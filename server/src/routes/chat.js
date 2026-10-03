import express from 'express';
import Zone from '../../models/Zone.js';
import Place from '../../models/Place.js';
import Report from '../../models/Report.js';
import Alert from '../../models/Alert.js';

const router = express.Router();

// POST /api/chat -> body: { message } returns { reply }
router.post('/', async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Default response context for Chunk 0 foundation:
    // Full Anthropic Claude live prompting is wired in Chunk 6
    const latestAlert = await Alert.findOne({ status: 'SENT' }).sort({ sentAt: -1 });
    const openShelters = await Place.countDocuments({ kind: 'SHELTER', status: 'OPEN' });

    let reply = `Disaster Response Bot: We are monitoring the situation. For immediate life-threatening emergencies, dial 112 immediately.`;
    if (latestAlert) {
      reply += ` Latest official alert: "${latestAlert.title} - ${latestAlert.message}".`;
    }
    reply += ` Currently ${openShelters} emergency shelters are verified open in the district. Stay tuned to live map updates.`;

    res.json({ reply });
  } catch (error) {
    // Hardcoded fallback response to ensure it never crashes
    res.json({
      reply: 'Emergency Response Bot: Systems are active. For immediate life-threatening assistance, call national helpline 112 immediately.'
    });
  }
});

export default router;
