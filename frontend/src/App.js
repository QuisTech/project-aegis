import React, { useState, useEffect, useCallback } from 'react';
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

  // Wrap load functions in useCallback to stabilize dependencies
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
  }, [loadAllData]); // Fixed: Added loadAllData to dependencies

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
      
      alert('✅ Intelligence event submitted successfully!');
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('❌ Failed to submit intelligence event: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const ConfidenceStars = ({ level }) => {
    return (
      <span className="confidence-stars">
        {'★'.repeat(level)}{'☆'.repeat(3 - level)}
      </span>
    );
  };

  // Removed unused getEventColor function to fix the second warning

  // Show login if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      {/* Enhanced Header with User Info */}
      <header className="app-header">
  <div className="header-content">
    {/* Top Row - Branding and User Controls */}
    <div className="header-top-row">
      <div className="header-branding">
        <div className="app-title">
          <span className="app-icon">🛰️</span>
          <h1>FUSION CORE</h1>
          <span className="app-subtitle">Intelligence Dashboard</span>
        </div>
        <div className="user-welcome">
          Welcome back, <strong>{user.full_name || user.username}</strong>
          <span className="user-role">({user.role})</span>
        </div>
      </div>
      
      <div className="header-actions">
        <button 
          onClick={handleLogout}
          className="logout-btn"
          title="Logout"
        >
          <span className="logout-icon">⎋</span>
          {/* Alternatively: ↗ or ⬆ or 🚪 */}
        </button>
      </div>
    </div>

    {/* Stats Row */}
    <div className="dashboard-stats">
      <div className="stat">
        <span className="stat-value">{dashboard.total_events || 4521}</span>
        <span className="stat-label">Total Events</span>
      </div>
      <div className="stat">
        <span className="stat-value">{dashboard.sigint_events || 1187}</span>
        <span className="stat-label">SIGINT Events</span>
      </div>
      <div className="stat">
        <span className="stat-value">{dashboard.buas_events || 364}</span>
        <span className="stat-label">Drone Events</span>
      </div>
      <div className="stat">
        <span className="stat-value">{dashboard.recent_events || 49}</span>
        <span className="stat-label">Last Hour</span>
      </div>
      <div className="stat">
        <span className="stat-value">{dashboard.active_users || 12}</span>
        <span className="stat-label">Active Users</span>
      </div>
    </div>
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

          {/* User Info Card */}
          <div className="card">
            <h3>👤 User Information</h3>
            <div style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <p><strong>Username:</strong> {user.username}</p>
              <p><strong>Role:</strong> <span style={{ 
                color: user.role === 'admin' ? '#e6116d' : 
                       user.role === 'supervisor' ? '#0f9ed6' : '#196b23',
                fontWeight: 'bold'
              }}>{user.role.toUpperCase()}</span></p>
              <p><strong>Permissions:</strong> { 
                user.role === 'admin' ? 'Full System Access' :
                user.role === 'supervisor' ? 'Event Management + User Oversight' :
                'Event Creation + Basic Viewing'
              }</p>
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
                    <p>👤 <strong>Created by:</strong> {event.created_by_username}</p>
                    <p>🕒 <strong>Time:</strong> {new Date(event.created_at).toLocaleString()}</p>
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