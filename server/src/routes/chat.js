import express from 'express';
import { GoogleGenAI } from '@google/genai';
import Zone from '../../models/Zone.js';
import Place from '../../models/Place.js';
import Report from '../../models/Report.js';
import Alert from '../../models/Alert.js';

const router = express.Router();

// Fallback response generator if API fails or rate-limited
function buildFallbackReply(latestAlert, openPlaces) {
  let reply = 'Disaster Response Bot: All emergency services are actively monitoring the district. For any life-threatening emergency, dial 112 immediately.';
  if (latestAlert) {
    reply += ` Latest official alert: "${latestAlert.title} - ${latestAlert.message}".`;
  }
  const openShelters = openPlaces.filter((p) => p.kind === 'SHELTER');
  if (openShelters.length > 0) {
    reply += ` Currently ${openShelters.length} emergency shelters are open. Please follow safe evacuation routes and refer to the live map.`;
  }
  return reply;
}

// POST /api/chat -> body: { message } returns { reply }
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // 1. Fetch live district data from MongoDB
    const [zones, openPlaces, verifiedReports, latestSentAlert] = await Promise.all([
      Zone.find({}, 'name riskLevel riskReason estimatedPopulation').lean(),
      Place.find({ status: 'OPEN' }, 'name kind capacity location').lean(),
      Report.find(
        { status: { $in: ['VERIFIED', 'LIKELY'] } },
        'type description status location'
      ).lean(),
      Alert.findOne({ status: 'SENT' })
        .populate('zone', 'name')
        .sort({ sentAt: -1, createdAt: -1 })
        .lean()
    ]);

    // 2. Prepare context object for Gemini
    const context = {
      latestAlert: latestSentAlert
        ? {
            title: latestSentAlert.title,
            message: latestSentAlert.message,
            severity: latestSentAlert.severity,
            zone: latestSentAlert.zone?.name,
            sentAt: latestSentAlert.sentAt
          }
        : null,
      zones: zones.map((z) => ({
        name: z.name,
        riskLevel: z.riskLevel,
        riskReason: z.riskReason,
        population: z.estimatedPopulation
      })),
      openPlaces: openPlaces.map((p) => ({
        name: p.name,
        kind: p.kind,
        capacity: p.capacity,
        coordinates: p.location?.coordinates // [lng, lat]
      })),
      verifiedOrLikelyHazardReports: verifiedReports.map((r) => ({
        type: r.type,
        description: r.description,
        status: r.status,
        coordinates: r.location?.coordinates
      }))
    };

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('[Chatbot] GEMINI_API_KEY is not set. Using fallback reply.');
      return res.json({ reply: buildFallbackReply(latestSentAlert, openPlaces) });
    }

    // 3. Build system prompt instructing Gemini to answer ONLY from the live data
    const systemInstruction = `You are an AI Disaster Response Assistant for citizens during a district emergency.
Strict rules you MUST follow:
1. Answer ONLY based on the provided live district context below. Never invent places, roads, or status.
2. Be short, calm, clear, and reassuring.
3. If the citizen asks about a route, road, or shelter not covered in the data, state clearly that you do not have verified data for it yet.
4. Mention open shelter names, food hubs, and roads to avoid where relevant to the user query.
5. ALWAYS conclude or include the national helpline: "For life-threatening emergencies, dial 112 immediately."

LIVE DISTRICT CONTEXT:
${JSON.stringify(context, null, 2)}`;

    // 4. Initialize Gemini client and generate content
    const ai = new GoogleGenAI({ apiKey });

    let reply = '';
    try {
      // Primary model: gemini-3.5-flash-lite for fastest response and high throughput
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: message.trim(),
        config: {
          systemInstruction,
          temperature: 0.2
        }
      });
      reply = response.text?.trim() || '';
    } catch (modelErr) {
      console.warn('[Chatbot] gemini-3.5-flash-lite error, attempting gemini-3.8-flash fallback:', modelErr.message);
      try {
        const response2 = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: message.trim(),
          config: {
            systemInstruction,
            temperature: 0.2
          }
        });
        reply = response2.text?.trim() || '';
      } catch (err2) {
        console.error('[Chatbot] Gemini API call failed:', err2.message);
        // Fall back to hardcoded reply if external API fails
        reply = buildFallbackReply(latestSentAlert, openPlaces);
      }
    }

    if (!reply) {
      reply = buildFallbackReply(latestSentAlert, openPlaces);
    }

    res.json({ reply });
  } catch (error) {
    console.error('[Chatbot] Unexpected error:', error);
    res.json({
      reply: 'Disaster Response Bot: Systems are active. For immediate life-threatening emergencies, call 112 immediately.'
    });
  }
});

export default router;
