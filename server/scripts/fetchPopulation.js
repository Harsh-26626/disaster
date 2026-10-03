import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../src/db.js';
import Zone from '../models/Zone.js';

/**
 * WorldPop Population Stats API Service
 * Endpoint: https://api.worldpop.org/v1/services/stats?dataset=wpgppop&year=2020&geojson=...
 * Async Workflow:
 * 1. Submit geometry -> Returns taskid
 * 2. Poll https://api.worldpop.org/v1/tasks/{taskid} until status is finished/completed
 */

async function fetchWorldPopStats(geometry) {
  // Strategy 1: Try bare geometry first
  let payload = geometry;
  let taskid = await submitWorldPopTask(payload);

  // Strategy 2: If bare geometry fails, retry with FeatureCollection
  if (!taskid) {
    console.log('[WorldPop] Bare geometry returned no taskid, retrying with FeatureCollection...');
    payload = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: geometry
        }
      ]
    };
    taskid = await submitWorldPopTask(payload);
  }

  if (!taskid) {
    throw new Error('Failed to initiate WorldPop task ID for geometry.');
  }

  // Poll task status until finished (max 15 attempts = 30 seconds)
  console.log(`[WorldPop] Task initiated with ID ${taskid}. Polling status...`);
  const maxAttempts = 15;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const pollUrl = `https://api.worldpop.org/v1/tasks/${taskid}`;
      const res = await fetch(pollUrl, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;

      const pollData = await res.json();
      const statusStr = (pollData.status || pollData.task_status || '').toLowerCase();

      if (statusStr === 'finished' || statusStr === 'completed' || statusStr === 'success' || pollData.data) {
        const dataObj = pollData.data || pollData;
        const popValue =
          dataObj.total_population ||
          dataObj.sum ||
          dataObj.pop ||
          dataObj.total ||
          (dataObj.data && (dataObj.data.total_population || dataObj.data.sum));

        if (typeof popValue === 'number' && !isNaN(popValue) && popValue > 0) {
          return Math.round(popValue);
        }
      }

      if (statusStr === 'failed' || statusStr === 'error') {
        throw new Error(`WorldPop task ${taskid} failed with status: ${statusStr}`);
      }
    } catch (err) {
      if (attempt === maxAttempts) throw err;
    }
  }

  throw new Error(`WorldPop task ${taskid} timed out after ${maxAttempts * 2} seconds.`);
}

async function submitWorldPopTask(geoJsonObj) {
  try {
    const geoJsonStr = JSON.stringify(geoJsonObj);
    const url = `https://api.worldpop.org/v1/services/stats?dataset=wpgppop&year=2020&geojson=${encodeURIComponent(geoJsonStr)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.taskid || data.task_id || (data.data && data.data.taskid) || null;
  } catch (err) {
    return null;
  }
}

async function runFetchPopulation() {
  console.log('[PopulationScript] Connecting to database...');
  await connectDB();

  const zones = await Zone.find({});
  console.log(`[PopulationScript] Found ${zones.length} district zones to process.`);

  let updatedCount = 0;
  let fallbackCount = 0;

  for (const zone of zones) {
    console.log(`\n[PopulationScript] Processing zone: ${zone.name}...`);
    try {
      if (!zone.polygon || !zone.polygon.coordinates) {
        throw new Error('Zone polygon coordinates missing');
      }

      const estimatedPop = await fetchWorldPopStats(zone.polygon);
      zone.estimatedPopulation = estimatedPop;
      zone.updatedAt = new Date();
      await zone.save();
      console.log(`[PopulationScript] ✅ Successfully fetched population for '${zone.name}': ${estimatedPop.toLocaleString()} citizens.`);
      updatedCount++;
    } catch (err) {
      const fallbackPop = zone.estimatedPopulation && zone.estimatedPopulation > 0 ? zone.estimatedPopulation : 35000;
      console.warn(`[PopulationScript] ⚠️ Warning: Failed to fetch live WorldPop stats for '${zone.name}' (${err.message}). Using fallback estimate: ${fallbackPop.toLocaleString()}`);
      zone.estimatedPopulation = fallbackPop;
      zone.updatedAt = new Date();
      await zone.save();
      fallbackCount++;
    }
  }

  console.log(`\n[PopulationScript] Population sync finished! Live updated: ${updatedCount}, Fallback used: ${fallbackCount}.`);
  await mongoose.disconnect();
  process.exit(0);
}

runFetchPopulation().catch((err) => {
  console.error('[PopulationScript] Fatal error:', err);
  process.exit(1);
});
