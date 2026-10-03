import React, { useState, useEffect } from 'react';
import { createReport } from '../api.js';

export default function ReportModal({ isOpen, onClose, selectedCoords, onEnableMapPick, onSuccess }) {
  const [type, setType] = useState('FLOODED_ROAD');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  
  // Rescue specific fields
  const [peopleCount, setPeopleCount] = useState(1);
  const [hasChildrenOrElderly, setHasChildrenOrElderly] = useState(false);
  const [medicalEmergency, setMedicalEmergency] = useState(false);
  const [trapped, setTrapped] = useState(false);
  const [floorInfo, setFloorInfo] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedCoords) {
      setLat(selectedCoords[0].toFixed(6));
      setLng(selectedCoords[1].toFixed(6));
    }
  }, [selectedCoords]);

  if (!isOpen) return null;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
      },
      (err) => {
        setError(`Failed to get location: ${err.message}`);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setError('Please provide valid latitude and longitude coordinates.');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a brief description of the incident.');
      return;
    }

    const payload = {
      type,
      description: description.trim(),
      location: {
        type: 'Point',
        coordinates: [parsedLng, parsedLat] // GeoJSON [lng, lat]
      }
    };

    if (type === 'RESCUE') {
      payload.rescue = {
        peopleCount: parseInt(peopleCount, 10) || 1,
        hasChildrenOrElderly,
        medicalEmergency,
        trapped,
        floorInfo: floorInfo.trim()
      };
    }

    try {
      setLoading(true);
      const created = await createReport(payload);
      setLoading(false);
      onSuccess(created);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to submit report.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2>🚨 Submit Ground Incident / Rescue Request</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Report Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="FLOODED_ROAD">🌊 Flooded Road / Inundated Street</option>
              <option value="BLOCKED_ROUTE">🚧 Blocked Evacuation Route / Debris</option>
              <option value="SHELTER_FULL">🚫 Shelter Capacity Reached / Full</option>
              <option value="RESCUE">🚨 Emergency Search & Rescue Request</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              rows="3"
              placeholder="Describe the situation (e.g., 3 feet deep water near river bridge, road impassable)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Location Coordinates</label>
            <div className="coords-picker-row">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
              />
            </div>
            <div className="location-buttons">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onEnableMapPick}
              >
                📍 Tap Location on Map
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleUseMyLocation}
              >
                🎯 Use My GPS Location
              </button>
            </div>
          </div>

          {type === 'RESCUE' && (
            <div className="rescue-fields-section">
              <h3 className="rescue-title">Emergency Rescue Parameters</h3>
              
              <div className="form-group">
                <label>Number of People Stranded</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(e.target.value)}
                  required
                />
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hasChildrenOrElderly}
                    onChange={(e) => setHasChildrenOrElderly(e.target.checked)}
                  />
                  <span>Children or Elderly Present (+25 Priority)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={medicalEmergency}
                    onChange={(e) => setMedicalEmergency(e.target.checked)}
                  />
                  <span>Immediate Medical Emergency (+40 Priority)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={trapped}
                    onChange={(e) => setTrapped(e.target.checked)}
                  />
                  <span>Trapped / No Escape Route (+20 Priority)</span>
                </label>
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label>Floor / Building / Landmark Info</label>
                <input
                  type="text"
                  placeholder="e.g. 2nd floor balcony, blue roof building near landmark"
                  value={floorInfo}
                  onChange={(e) => setFloorInfo(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
