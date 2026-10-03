import Alert from '../../models/Alert.js';

/**
 * Checks zones and feed items to auto-generate DRAFT alerts for high/severe risk conditions.
 * Enforces rule: No duplicate alert for the same zone within 6 hours.
 */
export async function evaluateAlertTriggers(zones, newFeedItems = []) {
  const createdDrafts = [];
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const sixHoursAgo = new Date(Date.now() - SIX_HOURS_MS);

  for (const zone of zones) {
    const isHighOrSevere = zone.riskLevel === 'HIGH' || zone.riskLevel === 'SEVERE';

    // Find official alerts for this zone
    const officialAlertFeed = newFeedItems.find(
      (item) => item.zone && item.zone.toString() === zone._id.toString() &&
      (item.severity === 'HIGH' || item.severity === 'SEVERE')
    );

    if (!isHighOrSevere && !officialAlertFeed) {
      continue;
    }

    // Check if an alert for this zone was created within the last 6 hours
    const recentAlert = await Alert.findOne({
      zone: zone._id,
      createdAt: { $gte: sixHoursAgo }
    });

    if (recentAlert) {
      console.log(`[AlertTrigger] Skipped draft alert for '${zone.name}' (Alert already created within 6 hours).`);
      continue;
    }

    // Determine draft alert details
    const severity = zone.riskLevel === 'SEVERE' ? 'SEVERE' : (officialAlertFeed ? officialAlertFeed.severity : 'HIGH');
    const source = officialAlertFeed ? officialAlertFeed.source : 'OPEN_METEO';

    const draftAlert = new Alert({
      zone: zone._id,
      title: `DRAFT ALERT: ${severity} Risk Warning for ${zone.name}`,
      message: `AUTOMATED DRAFT ALERT for ${zone.name}: ${zone.riskReason || 'Environmental indicators crossed critical disaster thresholds.'} Preparedness measures advised.`,
      severity,
      status: 'DRAFT',
      source,
      createdAt: new Date()
    });

    await draftAlert.save();
    createdDrafts.push(draftAlert);
    console.log(`[AlertTrigger] Created new DRAFT Alert for '${zone.name}' (Severity: ${severity}).`);
  }

  return createdDrafts;
}
