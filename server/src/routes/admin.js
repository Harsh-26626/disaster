import express from 'express';
import mongoose from 'mongoose';
import Zone from '../../models/Zone.js';
import Report from '../../models/Report.js';
import Alert from '../../models/Alert.js';
import FeedItem from '../../models/FeedItem.js';
import { adminAuth } from '../../middleware/auth.js';

const router = express.Router();

// Apply admin authentication to all routes in this router
router.use(adminAuth);

// GET /api/admin/feeds -> { zones, draftAlerts:[...], recentFeedItems:[...] }
router.get('/feeds', async (req, res, next) => {
  try {
    const [zones, draftAlerts, recentFeedItems] = await Promise.all([
      Zone.find({}, 'name riskLevel riskReason estimatedPopulation centroid polygon updatedAt').lean(),
      Alert.find({ status: 'DRAFT' }).populate('zone', 'name riskLevel').sort({ createdAt: -1 }).lean(),
      FeedItem.find({}).populate('zone', 'name').sort({ fetchedAt: -1 }).limit(30).lean()
    ]);

    res.json({
      zones,
      draftAlerts,
      recentFeedItems
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports -> all reports, rescue sorted by priority desc
router.get('/reports', async (req, res, next) => {
  try {
    const reports = await Report.find({}).lean();

    // Rescue reports sorted by priority descending at top, then non-rescue by createdAt desc
    reports.sort((a, b) => {
      if (a.type === 'RESCUE' && b.type === 'RESCUE') {
        return (b.priority || 0) - (a.priority || 0);
      }
      if (a.type === 'RESCUE') return -1;
      if (b.type === 'RESCUE') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(reports);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/reports/:id -> body: { status } (VERIFIED|RESOLVED)
router.patch('/reports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['VERIFIED', 'RESOLVED', 'LIKELY', 'UNVERIFIED'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    const report = await Report.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/alerts -> body: { draftId?, zoneId, title?, message? }; builds final message if not provided and marks it SENT
router.post('/alerts', async (req, res, next) => {
  try {
    const { draftId, zoneId, title, message } = req.body;

    let alert;
    if (draftId) {
      alert = await Alert.findById(draftId);
      if (!alert) {
        return res.status(404).json({ error: 'Draft alert not found' });
      }
      if (title) alert.title = title;
      if (message) alert.message = message;
      alert.status = 'SENT';
      alert.sentAt = new Date();
      await alert.save();
    } else {
      if (!zoneId) {
        return res.status(400).json({ error: 'Either draftId or zoneId is required' });
      }

      const zone = await Zone.findById(zoneId);
      if (!zone) {
        return res.status(404).json({ error: 'Zone not found' });
      }

      const alertTitle = title || `GOVT ALERT: SEVERE WEATHER IN ${zone.name.toUpperCase()}`;
      const alertMessage = message || `EMERGENCY ALERT for ${zone.name}: Severe flooding risk detected. Avoid low-lying river areas. Move to designated shelters immediately. Dial 112 for search & rescue assistance.`;

      alert = new Alert({
        zone: zone._id,
        title: alertTitle,
        message: alertMessage,
        severity: zone.riskLevel || 'HIGH',
        status: 'SENT',
        source: 'MANUAL',
        sentAt: new Date()
      });
      await alert.save();
    }

    const populatedAlert = await Alert.findById(alert._id).populate('zone', 'name riskLevel riskReason estimatedPopulation');
    res.status(201).json(populatedAlert);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/feeds/refresh -> manual refresh endpoint for demos
router.post('/feeds/refresh', async (req, res, next) => {
  try {
    // Scaffold hook for Chunk 1 ingestion refresh
    res.json({ message: 'Feeds refresh initiated', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

export default router;
