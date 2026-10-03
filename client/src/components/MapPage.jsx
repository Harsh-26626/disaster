import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Marker, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import { getMapData, getSentAlerts } from '../api.js';
import { createPlaceIcon, createReportIcon } from '../utils/leafletIcons.js';
import ReportModal from './ReportModal.jsx';
import ChatWidget from './ChatWidget.jsx';

// Leaflet map click listener component
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
      case 'SEVERE': return { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.45 };
      case 'HIGH': return { color: '#ea580c', fillColor: '#f97316', fillOpacity: 0.40 };
      case 'MEDIUM': return { color: '#ca8a04', fillColor: '#eab308', fillOpacity: 0.35 };
      default: return { color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.25 };
    }
  };

  const latestAlert = alerts.length > 0 ? alerts[0] : null;

  return (
    <div className="map-page-layout">
      {/* Top Header Controls */}
      <header className="map-header">
        <div className="brand-logo">
          <span className="logo-icon">📡</span>
          <div>
            <h1>Disaster Intel & Emergency Response</h1>
            <span className="sub-tag">Live Citizen Map & Command Portal</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className={`tile-toggle-btn ${isSatellite ? 'active' : ''}`}
            onClick={() => setIsSatellite(!isSatellite)}
          >
            {isSatellite ? '🗺️ Standard Map' : '🛰️ Satellite Layer'}
          </button>

          <Link to="/sms" className="header-nav-btn">
            📱 Phone SMS Inbox ({alerts.length})
          </Link>

          <Link to="/admin" className="header-nav-btn admin-btn">
            🛡️ Admin Portal
          </Link>
        </div>
      </header>

      {/* Latest Alert Banner */}
      {latestAlert && (
        <div className={`alert-banner severity-${latestAlert.severity?.toLowerCase()}`}>
          <div className="banner-content">
            <span className="banner-badge">🚨 {latestAlert.severity} ALERT</span>
            <div className="banner-text">
              <strong>{latestAlert.title}:</strong> {latestAlert.message}
            </div>
            <Link to="/sms" className="banner-link">View Inbox →</Link>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <span>✅ {toastMessage}</span>
        </div>
      )}

      {/* Picking Location Indicator Banner */}
      {isPickingLocation && (
        <div className="picking-banner">
          <span>📍 Click anywhere on the map to set report coordinates</span>
          <button onClick={() => { setIsPickingLocation(false); setIsReportModalOpen(true); }}>
            Cancel
          </button>
        </div>
      )}

      {/* Main Full-Screen Map Container */}
      <div className="map-wrapper">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          {/* Tile Layer: OpenStreetMap or Esri World Imagery Satellite */}
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
            // GeoJSON polygon coordinates [lng, lat] -> Leaflet [lat, lng]
            const positions = zone.polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
            const style = getZoneColor(zone.riskLevel);

            return (
              <Polygon key={zone._id} positions={positions} pathOptions={style}>
                <Tooltip sticky>
                  <strong>{zone.name}</strong> - <span className={`badge badge-${zone.riskLevel.toLowerCase()}`}>{zone.riskLevel}</span>
                </Tooltip>
                <Popup>
                  <div className="map-popup-card">
                    <h3>{zone.name}</h3>
                    <div className="popup-row">
                      <span>Risk Level:</span>
                      <strong className={`badge badge-${zone.riskLevel.toLowerCase()}`}>{zone.riskLevel}</strong>
                    </div>
                    <p className="popup-reason"><strong>Details:</strong> {zone.riskReason || 'Normal monitoring.'}</p>
                    <div className="popup-row">
                      <span>Population Exposure:</span>
                      <strong>{zone.estimatedPopulation ? zone.estimatedPopulation.toLocaleString() : 'N/A'} citizens</strong>
                    </div>
                  </div>
                </Popup>
              </Polygon>
            );
          })}

          {/* Render Places Markers */}
          {mapData.places.map((place) => {
            if (!place.location || !place.location.coordinates) return null;
            const [lng, lat] = place.location.coordinates;
            const icon = createPlaceIcon(place.kind, place.status);

            return (
              <Marker key={place._id} position={[lat, lng]} icon={icon}>
                <Popup>
                  <div className="map-popup-card">
                    <span className="popup-kind-badge">{place.kind}</span>
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
          {mapData.reports.map((report) => {
            if (!report.location || !report.location.coordinates) return null;
            const [lng, lat] = report.location.coordinates;
            const icon = createReportIcon(report.type, report.status);

            return (
              <Marker key={report._id} position={[lat, lng]} icon={icon}>
                <Popup>
                  <div className="map-popup-card">
                    <span className="popup-kind-badge report-kind">{report.type?.replace('_', ' ')}</span>
                    <div className="popup-row">
                      <span>Status:</span>
                      <strong className={`status-${report.status?.toLowerCase()}`}>{report.status}</strong>
                    </div>
                    <p className="popup-desc">{report.description}</p>
                    
                    {report.type === 'RESCUE' && (
                      <div className="popup-rescue-box">
                        <strong>🚨 RESCUE PARAMETERS</strong>
                        <div>Priority Score: <span className="rescue-priority-num">{report.priority}</span></div>
                        <div>People Stranded: {report.rescue?.peopleCount || 1}</div>
                        <div>Medical Emergency: {report.rescue?.medicalEmergency ? 'YES ⚠️' : 'No'}</div>
                        <div>Trapped: {report.rescue?.trapped ? 'YES 🔒' : 'No'}</div>
                        {report.rescue?.floorInfo && <div>Floor/Location: {report.rescue.floorInfo}</div>}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Floating Action Bar */}
      <div className="map-floating-controls">
        <button
          className="btn-report-disaster"
          onClick={() => setIsReportModalOpen(true)}
        >
          🚨 Report Incident / Request Rescue
        </button>
      </div>

      {/* Floating Chat Widget */}
      <ChatWidget />

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedCoords={selectedCoords}
        onEnableMapPick={() => {
          setIsReportModalOpen(false);
          setIsPickingLocation(true);
        }}
        onSuccess={handleReportSuccess}
      />
    </div>
  );
}
