import express from 'express';
import Report from '../../models/Report.js';

const router = express.Router();

/**
 * Calculates priority score for RESCUE reports based on documented weighted formula:
 * Priority = peopleCount + (medicalEmergency ? +40) + (hasChildrenOrElderly ? +25) + (trapped ? +20)
 * 
 * Weights:
 * - Medical emergency (+40): critical immediate risk to life
 * - Children or elderly (+25): high vulnerability individuals
 * - Trapped (+20): confined, cannot self-evacuate
 * - Base peopleCount (+1 per person): scale of rescue operation
 */
export function calculateRescuePriority(rescue = {}) {
  const peopleCount = Math.max(1, parseInt(rescue.peopleCount, 10) || 1);
  let priority = peopleCount;
  if (rescue.medicalEmergency === true || rescue.medicalEmergency === 'true') priority += 40;
  if (rescue.hasChildrenOrElderly === true || rescue.hasChildrenOrElderly === 'true') priority += 25;
  if (rescue.trapped === true || rescue.trapped === 'true') priority += 20;
  return priority;
}

// Allowed hazard report types that participate in confidence-based clustering
const HAZARD_TYPES = ['FLOODED_ROAD', 'BLOCKED_ROUTE', 'SHELTER_FULL'];
const ALL_VALID_TYPES = [...HAZARD_TYPES, 'RESCUE'];

// POST /api/report -> body: report fields; returns created report (with status/priority)
router.post('/', async (req, res, next) => {
  try {
    const { type, description, location, rescue, status } = req.body;

    // 1. Validate type
    if (!type || !ALL_VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: `Invalid or missing report type. Must be one of: ${ALL_VALID_TYPES.join(', ')}`
      });
    }

    // 2. Validate description
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        error: 'Description is required and cannot be empty.'
      });
    }

    // 3. Validate location and coordinates
    if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      return res.status(400).json({
        error: 'Location with coordinates [lng, lat] is required.'
      });
    }

    const [lng, lat] = location.coordinates.map(Number);
    if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({
        error: 'Valid coordinates are required: longitude must be between -180 and 180, latitude between -90 and 90.'
      });
    }

    let reportPriority = null;
    let rescueData = {};
    let initialStatus = status || 'UNVERIFIED';

    // 4. Handle RESCUE reports with documented weighted formula
    if (type === 'RESCUE') {
      rescueData = {
        peopleCount: Math.max(1, parseInt(rescue?.peopleCount, 10) || 1),
        hasChildrenOrElderly: Boolean(rescue?.hasChildrenOrElderly),
        medicalEmergency: Boolean(rescue?.medicalEmergency),
        trapped: Boolean(rescue?.trapped),
        floorInfo: typeof rescue?.floorInfo === 'string' ? rescue.floorInfo.trim() : ''
      };
      reportPriority = calculateRescuePriority(rescueData);
    }

    // 5. Confidence check for hazard reports (FLOODED_ROAD, BLOCKED_ROUTE, SHELTER_FULL):
    // $near query within ~300 m for other reports of the same type from the last 6 hours;
    // if >=1 other exists, set status LIKELY on both (new report and any nearby unverified reports).
    if (HAZARD_TYPES.includes(type) && (!status || status === 'UNVERIFIED')) {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

      const nearbyReports = await Report.find({
        type,
        status: { $ne: 'RESOLVED' },
        createdAt: { $gte: sixHoursAgo },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            $maxDistance: 300 // ~300 meters
          }
        }
      });

      if (nearbyReports.length >= 1) {
        initialStatus = 'LIKELY';

        // Update all nearby unverified reports of same type to LIKELY as well
        const unverifiedNearbyIds = nearbyReports
          .filter(r => r.status === 'UNVERIFIED')
          .map(r => r._id);

        if (unverifiedNearbyIds.length > 0) {
          await Report.updateMany(
            { _id: { $in: unverifiedNearbyIds } },
            { $set: { status: 'LIKELY' } }
          );
        }
      }
    }

    const report = new Report({
      type,
      description: description.trim(),
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      status: initialStatus,
      priority: reportPriority,
      rescue: rescueData
    });

    const savedReport = await report.save();
    res.status(201).json(savedReport);
  } catch (error) {
    next(error);
  }
});

export default router;
