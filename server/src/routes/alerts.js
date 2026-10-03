import express from 'express';
import Alert from '../../models/Alert.js';

const router = express.Router();

// GET /api/alerts -> list of SENT alerts, newest first
router.get('/', async (req, res, next) => {
  try {
    const alerts = await Alert.find({ status: 'SENT' })
      .populate('zone', 'name riskLevel riskReason estimatedPopulation')
      .sort({ sentAt: -1, createdAt: -1 })
      .lean();

    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

export default router;
