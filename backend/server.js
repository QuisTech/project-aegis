// backend/server.js - INDUSTRIAL GRADE
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

// Enhanced database with proper indexing
const db = new sqlite3.Database('./aegis.db');

// Industrial-grade table structure
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    source_id TEXT NOT NULL,
    confidence INTEGER DEFAULT 1 CHECK(confidence BETWEEN 1 AND 5),
    priority INTEGER DEFAULT 1 CHECK(priority BETWEEN 1 AND 3),
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'false_positive')),
    analyst_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    severity INTEGER DEFAULT 1 CHECK(severity BETWEEN 1 AND 5),
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'resolved')),
    assigned_analyst TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS event_correlations (
    correlation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event1_id INTEGER NOT NULL,
    event2_id INTEGER NOT NULL,
    correlation_type TEXT NOT NULL,
    confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
    correlation_vectors TEXT, -- JSON storing correlation metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event1_id) REFERENCES events(id),
    FOREIGN KEY (event2_id) REFERENCES events(id),
    UNIQUE(event1_id, event2_id)
  )`);

  // Indexes for performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_location ON events(latitude, longitude)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)`);
});

// Advanced Correlation Engine
class IntelligenceCorrelationEngine {
  static analyzeEventCorrelations(newEvent, existingEvents) {
    const correlations = [];
    const now = new Date(newEvent.timestamp || new Date());
    
    existingEvents.forEach(existingEvent => {
      if (existingEvent.id === newEvent.id) return;
      
      const correlationScore = this.calculateCorrelationScore(newEvent, existingEvent, now);
      
      if (correlationScore.total > 0.3) { // Threshold for meaningful correlation
        correlations.push({
          event1_id: Math.min(newEvent.id, existingEvent.id),
          event2_id: Math.max(newEvent.id, existingEvent.id),
          correlation_type: this.determineCorrelationType(correlationScore),
          confidence: correlationScore.total,
          correlation_vectors: JSON.stringify(correlationScore)
        });
      }
    });
    
    return correlations;
  }

  static calculateCorrelationScore(event1, event2, currentTime) {
    const timeDiff = Math.abs(new Date(event1.timestamp || currentTime) - new Date(event2.timestamp || currentTime));
    const locationDiff = this.calculateDistance(event1.latitude, event1.longitude, event2.latitude, event2.longitude);
    
    return {
      temporal: this.normalizeTemporalProximity(timeDiff),
      spatial: this.normalizeSpatialProximity(locationDiff),
      semantic: this.calculateSemanticSimilarity(event1, event2),
      behavioral: this.analyzeBehavioralPatterns(event1, event2),
      total: 0 // Calculated below
    };
  }

  static normalizeTemporalProximity(timeDiffMs) {
    // Events within 15 minutes are highly correlated
    const fifteenMinutes = 15 * 60 * 1000;
    return Math.max(0, 1 - (timeDiffMs / fifteenMinutes));
  }

  static normalizeSpatialProximity(distanceKm) {
    // Events within 10km are highly correlated
    return Math.max(0, 1 - (distanceKm / 10));
  }

  static calculateSemanticSimilarity(event1, event2) {
    // Simple keyword-based similarity
    const keywords1 = event1.description.toLowerCase().split(/\s+/);
    const keywords2 = event2.description.toLowerCase().split(/\s+/);
    const commonKeywords = keywords1.filter(kw => keywords2.includes(kw));
    return commonKeywords.length / Math.max(keywords1.length, keywords2.length);
  }

  static analyzeBehavioralPatterns(event1, event2) {
    // Pattern analysis based on event types and sources
    if (event1.event_type !== event2.event_type) return 0.6; // Cross-type correlations are valuable
    if (event1.source_id === event2.source_id) return 0.8; // Same source increases confidence
    return 0.4;
  }

  static determineCorrelationType(score) {
    if (score.temporal > 0.7 && score.spatial > 0.7) return 'spatiotemporal_high_confidence';
    if (score.temporal > 0.5 && score.spatial > 0.5) return 'spatiotemporal_medium_confidence';
    if (score.semantic > 0.6) return 'semantic_similarity';
    return 'behavioral_pattern';
  }

  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

// WebSocket for real-time updates
const wss = new WebSocket.Server({ port: 8080 });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcastUpdate(data) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// INDUSTRIAL API ENDPOINTS

// Create intelligence event with enhanced validation
app.post('/api/events', (req, res) => {
  const { event_type, description, latitude, longitude, source_id, confidence, priority } = req.body;
  
  // Validation
  if (!event_type || !description || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  db.run(
    `INSERT INTO events (event_type, description, latitude, longitude, source_id, confidence, priority) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [event_type, description, latitude, longitude, source_id, confidence || 1, priority || 1],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create event' });
      }
      
      const newEvent = {
        id: this.lastID,
        event_type,
        description,
        latitude,
        longitude,
        source_id,
        confidence: confidence || 1,
        priority: priority || 1,
        status: 'active',
        timestamp: new Date().toISOString()
      };

      // Real-time correlation analysis
      db.all("SELECT * FROM events WHERE id != ?", [this.lastID], (err, allEvents) => {
        if (!err && allEvents.length > 0) {
          const correlations = IntelligenceCorrelationEngine.analyzeEventCorrelations(newEvent, allEvents);
          
          correlations.forEach(corr => {
            db.run(
              `INSERT OR REPLACE INTO event_correlations 
               (event1_id, event2_id, correlation_type, confidence, correlation_vectors) 
               VALUES (?, ?, ?, ?, ?)`,
              [corr.event1_id, corr.event2_id, corr.correlation_type, corr.confidence, corr.correlation_vectors]
            );
          });
          
          console.log(`🔗 Created ${correlations.length} correlations for event ${this.lastID}`);
          
          // Broadcast real-time update
          if (correlations.length > 0) {
            broadcastUpdate({
              type: 'new_correlations',
              data: { event: newEvent, correlations }
            });
          }
        }
      });

      broadcastUpdate({ type: 'new_event', data: newEvent });
      res.json(newEvent);
    }
  );
});

// Get events with advanced filtering
app.get('/api/events', (req, res) => {
  const { type, hours, confidence, limit } = req.query;
  let query = `
    SELECT e.*, 
           COUNT(DISTINCT ec.correlation_id) as correlation_count,
           GROUP_CONCAT(DISTINCT ec.correlation_type) as correlation_types
    FROM events e
    LEFT JOIN event_correlations ec ON e.id = ec.event1_id OR e.id = ec.event2_id
  `;
  const params = [];
  const conditions = [];

  if (type) {
    conditions.push('e.event_type = ?');
    params.push(type);
  }
  if (hours) {
    conditions.push('e.created_at >= datetime("now", ?)');
    params.push(`-${hours} hours`);
  }
  if (confidence) {
    conditions.push('e.confidence >= ?');
    params.push(confidence);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY e.id ORDER BY e.created_at DESC';

  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Enhanced dashboard with operational metrics
app.get('/api/dashboard', (req, res) => {
  db.all(`
    SELECT 
      (SELECT COUNT(*) FROM events) as total_events,
      (SELECT COUNT(*) FROM event_correlations) as total_correlations,
      (SELECT COUNT(*) FROM events WHERE event_type = 'SIGINT') as sigint_events,
      (SELECT COUNT(*) FROM events WHERE event_type = 'BUAS') as buas_events,
      (SELECT COUNT(*) FROM events WHERE datetime(created_at) >= datetime('now', '-1 hour')) as recent_events,
      (SELECT COUNT(*) FROM events WHERE confidence >= 4) as high_confidence_events,
      (SELECT COUNT(*) FROM events WHERE status = 'active') as active_events,
      (SELECT AVG(confidence) FROM events) as avg_confidence
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows[0]);
  });
});

// Threat assessment endpoint
app.get('/api/threat-assessment', (req, res) => {
  db.all(`
    SELECT 
      ec.correlation_type,
      COUNT(*) as count,
      AVG(ec.confidence) as avg_confidence,
      MAX(e.created_at) as latest_correlation
    FROM event_correlations ec
    JOIN events e ON ec.event1_id = e.id OR ec.event2_id = e.id
    WHERE ec.confidence > 0.7
    GROUP BY ec.correlation_type
    ORDER BY count DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('🚀 INDUSTRIAL FUSION CORE running on port', PORT);
  console.log('📡 WebSocket server on port 8080');
  console.log('🎯 Advanced correlation engine ACTIVE');
});