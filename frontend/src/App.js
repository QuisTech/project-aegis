import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { api } from './services/api';
import { authService } from './services/auth';
import Login from './components/Login';
import OverviewDashboard from './components/OverviewDashboard';
import ThreatIntelligenceDashboard from './components/ThreatIntelligenceDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
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
  const [activeTab, setActiveTab] = useState('overview');
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

  // Render active tab content
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewDashboard 
            dashboard={dashboard} 
            events={events}
            newEvent={newEvent}
            setNewEvent={setNewEvent}
            handleCreateEvent={handleCreateEvent}
            loading={loading}
            user={user}
            ConfidenceStars={ConfidenceStars}
          />
        );
      case 'threats':
        return <ThreatIntelligenceDashboard events={events} dashboard={dashboard} />;
      case 'analytics':
        return <AnalyticsDashboard events={events} dashboard={dashboard} />;
      default:
        return (
          <OverviewDashboard 
            dashboard={dashboard} 
            events={events}
            newEvent={newEvent}
            setNewEvent={setNewEvent}
            handleCreateEvent={handleCreateEvent}
            loading={loading}
            user={user}
            ConfidenceStars={ConfidenceStars}
          />
        );
    }
  };

  // Show login if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      {/* Enhanced Header with Tabs */}
      <header className="app-header">
        <div className="header-main">
          <div className="header-brand">
            <div className="brand-icon">🛰️</div>
            <div className="brand-text">
              <h1>FUSION CORE - Intelligence Command Center</h1>
              <div className="system-status">
                <span className="status-indicator online"></span>
                <span>System Status: OPERATIONAL</span>
              </div>
            </div>
          </div>
          
          <div className="header-controls">
            <div className="user-info">
              <div className="user-avatar">👤</div>
              <div className="user-details">
                <span className="user-name">Welcome, {user.full_name || user.username}</span>
                <span className="user-role">{user.role.toUpperCase()}</span>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="dashboard-nav">
          <button 
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">Overview</span>
          </button>
          
          <button 
            className={`nav-tab ${activeTab === 'threats' ? 'active' : ''}`}
            onClick={() => setActiveTab('threats')}
          >
            <span className="tab-icon">⚠️</span>
            <span className="tab-label">Threat Intelligence</span>
          </button>
          
          <button 
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <span className="tab-icon">📈</span>
            <span className="tab-label">Analytics</span>
          </button>
        </nav>
      </header>

      {/* Main Dashboard Content */}
      <div className="dashboard-container">
        {renderActiveTab()}
      </div>
    </div>
  );
}

export default App;