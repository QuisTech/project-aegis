cat > frontend/src/App.js << 'EOF'
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { api } from './services/api';
import { authService } from './services/auth';
import Login from './components/Login';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix for default markers
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';

let DefaultIcon = L.divIcon({
  html: `<img src="${icon}" style="width: 25px; height: 41px;" />`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

function Dashboard({ user, events, dashboard, newEvent, loading, onCreateEvent, onLogout, onEventChange, loadAllData }) {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🛡️ FUSION CORE DASHBOARD</h1>
        <div style={styles.userInfo}>
          <span>Welcome, {user?.username} ({user?.role})</span>
          <button onClick={onLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <h3>Total Events</h3>
          <p style={styles.statNumber}>{dashboard.total_events || 0}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Recent Events</h3>
          <p style={styles.statNumber}>{dashboard.recent_events || 0}</p>
        </div>
        <div style={styles.statCard}>
          <h3>SIGINT Events</h3>
          <p style={styles.statNumber}>{dashboard.sigint_events || 0}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Active Users</h3>
          <p style={styles.statNumber}>{dashboard.active_users || 0}</p>
        </div>
      </div>

      <div style={styles.mainContent}>
        <div style={styles.mapSection}>
          <h3>Event Map</h3>
          <div style={styles.mapContainer}>
            <MapContainer
              center={[9.0820, 8.6753]}
              zoom={6}
              style={{ height: '400px', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {events.map(event => (
                <Marker
                  key={event.id}
                  position={[event.latitude, event.longitude]}
                >
                  <Popup>
                    <div>
                      <strong>{event.event_type}</strong><br />
                      {event.description}<br />
                      Confidence: {event.confidence}/5
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div style={styles.sidebar}>
          <div style={styles.createEvent}>
            <h3>Create New Event</h3>
            <form onSubmit={onCreateEvent}>
              <select
                name="event_type"
                value={newEvent.event_type}
                onChange={onEventChange}
                style={styles.select}
              >
                <option value="SIGINT">SIGINT</option>
                <option value="BUAS">BUAS</option>
                <option value="HUMINT">HUMINT</option>
                <option value="OSINT">OSINT</option>
              </select>
              
              <textarea
                name="description"
                value={newEvent.description}
                onChange={onEventChange}
                placeholder="Event description"
                style={styles.textarea}
                required
              />
              
              <button
                type="submit"
                disabled={loading}
                style={styles.createButton}
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </form>
          </div>

          <div style={styles.eventsList}>
            <h3>Recent Events</h3>
            {events.slice(0, 5).map(event => (
              <div key={event.id} style={styles.eventItem}>
                <strong>{event.event_type}</strong>: {event.description}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [newEvent, setNewEvent] = useState({
    event_type: 'SIGINT',
    description: '',
    latitude: 9.0820,
    longitude: 8.6753,
    confidence: 3
  });
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await api.getDashboard();
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const response = await api.getEvents({ limit: 50 });
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    await loadDashboard();
    await loadEvents();
  }, [loadDashboard, loadEvents]);

  useEffect(() => {
    if (authService.isAuthenticated()) {
      setUser(authService.getUser());
      loadAllData();
    }
  }, [loadAllData]);

  const handleLogin = (userData) => {
    setUser(userData);
    loadAllData();
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setEvents([]);
    setDashboard({});
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const eventData = {
        ...newEvent,
        source_id: newEvent.event_type === 'SIGINT'
          ? 'SIG_' + Math.floor(10000 + Math.random() * 90000)
          : 'BUAS_' + Math.floor(1000 + Math.random() * 9000)
      };

      await api.createEvent(eventData);
      setNewEvent({
        event_type: 'SIGINT',
        description: '',
        latitude: 9.0 + (Math.random() - 0.5),
        longitude: 8.0 + (Math.random() - 0.5),
        confidence: 3
      });

      setTimeout(() => {
        loadAllData();
      }, 1000);
    } catch (error) {
      console.error('Failed to create event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventChange = (e) => {
    setNewEvent({
      ...newEvent,
      [e.target.name]: e.target.value
    });
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            user ? (
              <Dashboard 
                user={user}
                events={events}
                dashboard={dashboard}
                newEvent={newEvent}
                loading={loading}
                onCreateEvent={handleCreateEvent}
                onLogout={handleLogout}
                onEventChange={handleEventChange}
                loadAllData={loadAllData}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        <Route 
          path="/login" 
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f1419 0%, #1b1f28 100%)',
    color: '#ffffff'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #2d3748'
  },
  title: {
    background: 'linear-gradient(135deg, #e97132, #0f9ed6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontSize: '1.5em',
    fontWeight: 'bold'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  logoutButton: {
    padding: '8px 16px',
    background: '#e53e3e',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    padding: '20px'
  },
  statCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #2d3748',
    textAlign: 'center'
  },
  statNumber: {
    fontSize: '2em',
    fontWeight: 'bold',
    color: '#e97132',
    margin: '10px 0 0 0'
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '20px',
    padding: '20px'
  },
  mapSection: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #2d3748'
  },
  mapContainer: {
    borderRadius: '8px',
    overflow: 'hidden'
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  createEvent: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #2d3748'
  },
  select: {
    width: '100%',
    padding: '10px',
    marginBottom: '10px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid #475569',
    borderRadius: '6px',
    color: 'white'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    marginBottom: '10px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid #475569',
    borderRadius: '6px',
    color: 'white',
    minHeight: '80px',
    resize: 'vertical'
  },
  createButton: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #e97132, #e6116d)',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  eventsList: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #2d3748',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  eventItem: {
    padding: '10px',
    marginBottom: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
    border: '1px solid #475569'
  }
};

export default App;
EOF