# TESTING_PLAN.md - EcoGuard Air Quality Assurance & Testing Plan

## 1. Executive Summary & Existing Project Structure

EcoGuard Air is an AI-powered Disaster Intelligence and Community Response web platform designed for real-time hazard mapping, risk assessment, automated alert triggering, government command review/broadcasting, citizen incident/rescue reporting, simulated SMS alerts, and AI emergency assistant chat.

### Codebase Inventory

#### Backend (`/server`)
- **Server Core & DB**: `src/server.js`, `src/db.js`, `src/cron.js`
- **Mongoose Models**:
  - `models/Zone.js` (GeoJSON Polygon/Centroid, riskLevel, riskReason, estimatedPopulation, updatedAt)
  - `models/Place.js` (GeoJSON Point location, kind: SHELTER|FOOD|MEDICAL, capacity, status: OPEN|FULL|CLOSED)
  - `models/Report.js` (GeoJSON Point location, type: FLOODED_ROAD|BLOCKED_ROUTE|SHELTER_FULL|RESCUE, status: UNVERIFIED|LIKELY|VERIFIED|RESOLVED, rescue parameters & priority formula)
  - `models/Alert.js` (Zone ref, title, message, severity, status: DRAFT|SENT, source: OPEN_METEO|GDACS|SACHET|MANUAL, sentAt)
  - `models/FeedItem.js` (source, Zone ref, severity, summary, raw, fetchedAt)
- **Middleware**: `middleware/auth.js` (`adminAuth` enforcing `x-admin-password` header)
- **Services**:
  - `src/services/meteoService.js` (Open-Meteo forecast API fetch & risk thresholds rule engine)
  - `src/services/alertFeedService.js` (GDACS & SACHET CAP RSS/GeoJSON feeds & spatial proximity matching)
  - `src/services/alertTriggerService.js` (Automated DRAFT alert creation with 6-hour duplicate suppression)
  - `src/services/ingestionService.js` (Master feed ingestion orchestration)
- **API Routes**:
  - `src/routes/map.get`: `GET /api/map`
  - `src/routes/report.js`: `POST /api/report` (Rescue priority calculation + 300m/6h confidence duplicate check)
  - `src/routes/alerts.js`: `GET /api/alerts` (SENT alerts sorted newest first)
  - `src/routes/chat.js`: `POST /api/chat` (Google Gemini AI grounded prompt execution with fallback)
  - `src/routes/admin.js`: `GET /api/admin/feeds`, `GET /api/admin/reports`, `PATCH /api/admin/reports/:id`, `POST /api/admin/alerts`, `POST /api/admin/feeds/refresh`
- **Utilities & Scripts**:
  - `src/utils/alertBuilder.js` (Automated government emergency SMS text builder using spatial query for nearest open shelter, food point, and blocked roads)
  - `seed.js` (Database seeder for district zones, places, reports, alerts, and feeds)
  - `scripts/mockAlert.js` (Forces SEVERE cyclone draft alert)
  - `scripts/fetchPopulation.js` (WorldPop Stats API async polling for zone population estimation)

#### Frontend (`/client`)
- **Core App & Router**: `src/main.jsx`, `src/App.jsx`, `src/api.js`
- **Styling**: `src/style.css` (EcoGuard Air light design system with crisp white containers and status badges)
- **Components**:
  - `src/components/MapPage.jsx` (React-Leaflet map page with satellite toggle, hazard zones, shelter/report pins, latest alert banner)
  - `src/components/ReportModal.jsx` (Ground incident and emergency search & rescue submission form)
  - `src/components/ChatWidget.jsx` (AI Emergency Assistant floating chat widget)
  - `src/components/SmsInbox.jsx` (Smartphone mockup displaying SENT emergency alerts)
  - `src/components/AdminDashboard.jsx` (Government command dashboard with password gate, feeds panel, rescue queue, and alert broadcast modal)
- **Utils**: `src/utils/leafletIcons.js` (Custom Leaflet SVG markers)

---

## 2. Test Suites Required

### A. Backend Test Suites (`/server/tests`)
1. **Server Configuration & Middleware (`server.test.js`)**:
   - Verify server startup without auto-listening or running background daemons during testing.
   - CORS middleware header enforcement.
   - Body parser JSON handling and malformed JSON error responses.
   - 404 handler for unknown routes.
   - Global error middleware response shape (`{ error: string }`).

2. **Mongoose Models (`models.test.js`)**:
   - `Zone`: Required fields, polygon/centroid GeoJSON validation, risk level enum (`LOW`, `MEDIUM`, `HIGH`, `SEVERE`), default population values.
   - `Place`: Required fields, kind enum (`SHELTER`, `FOOD`, `MEDICAL`), status enum (`OPEN`, `FULL`, `CLOSED`), 2dsphere index behavior.
   - `Report`: Required description, location Point, status enum (`UNVERIFIED`, `LIKELY`, `VERIFIED`, `RESOLVED`), rescue parameters, priority calculation.
   - `Alert`: Required title/message, zone ref, status enum (`DRAFT`, `SENT`), source enum.
   - `FeedItem`: Required summary, source validation, optional zone ref.

3. **Authentication & Admin Middleware (`auth.test.js`)**:
   - Access to `/api/admin/*` endpoints with valid `x-admin-password`.
   - Rejection (401 Unauthorized) when header is missing or incorrect.
   - Password secret leak prevention in error logs.

4. **Public API Endpoints (`publicApi.test.js`)**:
   - `GET /api/map`: Returns active zones, places, and non-resolved reports. Excludes `RESOLVED` reports.
   - `POST /api/report`:
     - Creates valid hazard report.
     - Calculates RESCUE priority score: `peopleCount + (medical ? 40 : 0) + (children/elderly ? 25 : 0) + (trapped ? 20 : 0)`.
     - Confirms 300m/6h spatial confidence check sets status `LIKELY` on matching nearby reports.
   - `GET /api/alerts`: Returns only `SENT` alerts ordered newest first (`sentAt` desc).
   - `POST /api/chat`: Grounded Gemini prompt response generation, emergency number 112 inclusion, offline/error fallback string.

5. **Admin API Endpoints (`adminApi.test.js`)**:
   - `GET /api/admin/feeds`: Returns zones, draft alerts, recent feed items.
   - `GET /api/admin/reports`: Returns all reports, rescue reports sorted by priority desc.
   - `PATCH /api/admin/reports/:id`: Updates status to `VERIFIED` or `RESOLVED`, handles invalid status and non-existent IDs.
   - `POST /api/admin/alerts`: Approves existing draft or creates direct zone alert, builds SMS text, sets status `SENT`, stamps `sentAt`.
   - `POST /api/admin/feeds/refresh`: Triggers manual feed ingestion.

6. **Weather Risk & Alert Logic (`weatherAlertLogic.test.js`)**:
   - Open-Meteo risk threshold rule evaluation:
     - SEVERE: Rainfall >= 100mm OR max wind >= 70 km/h
     - HIGH: Rainfall >= 50mm OR max wind >= 50 km/h
     - MEDIUM: Rainfall >= 20mm OR max wind >= 30 km/h
     - LOW: Otherwise
   - Automated DRAFT alert creation when zone reaches HIGH/SEVERE.
   - 6-hour duplicate suppression rule verification.

7. **Alert Message Generator (`alertBuilder.test.js`)**:
   - Validates `buildSmartAlertMessage`: computes nearest open shelter distance, nearest food depot distance, avoids verified/likely blocked routes, includes emergency number 112, target length < 350 chars.

8. **External Integrations Mocks (`externalMocks.test.js`)**:
   - Open-Meteo forecast API mock (success, timeout, HTTP 500 fallback).
   - GDACS / SACHET feeds mock (success, offline 404 fallback).
   - Google Gemini AI API mock (success, rate limit error fallback).
   - WorldPop stats API mock (task submission, async polling, timeout fallback).

---

### B. Frontend Test Suites (`/client/tests`)

1. **API Client (`api.test.js`)**:
   - Tests all functions in `client/src/api.js` (`getMapData`, `createReport`, `getSentAlerts`, `sendChatMessage`, `getAdminFeeds`, `getAdminReports`, `updateReportStatus`, `broadcastAlert`, `refreshFeeds`).
   - Verifies HTTP methods, headers (`x-admin-password`), payload stringification, error parsing.

2. **Citizen Map Page & Leaflet Components (`MapPage.test.jsx`)**:
   - Renders MapContainer, tile layer, satellite toggle button.
   - Displays zone polygons with risk-based styles.
   - Displays place markers and report markers with custom SVG icons.
   - Displays latest alert banner linking to `/sms`.
   - Map click location selection mode for report form.
   - Polling interval (5s) execution and unmount cleanup.

3. **Citizen Report & Rescue Modal (`ReportModal.test.jsx`)**:
   - Form inputs rendering & validation.
   - Conditional rescue fields display when `type === 'RESCUE'`.
   - GPS location fetching & tap-on-map picker button.
   - Form submit payload formatting and API call invocation.

4. **Smartphone SMS Inbox Mockup (`SmsInbox.test.jsx`)**:
   - Smartphone frame UI rendering.
   - Fetches and displays SENT alerts ordered newest first.
   - Polling interval (5s) verification and unmount cleanup.
   - Empty state rendering.

5. **AI Emergency Assistant Widget (`ChatWidget.test.jsx`)**:
   - Open/close toggle widget button.
   - Text input, send button, message thread display.
   - Typing indicator during API call.
   - Fallback response display on API failure.

6. **Admin Dashboard (`AdminDashboard.test.jsx`)**:
   - Password gate login card rendering & authentication state (`sessionStorage`).
   - Tab switching: Official Feeds, Rescue Queue, Ground Reports.
   - "Refresh All Feeds" button trigger.
   - "Review & Broadcast Alert" modal opening, title/message editing, submit action.
   - Rescue queue table sorting by priority score.
   - Status update buttons ("Verify", "Resolve").

---

## 3. Critical User Workflows

### Workflow 1: Citizen Hazard Reporting
1. Citizen opens map page (`/`).
2. Clicks "🚨 Report Incident / Request Rescue".
3. Selects report type `FLOODED_ROAD`, inputs description and location coordinates.
4. Submits form -> API POST `/api/report`.
5. Map updates via polling and displays the new UNVERIFIED report icon.

### Workflow 2: Citizen Emergency Rescue Request
1. Citizen opens report modal, selects `RESCUE`.
2. Fills rescue fields: `peopleCount: 4`, `medicalEmergency: true`, `children/elderly: true`, `trapped: true`.
3. Submits form -> API calculates priority score `89` (`4 + 40 + 25 + 20`).
4. Report appears at the top of the Admin Rescue Queue sorted by priority.

### Workflow 3: Environmental Ingestion & Alert Drafting
1. Scheduled cron job or admin clicks "Refresh Feeds" -> `POST /api/admin/feeds/refresh`.
2. System queries Open-Meteo API for zone centroids.
3. Zone `North Harbor Ward` reaches SEVERE risk -> Automated trigger creates a `DRAFT` alert (checking 6-hour suppression).
4. Draft alert appears in Admin Dashboard under Pending Drafts.

### Workflow 4: Government Alert Broadcast & Citizen SMS Delivery
1. Admin logs into `/admin` with `x-admin-password`.
2. Admin reviews DRAFT alert, edits emergency message body.
3. Admin clicks "Authorize & Send SMS Broadcast" -> `POST /api/admin/alerts`.
4. Alert status becomes `SENT`, `sentAt` is stamped.
5. Citizen opens `/sms` phone mockup and sees the official broadcast message.

### Workflow 5: Ground Incident Verification by Officer
1. Officer views Admin Dashboard -> Ground Reports tab.
2. Officer clicks "Verify" on `FLOODED_ROAD` report -> `PATCH /api/admin/reports/:id` updates status to `VERIFIED`.
3. Nearby reports of same type within 300m get set to `LIKELY`.
4. Citizen map reflects updated marker status.

### Workflow 6: AI Chatbot Grounded Safety Guidance
1. Citizen opens AI Assistant chat widget on map page.
2. Citizen asks: "Which shelters are open near Riverside?"
3. Backend fetches live database state (zones, OPEN places, VERIFIED reports, latest alert) and prompts Gemini AI.
4. Assistant replies with grounded shelter advice including helpline 112.

---

## 4. API Coverage Plan

| Endpoint | Method | Public/Admin | Key Test Scenarios |
|---|---|---|---|
| `/api/map` | GET | Public | Returns zones, places, non-resolved reports; excludes resolved; empty DB handling |
| `/api/report` | POST | Public | Valid creation, rescue priority formula, 300m spatial confidence check, validation error on missing coords |
| `/api/alerts` | GET | Public | Returns SENT alerts newest first, empty list, DB failure handling |
| `/api/chat` | POST | Public | Valid message response, grounded context, 112 helpline inclusion, API offline fallback |
| `/api/admin/feeds` | GET | Admin | Auth header check, zone risks, draft alerts, recent feed items |
| `/api/admin/reports` | GET | Admin | Auth header check, rescue priority desc sorting, list all reports |
| `/api/admin/reports/:id` | PATCH | Admin | Auth header check, update status to VERIFIED/RESOLVED, invalid status 400, invalid ID 404 |
| `/api/admin/alerts` | POST | Admin | Auth header check, approve draft, direct zone broadcast, default message generation, status update to SENT |
| `/api/admin/feeds/refresh` | POST | Admin | Auth header check, invokes ingestion pipeline, returns summary report |

---

## 5. Security & Reliability Checks

1. **Authentication Enforcement**:
   - Verify protected `/api/admin/*` endpoints reject requests without `x-admin-password` header or with invalid passkey (HTTP 401).
   - Ensure `ADMIN_PASSWORD` is read securely from environment variables (`.env`).
2. **Secrets & Error Sanitization**:
   - Ensure stack traces and database credentials are never exposed in JSON error responses.
3. **Input Validation**:
   - Reject malformed GeoJSON coordinates, invalid enum strings (`riskLevel`, `kind`, `type`, `status`), and empty required text fields.
4. **Resilience & Fallbacks**:
   - Every external call (Open-Meteo, GDACS, SACHET, Gemini, WorldPop) must catch errors gracefully and return fallback data without crashing the Node.js server process.

---

## 6. External Integrations Needing Mocks

1. **Open-Meteo API**: Mocked with Jest (`jest.spyOn(global, 'fetch')` / `nock` / Supertest mocks) returning sample hourly precipitation and wind speed arrays.
2. **GDACS & SACHET RSS/GeoJSON Feeds**: Mocked returning sample disaster event features or empty arrays.
3. **Google Gemini AI API (`@google/genai`)**: Mocked `@google/genai` module response returning deterministic AI replies.
4. **WorldPop Stats API**: Mocked task submission (`taskid: "12345"`) and polling endpoint (`status: "finished", data: { total_population: 45000 }`).
5. **MongoDB**: Tested using isolated MongoDB connection / in-memory Mongo test database.

---

## 7. Known Gaps & Implementation Audit

- **Dependencies**: Testing tools (`jest`, `supertest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `babel-jest`, etc.) are not yet added to `package.json`.
- **Module System**: Monorepo uses ES Modules (`"type": "module"` in server and client). Jest needs `babel-jest` or `--experimental-vm-modules` / `node --experimental-vm-modules node_modules/jest/bin/jest.js` configuration.

---

## 8. Test Execution Commands (To Be Configured in Phase 2)

- `npm run test`: Run complete test suite across server and client
- `npm run test:backend`: Run backend Jest tests in `/server`
- `npm run test:frontend`: Run frontend Jest tests in `/client`
- `npm run test:coverage`: Generate Jest code coverage reports
