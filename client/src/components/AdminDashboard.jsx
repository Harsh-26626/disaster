import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getAdminFeeds,
  getAdminReports,
  updateReportStatus,
  broadcastAlert,
  refreshFeeds
} from '../api.js';

export default function AdminDashboard() {
  // Authentication State
  const [password, setPassword] = useState(() => sessionStorage.getItem('admin_password') || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState('feeds'); // 'feeds' | 'rescue' | 'reports' | 'activity'
  const [feedsData, setFeedsData] = useState({ zones: [], draftAlerts: [], recentFeedItems: [] });
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshingFeeds, setRefreshingFeeds] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [rescueFilter, setRescueFilter] = useState('ALL'); // 'ALL' | 'MEDICAL' | 'TRAPPED' | 'UNVERIFIED' | 'VERIFIED'
  const [reportFilter, setReportFilter] = useState('ALL'); // 'ALL' | 'FLOODED_ROAD' | 'BLOCKED_ROUTE' | 'SHELTER_FULL' | 'UNVERIFIED'
  const [zoneRiskFilter, setZoneRiskFilter] = useState('ALL'); // 'ALL' | 'SEVERE' | 'HIGH' | 'MEDIUM' | 'LOW'

  // Broadcast Modal State (Supports both Draft approval and Direct Manual broadcast)
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [broadcastZoneId, setBroadcastZoneId] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  // Fetch admin data
  const fetchData = useCallback(async (pwd) => {
    const targetPassword = pwd || password;
    if (!targetPassword) return;

    try {
      setLoading(true);
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
        setAuthError('Invalid admin password. Please enter the correct ADMIN_PASSWORD.');
        sessionStorage.removeItem('admin_password');
      } else {
        console.error('Error fetching admin data:', err);
      }
    } finally {
      setLoading(false);
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

  // Handle Login
  const handleLogin = (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setAuthError(null);
    sessionStorage.setItem('admin_password', passwordInput.trim());
    setPassword(passwordInput.trim());
    fetchData(passwordInput.trim());
  };

  // Handle Logout
  const handleLogout = () => {
    sessionStorage.removeItem('admin_password');
    setPassword('');
    setIsAuthenticated(false);
  };

  // Trigger Manual Feed Refresh
  const handleRefreshFeeds = async () => {
    try {
      setRefreshingFeeds(true);
      await refreshFeeds(password);
      await fetchData(password);
      showActionSuccess('Weather forecasts & official feeds refreshed successfully!');
    } catch (err) {
      alert(`Refresh failed: ${err.message}`);
    } finally {
      setRefreshingFeeds(false);
    }
  };

  // Open Broadcast Modal for an existing Draft
  const handleOpenDraftBroadcast = (draft) => {
    setSelectedDraft(draft);
    setBroadcastZoneId(draft.zone?._id || draft.zone || '');
    setBroadcastTitle(draft.title || `GOVT ALERT: SEVERE WEATHER IN ${draft.zone?.name?.toUpperCase() || 'DISTRICT'}`);
    setBroadcastMessage(
      draft.message ||
      `EMERGENCY ALERT for ${draft.zone?.name || 'District'}: Severe disaster risks detected. Move to designated shelters. Dial 112 for rescue.`
    );
    setIsBroadcastModalOpen(true);
  };

  // Open Broadcast Modal for Direct Manual Alert
  const handleOpenDirectBroadcast = () => {
    setSelectedDraft(null);
    const firstZone = feedsData.zones?.[0];
    setBroadcastZoneId(firstZone ? firstZone._id : '');
    setBroadcastTitle(`GOVT EMERGENCY ALERT: DISTRICT ADVISORY`);
    setBroadcastMessage(
      `EMERGENCY ALERT: Severe conditions reported. Avoid inundated routes. Move to designated relief camps immediately. Dial 112 for rescue.`
    );
    setIsBroadcastModalOpen(true);
  };

  // Handle Zone Selection Change in Direct Broadcast
  const handleZoneSelectChange = (zoneId) => {
    setBroadcastZoneId(zoneId);
    const z = feedsData.zones?.find((item) => item._id === zoneId);
    if (z) {
      setBroadcastTitle(`GOVT EMERGENCY ALERT: ${z.name.toUpperCase()}`);
      setBroadcastMessage(
        `EMERGENCY ALERT for ${z.name}: High flood risk detected. Evacuate low-lying areas. Nearest shelters are open. Dial 112 for rescue.`
      );
    }
  };

  // Send Broadcast
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastZoneId && !selectedDraft) {
      alert('Please select a target zone');
      return;
    }

    try {
      setBroadcasting(true);
      const payload = {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim()
      };
      if (selectedDraft) {
        payload.draftId = selectedDraft._id;
      } else {
        payload.zoneId = broadcastZoneId;
      }

      await broadcastAlert(payload, password);
      setBroadcasting(false);
      setIsBroadcastModalOpen(false);
      setSelectedDraft(null);
      showActionSuccess(`Broadcast dispatched! Alert is now live on Citizen Maps and SMS feeds.`);
      fetchData(password);
    } catch (err) {
      setBroadcasting(false);
      alert(`Broadcast failed: ${err.message}`);
    }
  };

  // Update Report Status
  const handleUpdateStatus = async (reportId, newStatus) => {
    try {
      await updateReportStatus(reportId, newStatus, password);
      showActionSuccess(`Report marked as ${newStatus}`);
      fetchData(password);
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const showActionSuccess = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Filter and Search Computations
  const rescueReports = useMemo(() => {
    return reports
      .filter((r) => r.type === 'RESCUE')
      .filter((r) => {
        if (rescueFilter === 'MEDICAL') return r.rescue?.medicalEmergency;
        if (rescueFilter === 'TRAPPED') return r.rescue?.trapped;
        if (rescueFilter === 'UNVERIFIED') return r.status === 'UNVERIFIED';
        if (rescueFilter === 'VERIFIED') return r.status === 'VERIFIED';
        return true;
      })
      .filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.description?.toLowerCase().includes(q) ||
          r.rescue?.floorInfo?.toLowerCase().includes(q)
        );
      });
  }, [reports, rescueFilter, searchQuery]);

  const generalReports = useMemo(() => {
    return reports
      .filter((r) => r.type !== 'RESCUE')
      .filter((r) => {
        if (reportFilter === 'FLOODED_ROAD') return r.type === 'FLOODED_ROAD';
        if (reportFilter === 'BLOCKED_ROUTE') return r.type === 'BLOCKED_ROUTE';
        if (reportFilter === 'SHELTER_FULL') return r.type === 'SHELTER_FULL';
        if (reportFilter === 'UNVERIFIED') return r.status === 'UNVERIFIED';
        return true;
      })
      .filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.description?.toLowerCase().includes(q) ||
          r.type?.toLowerCase().includes(q)
        );
      });
  }, [reports, reportFilter, searchQuery]);

  const filteredZones = useMemo(() => {
    return (feedsData.zones || []).filter((z) => {
      if (zoneRiskFilter === 'ALL') return true;
      return z.riskLevel === zoneRiskFilter;
    });
  }, [feedsData.zones, zoneRiskFilter]);

  // Executive KPI Metrics
  const totalMonitoredZones = feedsData.zones?.length || 0;
  const severeOrHighZonesCount = (feedsData.zones || []).filter(
    (z) => z.riskLevel === 'SEVERE' || z.riskLevel === 'HIGH'
  ).length;
  const activeRescueTotal = reports.filter((r) => r.type === 'RESCUE' && r.status !== 'RESOLVED').length;
  const pendingDraftsCount = feedsData.draftAlerts?.length || 0;
  const totalExposurePopulation = (feedsData.zones || []).reduce(
    (sum, z) => sum + (z.estimatedPopulation || 0),
    0
  );

  // If Not Authenticated, Render Password Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="admin-login-layout">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <div className="admin-shield-badge">🛡️</div>
            <h2>Disaster Command Access</h2>
            <p>State Disaster Management Authority • Authorization Gateway</p>
          </div>

          {authError && <div className="error-alert">⚠️ {authError}</div>}

          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="form-group">
              <label>Administrative Security Passkey</label>
              <input
                type="password"
                placeholder="Enter ADMIN_PASSWORD (e.g. adminsecret123)..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              🔓 Authenticate & Unlock Command Center
            </button>
            <div className="login-footer-hint">
              <Link to="/">← Return to Citizen Map</Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-layout">
      {/* Top High-Tech Command Header */}
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-logo-icon">🛡️</div>
          <div>
            <div className="brand-badge-row">
              <span className="brand-badge">SDMA COMMAND CENTER</span>
              <span className="live-sync-indicator">
                <span className="sync-pulse-dot"></span> LIVE 5s
              </span>
            </div>
            <h1>Disaster Response & Triage Command</h1>
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            className="btn btn-primary btn-sm highlight-btn"
            onClick={handleOpenDirectBroadcast}
            title="Dispatch emergency broadcast to citizen SMS channel"
          >
            📢 Broadcast New Alert
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefreshFeeds}
            disabled={refreshingFeeds}
            title="Fetch latest Open-Meteo & GDACS data"
          >
            {refreshingFeeds ? '🔄 Syncing...' : '📡 Refresh Feeds'}
          </button>

          <Link to="/" className="btn btn-secondary btn-sm" title="View Public Map">
            🗺️ Citizen Map
          </Link>

          <button className="btn btn-cancel btn-sm" onClick={handleLogout} title="Lock Command Session">
            🔒 Lock Session
          </button>
        </div>
      </header>

      {/* Action Success Toast */}
      {actionSuccess && (
        <div className="toast-notification">
          <span>✅ {actionSuccess}</span>
        </div>
      )}

      {/* Executive Command KPI Metric Strip */}
      <section className="admin-kpi-grid">
        <div
          className={`kpi-card ${severeOrHighZonesCount > 0 ? 'kpi-urgent' : ''}`}
          onClick={() => setActiveTab('feeds')}
        >
          <div className="kpi-icon-wrap">🛡️</div>
          <div className="kpi-info">
            <span className="kpi-title">Monitored Zones</span>
            <div className="kpi-value-row">
              <span className="kpi-number">{totalMonitoredZones}</span>
              <span className="kpi-tag warning">{severeOrHighZonesCount} High/Severe</span>
            </div>
            <span className="kpi-sub">Total Pop: {totalExposurePopulation.toLocaleString()}</span>
          </div>
        </div>

        <div
          className={`kpi-card ${activeRescueTotal > 0 ? 'kpi-danger' : ''}`}
          onClick={() => setActiveTab('rescue')}
        >
          <div className="kpi-icon-wrap">🚨</div>
          <div className="kpi-info">
            <span className="kpi-title">Rescue Requests</span>
            <div className="kpi-value-row">
              <span className="kpi-number">{activeRescueTotal}</span>
              <span className="kpi-tag danger">Prioritized Queue</span>
            </div>
            <span className="kpi-sub">Medical & trapped weighted</span>
          </div>
        </div>

        <div
          className={`kpi-card ${pendingDraftsCount > 0 ? 'kpi-highlight' : ''}`}
          onClick={() => setActiveTab('feeds')}
        >
          <div className="kpi-icon-wrap">📢</div>
          <div className="kpi-info">
            <span className="kpi-title">Pending Drafts</span>
            <div className="kpi-value-row">
              <span className="kpi-number">{pendingDraftsCount}</span>
              <span className="kpi-tag alert">Awaiting Broadcast</span>
            </div>
            <span className="kpi-sub">Automated weather triggers</span>
          </div>
        </div>

        <div
          className="kpi-card"
          onClick={() => setActiveTab('reports')}
        >
          <div className="kpi-icon-wrap">📋</div>
          <div className="kpi-info">
            <span className="kpi-title">Ground Reports</span>
            <div className="kpi-value-row">
              <span className="kpi-number">{reports.length - rescueReports.length}</span>
              <span className="kpi-tag normal">Citizen Hazards</span>
            </div>
            <span className="kpi-sub">Floods, Blocked Roads, Shelters</span>
          </div>
        </div>
      </section>

      {/* Main Tab Bar */}
      <div className="admin-tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'feeds' ? 'active' : ''}`}
          onClick={() => setActiveTab('feeds')}
        >
          <span>📡 Official Feeds & Drafts</span>
          {pendingDraftsCount > 0 && <span className="tab-count-badge warning">{pendingDraftsCount}</span>}
        </button>

        <button
          className={`tab-btn ${activeTab === 'rescue' ? 'active' : ''}`}
          onClick={() => setActiveTab('rescue')}
        >
          <span>🚨 Emergency Rescue Queue</span>
          {activeRescueTotal > 0 && <span className="tab-count-badge danger">{activeRescueTotal}</span>}
        </button>

        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <span>📋 Ground Reports Verification</span>
          <span className="tab-count-badge normal">{reports.length - rescueReports.length}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <span>⚡ Live Ingested Feed Stream</span>
          <span className="tab-count-badge normal">{feedsData.recentFeedItems?.length || 0}</span>
        </button>
      </div>

      {/* Command Content Area */}
      <main className="admin-content-body">
        {/* =========================================================================
            PANEL 1: OFFICIAL FEEDS & DRAFT ALERTS
            ========================================================================= */}
        {activeTab === 'feeds' && (
          <div className="dashboard-grid-two">
            {/* Left Column: District Risk Assessment */}
            <div className="admin-panel-card">
              <div className="panel-card-header">
                <div>
                  <h3>District Hazard Risk Status</h3>
                  <p className="panel-sub">Real-time risk scoring based on Open-Meteo & alert feeds</p>
                </div>
                {/* Risk Filter Chips */}
                <div className="filter-chip-row">
                  {['ALL', 'SEVERE', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                    <button
                      key={lvl}
                      className={`filter-chip ${zoneRiskFilter === lvl ? 'active' : ''}`}
                      onClick={() => setZoneRiskFilter(lvl)}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="zones-list">
                {filteredZones.map((zone) => (
                  <div key={zone._id} className={`zone-status-row risk-${zone.riskLevel?.toLowerCase()}`}>
                    <div className="zone-info-main">
                      <div className="zone-title-bar">
                        <h4>{zone.name}</h4>
                        <span className={`badge badge-${zone.riskLevel?.toLowerCase()}`}>
                          {zone.riskLevel} THREAT
                        </span>
                      </div>
                      <p className="zone-reason-text">{zone.riskReason || 'Normal monitoring conditions.'}</p>
                      <div className="zone-meta-footer">
                        <span>👥 Population: <strong>{zone.estimatedPopulation?.toLocaleString() || 'N/A'}</strong> citizens</span>
                        <span>Updated: {new Date(zone.updatedAt || Date.now()).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Pending Draft Alerts */}
            <div className="admin-panel-card">
              <div className="panel-card-header">
                <div>
                  <h3>Pending Draft Alerts (Awaiting Authorization)</h3>
                  <p className="panel-sub">Generated automatically when zone risk hits HIGH/SEVERE</p>
                </div>
                <span className="count-badge count-warning">{feedsData.draftAlerts?.length || 0} Pending</span>
              </div>

              {feedsData.draftAlerts?.length === 0 ? (
                <div className="empty-panel-state">
                  <div className="empty-icon">✅</div>
                  <h4>No Pending Draft Alerts</h4>
                  <p>All emergency notifications have been reviewed or risk levels are stable.</p>
                  <button className="btn btn-secondary btn-sm" onClick={handleOpenDirectBroadcast} style={{ marginTop: '0.85rem' }}>
                    + Create Direct Manual Broadcast
                  </button>
                </div>
              ) : (
                <div className="draft-alerts-list">
                  {feedsData.draftAlerts?.map((draft) => (
                    <div key={draft._id} className="draft-alert-card">
                      <div className="draft-card-header">
                        <span className={`badge badge-${draft.severity?.toLowerCase()}`}>
                          {draft.severity} LEVEL
                        </span>
                        <span className="draft-source-tag">Source: {draft.source || 'OPEN_METEO'}</span>
                      </div>
                      <h4 className="draft-title">{draft.title}</h4>
                      <p className="draft-message">{draft.message}</p>
                      <div className="draft-card-footer">
                        <span className="draft-time">Triggered: {new Date(draft.createdAt).toLocaleTimeString()}</span>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenDraftBroadcast(draft)}
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

        {/* =========================================================================
            PANEL 2: RESCUE QUEUE
            ========================================================================= */}
        {activeTab === 'rescue' && (
          <div className="admin-panel-card full-width">
            <div className="panel-card-header flex-header">
              <div>
                <h3>🚨 Emergency Search & Rescue Triage Queue</h3>
                <p className="panel-sub">
                  Ranked by life-risk formula: <strong>Base + Medical (+40) + Children/Elderly (+25) + Trapped (+20)</strong>
                </p>
              </div>

              {/* Triage Search & Filters */}
              <div className="table-controls-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search rescues (street, floor, notes)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="filter-chip-row">
                  <button
                    className={`filter-chip ${rescueFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setRescueFilter('ALL')}
                  >
                    All ({reports.filter((r) => r.type === 'RESCUE').length})
                  </button>
                  <button
                    className={`filter-chip ${rescueFilter === 'MEDICAL' ? 'active' : ''}`}
                    onClick={() => setRescueFilter('MEDICAL')}
                  >
                    ⚠️ Medical
                  </button>
                  <button
                    className={`filter-chip ${rescueFilter === 'TRAPPED' ? 'active' : ''}`}
                    onClick={() => setRescueFilter('TRAPPED')}
                  >
                    🔒 Trapped
                  </button>
                  <button
                    className={`filter-chip ${rescueFilter === 'UNVERIFIED' ? 'active' : ''}`}
                    onClick={() => setRescueFilter('UNVERIFIED')}
                  >
                    Unverified
                  </button>
                  <button
                    className={`filter-chip ${rescueFilter === 'VERIFIED' ? 'active' : ''}`}
                    onClick={() => setRescueFilter('VERIFIED')}
                  >
                    Verified
                  </button>
                </div>
              </div>
            </div>

            {rescueReports.length === 0 ? (
              <div className="empty-panel-state">
                <div className="empty-icon">✅</div>
                <h4>No Rescue Requests Match Filter</h4>
                <p>All emergency distress requests are resolved or no reports match the current query.</p>
              </div>
            ) : (
              <div className="reports-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '90px' }}>Priority</th>
                      <th>Location & Circumstance</th>
                      <th>Rescue Parameters</th>
                      <th style={{ width: '110px' }}>Status</th>
                      <th style={{ width: '160px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rescueReports.map((report) => (
                      <tr key={report._id} className={`status-row-${report.status?.toLowerCase()}`}>
                        <td>
                          <div className={`priority-score-badge ${report.priority >= 70 ? 'extreme' : report.priority >= 40 ? 'high' : 'normal'}`}>
                            <span className="priority-num">{report.priority || 0}</span>
                            <small>PTS</small>
                          </div>
                        </td>
                        <td>
                          <strong className="report-desc-title">{report.description}</strong>
                          <div className="coords-text">
                            📍 Coordinates: [{report.location?.coordinates[1]?.toFixed(5)}, {report.location?.coordinates[0]?.toFixed(5)}]
                            <a
                              href={`https://www.google.com/maps?q=${report.location?.coordinates[1]},${report.location?.coordinates[0]}`}
                              target="_blank"
                              rel="noreferrer"
                              className="map-link-tag"
                            >
                              Open in Maps ↗
                            </a>
                          </div>
                        </td>
                        <td>
                          <div className="rescue-params-tags">
                            <span className="param-tag">👥 {report.rescue?.peopleCount || 1} Stranded</span>
                            {report.rescue?.medicalEmergency && <span className="param-tag danger">⚠️ Medical Emergency</span>}
                            {report.rescue?.hasChildrenOrElderly && <span className="param-tag warning">👶/👵 Children/Elderly</span>}
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
                                title="Verify for emergency dispatch"
                              >
                                ✓ Verify
                              </button>
                            )}
                            {report.status !== 'RESOLVED' && (
                              <button
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleUpdateStatus(report._id, 'RESOLVED')}
                                title="Mark as successfully rescued"
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

        {/* =========================================================================
            PANEL 3: GROUND REPORTS VERIFICATION
            ========================================================================= */}
        {activeTab === 'reports' && (
          <div className="admin-panel-card full-width">
            <div className="panel-card-header flex-header">
              <div>
                <h3>📋 Ground Incident Reports Verification</h3>
                <p className="panel-sub">Field reports submitted by citizens (Flooded roads, blocked routes, shelters)</p>
              </div>

              {/* Reports Search & Filter */}
              <div className="table-controls-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search hazard reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="filter-chip-row">
                  <button
                    className={`filter-chip ${reportFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setReportFilter('ALL')}
                  >
                    All
                  </button>
                  <button
                    className={`filter-chip ${reportFilter === 'FLOODED_ROAD' ? 'active' : ''}`}
                    onClick={() => setReportFilter('FLOODED_ROAD')}
                  >
                    🌊 Flooded Roads
                  </button>
                  <button
                    className={`filter-chip ${reportFilter === 'BLOCKED_ROUTE' ? 'active' : ''}`}
                    onClick={() => setReportFilter('BLOCKED_ROUTE')}
                  >
                    🚧 Blocked Routes
                  </button>
                  <button
                    className={`filter-chip ${reportFilter === 'SHELTER_FULL' ? 'active' : ''}`}
                    onClick={() => setReportFilter('SHELTER_FULL')}
                  >
                    🚫 Shelter Full
                  </button>
                  <button
                    className={`filter-chip ${reportFilter === 'UNVERIFIED' ? 'active' : ''}`}
                    onClick={() => setReportFilter('UNVERIFIED')}
                  >
                    Unverified
                  </button>
                </div>
              </div>
            </div>

            {generalReports.length === 0 ? (
              <div className="empty-panel-state">
                <div className="empty-icon">✅</div>
                <h4>No Ground Reports Found</h4>
                <p>No active hazard reports match your current filter criteria.</p>
              </div>
            ) : (
              <div className="reports-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Type</th>
                      <th>Incident Description</th>
                      <th>Location</th>
                      <th style={{ width: '110px' }}>Status</th>
                      <th style={{ width: '160px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generalReports.map((report) => (
                      <tr key={report._id}>
                        <td>
                          <span className={`report-kind-tag kind-${report.type?.toLowerCase()}`}>
                            {report.type?.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <p className="report-desc-text">{report.description}</p>
                          <small className="created-at">Submitted: {new Date(report.createdAt).toLocaleString()}</small>
                        </td>
                        <td>
                          <div className="coords-box">
                            📍 [{report.location?.coordinates[1]?.toFixed(4)}, {report.location?.coordinates[0]?.toFixed(4)}]
                            <a
                              href={`https://www.google.com/maps?q=${report.location?.coordinates[1]},${report.location?.coordinates[0]}`}
                              target="_blank"
                              rel="noreferrer"
                              className="map-link-tag"
                            >
                              Maps ↗
                            </a>
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

        {/* =========================================================================
            PANEL 4: LIVE INGESTED FEED STREAM
            ========================================================================= */}
        {activeTab === 'activity' && (
          <div className="admin-panel-card full-width">
            <div className="panel-card-header">
              <div>
                <h3>⚡ Live Ingested Feed Activity Stream</h3>
                <p className="panel-sub">Raw feed logs ingested from Open-Meteo, GDACS, and internal alert triggers</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleRefreshFeeds} disabled={refreshingFeeds}>
                {refreshingFeeds ? '🔄 Syncing...' : '📡 Refresh Stream'}
              </button>
            </div>

            {(!feedsData.recentFeedItems || feedsData.recentFeedItems.length === 0) ? (
              <div className="empty-panel-state">
                <div className="empty-icon">📡</div>
                <h4>No Recent Feed Items Ingested</h4>
                <p>Click "Refresh Feeds" to poll Open-Meteo and external weather alert networks.</p>
              </div>
            ) : (
              <div className="feed-stream-list">
                {feedsData.recentFeedItems.map((feed) => (
                  <div key={feed._id} className="feed-stream-row">
                    <div className="feed-stream-badge">
                      <span className={`source-tag tag-${feed.source?.toLowerCase()}`}>
                        {feed.source}
                      </span>
                      <span className={`badge badge-${feed.severity?.toLowerCase() || 'info'}`}>
                        {feed.severity || 'INFO'}
                      </span>
                    </div>

                    <div className="feed-stream-content">
                      <p className="feed-summary">{feed.summary}</p>
                      {feed.zone?.name && (
                        <span className="feed-zone-pill">Zone: {feed.zone.name}</span>
                      )}
                    </div>

                    <div className="feed-stream-time">
                      {new Date(feed.fetchedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* =========================================================================
          BROADCAST AUTHORIZATION & DISPATCH MODAL
          ========================================================================= */}
      {isBroadcastModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>📢 {selectedDraft ? 'Authorize Draft Alert Broadcast' : 'Dispatch Direct Emergency Broadcast'}</h2>
              <button className="close-btn" onClick={() => setIsBroadcastModalOpen(false)}>&times;</button>
            </div>

            <form onSubmit={handleSendBroadcast} className="modal-form">
              {/* Target Zone Selection */}
              <div className="form-group">
                <label>Target District Zone</label>
                {selectedDraft ? (
                  <div className="draft-meta-summary">
                    <strong>Zone:</strong> {selectedDraft.zone?.name || 'Assigned Zone'} |{' '}
                    <span className={`badge badge-${selectedDraft.severity?.toLowerCase()}`}>
                      {selectedDraft.severity} LEVEL
                    </span>
                  </div>
                ) : (
                  <select
                    value={broadcastZoneId}
                    onChange={(e) => handleZoneSelectChange(e.target.value)}
                    required
                  >
                    {feedsData.zones?.map((z) => (
                      <option key={z._id} value={z._id}>
                        {z.name} (Risk: {z.riskLevel}) - Pop ~{Math.round((z.estimatedPopulation || 0) / 1000)}k
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Alert Title */}
              <div className="form-group">
                <label>Broadcast Title (Emergency SMS Header)</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. GOVT ALERT: SEVERE WEATHER IN ZONE..."
                  required
                />
              </div>

              {/* Alert Message Body */}
              <div className="form-group">
                <label>Official SMS Message Body (Kept under ~300 chars)</label>
                <textarea
                  rows="4"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  maxLength={350}
                  placeholder="Enter official SMS message (will include nearest shelter and helpline)..."
                  required
                />
                <div className="char-count-bar">
                  <span className={broadcastMessage.length > 300 ? 'char-over' : ''}>
                    {broadcastMessage.length}/300 characters
                  </span>
                  <small>SMS is dispatched to citizens & phone simulator immediately.</small>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => setIsBroadcastModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={broadcasting}
                >
                  {broadcasting ? '🚀 Broadcasting...' : '🚀 Authorize & Broadcast Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
