import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
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

function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [correlations, setCorrelations] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [newEvent, setNewEvent] = useState({
    event_type: 'SIGINT',
    description: '',
    latitude: 9.0820,
    longitude: 8.6753,
    confidence: 3
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    if (authService.isAuthenticated()) {
      setUser(authService.getUser());
      loadAllData();
      
      const interval = setInterval(loadAllData, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  const loadAllData = async () => {
    await loadDashboard();
    await loadEvents();
    await loadCorrelations();
  };

  const loadDashboard = async () => {
    try {
      const response = await api.getDashboard();
      setDashboard(response);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const eventsData = await api.getEvents();
      setEvents(eventsData.events || []);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const loadCorrelations = async () => {
    try {
      const response = await api.getCorrelations();
      setCorrelations(response.correlations || []);
    } catch (error) {
      console.error('Failed to load correlations:', error);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    loadAllData();
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setEvents([]);
    setCorrelations([]);
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
      
      setTimeout(loadAllData, 1000);
      alert('🚀 Intelligence event submitted! Correlation engine analyzing...');
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('❌ Failed to submit intelligence event');
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (eventType) => {
    return eventType === 'SIGINT' ? '#a02b93' : '#006ebe';
  };

  const getCorrelationLines = () => {
    return correlations.map(corr => {
      const event1 = events.find(e => e.id === corr.event1_id);
      const event2 = events.find(e => e.id === corr.event2_id);
      
      if (event1 && event2) {
        return {
          positions: [
            [event1.latitude, event1.longitude],
            [event2.latitude, event2.longitude]
          ],
          confidence: corr.confidence
        };
      }
      return null;
    }).filter(Boolean);
  };

  const ConfidenceStars = ({ level }) => {
    return (
      <span className="confidence-stars">
        {'★'.repeat(level)}{'☆'.repeat(3 - level)}
      </span>
    );
  };

  // Show login screen if no user
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      {/* Enhanced Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>🛰️ FUSION CORE - Intelligence Dashboard</h1>
          <div className="subtitle">Real-time Signal Intelligence & Surveillance Coordination</div>
          
          <div className="dashboard-stats">
            <div className="stat">
              <span className="stat-value">{dashboard.total_events || 0}</span>
              <span className="stat-label">Total Events</span>
            </div>
            <div className="stat">
              <span className="stat-value">{dashboard.total_correlations || 0}</span>
              <span className="stat-label">Correlations</span>
            </div>
            <div className="stat">
              <span className="stat-value">{dashboard.sigint_events || 0}</span>
              <span className="stat-label">SIGINT Events</span>
            </div>
            <div className="stat">
              <span className="stat-value">{dashboard.buas_events || 0}</span>
              <span className="stat-label">Drone Events</span>
            </div>
            <div className="stat">
              <span className="stat-value">{dashboard.recent_events || 0}</span>
              <span className="stat-label">Last Hour</span>
            </div>
          </div>
        </div>
        
        <div className="user-info">
          <span>Welcome, {user.username} ({user.role})</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboard">
        {/* Control Panel */}
        <div className="control-panel">
          {/* Event Creation Card */}
          <div className="card">
            <h3>🎯 Submit Intelligence</h3>
            <form onSubmit={handleCreateEvent}>
              <div className="form-group">
                <label>Event Type</label>
                <select 
                  value={newEvent.event_type} 
                  onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value})}
                >
                  <option value="SIGINT">📡 SIGINT - Signal Intercept</option>
                  <option value="BUAS">🛸 BUAS - Drone Surveillance</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Event Description</label>
                <textarea 
                  placeholder="Describe the intelligence event, target, or observation..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  required
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label>Confidence Level</label>
                <select 
                  value={newEvent.confidence}
                  onChange={(e) => setNewEvent({...newEvent, confidence: parseInt(e.target.value)})}
                >
                  <option value="1">Low Confidence (1)</option>
                  <option value="2">Medium Confidence (2)</option>
                  <option value="3">High Confidence (3)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Geographic Coordinates</label>
                <div className="coords-input">
                  <input 
                    type="number" 
                    step="any"
                    placeholder="Latitude"
                    value={newEvent.latitude}
                    onChange={(e) => setNewEvent({...newEvent, latitude: parseFloat(e.target.value)})}
                  />
                  <input 
                    type="number" 
                    step="any"
                    placeholder="Longitude"
                    value={newEvent.longitude}
                    onChange={(e) => setNewEvent({...newEvent, longitude: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              
              <button type="submit" disabled={loading}>
                {loading ? '🔄 Submitting...' : '🚀 Submit Intelligence'}
              </button>
            </form>
          </div>

          {/* Active Correlations Card */}
          <div className="card">
            <h3>🔗 Intelligence Correlations ({correlations.length})</h3>
            <div className="correlations-list">
              {correlations.slice(0, 6).map(corr => (
                <div key={`${corr.event1_id}-${corr.event2_id}`} className="correlation-item">
                  <div className="correlation-header">
                    <span className="correlation-type">{corr.correlation_type}</span>
                    <span className="correlation-confidence">
                      {Math.round(corr.confidence * 100)}% match
                    </span>
                  </div>
                  <div className="correlation-details">
                    <div>📡 {corr.event1_desc}</div>
                    <div>🛸 {corr.event2_desc}</div>
                  </div>
                </div>
              ))}
              {correlations.length === 0 && (
                <div style={{textAlign: 'center', color: '#718096', padding: '20px'}}>
                  No correlations detected yet. Submit events to see intelligence patterns.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map Panel */}
        <div className="map-panel">
          <MapContainer 
            center={[9.0820, 8.6753]} 
            zoom={6} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* Correlation Lines */}
            {getCorrelationLines().map((line, index) => (
              <Polyline
                key={index}
                positions={line.positions}
                color={line.confidence > 0.7 ? '#e6116d' : '#e97132'}
                weight={line.confidence > 0.7 ? 4 : 2}
                opacity={0.7}
              />
            ))}
            
            {/* Event Markers */}
            {events.map(event => (
              <Marker key={event.id} position={[event.latitude, event.longitude]}>
                <Popup>
                  <div className="popup-content">
                    <div className={`event-type-badge ${event.event_type}`}>
                      {event.event_type} EVENT
                    </div>
                    <h4>{event.description}</h4>
                    <p>📍 <strong>Location:</strong> {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</p>
                    <p>🆔 <strong>Source:</strong> {event.source_id}</p>
                    <p>🎯 <strong>Confidence:</strong> <ConfidenceStars level={event.confidence} /></p>
                    <p>🕒 <strong>Time:</strong> {new Date(event.timestamp).toLocaleString()}</p>
                    {event.correlation_count > 0 && (
                      <p>🔗 <strong>Correlations:</strong> {event.correlation_count} connections</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default App;