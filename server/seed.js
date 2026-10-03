import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import mongoose from 'mongoose';
import { connectDB } from './src/db.js';
import Zone from './models/Zone.js';
import Place from './models/Place.js';
import Report from './models/Report.js';
import Alert from './models/Alert.js';
import FeedItem from './models/FeedItem.js';

async function seedDatabase() {
  console.log('[Seed] Starting database seed...');
  await connectDB();

  // Clear existing collections
  await Promise.all([
    Zone.deleteMany({}),
    Place.deleteMany({}),
    Report.deleteMany({}),
    Alert.deleteMany({}),
    FeedItem.deleteMany({})
  ]);
  console.log('[Seed] Cleared existing data.');

  // 1. Create 5 Fictional-but-realistic District Zones (Delta / Coastal Haven District)
  const zonesData = [
    {
      name: 'North Harbor Ward',
      centroid: {
        type: 'Point',
        coordinates: [80.290, 13.090] // [lng, lat]
      },
      polygon: {
        type: 'Polygon',
        coordinates: [[
          [80.275, 13.070],
          [80.305, 13.070],
          [80.305, 13.110],
          [80.275, 13.110],
          [80.275, 13.070]
        ]]
      },
      riskLevel: 'SEVERE',
      riskReason: 'Storm surge warning and active sea ingress along fishing docks.',
      estimatedPopulation: 45000,
      updatedAt: new Date()
    },
    {
      name: 'Riverside Central',
      centroid: {
        type: 'Point',
        coordinates: [80.245, 13.070]
      },
      polygon: {
        type: 'Polygon',
        coordinates: [[
          [80.225, 13.050],
          [80.265, 13.050],
          [80.265, 13.090],
          [80.225, 13.090],
          [80.225, 13.050]
        ]]
      },
      riskLevel: 'HIGH',
      riskReason: 'River water level breached warning mark following 125mm rainfall.',
      estimatedPopulation: 72000,
      updatedAt: new Date()
    },
    {
      name: 'East Beach Ward',
      centroid: {
        type: 'Point',
        coordinates: [80.280, 13.030]
      },
      polygon: {
        type: 'Polygon',
        coordinates: [[
          [80.265, 13.010],
          [80.295, 13.010],
          [80.295, 13.050],
          [80.265, 13.050],
          [80.265, 13.010]
        ]]
      },
      riskLevel: 'MEDIUM',
      riskReason: 'Strong gale winds (55km/h) and coastal erosion along beach boulevard.',
      estimatedPopulation: 28000,
      updatedAt: new Date()
    },
    {
      name: 'Hilltop Heights',
      centroid: {
        type: 'Point',
        coordinates: [80.210, 13.090]
      },
      polygon: {
        type: 'Polygon',
        coordinates: [[
          [80.190, 13.070],
          [80.230, 13.070],
          [80.230, 13.110],
          [80.190, 13.110],
          [80.190, 13.070]
        ]]
      },
      riskLevel: 'LOW',
      riskReason: 'Elevated topography with natural drainage; designated safe refuge zone.',
      estimatedPopulation: 35000,
      updatedAt: new Date()
    },
    {
      name: 'South Canal Ward',
      centroid: {
        type: 'Point',
        coordinates: [80.230, 13.020]
      },
      polygon: {
        type: 'Polygon',
        coordinates: [[
          [80.210, 13.000],
          [80.250, 13.000],
          [80.250, 13.040],
          [80.210, 13.040],
          [80.210, 13.000]
        ]]
      },
      riskLevel: 'HIGH',
      riskReason: 'Canal sluice gates overflowing into surrounding residential settlements.',
      estimatedPopulation: 58000,
      updatedAt: new Date()
    }
  ];

  const createdZones = await Zone.insertMany(zonesData);
  console.log(`[Seed] Inserted ${createdZones.length} zones.`);

  const zoneMap = {};
  createdZones.forEach(z => {
    zoneMap[z.name] = z._id;
  });

  // 2. Create 10 Places (SHELTER, FOOD, MEDICAL)
  const placesData = [
    {
      name: 'North Harbor Relief Shelter',
      kind: 'SHELTER',
      location: { type: 'Point', coordinates: [80.285, 13.085] },
      capacity: 450,
      status: 'OPEN'
    },
    {
      name: 'Central Community Gymnasium',
      kind: 'SHELTER',
      location: { type: 'Point', coordinates: [80.240, 13.065] },
      capacity: 800,
      status: 'OPEN'
    },
    {
      name: 'St. Jude Flood Relief Camp',
      kind: 'SHELTER',
      location: { type: 'Point', coordinates: [80.250, 13.075] },
      capacity: 300,
      status: 'FULL'
    },
    {
      name: 'Hilltop High School & Sports Complex',
      kind: 'SHELTER',
      location: { type: 'Point', coordinates: [80.205, 13.088] },
      capacity: 1200,
      status: 'OPEN'
    },
    {
      name: 'East Beach Community Center',
      kind: 'SHELTER',
      location: { type: 'Point', coordinates: [80.278, 13.035] },
      capacity: 350,
      status: 'CLOSED'
    },
    {
      name: 'Riverside Central Food Depot',
      kind: 'FOOD',
      location: { type: 'Point', coordinates: [80.248, 13.068] },
      capacity: 600,
      status: 'OPEN'
    },
    {
      name: 'South Canal Dry Rations Hub',
      kind: 'FOOD',
      location: { type: 'Point', coordinates: [80.228, 13.025] },
      capacity: 400,
      status: 'OPEN'
    },
    {
      name: 'East Beach Aid Canteen',
      kind: 'FOOD',
      location: { type: 'Point', coordinates: [80.282, 13.028] },
      capacity: 250,
      status: 'OPEN'
    },
    {
      name: 'District General Hospital',
      kind: 'MEDICAL',
      location: { type: 'Point', coordinates: [80.215, 13.085] },
      capacity: 500,
      status: 'OPEN'
    },
    {
      name: 'Harbor Urgent Care Trauma Post',
      kind: 'MEDICAL',
      location: { type: 'Point', coordinates: [80.288, 13.092] },
      capacity: 150,
      status: 'OPEN'
    }
  ];

  const createdPlaces = await Place.insertMany(placesData);
  console.log(`[Seed] Inserted ${createdPlaces.length} places.`);

  // 3. Create 4 Sample Reports (FLOODED_ROAD, BLOCKED_ROUTE, SHELTER_FULL, RESCUE)
  // Rescue priority: peopleCount(4) + medical(40) + children/elderly(25) + trapped(20) = 89
  const reportsData = [
    {
      type: 'FLOODED_ROAD',
      description: 'Water logging 3.5 feet deep across Marina Bypass road; completely impassable for two-wheelers and sedans.',
      location: { type: 'Point', coordinates: [80.282, 13.078] },
      status: 'UNVERIFIED',
      priority: null
    },
    {
      type: 'BLOCKED_ROUTE',
      description: 'Huge uprooted banyan tree and collapsed utility pole blocking 4-lane River Bridge approach.',
      location: { type: 'Point', coordinates: [80.242, 13.072] },
      status: 'LIKELY',
      priority: null
    },
    {
      type: 'SHELTER_FULL',
      description: 'St. Jude Flood Relief Camp is at 100% capacity; redirecting arriving evacuees to Central Gym.',
      location: { type: 'Point', coordinates: [80.251, 13.076] },
      status: 'VERIFIED',
      priority: null
    },
    {
      type: 'RESCUE',
      description: 'Family of 4 stranded on second-floor balcony due to rising canal floodwaters. Elderly grandmother requires dialysis care.',
      location: { type: 'Point', coordinates: [80.232, 13.022] },
      status: 'UNVERIFIED',
      priority: 89,
      rescue: {
        peopleCount: 4,
        hasChildrenOrElderly: true,
        medicalEmergency: true,
        trapped: true,
        floorInfo: '2nd Floor balcony, blue residential building near canal bridge'
      }
    }
  ];

  const createdReports = await Report.insertMany(reportsData);
  console.log(`[Seed] Inserted ${createdReports.length} reports.`);

  // 4. Create Sample Alerts (1 SENT, 1 DRAFT)
  const alertsData = [
    {
      zone: zoneMap['Riverside Central'],
      title: 'GOVT EMERGENCY: Flash Flood Warning for Riverside Central',
      message: 'EMERGENCY: River overflow in Riverside Central. AVOID River Bridge approach. Move to Central Gymnasium shelter (0.8km). For life-threatening emergencies call 112.',
      severity: 'HIGH',
      status: 'SENT',
      source: 'MANUAL',
      sentAt: new Date(Date.now() - 25 * 60 * 1000)
    },
    {
      zone: zoneMap['North Harbor Ward'],
      title: 'DRAFT ALERT: High Tidal Storm Surge Warning in North Harbor',
      message: 'CRITICAL: Severe sea surge expected within 2 hours. Mandatory evacuation of coastline within 500m to North Harbor Relief Shelter. Dial 112.',
      severity: 'SEVERE',
      status: 'DRAFT',
      source: 'OPEN_METEO'
    }
  ];

  const createdAlerts = await Alert.insertMany(alertsData);
  console.log(`[Seed] Inserted ${createdAlerts.length} alerts.`);

  // 5. Create Sample FeedItems
  const feedItemsData = [
    {
      source: 'OPEN_METEO',
      zone: zoneMap['North Harbor Ward'],
      severity: 'SEVERE',
      summary: 'Open-Meteo Forecast: 135mm 24h precipitation with gusts exceeding 75 km/h.',
      raw: { precipitation: 135, wind_speed: 76.4, units: 'metric' }
    },
    {
      source: 'GDACS',
      zone: zoneMap['Riverside Central'],
      severity: 'ORANGE',
      summary: 'GDACS Alert: River basin flood advisory level ORANGE for coastal delta region.',
      raw: { alertscore: 2.0, eventtype: 'FL', country: 'IN' }
    }
  ];

  await FeedItem.insertMany(feedItemsData);
  console.log(`[Seed] Inserted ${feedItemsData.length} feed items.`);

  console.log('[Seed] Database seeding completed successfully.');
  await mongoose.disconnect();
}

seedDatabase().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});
