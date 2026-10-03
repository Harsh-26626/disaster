import Place from '../../models/Place.js';
import Report from '../../models/Report.js';

// Calculate distance between two coordinates [lng, lat] in kilometers using Haversine formula
export function calculateDistanceKm(coord1, coord2) {
  if (!coord1 || !coord2) return null;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.round(dist * 10) / 10; // Rounded to 1 decimal place, e.g. 1.2
}

// Extract a concise road/landmark name from a report description
function extractShortRoadName(description) {
  if (!description) return '';
  // Match proper noun road/bridge/bypass/pier/dock names
  const properRoadMatch = description.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Road|Bridge|Bypass|Street|Avenue|Highway|Dock|Pier|Canal|Flyover|Junction|Boulevard)(?:\s+(?:approach|road))?)\b/
  );
  if (properRoadMatch && properRoadMatch[1]) {
    return properRoadMatch[1].trim();
  }
  const phraseMatch = description.match(/(?:near|across|at|on|blocking)\s+([A-Za-z0-9\s]{3,25})/i);
  if (phraseMatch && phraseMatch[1]) {
    return phraseMatch[1].trim();
  }
  return description.split(/[.,;]/)[0].substring(0, 25).trim();
}

/**
 * Builds an official SMS-style government alert message under 300 characters.
 * Includes:
 * - severity
 * - zone name
 * - roads/areas to avoid (from VERIFIED / LIKELY FLOODED_ROAD & BLOCKED_ROUTE reports)
 * - nearest OPEN shelter (with approximate distance in km using MongoDB $near)
 * - nearest OPEN food point (with approximate distance in km using MongoDB $near)
 * - estimated population in the zone
 * - emergency helpline 112
 */
export async function buildGovernmentSmsAlert(zone, customSeverity) {
  const severity = customSeverity || zone.riskLevel || 'HIGH';
  const centroid = zone.centroid;

  // 1. Find nearest OPEN shelter using MongoDB 2dsphere $near
  let nearestShelter = null;
  let shelterDistance = null;
  try {
    nearestShelter = await Place.findOne({
      kind: 'SHELTER',
      status: 'OPEN',
      location: {
        $near: {
          $geometry: centroid
        }
      }
    }).lean();
    if (nearestShelter && nearestShelter.location?.coordinates) {
      shelterDistance = calculateDistanceKm(centroid.coordinates, nearestShelter.location.coordinates);
    }
  } catch (err) {
    console.warn('[AlertBuilder] Could not find nearest shelter via $near:', err.message);
  }

  // 2. Find nearest OPEN food distribution point using MongoDB 2dsphere $near
  let nearestFood = null;
  let foodDistance = null;
  try {
    nearestFood = await Place.findOne({
      kind: 'FOOD',
      status: 'OPEN',
      location: {
        $near: {
          $geometry: centroid
        }
      }
    }).lean();
    if (nearestFood && nearestFood.location?.coordinates) {
      foodDistance = calculateDistanceKm(centroid.coordinates, nearestFood.location.coordinates);
    }
  } catch (err) {
    console.warn('[AlertBuilder] Could not find nearest food point via $near:', err.message);
  }

  // 3. Find VERIFIED / LIKELY hazard reports (roads to avoid) near zone
  let roadsToAvoid = [];
  try {
    const hazardReports = await Report.find({
      type: { $in: ['FLOODED_ROAD', 'BLOCKED_ROUTE'] },
      status: { $in: ['VERIFIED', 'LIKELY'] },
      location: {
        $near: {
          $geometry: centroid,
          $maxDistance: 15000 // within 15km
        }
      }
    })
      .limit(2)
      .lean();

    roadsToAvoid = hazardReports
      .map((r) => extractShortRoadName(r.description))
      .filter(Boolean);
  } catch (err) {
    console.warn('[AlertBuilder] Could not find hazard reports via $near:', err.message);
  }

  // 4. Format population string
  const popStr = zone.estimatedPopulation
    ? zone.estimatedPopulation >= 1000
      ? `Pop ~${Math.round(zone.estimatedPopulation / 1000)}k`
      : `Pop ~${zone.estimatedPopulation}`
    : '';

  // 5. Construct parts
  const header = `GOVT ALERT [${severity}] ${zone.name}${popStr ? ` (${popStr})` : ''}:`;

  let avoidPart = '';
  if (roadsToAvoid.length > 0) {
    avoidPart = ` AVOID: ${roadsToAvoid.join(', ')}.`;
  }

  let shelterPart = '';
  if (nearestShelter) {
    const sName = nearestShelter.name.length > 28 ? nearestShelter.name.substring(0, 26) + '..' : nearestShelter.name;
    shelterPart = ` Shelter: ${sName}${shelterDistance !== null ? ` (${shelterDistance}km)` : ''}.`;
  }

  let foodPart = '';
  if (nearestFood) {
    const fName = nearestFood.name.length > 26 ? nearestFood.name.substring(0, 24) + '..' : nearestFood.name;
    foodPart = ` Food: ${fName}${foodDistance !== null ? ` (${foodDistance}km)` : ''}.`;
  }

  const footer = ' Emergency: Dial 112.';

  let sms = `${header}${avoidPart}${shelterPart}${foodPart}${footer}`;

  // Ensure strict adherence to under ~300 characters
  if (sms.length > 295) {
    sms = sms.substring(0, 280) + '... Call 112.';
  }

  return sms;
}
