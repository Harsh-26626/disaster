import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSentAlerts } from '../api.js';

export default function SmsInbox() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const data = await getSentAlerts();
      setAlerts(data || []);
    } catch (err) {
      console.error('Failed to fetch SENT alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="phone-page-layout">
      {/* Top Navbar */}
      <header className="page-header-nav">
        <Link to="/" className="nav-back-btn">
          <span>←</span> Back to Live Map
        </Link>
        <div className="nav-center-branding">
          <span className="nav-brand-beacon">🚨</span>
          <div>
            <h3>EMERGENCY BROADCAST SIMULATOR</h3>
            <span className="nav-sub">Official Citizen SMS Feed • Channel GOVT_ALERT_112</span>
          </div>
        </div>
        <div className="nav-right-actions">
          <Link to="/admin" className="nav-admin-link">
            🛡️ Admin Command
          </Link>
        </div>
      </header>

      <div className="phone-container">
        <div className="phone-mockup">
          {/* Smartphone Status Bar */}
          <div className="phone-status-bar">
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="speaker-notch"></div>
            <div className="phone-icons">
              <span>📶 5G</span>
              <span>🔋 92%</span>
            </div>
          </div>

          {/* Messages App Header */}
          <div className="phone-header">
            <div className="avatar-circle">🚨</div>
            <div>
              <h3>GOVT_ALERT_112</h3>
              <p>Official State Disaster Warning System</p>
            </div>
          </div>

          {/* SMS Messages Feed */}
          <div className="phone-messages-body">
            {loading && alerts.length === 0 ? (
              <div className="phone-loading">Connecting to broadcast antenna...</div>
            ) : alerts.length === 0 ? (
              <div className="phone-empty-state">
                <p>📲 No emergency broadcast alerts sent yet.</p>
                <small>Alerts dispatched by state authorities will appear here instantly.</small>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert._id} className="sms-bubble-wrapper">
                  <div className={`sms-bubble severity-${alert.severity?.toLowerCase()}`}>
                    <div className="sms-badge">
                      <span className={`badge badge-${alert.severity?.toLowerCase()}`}>
                        {alert.severity} EMERGENCY
                      </span>
                      <span className="sms-time">
                        {new Date(alert.sentAt || alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="sms-title">{alert.title}</h4>
                    <p className="sms-content">{alert.message}</p>

                    <div className="sms-footer">
                      <span>Source: {alert.source || 'MANUAL'}</span>
                      <span>Helpline: 112</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Smartphone Bottom Home Bar */}
          <div className="phone-bottom-bar">
            <div className="home-indicator"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
