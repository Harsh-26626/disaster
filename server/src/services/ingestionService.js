import Zone from '../../models/Zone.js';
import FeedItem from '../../models/FeedItem.js';
import { fetchZoneWeather } from './meteoService.js';
import { fetchAllOfficialAlerts } from './alertFeedService.js';
import { evaluateAlertTriggers } from './alertTriggerService.js';

/**
 * Main feed ingestion job orchestration
 */
export async function runIngestion() {
  console.log('[Ingestion] Starting feed ingestion job...');
  const startTime = Date.now();

  try {
    // 1. Fetch all zones
    const zones = await Zone.find({});
    if (zones.length === 0) {
      console.warn('[Ingestion] No zones found in database.');
      return { timestamp: new Date(), zonesUpdated: 0, feedItemsAdded: 0, draftAlertsCreated: 0 };
    }

    const createdFeedItems = [];

    // 2. Process Open-Meteo weather for each zone
    for (const zone of zones) {
      const weatherRes = await fetchZoneWeather(zone);
      
      zone.riskLevel = weatherRes.riskLevel;
      zone.riskReason = weatherRes.riskReason;
      zone.updatedAt = new Date();
      await zone.save();

      const meteoFeedItem = new FeedItem({
        source: 'OPEN_METEO',
        zone: zone._id,
        severity: weatherRes.riskLevel,
        summary: `Open-Meteo Weather [${zone.name}]: ${weatherRes.riskLevel} - ${weatherRes.riskReason}`,
        raw: weatherRes.raw,
        fetchedAt: new Date()
      });
      await meteoFeedItem.save();
      createdFeedItems.push(meteoFeedItem);
    }

    // 3. Fetch Official Alert Feeds (GDACS / SACHET)
    const officialAlertData = await fetchAllOfficialAlerts(zones);
    let savedOfficialFeedItems = [];
    if (officialAlertData.length > 0) {
      savedOfficialFeedItems = await FeedItem.insertMany(officialAlertData);
      createdFeedItems.push(...savedOfficialFeedItems);
    }

    // 4. Evaluate and trigger DRAFT alerts for HIGH/SEVERE conditions
    const draftAlerts = await evaluateAlertTriggers(zones, savedOfficialFeedItems);

    const duration = Date.now() - startTime;
    console.log(`[Ingestion] Completed in ${duration}ms. Zones: ${zones.length}, New FeedItems: ${createdFeedItems.length}, New Draft Alerts: ${draftAlerts.length}`);

    return {
      timestamp: new Date(),
      zonesUpdated: zones.length,
      feedItemsAdded: createdFeedItems.length,
      draftAlertsCreated: draftAlerts.length,
      draftAlerts
    };
  } catch (error) {
    console.error('[Ingestion Error] Feed ingestion failed:', error);
    // Never throw, return safe status report
    return {
      timestamp: new Date(),
      error: error.message,
      zonesUpdated: 0,
      feedItemsAdded: 0,
      draftAlertsCreated: 0
    };
  }
}
