import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../src/db.js';
import Zone from '../models/Zone.js';
import Alert from '../models/Alert.js';
import FeedItem from '../models/FeedItem.js';

async function runMockAlert() {
  console.log('[MockAlert] Connecting to database...');
  await connectDB();

  // Find North Harbor Ward or the first available zone
  let zone = await Zone.findOne({ name: /North Harbor/i });
  if (!zone) {
    zone = await Zone.findOne({});
  }

  if (!zone) {
    console.error('[MockAlert] Error: No zones found in database. Please run `npm run seed` first.');
    process.exit(1);
  }

  console.log(`[MockAlert] Target zone selected: ${zone.name} (${zone._id})`);

  // Force SEVERE status on zone
  zone.riskLevel = 'SEVERE';
  zone.riskReason = 'DEMO MOCK: Severe Category 4 Cyclone Warning (140mm rainfall & 95km/h gale winds predicted)';
  zone.updatedAt = new Date();
  await zone.save();

  // Create FeedItem
  const feedItem = new FeedItem({
    source: 'OPEN_METEO',
    zone: zone._id,
    severity: 'SEVERE',
    summary: `DEMO MOCK: Forced SEVERE cyclone alert for ${zone.name}`,
    raw: { mock: true, precipitation24h: 140, maxWind24h: 95 },
    fetchedAt: new Date()
  });
  await feedItem.save();

  // Create SEVERE DRAFT Alert
  const draftAlert = new Alert({
    zone: zone._id,
    title: `DRAFT ALERT: SEVERE Cyclone Warning for ${zone.name}`,
    message: `DEMO EMERGENCY DRAFT: Category 4 Cyclone making landfall in ${zone.name}. Severe sea surge and structure-damaging winds expected. Seek high ground or designated shelter immediately. Call 112 for emergency rescue.`,
    severity: 'SEVERE',
    status: 'DRAFT',
    source: 'OPEN_METEO',
    createdAt: new Date()
  });

  await draftAlert.save();

  console.log('[MockAlert] Successfully generated SEVERE cyclone draft alert!');
  console.log(`[MockAlert] Alert ID: ${draftAlert._id}`);
  console.log(`[MockAlert] Title: ${draftAlert.title}`);
  console.log(`[MockAlert] Status: ${draftAlert.status}`);

  await mongoose.disconnect();
  process.exit(0);
}

runMockAlert().catch((err) => {
  console.error('[MockAlert] Error:', err);
  process.exit(1);
});
