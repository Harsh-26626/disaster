import express from 'express';
import Zone from '../../models/Zone.js';
import Place from '../../models/Place.js';
import Report from '../../models/Report.js';

const router = express.Router();

// GET /api/map -> { zones:[...], places:[...], reports:[...non-resolved...] }
router.get('/', async (req, res, next) => {
  try {
    const [zones, places, reports] = await Promise.all([
      Zone.find({}).lean(),
      Place.find({}).lean(),
      Report.find({ status: { $ne: 'RESOLVED' } }).sort({ createdAt: -1 }).lean()
    ]);

    res.json({
      zones,
      places,
      reports
    });
  } catch (error) {
    next(error);
  }
});

export default router;
