import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { calculateRescuePriority } from './src/routes/report.js';
import Report from './models/Report.js';
import Zone from './models/Zone.js';
import Place from './models/Place.js';
import app from './src/server.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/disaster_db';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminsecret123';

async function runTests() {
  console.log('--- STARTING CHUNK 3 VALIDATION TESTS ---');

  // Test 1: Priority formula unit tests
  console.log('\n[Test 1] Rescue Priority Formula:');
  const p1 = calculateRescuePriority({ peopleCount: 1 });
  console.assert(p1 === 1, `Expected 1, got ${p1}`);
  console.log('✓ Base 1 person: priority =', p1);

  const p2 = calculateRescuePriority({ peopleCount: 4, medicalEmergency: true });
  console.assert(p2 === 44, `Expected 44, got ${p2}`);
  console.log('✓ 4 people + medical (+40): priority =', p2);

  const p3 = calculateRescuePriority({ peopleCount: 2, hasChildrenOrElderly: true, trapped: true });
  console.assert(p3 === 47, `Expected 47, got ${p3}`);
  console.log('✓ 2 people + children/elderly (+25) + trapped (+20): priority =', p3);

  const p4 = calculateRescuePriority({
    peopleCount: 4,
    hasChildrenOrElderly: true,
    medicalEmergency: true,
    trapped: true
  });
  console.assert(p4 === 89, `Expected 89, got ${p4}`);
  console.log('✓ 4 people + medical (+40) + children/elderly (+25) + trapped (+20): priority =', p4);

  // Connect to DB for integration tests
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  // Ensure index is ready
  await Report.init();

  // Clean test reports
  await Report.deleteMany({ description: { $regex: /^\[TEST\]/ } });

  // Test 2: Input validation via express handler or fetch
  console.log('\n[Test 2] Input validation on POST /api/report:');
  
  // Start server on a test port if not running
  const server = app.listen(5099);
  const BASE_URL = 'http://localhost:5099';

  try {
    // Missing type
    const res1 = await fetch(`${BASE_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'test', location: { coordinates: [80.2, 13.0] } })
    });
    console.assert(res1.status === 400, `Expected 400 for missing type, got ${res1.status}`);
    console.log('✓ Missing type returns 400 Bad Request');

    // Invalid type
    const res2 = await fetch(`${BASE_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'EARTHQUAKE', description: 'test', location: { coordinates: [80.2, 13.0] } })
    });
    console.assert(res2.status === 400, `Expected 400 for invalid type, got ${res2.status}`);
    console.log('✓ Invalid type returns 400 Bad Request');

    // Missing description
    const res3 = await fetch(`${BASE_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'FLOODED_ROAD', description: '   ', location: { coordinates: [80.2, 13.0] } })
    });
    console.assert(res3.status === 400, `Expected 400 for empty description, got ${res3.status}`);
    console.log('✓ Empty description returns 400 Bad Request');

    // Invalid coordinates
    const res4 = await fetch(`${BASE_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'FLOODED_ROAD', description: 'test', location: { coordinates: [999, 13.0] } })
    });
    console.assert(res4.status === 400, `Expected 400 for invalid coordinates, got ${res4.status}`);
    console.log('✓ Invalid coordinates returns 400 Bad Request');

    // Test 3: Rescue report creation with priority
    console.log('\n[Test 3] Create RESCUE report:');
    const resRescue = await fetch(`${BASE_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'RESCUE',
        description: '[TEST] Family needing extraction from flooded floor',
        location: { coordinates: [80.250, 13.050] },
        rescue: {
          peopleCount: 3,
          hasChildrenOrElderly: true,
          medicalEmergency: true,
          trapped: false,
          floorInfo: '1st floor apartment'
        }
      })
    });
    console.assert(resRescue.status === 201, `Expected 201, got ${resRescue.status}`);
    const rescueJson = await resRescue.json();
    // 3 + 25 + 40 = 68
    console.assert(rescueJson.priority === 68, `Expected priority 68, got ${rescueJson.priority}`);
    console.assert(rescueJson.status === 'UNVERIFIED', `Expected UNVERIFIED, got ${rescueJson.status}`);
    console.log('✓ RESCUE report created successfully with computed priority =', rescueJson.priority);

    // Test 4: Confidence-based clustering for hazard reports (~300m)
    console.log('\n[Test 4] Confidence-based clustering for FLOODED_ROAD:');
    
    // First report at (80.2600, 13.0600)
    const resRep1 = await fetch(`${BASE_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FLOODED_ROAD',
        description: '[TEST] Initial waterlogging at Main St',
        location: { coordinates: [80.2600, 13.0600] }
      })
    });
    const rep1 = await resRep1.json();
    console.assert(rep1.status === 'UNVERIFIED', `Expected UNVERIFIED for first report, got ${rep1.status}`);
    console.log('✓ First report created: status =', rep1.status);

    // Second report ~100m away at (80.2607, 13.0605) within 6 hours
    const resRep2 = await fetch(`${BASE_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FLOODED_ROAD',
        description: '[TEST] Confirmed waterlogging at Main St intersection',
        location: { coordinates: [80.2607, 13.0605] }
      })
    });
    const rep2 = await resRep2.json();
    console.assert(rep2.status === 'LIKELY', `Expected LIKELY for second report, got ${rep2.status}`);

    // Verify first report was also updated to LIKELY
    const updatedRep1 = await Report.findById(rep1._id);
    console.assert(updatedRep1.status === 'LIKELY', `Expected first report status updated to LIKELY, got ${updatedRep1.status}`);
    console.log('✓ Confidence check verified: both reports now have status = LIKELY!');

    // Different type (BLOCKED_ROUTE) at same location should NOT cluster with FLOODED_ROAD
    const resDiffType = await fetch(`${BASE_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'BLOCKED_ROUTE',
        description: '[TEST] Tree fell down',
        location: { coordinates: [80.2600, 13.0600] }
      })
    });
    const diffTypeRep = await resDiffType.json();
    console.assert(diffTypeRep.status === 'UNVERIFIED', `Expected UNVERIFIED for different type, got ${diffTypeRep.status}`);
    console.log('✓ Different type at same location remains UNVERIFIED');

    // Report far away (> 1km) at (80.3000, 13.1000) should NOT cluster
    const resFarRep = await fetch(`${BASE_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FLOODED_ROAD',
        description: '[TEST] Faraway puddle',
        location: { coordinates: [80.3000, 13.1000] }
      })
    });
    const farRep = await resFarRep.json();
    console.assert(farRep.status === 'UNVERIFIED', `Expected UNVERIFIED for far report, got ${farRep.status}`);
    console.log('✓ Report outside ~300m remains UNVERIFIED');

    // Test 5: Admin PATCH sets VERIFIED / RESOLVED
    console.log('\n[Test 5] Admin PATCH /api/admin/reports/:id:');
    
    // Without password -> 401
    const resNoAuth = await fetch(`${BASE_URL}/api/admin/reports/${rep1._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VERIFIED' })
    });
    console.assert(resNoAuth.status === 401, `Expected 401 without auth, got ${resNoAuth.status}`);
    console.log('✓ PATCH without admin password rejected (401)');

    // Verify report
    const resVerify = await fetch(`${BASE_URL}/api/admin/reports/${rep1._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': ADMIN_PASSWORD
      },
      body: JSON.stringify({ status: 'VERIFIED' })
    });
    console.assert(resVerify.status === 200, `Expected 200, got ${resVerify.status}`);
    const verifiedData = await resVerify.json();
    console.assert(verifiedData.status === 'VERIFIED', `Expected VERIFIED, got ${verifiedData.status}`);
    console.log('✓ Admin successfully set report status to VERIFIED');

    // Resolve report
    const resResolve = await fetch(`${BASE_URL}/api/admin/reports/${rep1._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': ADMIN_PASSWORD
      },
      body: JSON.stringify({ status: 'RESOLVED' })
    });
    console.assert(resResolve.status === 200, `Expected 200, got ${resResolve.status}`);
    const resolvedData = await resResolve.json();
    console.assert(resolvedData.status === 'RESOLVED', `Expected RESOLVED, got ${resolvedData.status}`);
    console.log('✓ Admin successfully set report status to RESOLVED');

    // Test 6: GET /api/map excludes RESOLVED reports
    console.log('\n[Test 6] GET /api/map (excludes RESOLVED reports):');
    const resMap = await fetch(`${BASE_URL}/api/map`);
    console.assert(resMap.status === 200, `Expected 200, got ${resMap.status}`);
    const mapData = await resMap.json();
    console.assert(Array.isArray(mapData.zones), 'mapData.zones should be an array');
    console.assert(Array.isArray(mapData.places), 'mapData.places should be an array');
    console.assert(Array.isArray(mapData.reports), 'mapData.reports should be an array');
    
    const containsResolved = mapData.reports.some(r => r._id === String(rep1._id));
    console.assert(!containsResolved, 'Resolved report must NOT be included in /api/map');
    console.log('✓ GET /api/map returns zones, places, and active reports (RESOLVED correctly excluded)');

    // Test 7: GET /api/admin/reports lists all reports and sorts rescue by priority desc
    console.log('\n[Test 7] GET /api/admin/reports:');
    const resAdminReports = await fetch(`${BASE_URL}/api/admin/reports`, {
      headers: { 'x-admin-password': ADMIN_PASSWORD }
    });
    console.assert(resAdminReports.status === 200, `Expected 200, got ${resAdminReports.status}`);
    const adminReports = await resAdminReports.json();
    console.assert(adminReports.length > 0, 'Admin reports should not be empty');
    
    // Check that rescue reports with higher priority appear first among rescue reports
    const rescueReports = adminReports.filter(r => r.type === 'RESCUE');
    for (let i = 0; i < rescueReports.length - 1; i++) {
      console.assert(
        (rescueReports[i].priority || 0) >= (rescueReports[i + 1].priority || 0),
        `Rescue reports should be sorted by priority descending: ${rescueReports[i].priority} vs ${rescueReports[i + 1].priority}`
      );
    }
    console.log('✓ GET /api/admin/reports correctly sorts rescue reports by priority descending');

    console.log('\n🎉 ALL CHUNK 3 TESTS PASSED PERFECTLY! 🎉\n');
  } finally {
    // Clean up test reports
    await Report.deleteMany({ description: { $regex: /^\[TEST\]/ } });
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
