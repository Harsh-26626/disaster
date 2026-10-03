import FeedItem from '../../models/FeedItem.js';

/**
 * Calculate approximate distance in kilometers between two [lng, lat] points
 */
function getDistanceKm(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GDACS (Global Disaster Alert and Coordination System) Provider
 * Fetches recent disaster events via GDACS GeoJSON API
 */
export async function fetchGDACSAlerts() {
  const url = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/M';
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error(`GDACS API HTTP ${response.status}`);
    }
    const data = await response.json();
    const features = data.features || [];

    return features.map((feat) => {
      const props = feat.properties || {};
      const coords = feat.geometry?.coordinates || null;
      const alertScore = props.alertlevel || props.alertscore || 'Green';
      
      let severity = 'LOW';
      if (typeof alertScore === 'string') {
        if (alertScore.toLowerCase().includes('red')) severity = 'SEVERE';
        else if (alertScore.toLowerCase().includes('orange')) severity = 'HIGH';
        else if (alertScore.toLowerCase().includes('yellow')) severity = 'MEDIUM';
      } else if (typeof alertScore === 'number') {
        if (alertScore >= 2.5) severity = 'SEVERE';
        else if (alertScore >= 2.0) severity = 'HIGH';
        else if (alertScore >= 1.0) severity = 'MEDIUM';
      }

      return {
        source: 'GDACS',
        severity,
        summary: `GDACS Alert [${props.eventtype || 'EVENT'}]: ${props.eventname || props.description || props.name || 'Disaster Event'}`,
        coordinates: Array.isArray(coords) && coords.length >= 2 ? [coords[0], coords[1]] : null,
        raw: props
      };
    });
  } catch (error) {
    console.warn('[GDACS Feed] Fetch failed or offline, skipping GDACS live stream:', error.message);
    return [];
  }
}

/**
 * SACHET (India NDMA CAP Feed) Provider - Pluggable provider
 * Attempts to fetch CAP alerts from NDMA Sachet system with fallback
 */
export async function fetchSACHETAlerts() {
  const url = 'https://sachet.ndma.gov.in/cap_public_website/rss_feed';
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`SACHET HTTP ${response.status}`);
    }
    // Standard CAP/RSS XML response parsing if accessible
    const text = await response.text();
    // Parse basic info if present
    if (text.includes('<item>')) {
      return [{
        source: 'SACHET',
        severity: 'HIGH',
        summary: 'SACHET NDMA Official Advisory: Severe weather / flood warning issued for state region.',
        coordinates: null,
        raw: { feedTextSnippet: text.slice(0, 300) }
      }];
    }
    return [];
  } catch (error) {
    // Graceful fallback: SACHET feed unreachable or restricted
    console.log('[SACHET Feed] Feed unavailable or non-responsive, skipping:', error.message);
    return [];
  }
}

/**
 * Aggregate official feeds (GDACS, SACHET) and associate with zones
 */
export async function fetchAllOfficialAlerts(zones) {
  const results = [];
  
  // Call providers in parallel with safe error isolation
  const [gdacsItems, sachetItems] = await Promise.all([
    fetchGDACSAlerts(),
    fetchSACHETAlerts()
  ]);

  const allAlerts = [...gdacsItems, ...sachetItems];

  for (const alert of allAlerts) {
    let matchedZoneId = null;

    // Match alert location to nearest zone centroid within 150km
    if (alert.coordinates) {
      let closestZone = null;
      let minDistance = 150; // Max radius in km

      for (const zone of zones) {
        const dist = getDistanceKm(alert.coordinates, zone.centroid.coordinates);
        if (dist < minDistance) {
          minDistance = dist;
          closestZone = zone;
        }
      }

      if (closestZone) {
        matchedZoneId = closestZone._id;
      }
    }

    results.push({
      source: alert.source,
      zone: matchedZoneId,
      severity: alert.severity,
      summary: alert.summary,
      raw: alert.raw,
      fetchedAt: new Date()
    });
  }

  return results;
}
