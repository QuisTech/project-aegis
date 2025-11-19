// components/OverviewDashboard.js
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import StatCard from './StatCard';
import EventCreationPanel from './EventCreationPanel';
import SystemStatusPanel from './SystemStatusPanel';

const OverviewDashboard = ({ 
  dashboard, 
  events, 
  newEvent, 
  setNewEvent, 
  handleCreateEvent, 
  loading, 
  user, 
  ConfidenceStars 
}) => {
  return (
    <div className="overview-dashboard">
      {/* Real-time Alert Banner */}
      <div className="alert-banner warning">
        <div className="alert-icon">⚠️</div>
        <div className="alert-content">
          <strong>OPERATIONAL STATUS:</strong> All systems nominal - {dashboard.active_users || 1} active users
        </div>
        <div className="alert-time">Live</div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="stats-grid-enhanced">
        <StatCard 
          title="Total Events" 
          value={dashboard.total_events || 0}
          trend={{ value: 12, isPositive: true }}
          icon="📈"
          color="blue"
          subtitle="All time"
        />
        <StatCard 
          title="Active Threats" 
          value={dashboard.high_confidence_events || 0}
          trend={{ value: 3, isPositive: false }}
          icon="⚠️"
          color="red"
          subtitle="High confidence"
        />
        <StatCard 
          title="SIGINT Events" 
          value={dashboard.sigint_events || 0}
          trend={{ value: 5, isPositive: true }}
          icon="📡"
          color="purple"
          subtitle="Signal intelligence"
        />
        <StatCard 
          title="Drone Events" 
          value={dashboard.buas_events || 0}
          trend={{ value: 2, isPositive: false }}
          icon="🛸"
          color="orange"
          subtitle="UAS detection"
        />
        <StatCard 
          title="Recent Activity" 
          value={dashboard.recent_events || 0}
          trend={{ value: 8, isPositive: true }}
          icon="🕒"
          color="green"
          subtitle="Last hour"
        />
        <StatCard 
          title="Response Time" 
          value="1.2s"
          trend={{ value: 0.3, isPositive: true }}
          icon="⚡"
          color="teal"
          subtitle="Avg. processing"
        />
      </div>

      {/* Main Content Area */}
      <div className="dashboard-content-hybrid">
        {/* Left Panel - Controls & Actions */}
        <div className="control-panel-enhanced">
          {/* Quick Actions */}
          <div className="quick-actions card">
            <h3>🚀 Quick Actions</h3>
            <div className="action-buttons">
              <button 
                className="action-btn primary"
                onClick={() => document.querySelector('.event-creation-panel').scrollIntoView({ behavior: 'smooth' })}
              >
                New Intelligence Event
              </button>
              <button className="action-btn secondary">Generate Report</button>
              <button className="action-btn secondary">Advanced Search</button>
            </div>
          </div>

          {/* Event Creation Panel */}
          <EventCreationPanel 
            newEvent={newEvent}
            setNewEvent={setNewEvent}
            handleCreateEvent={handleCreateEvent}
            loading={loading}
            user={user}
          />

          {/* System Status */}
          <SystemStatusPanel />
        </div>

        {/* Right Panel - Map & Visualization */}
        <div className="visualization-panel">
          {/* Map Container */}
          <div className="map-panel-enhanced card">
            <div className="card-header">
              <h3>🌍 Live Intelligence Map</h3>
              <div className="map-stats">
                <span className="map-stat">{events.length} active markers</span>
                <span className="map-stat">{dashboard.recent_events || 0} recent</span>
              </div>
            </div>
            
            <MapContainer 
              center={[9.0820, 8.6753]} 
              zoom={6} 
              style={{ height: '400px', width: '100%' }}
              className="intelligence-map"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              
              {/* Event Markers */}
              {events.map(event => (
                <Marker 
                  key={event.id} 
                  position={[event.latitude, event.longitude]}
                  className={`event-marker ${event.event_type.toLowerCase()} confidence-${event.confidence}`}
                >
                  <Popup className="intelligence-popup">
                    <div className="popup-content-enhanced">
                      <div className={`event-type-badge ${event.event_type}`}>
                        {event.event_type} EVENT
                        <ConfidenceStars level={event.confidence} />
                      </div>
                      <h4>{event.description}</h4>
                      <div className="popup-details">
                        <p>📍 <strong>Location:</strong> {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</p>
                        <p>🆔 <strong>Source:</strong> {event.source_id}</p>
                        <p>👤 <strong>Analyst:</strong> {event.created_by_username}</p>
                        <p>🕒 <strong>Time:</strong> {new Date(event.created_at).toLocaleString()}</p>
                      </div>
                      <div className="popup-actions">
                        <button className="btn-small primary">View Details</button>
                        <button className="btn-small secondary">Add Comment</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Recent Activity Feed */}
          <div className="activity-feed card">
            <h3>📋 Recent Activity</h3>
            <div className="feed-items">
              {events.slice(0, 5).map(event => (
                <div key={event.id} className="feed-item">
                  <div className="feed-icon">
                    {event.event_type === 'SIGINT' ? '📡' : '🛸'}
                  </div>
                  <div className="feed-content">
                    <div className="feed-title">{event.description}</div>
                    <div className="feed-meta">
                      {event.created_by_username} • {new Date(event.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className={`confidence-badge level-${event.confidence}`}>
                    {event.confidence}/3
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;