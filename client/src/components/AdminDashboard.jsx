import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getAdminFeeds,
  getAdminReports,
  updateReportStatus,
  broadcastAlert,
  refreshFeeds
} from '../api.js';

export default function AdminDashboard() {
  // Password authentication state
  const [password, setPassword] = useState(() => sessionStorage.getItem('admin_password') || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState('feeds'); // 'feeds' | 'rescue' | 'reports'
  const [feedsData, setFeedsData] = useState({ zones: [], draftAlerts: [], recentFeedItems: [] });
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshingFeeds, setRefreshingFeeds] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Broadcast Modal State
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  // Fetch admin data
  const fetchData = useCallback(async (pwd) => {
    const targetPassword = pwd || password;
    if (!targetPassword) return;

    try {
      const [feedsRes, reportsRes] = await Promise.all([
        getAdminFeeds(targetPassword),
        getAdminReports(targetPassword)
      ]);

      setFeedsData(feedsRes || { zones: [], draftAlerts: [], recentFeedItems: [] });
      setReports(reportsRes || []);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setIsAuthenticated(false);
        setAuthError('Invalid admin password. Please try again.');
        sessionStorage.removeItem('admin_password');
      } else {
        console.error('Error fetching admin data:', err);
      }
    }
  }, [password]);

  // Initial load & 5s polling
  useEffect(() => {
    if (password) {
      fetchData(password);
      const interval = setInterval(() => fetchData(password), 5000);
      return () => clearInterval(interval);
    }
  }, [password, fetchData]);

  // Handle password submission
  const handleLogin = (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setAuthError(null);
    sessionStorage.setItem('admin_password', passwordInput.trim());
    setPassword(passwordInput.trim());
    fetchData(passwordInput.trim());
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_password');
    setPassword('');
    setIsAuthenticated(false);
  };

  // Trigger manual feed refresh
  const handleRefreshFeeds = async () => {
    try {
      setRefreshingFeeds(true);
      await refreshFeeds(password);
      await fetchData(password);
      showActionSuccess('Feeds & weather forecasts refreshed successfully!');
    } catch (err) {
      alert(`Refresh failed: ${err.message}`);
    } finally {
      setRefreshingFeeds(false);
    }
  };

  // Open Broadcast Modal for a draft alert
  const handleOpenBroadcastModal = (draft) => {
    setSelectedDraft(draft);
    setBroadcastTitle(draft.title || `GOVT ALERT: SEVERE WEATHER IN ${draft.zone?.name?.toUpperCase() || 'DISTRICT'}`);
    setBroadcastMessage(
      draft.message ||
      `EMERGENCY ALERT for ${draft.zone?.name || 'District'}: Severe disaster risks detected. Move to designated shelters. Dial 112 for emergency search & rescue.`
    );
  };

  // Submit Broadcast Alert
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!selectedDraft) return;

    try {
      setBroadcasting(true);
      await broadcastAlert(
        {
          draftId: selectedDraft._id,
          zoneId: selectedDraft.zone?._id || selectedDraft.zone,
          title: broadcastTitle,
          message: broadcastMessage
        },
        password
      );
      setBroadcasting(false);
      setSelectedDraft(null);
      showActionSuccess(`Alert broadcasted successfully! Dispatched to emergency channel.`);
      fetchData(password);
    } catch (err) {
      setBroadcasting(false);
      alert(`Failed to broadcast alert: ${err.message}`);
    }
  };

  // Update Report Status
  const handleUpdateStatus = async (reportId, newStatus) => {
    try {
      await updateReportStatus(reportId, newStatus, password);
      showActionSuccess(`Report status updated to ${newStatus}`);
      fetchData(password);
    } catch (err) {
      alert(`Failed to update report: ${err.message}`);
    }
  };

  const showActionSuccess = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Filter rescue reports vs general reports
  const rescueReports = reports.filter((r) => r.type === 'RESCUE');
  const generalReports = reports.filter((r) => r.type !== 'RESCUE');

  // If not authenticated, render Password Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="admin-login-layout">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <span className="login-shield-icon">🛡️</span>
            <h2>Government Command Access</h2>
            <p>Enter administrative passkey to access live disaster command portal</p>
          </div>

          {authError && <div className="error-alert">{authError}</div>}

          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="form-group">
              <label>Admin Passkey (`ADMIN_PASSWORD`)</label>
              <input
                type="password"
                placeholder="Enter password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              Unlock Dashboard
            </button>
          </form>
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <Link to="/" className="back-link">← Return to Citizen Map</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-layout">
      {/* Top Command Navbar */}
      <header className="admin-header">
        <div className="admin-brand">
          <span className="brand-badge">GOVT COMMAND</span>
          <div>
            <h1>Disaster Response & Intelligence Center</h1>
            <p>Live Monitoring, Rescue Queue & Alert Authorization</p>
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefreshFeeds}
            disabled={refreshingFeeds}
          >
            {refreshingFeeds ? '🔄 Refreshing...' : '📡 Refresh All Feeds'}
          </button>
          <Link to="/" className="btn btn-secondary btn-sm">
            🗺️ View Citizen Map
          </Link>
          <button className="btn btn-cancel btn-sm" onClick={handleLogout}>
            🔒 Logout
          </button>
        </div>
      </header>

      {actionSuccess && (
        <div className="toast-notification">
          <span>✅ {actionSuccess}</span>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="admin-tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'feeds' ? 'active' : ''}`}
          onClick={() => setActiveTab('feeds')}
        >
          📡 Official Feeds & Draft Alerts ({feedsData.draftAlerts?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'rescue' ? 'active' : ''}`}
          onClick={() => setActiveTab('rescue')}
        >
          🚨 Rescue Queue ({rescueReports.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📋 Ground Reports ({generalReports.length})
        </button>
      </div>

      {/* Content Area */}
      <main className="admin-content-body">
        {/* PANEL 1: OFFICIAL FEEDS & DRAFT ALERTS */}
        {activeTab === 'feeds' && (
          <div className="dashboard-grid-two">
            {/* Left Column: District Zones Risk Assessment */}
            <div className="admin-panel-card">
              <div className="panel-card-header">
                <h3>District Hazard Risk Status</h3>
                <span className="count-badge">{feedsData.zones?.length || 0} Zones</span>
              </div>
              <div className="zones-list">
                {feedsData.zones?.map((zone) => (
                  <div key={zone._id} className="zone-status-row">
                    <div className="zone-info-main">
                      <div className="zone-title-bar">
                        <h4>{zone.name}</h4>
                        <span className={`badge badge-${zone.riskLevel?.toLowerCase()}`}>
                          {zone.riskLevel} RISK
                        </span>
                      </div>
                      <p className="zone-reason-text">{zone.riskReason || 'No critical risk reported.'}</p>
                      <div className="zone-meta-footer">
                        <span>👥 Population Exposure: <strong>{zone.estimatedPopulation?.toLocaleString()}</strong></span>
                        <span>Updated: {new Date(zone.updatedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Draft Alerts for Government Approval */}
            <div className="admin-panel-card">
              <div className="panel-card-header">
                <h3>Pending Draft Alerts (Awaiting Broadcast)</h3>
                <span className="count-badge count-warning">{feedsData.draftAlerts?.length || 0} Drafts</span>
              </div>

              {feedsData.draftAlerts?.length === 0 ? (
                <div className="empty-panel-state">
                  <p>✅ No pending draft alerts requiring authorization.</p>
                  <small>Automated system triggers DRAFT alerts when zone risk reaches HIGH or SEVERE.</small>
                </div>
              ) : (
                <div className="draft-alerts-list">
                  {feedsData.draftAlerts?.map((draft) => (
                    <div key={draft._id} className="draft-alert-card">
                      <div className="draft-card-header">
                        <span className={`badge badge-${draft.severity?.toLowerCase()}`}>
                          {draft.severity}
                        </span>
                        <span className="draft-source-tag">Source: {draft.source || 'OPEN_METEO'}</span>
                      </div>
                      <h4 className="draft-title">{draft.title}</h4>
                      <p className="draft-message">{draft.message}</p>
                      <div className="draft-card-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenBroadcastModal(draft)}
                        >
                          📢 Review & Broadcast Alert
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 2: RESCUE QUEUE */}
        {activeTab === 'rescue' && (
          <div className="admin-panel-card full-width">
            <div className="panel-card-header">
              <div>
                <h3>🚨 Emergency Search & Rescue Queue</h3>
                <p className="panel-sub">Sorted by weighted rescue priority score (Medical +40, Children/Elderly +25, Trapped +20)</p>
              </div>
              <span className="count-badge count-danger">{rescueReports.length} Active Rescues</span>
            </div>

            {rescueReports.length === 0 ? (
              <div className="empty-panel-state">
                <p>✅ No active emergency rescue requests queued.</p>
              </div>
            ) : (
              <div className="reports-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Priority</th>
                      <th>Location & Details</th>
                      <th>Rescue Parameters</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rescueReports.map((report) => (
                      <tr key={report._id} className={`status-row-${report.status?.toLowerCase()}`}>
                        <td>
                          <div className="priority-score-badge">
                            <span className="priority-num">{report.priority || 0}</span>
                            <small>PTS</small>
                          </div>
                        </td>
                        <td>
                          <strong className="report-desc-title">{report.description}</strong>
                          <div className="coords-text">
                            📍 Coordinates: [{report.location?.coordinates[1]?.toFixed(5)}, {report.location?.coordinates[0]?.toFixed(5)}]
                          </div>
                        </td>
                        <td>
                          <div className="rescue-params-tags">
                            <span className="param-tag">👥 {report.rescue?.peopleCount || 1} Stranded</span>
                            {report.rescue?.medicalEmergency && <span className="param-tag danger">⚠️ Medical Emergency</span>}
                            {report.rescue?.hasChildrenOrElderly && <span className="param-tag warning">👶/👵 Children or Elderly</span>}
                            {report.rescue?.trapped && <span className="param-tag danger">🔒 Trapped</span>}
                            {report.rescue?.floorInfo && <div className="floor-tag">🏠 {report.rescue.floorInfo}</div>}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge status-${report.status?.toLowerCase()}`}>
                            {report.status}
                          </span>
                        </td>
                        <td>
                          <div className="table-action-btns">
                            {report.status !== 'VERIFIED' && report.status !== 'RESOLVED' && (
                              <button
                                className="btn btn-success btn-xs"
                                onClick={() => handleUpdateStatus(report._id, 'VERIFIED')}
                              >
                                ✓ Verify
                              </button>
                            )}
                            {report.status !== 'RESOLVED' && (
                              <button
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleUpdateStatus(report._id, 'RESOLVED')}
                              >
                                ✅ Resolve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PANEL 3: GROUND REPORTS AWAITING VERIFICATION */}
        {activeTab === 'reports' && (
          <div className="admin-panel-card full-width">
            <div className="panel-card-header">
              <div>
                <h3>📋 Ground Incident Reports</h3>
                <p className="panel-sub">Citizen-submitted flooded roads, blocked routes, and shelter capacity reports</p>
              </div>
              <span className="count-badge">{generalReports.length} Reports</span>
            </div>

            {generalReports.length === 0 ? (
              <div className="empty-panel-state">
                <p>No ground reports submitted yet.</p>
              </div>
            ) : (
              <div className="reports-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Incident Description</th>
                      <th>Coordinates</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generalReports.map((report) => (
                      <tr key={report._id}>
                        <td>
                          <span className="report-kind-tag">
                            {report.type?.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <p className="report-desc-text">{report.description}</p>
                          <small className="created-at">Submitted: {new Date(report.createdAt).toLocaleString()}</small>
                        </td>
                        <td>
                          <div className="coords-box">
                            📍 {report.location?.coordinates[1]?.toFixed(4)}, {report.location?.coordinates[0]?.toFixed(4)}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge status-${report.status?.toLowerCase()}`}>
                            {report.status}
                          </span>
                        </td>
                        <td>
                          <div className="table-action-btns">
                            {report.status !== 'VERIFIED' && report.status !== 'RESOLVED' && (
                              <button
                                className="btn btn-success btn-xs"
                                onClick={() => handleUpdateStatus(report._id, 'VERIFIED')}
                              >
                                ✓ Verify
                              </button>
                            )}
                            {report.status !== 'RESOLVED' && (
                              <button
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleUpdateStatus(report._id, 'RESOLVED')}
                              >
                                ✅ Resolve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Broadcast Review & Edit Modal */}
      {selectedDraft && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>📢 Review & Authorize Emergency Broadcast</h2>
              <button className="close-btn" onClick={() => setSelectedDraft(null)}>&times;</button>
            </div>

            <form onSubmit={handleSendBroadcast} className="modal-form">
              <div className="form-group">
                <label>Target Zone & Severity</label>
                <div className="draft-meta-summary">
                  <strong>Zone:</strong> {selectedDraft.zone?.name || 'Selected Zone'} |{' '}
                  <span className={`badge badge-${selectedDraft.severity?.toLowerCase()}`}>
                    {selectedDraft.severity}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label>Alert Title (SMS Header)</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>SMS Broadcast Message Body (under ~300 chars)</label>
                <textarea
                  rows="4"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  maxLength={350}
                  required
                />
                <small style={{ color: '#64748b' }}>
                  {broadcastMessage.length}/350 characters
                </small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => setSelectedDraft(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={broadcasting}
                >
                  {broadcasting ? 'Broadcasting...' : '🚀 Authorize & Send SMS Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
