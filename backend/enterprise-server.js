// backend/enterprise-server.js
'use strict';

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();

// Security middleware
app.use(helmet());

// CORS allow list - update/or add your production URLs here
const allowedOrigins = [
  'https://project-aegis-alpha.vercel.app',
  'https://project-aegis.netlify.app',
  'https://project-aegis-btw0.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow curl/postman
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// Environment / secrets
const DATABASE_URL = process.env.DATABASE_URL; // must be set in Render/Vercel
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Warn if secrets not set (still run with fallback but you should set them)
if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is not set. The app will not connect to Postgres until set.');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set. Tokens will be ephemeral across restarts. Set JWT_SECRET in your env.');
}

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: 'Too many authentication attempts, please try again later.'
});
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min
  max: 100,
  message: 'Too many requests, please try again later.'
});

app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// Postgres pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create tables (idempotent)
async function createTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('analyst','supervisor','admin')),
        full_name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        last_login TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // events
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL CHECK(event_type IN ('SIGINT','BUAS','HUMINT','OSINT')),
        description TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        source_id TEXT NOT NULL,
        confidence INTEGER DEFAULT 1 CHECK(confidence BETWEEN 1 AND 5),
        priority INTEGER DEFAULT 1 CHECK(priority BETWEEN 1 AND 3),
        status TEXT DEFAULT 'active' CHECK(status IN ('active','investigating','resolved','false_positive')),
        created_by INTEGER NOT NULL REFERENCES users(id),
        assigned_to INTEGER REFERENCES users(id),
        analyst_notes TEXT,
        classification TEXT DEFAULT 'UNCLASSIFIED' CHECK(classification IN ('UNCLASSIFIED','CONFIDENTIAL','SECRET','TOP_SECRET')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // audit_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action_type TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id INTEGER,
        description TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // incidents
    await client.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        severity INTEGER DEFAULT 1 CHECK(severity BETWEEN 1 AND 5),
        status TEXT DEFAULT 'open' CHECK(status IN ('open','investigating','resolved','closed')),
        assigned_analyst INTEGER REFERENCES users(id),
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        resolved_at TIMESTAMP WITH TIME ZONE
      );
    `);

    // event_correlations
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_correlations (
        correlation_id SERIAL PRIMARY KEY,
        event1_id INTEGER NOT NULL REFERENCES events(id),
        event2_id INTEGER NOT NULL REFERENCES events(id),
        correlation_type TEXT NOT NULL,
        confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
        correlation_vectors JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        UNIQUE (event1_id, event2_id)
      );
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_location ON events USING gist (point(latitude, longitude));`).catch(()=>{});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(created_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(created_at);`);

    await client.query('COMMIT');
    console.log('✅ Postgres tables ensured');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Ensure default admin exists
async function ensureDefaultAdmin() {
  const defaultUsername = 'admin';
  const defaultEmail = 'admin@fusioncore.gov';
  const defaultPassword = 'admin123';
  const defaultFullName = 'System Administrator';
  const defaultRole = 'admin';

  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [defaultUsername]);
  if (rows.length === 0) {
    const hash = bcrypt.hashSync(defaultPassword, 12);
    await pool.query(
      `INSERT INTO users (username, email, password_hash, role, full_name) VALUES ($1,$2,$3,$4,$5)`,
      [defaultUsername, defaultEmail, hash, defaultRole, defaultFullName]
    );
    console.log('✅ Default admin created');
  } else {
    console.log('✅ Default admin already exists');
  }
}

// initialize DB
(async () => {
  if (!DATABASE_URL) {
    console.error('✖ DATABASE_URL not provided. Exiting.');
    // don't exit if you want to allow running with limited functionality — for safety we exit
    process.exit(1);
  }
  try {
    await createTables();
    await ensureDefaultAdmin();
  } catch (err) {
    console.error('Initialization error:', err);
    process.exit(1);
  }
})();

// Utility: log audit (userId nullable)
async function logAudit(userId, actionType, resourceType, resourceId, description, req = null) {
  try {
    const ip = req ? (req.ip || req.headers['x-forwarded-for'] || 'unknown') : 'unknown';
    const userAgent = req ? req.get('User-Agent') : 'unknown';
    await pool.query(
      `INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, description, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId || null, actionType, resourceType, resourceId, description, ip, userAgent]
    );
  } catch (err) {
    console.warn('⚠️ audit log failed:', err.message);
  }
}

// AUTH middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    logAudit(null, 'UNAUTHENTICATED_ACCESS', 'API', null, 'Attempted access without token', req).catch(()=>{});
    return res.status(401).json({ error: 'Access token required' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      logAudit(null, 'INVALID_TOKEN', 'API', null, 'Invalid JWT token provided', req).catch(()=>{});
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    // Put normalized user object on req
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      email: decoded.email
    };
    next();
  });
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      logAudit(req.user.userId, 'UNAUTHORIZED_ACCESS', 'API', null, `User ${req.user.username} attempted to access restricted endpoint`, req).catch(()=>{});
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// ROUTES

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('🔐 Login attempt for', username);
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username=$1 AND is_active=true', [username]);
    if (rows.length === 0) {
      await logAudit(null, 'FAILED_LOGIN', 'USER', null, `Failed login attempt for username: ${username}`, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await logAudit(user.id, 'FAILED_LOGIN', 'USER', null, `Failed login attempt for user: ${user.username}`, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // update last_login
    await pool.query('UPDATE users SET last_login = now() WHERE id=$1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logAudit(user.id, 'LOGIN', 'USER', user.id, `User ${user.username} logged in successfully`, req);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, username, email, role, full_name, created_at, last_login FROM users WHERE id=$1', [req.user.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create user (admin/supervisor)
app.post('/api/users', authenticateToken, requireRole(['admin','supervisor']), async (req, res) => {
  const { username, email, password, role, full_name } = req.body;
  if (!username || !email || !password || !role || !full_name) return res.status(400).json({ error: 'All fields are required' });

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, full_name) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [username, email, password_hash, role, full_name]
    );
    await logAudit(req.user.userId, 'CREATE_USER', 'USER', rows[0].id, `Created user: ${username} with role: ${role}`, req);
    res.status(201).json({ message: 'User created successfully', user_id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Create event
app.post('/api/events', authenticateToken, async (req, res) => {
  const { event_type, description, latitude, longitude, source_id, confidence, priority, classification } = req.body;
  if (!event_type || !description || latitude === undefined || longitude === undefined) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO events (event_type, description, latitude, longitude, source_id, confidence, priority, classification, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, created_at`,
      [event_type, description, latitude, longitude, source_id, confidence || 1, priority || 1, classification || 'UNCLASSIFIED', req.user.userId]
    );

    const newEvent = {
      id: rows[0].id,
      event_type, description, latitude, longitude, source_id,
      confidence: confidence || 1, priority: priority || 1, classification: classification || 'UNCLASSIFIED',
      created_by: req.user.userId,
      timestamp: rows[0].created_at
    };

    await logAudit(req.user.userId, 'CREATE_EVENT', 'EVENT', newEvent.id, `Created ${event_type} event: ${description.substring(0,50)}...`, req);
    res.json(newEvent);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get events with filters
app.get('/api/events', authenticateToken, async (req, res) => {
  try {
    const { type, hours, confidence, limit, classification } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    let query = `SELECT e.*, u.username as created_by_username FROM events e JOIN users u ON e.created_by = u.id WHERE 1=1`;

    if (type) { conditions.push(`e.event_type = $${idx++}`); params.push(type); }
    if (hours) { conditions.push(`e.created_at >= now() - interval '${parseInt(hours,10)} hours'`); /* interval inline */ }
    if (confidence) { conditions.push(`e.confidence >= $${idx++}`); params.push(confidence); }
    if (classification && req.user.role !== 'analyst') { conditions.push(`e.classification = $${idx++}`); params.push(classification); }

    if (conditions.length) query += ' AND ' + conditions.join(' AND ');

    query += ' ORDER BY e.created_at DESC';

    if (limit) {
      query += ` LIMIT $${idx++}`;
      params.push(parseInt(limit,10));
    }

    const { rows } = await pool.query(query, params);
    await logAudit(req.user.userId, 'VIEW_EVENTS', 'EVENT', null, `Viewed events list with ${rows.length} results`, req);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Audit logs (admin only)
app.get('/api/audit-logs', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { days, user_id, action_type } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    let query = `SELECT al.*, u.username FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1`;

    if (days) { conditions.push(`al.created_at >= now() - interval '${parseInt(days,10)} days'`); }
    if (user_id) { conditions.push(`al.user_id = $${idx++}`); params.push(user_id); }
    if (action_type) { conditions.push(`al.action_type = $${idx++}`); params.push(action_type); }

    if (conditions.length) query += ' AND ' + conditions.join(' AND ');
    query += ' ORDER BY al.created_at DESC LIMIT 1000';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM events) as total_events,
        (SELECT COUNT(*) FROM event_correlations) as total_correlations,
        (SELECT COUNT(*) FROM events WHERE event_type = 'SIGINT') as sigint_events,
        (SELECT COUNT(*) FROM events WHERE event_type = 'BUAS') as buas_events,
        (SELECT COUNT(*) FROM events WHERE created_at >= now() - interval '1 hour') as recent_events,
        (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
        (SELECT COUNT(*) FROM audit_logs WHERE created_at >= now() - interval '24 hours') as daily_audits,
        (SELECT COUNT(*) FROM events WHERE confidence >= 4) as high_confidence_events
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Fusion Core Enterprise API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    security: 'JWT Authentication Enabled'
  });
});

// Start
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log('🔐 FUSION CORE ENTERPRISE running on port', PORT);
  console.log('🔁 Using DATABASE_URL:', DATABASE_URL ? 'provided' : 'NOT_PROVIDED');
  console.log('🎯 JWT Authentication: ENABLED');
  console.log('📋 Available Roles: analyst, supervisor, admin');
});
