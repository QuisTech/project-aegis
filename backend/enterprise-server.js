const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.'
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// Database
// Updated code for Render
const dbPath = process.env.DB_PATH || '/tmp/aegis_enterprise.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Failed to open database:', err);
  else console.log('✅ SQLite DB opened at', dbPath);
});


db.serialize(() => {
  // Existing table creation code
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('analyst', 'supervisor', 'admin')),
    full_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ... all other table creations here ...

  // Ensure default admin exists after tables are created
  const defaultUsername = 'admin';
  const defaultEmail = 'admin@fusioncore.gov';
  const defaultPasswordHash = bcrypt.hashSync('admin123', 12);
  const defaultFullName = 'System Administrator';
  const defaultRole = 'admin';

  db.get(`SELECT id FROM users WHERE username = ?`, [defaultUsername], (err, row) => {
    if (err) {
      console.error('Failed to query users table for default admin:', err);
      return;
    }

    if (!row) {
      db.run(`INSERT INTO users (username, email, password_hash, role, full_name)
              VALUES (?, ?, ?, ?, ?)`,
              [defaultUsername, defaultEmail, defaultPasswordHash, defaultRole, defaultFullName],
              (err) => {
                if (err) console.error('Failed to create default admin:', err);
                else console.log('✅ Default admin user created for this deployment.');
              });
    } else {
      console.log('✅ Default admin already exists.');
    }
  });
});


// Audit logging (allow null userId)
const logAudit = (userId, actionType, resourceType, resourceId, description, req = null) => {
  const ip = req ? req.ip : 'unknown';
  const userAgent = req ? req.get('User-Agent') : 'unknown';
  
  db.run(`INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, description, ip_address, user_agent) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId || null, actionType, resourceType, resourceId, description, ip, userAgent]);
};

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logAudit(null, 'UNAUTHENTICATED_ACCESS', 'API', null, 'Attempted access without token', req);
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logAudit(null, 'INVALID_TOKEN', 'API', null, 'Invalid JWT token provided', req);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Role check middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      logAudit(req.user.userId, 'UNAUTHORIZED_ACCESS', 'API', null, 
               `User ${req.user.username} attempted to access restricted endpoint`, req);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// --- AUTHENTICATION ENDPOINT ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Internal server error' });

    if (!user) {
      logAudit(null, 'FAILED_LOGIN', 'USER', null, `Failed login attempt for username: ${username}`, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      logAudit(user.id, 'FAILED_LOGIN', 'USER', null, `Failed login attempt for user: ${user.username}`, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logAudit(user.id, 'LOGIN', 'USER', user.id, `User ${user.username} logged in successfully`, req);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name
      }
    });
  });
});

// --- USER MANAGEMENT ENDPOINTS ---
app.get('/api/users/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, role, full_name, created_at, last_login FROM users WHERE id = ?', 
         [req.user.userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ user });
  });
});

app.post('/api/users', authenticateToken, requireRole(['admin', 'supervisor']), async (req, res) => {
  const { username, email, password, role, full_name } = req.body;
  if (!username || !email || !password || !role || !full_name) return res.status(400).json({ error: 'All fields are required' });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    
    db.run(`INSERT INTO users (username, email, password_hash, role, full_name) 
            VALUES (?, ?, ?, ?, ?)`,
            [username, email, passwordHash, role, full_name], 
            function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) return res.status(400).json({ error: 'Username or email already exists' });
        return res.status(500).json({ error: 'Failed to create user' });
      }
      logAudit(req.user.userId, 'CREATE_USER', 'USER', this.lastID, `Created user: ${username} with role: ${role}`, req);
      res.status(201).json({ message: 'User created successfully', user_id: this.lastID });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- EVENT ENDPOINTS ---
app.post('/api/events', authenticateToken, (req, res) => {
  const { event_type, description, latitude, longitude, source_id, confidence, priority, classification } = req.body;
  if (!event_type || !description || latitude === undefined || longitude === undefined) 
    return res.status(400).json({ error: 'Missing required fields' });

  db.run(`INSERT INTO events (event_type, description, latitude, longitude, source_id, confidence, priority, classification, created_by) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [event_type, description, latitude, longitude, source_id, confidence || 1, priority || 1, classification || 'UNCLASSIFIED', req.user.userId],
          function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create event' });

    const newEvent = {
      id: this.lastID, event_type, description, latitude, longitude, source_id,
      confidence: confidence || 1, priority: priority || 1,
      classification: classification || 'UNCLASSIFIED', created_by: req.user.userId,
      timestamp: new Date().toISOString()
    };

    logAudit(req.user.userId, 'CREATE_EVENT', 'EVENT', this.lastID, `Created ${event_type} event: ${description.substring(0,50)}...`, req);
    res.json(newEvent);
  });
});

app.get('/api/events', authenticateToken, (req, res) => {
  const { type, hours, confidence, limit, classification } = req.query;
  let query = `SELECT e.*, u.username as created_by_username FROM events e JOIN users u ON e.created_by = u.id WHERE 1=1`;
  const params = [];

  if (type) { query += ' AND e.event_type=?'; params.push(type); }
  if (hours) { query += ' AND e.created_at >= datetime("now", ?)'; params.push(`-${hours} hours`); }
  if (confidence) { query += ' AND e.confidence >= ?'; params.push(confidence); }
  if (classification && req.user.role !== 'analyst') { query += ' AND e.classification=?'; params.push(classification); }

  query += ' ORDER BY e.created_at DESC';
  if (limit) { query += ' LIMIT ?'; params.push(limit); }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    logAudit(req.user.userId, 'VIEW_EVENTS', 'EVENT', null, `Viewed events list with ${rows.length} results`, req);
    res.json(rows);
  });
});

// --- AUDIT LOGS (admin only) ---
app.get('/api/audit-logs', authenticateToken, requireRole(['admin']), (req, res) => {
  const { days, user_id, action_type } = req.query;
  let query = `SELECT al.*, u.username FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1`;
  const params = [];
  if (days) { query += ' AND al.created_at >= datetime("now", ?)'; params.push(`-${days} days`); }
  if (user_id) { query += ' AND al.user_id=?'; params.push(user_id); }
  if (action_type) { query += ' AND al.action_type=?'; params.push(action_type); }
  query += ' ORDER BY al.created_at DESC LIMIT 1000';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- DASHBOARD ---
app.get('/api/dashboard', authenticateToken, (req, res) => {
  db.all(`
    SELECT 
      (SELECT COUNT(*) FROM events) as total_events,
      (SELECT COUNT(*) FROM events WHERE event_type='SIGINT') as sigint_events,
      (SELECT COUNT(*) FROM events WHERE event_type='BUAS') as buas_events,
      (SELECT COUNT(*) FROM events WHERE datetime(created_at) >= datetime('now','-1 hour')) as recent_events,
      (SELECT COUNT(*) FROM users WHERE is_active=1) as active_users,
      (SELECT COUNT(*) FROM audit_logs WHERE datetime(created_at) >= datetime('now','-24 hours')) as daily_audits,
      (SELECT COUNT(*) FROM events WHERE confidence>=4) as high_confidence_events
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows[0]);
  });
});

// --- HEALTH ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Fusion Core Enterprise API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    security: 'JWT Authentication Enabled'
  });
});

// --- START SERVER ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log('🔐 FUSION CORE ENTERPRISE running on port', PORT);
  console.log('🎯 JWT Authentication: ENABLED');
  console.log('📊 Role-Based Access Control: ACTIVE');
  console.log('📝 Audit Logging: ENABLED');
  console.log('🚀 Rate Limiting: ACTIVE');
  console.log('💂 Security Headers: ENABLED\n');
  console.log('🔑 Default Admin Credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123\n');
  console.log('📋 Available Roles: analyst, supervisor, admin');
});
