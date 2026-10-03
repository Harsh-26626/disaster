import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Marker, Popup, Tooltip, ZoomControl, useMapEvents } from 'react-leaflet';
import { getMapData, getSentAlerts } from '../api.js';
import { createPlaceIcon, createReportIcon } from '../utils/leafletIcons.js';
import ReportModal from './ReportModal.jsx';
import ChatWidget from './ChatWidget.jsx';

// Leaflet map click listener component for coordinate picking
function MapEvents({ isPicking, onPick }) {
  useMapEvents({
    click(e) {
      if (isPicking) {
        onPick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

export default function MapPage() {
  const [mapData, setMapData] = useState({ zones: [], places: [], reports: [] });
  const [alerts, setAlerts] = useState([]);
  const [isSatellite, setIsSatellite] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'SHELTERS' | 'FOOD_MED' | 'HAZARDS' | 'RESCUE'
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const defaultCenter = [13.06, 80.25]; // District default centroid

  const fetchData = useCallback(async () => {
    try {
      const [mapRes, alertsRes] = await Promise.all([
        getMapData(),
        getSentAlerts()
      ]);
      if (mapRes) {
        setMapData({
          zones: mapRes.zones || [],
          places: mapRes.places || [],
          reports: mapRes.reports || []
        });
      }
      if (alertsRes) {
        setAlerts(alertsRes || []);
      }
    } catch (err) {
      console.error('Error polling map/alerts data:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleMapPick = (coords) => {
    setSelectedCoords(coords);
    setIsPickingLocation(false);
    setIsReportModalOpen(true);
  };

  const handleReportSuccess = (createdReport) => {
    showToast(`Report successfully submitted! ID: ${createdReport._id.slice(-6)}`);
    fetchData();
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getZoneColor = (riskLevel) => {
    switch (riskLevel) {
      case 'SEVERE':
        return { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.45, weight: 2.5 };
      case 'HIGH':
        return { color: '#ea580c', fillColor: '#f97316', fillOpacity: 0.40, weight: 2.5 };
      case 'MEDIUM':
        return { color: '#ca8a04', fillColor: '#eab308', fillOpacity: 0.35, weight: 2 };
      default:
        return { color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.25, weight: 2 };
    }
  };

  // Filter markers based on active category
  const filteredPlaces = mapData.places.filter((p) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'SHELTERS') return p.kind === 'SHELTER';
    if (activeFilter === 'FOOD_MED') return p.kind === 'FOOD' || p.kind === 'MEDICAL';
    return false;
  });

  const filteredReports = mapData.reports.filter((r) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'RESCUE') return r.type === 'RESCUE';
    if (activeFilter === 'HAZARDS') return r.type !== 'RESCUE';
    return false;
  });

  // Calculate live district metrics for navbar
  const openSheltersCount = mapData.places.filter((p) => p.kind === 'SHELTER' && p.status === 'OPEN').length;
  const rescueCount = mapData.reports.filter((r) => r.type === 'RESCUE').length;
  const activeHazardsCount = mapData.reports.filter((r) => r.type !== 'RESCUE').length;
  const latestAlert = alerts.length > 0 ? alerts[0] : null;

  return (
    <div className="map-page-layout">
      {/* Modern High-Tech Top Navigation Bar */}
      <header className="map-header">
        <div className="brand-logo">
          <div className="logo-badge-container">
            <span className="logo-beacon">🚨</span>
            <span className="beacon-ping"></span>
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <h1>Sahayak</h1>
              <span className="live-status-pill">
                <span className="live-pulse-dot"></span> LIVE 5s
              </span>
            </div>
            <span className="sub-tag">Disaster Intelligence & Citizen Command</span>
          </div>
        </div>

        {/* Tactical Status Pills in Navbar */}
        <div className="header-metrics-strip">
          <div className="metric-pill" title="Active Monitoring Zones">
            <span className="metric-icon">🛡️</span>
            <span className="metric-label">{mapData.zones.length} Zones</span>
          </div>
          <div className="metric-pill" title="Verified Open Evacuation Shelters">
            <span className="metric-icon">🏕️</span>
            <span className="metric-label">{openSheltersCount} Open Shelters</span>
          </div>
          <div className={`metric-pill ${rescueCount > 0 ? 'urgent' : ''}`} title="Pending Rescue Requests">
            <span className="metric-icon">🚨</span>
            <span className="metric-label">{rescueCount} Rescues</span>
          </div>
          <div className="metric-pill" title="Ground Hazard Reports">
            <span className="metric-icon">⚠️</span>
            <span className="metric-label">{activeHazardsCount} Hazards</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="header-actions">
          <button
            className={`tile-toggle-btn ${isSatellite ? 'active' : ''}`}
            onClick={() => setIsSatellite(!isSatellite)}
            title="Toggle between Satellite Imagery and Street Vector Map"
          >
            <span className="btn-icon">{isSatellite ? '🗺️' : '🛰️'}</span>
            <span className="btn-text">{isSatellite ? 'Street Map' : 'Satellite'}</span>
          </button>

          <Link to="/sms" className="header-nav-btn sms-nav-btn" title="View Emergency SMS Broadcasts">
            <span className="btn-icon">📱</span>
            <span className="btn-text">SMS Inbox</span>
            {alerts.length > 0 && <span className="notification-badge">{alerts.length}</span>}
          </Link>

          <Link to="/admin" className="header-nav-btn admin-btn" title="Government Command & Rescue Verification">
            <span className="btn-icon">🛡️</span>
            <span className="btn-text">Admin Command</span>
          </Link>
        </div>
      </header>

      {/* Latest Official Emergency Broadcast Banner */}
      {latestAlert && !isBannerDismissed && (
        <div className={`alert-banner severity-${latestAlert.severity?.toLowerCase()}`}>
          <div className="banner-content">
            <div className="banner-left">
              <span className="banner-badge">
                <span className="badge-pulse"></span>
                {latestAlert.severity} ALERT
              </span>
              <div className="banner-text">
                <strong>{latestAlert.title}:</strong> {latestAlert.message}
              </div>
            </div>
            <div className="banner-actions">
              <Link to="/sms" className="banner-link">View in SMS Inbox →</Link>
              <button
                className="banner-dismiss-btn"
                onClick={() => setIsBannerDismissed(true)}
                title="Dismiss banner"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <span>✅ {toastMessage}</span>
        </div>
      )}

      {/* Location Picking Banner */}
      {isPickingLocation && (
        <div className="picking-banner">
          <div className="picking-content">
            <span className="picking-pin">📍</span>
            <span>Click anywhere on the map to pin incident location</span>
          </div>
          <button
            className="picking-cancel-btn"
            onClick={() => {
              setIsPickingLocation(false);
              setIsReportModalOpen(true);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Map Container */}
      <div className="map-wrapper">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          {/* Zoom control placed at bottom-left to avoid header collision */}
          <ZoomControl position="bottomleft" />

          {/* Satellite Layer vs Street Map */}
          {isSatellite ? (
            <TileLayer
              attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}

          <MapEvents isPicking={isPickingLocation} onPick={handleMapPick} />

          {/* Render Zone Polygons */}
          {mapData.zones.map((zone) => {
            if (!zone.polygon || !zone.polygon.coordinates) return null;
            const positions = zone.polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
            const style = getZoneColor(zone.riskLevel);

            return (
              <Polygon key={zone._id} positions={positions} pathOptions={style}>
                <Tooltip sticky>
                  <div className="zone-tooltip">
                    <strong>{zone.name}</strong>
                    <span className={`badge badge-${zone.riskLevel.toLowerCase()}`}>{zone.riskLevel}</span>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="map-popup-card">
                    <div className="popup-header-zone">
                      <h3>{zone.name}</h3>
                      <span className={`badge badge-${zone.riskLevel.toLowerCase()}`}>{zone.riskLevel}</span>
                    </div>
                    <p className="popup-reason"><strong>Threat Status:</strong> {zone.riskReason || 'Normal monitoring.'}</p>
                    <div className="popup-row">
                      <span>Population Exposure:</span>
                      <strong>{zone.estimatedPopulation ? zone.estimatedPopulation.toLocaleString() : 'N/A'} citizens</strong>
                    </div>
                    <div className="popup-row">
                      <span>Last Updated:</span>
                      <small>{new Date(zone.updatedAt || Date.now()).toLocaleTimeString()}</small>
                    </div>
                  </div>
                </Popup>
              </Polygon>
            );
          })}

          {/* Render Places Markers */}
          {filteredPlaces.map((place) => {
            if (!place.location || !place.location.coordinates) return null;
            const [lng, lat] = place.location.coordinates;
            const icon = createPlaceIcon(place.kind, place.status);

            return (
              <Marker key={place._id} position={[lat, lng]} icon={icon}>
                <Popup>
                  <div className="map-popup-card">
                    <span className={`popup-kind-badge kind-${place.kind.toLowerCase()}`}>{place.kind}</span>
                    <h3>{place.name}</h3>
                    <div className="popup-row">
                      <span>Status:</span>
                      <strong className={`status-${place.status?.toLowerCase()}`}>{place.status}</strong>
                    </div>
                    <div className="popup-row">
                      <span>Capacity:</span>
                      <strong>{place.capacity} people</strong>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Render Reports Markers */}
          {filteredReports.map((report) => {
            if (!report.location || !report.location.coordinates) return null;
            const [lng, lat] = report.location.coordinates;
            const icon = createReportIcon(report.type, report.status);

            return (
              <Marker key={report._id} position={[lat, lng]} icon={icon}>
                <Popup>
                  <div className="map-popup-card">
                    <span className={`popup-kind-badge report-kind ${report.type === 'RESCUE' ? 'rescue' : ''}`}>
                      {report.type?.replace('_', ' ')}
                    </span>
                    <div className="popup-row">
                      <span>Status:</span>
                      <strong className={`status-${report.status?.toLowerCase()}`}>{report.status}</strong>
                    </div>
                    <p className="popup-desc">{report.description}</p>

                    {report.type === 'RESCUE' && (
                      <div className="popup-rescue-box">
                        <div className="rescue-box-title">🚨 RESCUE TRIAGE DATA</div>
                        <div className="rescue-data-row">
                          <span>Priority Score:</span>
                          <span className="rescue-priority-num">{report.priority}</span>
                        </div>
                        <div className="rescue-data-row">
                          <span>Stranded People:</span>
                          <strong>{report.rescue?.peopleCount || 1}</strong>
                        </div>
                        <div className="rescue-data-row">
                          <span>Medical Emergency:</span>
                          <strong>{report.rescue?.medicalEmergency ? 'YES ⚠️' : 'No'}</strong>
                        </div>
                        <div className="rescue-data-row">
                          <span>Trapped:</span>
                          <strong>{report.rescue?.trapped ? 'YES 🔒' : 'No'}</strong>
                        </div>
                        {report.rescue?.floorInfo && (
                          <div className="rescue-data-row">
                            <span>Location/Floor:</span>
                            <strong>{report.rescue.floorInfo}</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Map Legend & Layer Filter Widget */}
        <div className={`map-legend-widget ${isLegendOpen ? 'open' : 'collapsed'}`}>
          <div className="legend-header" onClick={() => setIsLegendOpen(!isLegendOpen)}>
            <div className="legend-title">
              <span>🗺️</span>
              <h4>Layers & Filters</h4>
            </div>
            <button className="legend-toggle-btn" title="Toggle Legend">
              {isLegendOpen ? '▾' : '▸'}
            </button>
          </div>

          {isLegendOpen && (
            <div className="legend-body">
              {/* Filter Pills */}
              <div className="legend-filters">
                <span className="legend-section-title">Filter Map:</span>
                <div className="filter-pill-group">
                  <button
                    className={`filter-btn ${activeFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('ALL')}
                  >
                    All ({mapData.places.length + mapData.reports.length})
                  </button>
                  <button
                    className={`filter-btn ${activeFilter === 'SHELTERS' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('SHELTERS')}
                  >
                    🏕️ Shelters
                  </button>
                  <button
                    className={`filter-btn ${activeFilter === 'FOOD_MED' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('FOOD_MED')}
                  >
                    🍲 Food/Med
                  </button>
                  <button
                    className={`filter-btn ${activeFilter === 'HAZARDS' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('HAZARDS')}
                  >
                    ⚠️ Hazards
                  </button>
                  <button
                    className={`filter-btn ${activeFilter === 'RESCUE' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('RESCUE')}
                  >
                    🚨 Rescues
                  </button>
                </div>
              </div>

              {/* Risk Level Guide */}
              <div className="legend-risk-guide">
                <span className="legend-section-title">Zone Threat Levels:</span>
                <div className="legend-items-grid">
                  <div className="legend-item"><span className="legend-dot dot-severe"></span> Severe (Evacuate)</div>
                  <div className="legend-item"><span className="legend-dot dot-high"></span> High Risk (Flooding)</div>
                  <div className="legend-item"><span className="legend-dot dot-medium"></span> Medium (Caution)</div>
                  <div className="legend-item"><span className="legend-dot dot-low"></span> Low (Designated Refuge)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Quick Action Button - Direct Child of Page Layout */}
      <div className="floating-action-container">
        <button
          type="button"
          className="floating-report-btn"
          onClick={() => {
            console.log('[MapPage] Opening Report Modal...');
            setIsReportModalOpen(true);
          }}
          title="Submit Ground Report or Urgent Rescue"
        >
          <span className="report-pulse-icon">🚨</span>
          <span className="btn-label">Report Hazard / Rescue</span>
        </button>
      </div>

      {/* Embedded AI Emergency Chatbot Widget */}
      <ChatWidget />

      {/* Citizen Report Modal */}
      {isReportModalOpen && (
        <ReportModal
          isOpen={isReportModalOpen}
          selectedCoords={selectedCoords}
          initialCoords={selectedCoords}
          onClose={() => setIsReportModalOpen(false)}
          onSuccess={handleReportSuccess}
          onEnableMapPick={() => {
            setIsReportModalOpen(false);
            setIsPickingLocation(true);
          }}
          onPickOnMap={() => {
            setIsReportModalOpen(false);
            setIsPickingLocation(true);
          }}
        />
      )}
    </div>
  );
}
