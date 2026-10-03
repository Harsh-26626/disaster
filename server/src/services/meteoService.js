import FeedItem from '../../models/FeedItem.js';

/**
 * Weather Risk Assessment Thresholds (24-hour forecast)
 * - SEVERE: Rainfall >= 100mm OR Max Wind Speed >= 70 km/h
 * - HIGH:   Rainfall >= 50mm  OR Max Wind Speed >= 50 km/h
 * - MEDIUM: Rainfall >= 20mm  OR Max Wind Speed >= 30 km/h
 * - LOW:    Below above thresholds
 */

export function calculateRiskFromMeteo(precipitation24h, maxWind24h) {
  if (precipitation24h >= 100 || maxWind24h >= 70) {
    return {
      riskLevel: 'SEVERE',
      riskReason: `Severe weather alert: 24h forecast predicts ${precipitation24h.toFixed(1)}mm rainfall and ${maxWind24h.toFixed(1)}km/h wind gusts.`
    };
  }
  if (precipitation24h >= 50 || maxWind24h >= 50) {
    return {
      riskLevel: 'HIGH',
      riskReason: `High risk weather: 24h forecast predicts ${precipitation24h.toFixed(1)}mm rainfall and ${maxWind24h.toFixed(1)}km/h wind speed.`
    };
  }
  if (precipitation24h >= 20 || maxWind24h >= 30) {
    return {
      riskLevel: 'MEDIUM',
      riskReason: `Moderate weather warning: 24h forecast predicts ${precipitation24h.toFixed(1)}mm rainfall and ${maxWind24h.toFixed(1)}km/h wind speed.`
    };
  }
  return {
    riskLevel: 'LOW',
    riskReason: `Normal weather conditions: 24h forecast predicts ${precipitation24h.toFixed(1)}mm rainfall and ${maxWind24h.toFixed(1)}km/h wind speed.`
  };
}

/**
 * Fetch forecast for a single zone centroid from Open-Meteo API with fallback
 */
export async function fetchZoneWeather(zone) {
  const [lng, lat] = zone.centroid.coordinates;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation,wind_speed_10m&forecast_days=1`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    const precipArray = data.hourly?.precipitation || [];
    const windArray = data.hourly?.wind_speed_10m || [];

    const precipitation24h = precipArray.slice(0, 24).reduce((sum, val) => sum + (val || 0), 0);
    const maxWind24h = Math.max(0, ...windArray.slice(0, 24).map(v => v || 0));

    const { riskLevel, riskReason } = calculateRiskFromMeteo(precipitation24h, maxWind24h);

    return {
      success: true,
      riskLevel,
      riskReason,
      raw: {
        precipitation24h: Number(precipitation24h.toFixed(1)),
        maxWind24h: Number(maxWind24h.toFixed(1)),
        units: data.hourly_units || {}
      }
    };
  } catch (error) {
    console.warn(`[Open-Meteo] Forecast fetch failed for zone '${zone.name}':`, error.message);
    // Fallback: Retain current risk level or return safe default without crashing
    return {
      success: false,
      riskLevel: zone.riskLevel || 'LOW',
      riskReason: zone.riskReason || 'Weather data unavailable (using cached/fallback status).',
      raw: { error: error.message, fallback: true }
    };
  }
}
