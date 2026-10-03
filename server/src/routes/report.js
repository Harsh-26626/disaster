import express from 'express';
import Report from '../../models/Report.js';

const router = express.Router();

// Helper to calculate rescue priority:
// Base peopleCount + 40 (medicalEmergency) + 25 (hasChildrenOrElderly) + 20 (trapped)
function calculateRescuePriority(rescue = {}) {
  const peopleCount = Number(rescue.peopleCount) || 1;
  let priority = peopleCount;
  if (rescue.medicalEmergency) priority += 40;
  if (rescue.hasChildrenOrElderly) priority += 25;
  if (rescue.trapped) priority += 20;
  return priority;
}

// POST /api/report -> body: report fields; returns created report (with status/priority)
router.post('/', async (req, res, next) => {
  try {
    const { type, description, location, rescue, status } = req.body;

    if (!type || !description || !location || !location.coordinates) {
      return res.status(400).json({
        error: 'Missing required report fields: type, description, and location with coordinates [lng, lat]'
      });
    }

    const validTypes = ['FLOODED_ROAD', 'BLOCKED_ROUTE', 'SHELTER_FULL', 'RESCUE'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    let reportPriority = null;
    let rescueData = {};

    if (type === 'RESCUE') {
      rescueData = {
        peopleCount: Number(rescue?.peopleCount) || 1,
        hasChildrenOrElderly: Boolean(rescue?.hasChildrenOrElderly),
        medicalEmergency: Boolean(rescue?.medicalEmergency),
        trapped: Boolean(rescue?.trapped),
        floorInfo: rescue?.floorInfo || ''
      };
      reportPriority = calculateRescuePriority(rescueData);
    }

    const report = new Report({
      type,
      description,
      location: {
        type: 'Point',
        coordinates: location.coordinates
      },
      status: status || 'UNVERIFIED',
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
