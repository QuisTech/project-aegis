import React from 'react';

const ThreatIntelligenceDashboard = () => {
  return (
    <div className="threat-dashboard">
      <div className="dashboard-header">
        <h2>⚠️ Threat Intelligence Center</h2>
        <p>Real-time threat monitoring and analysis</p>
      </div>
      
      <div className="threat-grid">
        <div className="threat-card critical">
          <div className="threat-header">
            <span className="threat-level">CRITICAL</span>
            <span className="threat-time">5 min ago</span>
          </div>
          <h4>Unauthorized Drone Activity</h4>
          <p>Multiple drone signals detected in restricted airspace</p>
          <div className="threat-metrics">
            <span className="metric">Confidence: 95%</span>
            <span className="metric">Priority: High</span>
          </div>
        </div>
        
        <div className="threat-card warning">
          <div className="threat-header">
            <span className="threat-level">WARNING</span>
            <span className="threat-time">15 min ago</span>
          </div>
          <h4>Suspicious Signal Pattern</h4>
          <p>Unusual communication patterns detected</p>
          <div className="threat-metrics">
            <span className="metric">Confidence: 75%</span>
            <span className="metric">Priority: Medium</span>
          </div>
        </div>
      </div>
      
      <div className="threat-actions">
        <button className="btn primary">Generate Threat Report</button>
        <button className="btn secondary">Export Intelligence Data</button>
      </div>
    </div>
  );
};

export default ThreatIntelligenceDashboard;