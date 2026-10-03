# API Contract & Schema Reference

This document defines the contract for all public and admin endpoints in the **AI-Powered Disaster Intelligence & Community Response Platform**.

---

## 1. Authentication
- **Public endpoints**: No authentication required.
- **Admin endpoints**: Require header `x-admin-password: <ADMIN_PASSWORD>`. If invalid or omitted, responds with `401 Unauthorized`.

---

## 2. Public Endpoints

### 2.1 `GET /api/map`
Retrieves all zones (with polygons and risk levels), all places (shelters, food, medical), and all active (non-resolved) reports.

**Request:**
```http
GET /api/map HTTP/1.1
Host: localhost:5000
```

**Response (200 OK):**
```json
{
  "zones": [
    {
      "_id": "674ef001a1b2c3d4e5f60001",
      "name": "North Harbor Ward",
      "centroid": {
        "type": "Point",
        "coordinates": [80.290, 13.090]
      },
      "polygon": {
        "type": "Polygon",
        "coordinates": [
          [
            [80.275, 13.070],
            [80.305, 13.070],
            [80.305, 13.110],
            [80.275, 13.110],
            [80.275, 13.070]
          ]
        ]
      },
      "riskLevel": "SEVERE",
      "riskReason": "Storm surge warning and active sea ingress along fishing docks.",
      "estimatedPopulation": 45000,
      "updatedAt": "2026-10-03T08:00:00.000Z"
    }
  ],
  "places": [
    {
      "_id": "674ef002a1b2c3d4e5f60010",
      "name": "North Harbor Relief Shelter",
      "kind": "SHELTER",
      "location": {
        "type": "Point",
        "coordinates": [80.285, 13.085]
      },
      "capacity": 450,
      "status": "OPEN"
    },
    {
      "_id": "674ef002a1b2c3d4e5f60015",
      "name": "Riverside Central Food Depot",
      "kind": "FOOD",
      "location": {
        "type": "Point",
        "coordinates": [80.248, 13.068]
      },
      "capacity": 600,
      "status": "OPEN"
    },
    {
      "_id": "674ef002a1b2c3d4e5f60018",
      "name": "District General Hospital",
      "kind": "MEDICAL",
      "location": {
        "type": "Point",
        "coordinates": [80.215, 13.085]
      },
      "capacity": 500,
      "status": "OPEN"
    }
  ],
  "reports": [
    {
      "_id": "674ef003a1b2c3d4e5f60020",
      "type": "RESCUE",
      "description": "Family of 4 stranded on second-floor balcony due to rising canal floodwaters.",
      "location": {
        "type": "Point",
        "coordinates": [80.232, 13.022]
      },
      "status": "UNVERIFIED",
      "priority": 89,
      "rescue": {
        "peopleCount": 4,
        "hasChildrenOrElderly": true,
        "medicalEmergency": true,
        "trapped": true,
        "floorInfo": "2nd Floor balcony, blue residential building"
      },
      "createdAt": "2026-10-03T08:15:00.000Z"
    },
    {
      "_id": "674ef003a1b2c3d4e5f60021",
      "type": "FLOODED_ROAD",
      "description": "Water logging 3.5 feet deep across Marina Bypass road.",
      "location": {
        "type": "Point",
        "coordinates": [80.282, 13.078]
      },
      "status": "UNVERIFIED",
      "priority": null,
      "createdAt": "2026-10-03T08:10:00.000Z"
    }
  ]
}
```

---

### 2.2 `POST /api/report`
Citizen submits a ground report (flooded road, blocked route, shelter full, or rescue request).

**Request (Rescue Example):**
```http
POST /api/report HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```
```json
{
  "type": "RESCUE",
  "description": "Elderly couple trapped on rooftop as ground floor inundated.",
  "location": {
    "type": "Point",
    "coordinates": [80.245, 13.065]
  },
  "rescue": {
    "peopleCount": 2,
    "hasChildrenOrElderly": true,
    "medicalEmergency": false,
    "trapped": true,
    "floorInfo": "Rooftop terrace"
  }
}
```

**Response (201 Created):**
```json
{
  "_id": "674ef004a1b2c3d4e5f60030",
  "type": "RESCUE",
  "description": "Elderly couple trapped on rooftop as ground floor inundated.",
  "location": {
    "type": "Point",
    "coordinates": [80.245, 13.065]
  },
  "status": "UNVERIFIED",
  "priority": 47,
  "rescue": {
    "peopleCount": 2,
    "hasChildrenOrElderly": true,
    "medicalEmergency": false,
    "trapped": true,
    "floorInfo": "Rooftop terrace"
  },
  "createdAt": "2026-10-03T08:20:00.000Z"
}
```

**Request (Hazard Report Example):**
POST /api/report HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```json
{
  "type": "FLOODED_ROAD",
  "description": "Severe road waterlogging near Market Gate.",
  "location": {
    "type": "Point",
    "coordinates": [80.281, 13.075]
  }
}
```

**Response (201 Created):**
```json
{
  "_id": "674ef004a1b2c3d4e5f60031",
  "type": "FLOODED_ROAD",
  "description": "Severe road waterlogging near Market Gate.",
  "location": {
    "type": "Point",
    "coordinates": [80.281, 13.075]
  },
  "status": "UNVERIFIED",
  "priority": null,
  "createdAt": "2026-10-03T08:21:00.000Z"
}
```

---

### 2.3 `GET /api/alerts`
Retrieves all broadcasted (`SENT`) government alerts, newest first.

**Request:**
```http
GET /api/alerts HTTP/1.1
Host: localhost:5000
```

**Response (200 OK):**
```json
[
  {
    "_id": "674ef005a1b2c3d4e5f60040",
    "zone": {
      "_id": "674ef001a1b2c3d4e5f60002",
      "name": "Riverside Central",
      "riskLevel": "HIGH",
      "riskReason": "River water level breached warning mark following 125mm rainfall.",
      "estimatedPopulation": 72000
    },
    "title": "GOVT EMERGENCY: Flash Flood Warning for Riverside Central",
    "message": "EMERGENCY: River overflow in Riverside Central. AVOID River Bridge approach. Move to Central Gymnasium shelter (0.8km). For life-threatening emergencies call 112.",
    "severity": "HIGH",
    "status": "SENT",
    "source": "MANUAL",
    "createdAt": "2026-10-03T07:45:00.000Z",
    "sentAt": "2026-10-03T07:50:00.000Z"
  }
]
```

---

### 2.4 `POST /api/chat`
Citizen queries the response assistant for verified, grounded safety guidance.

**Request:**
```http
POST /api/chat HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "message": "Is the bridge near Riverside open, and where is the closest open shelter?"
}
```

**Response (200 OK):**
```json
{
  "reply": "Disaster Response Bot: Riverside Central is currently at HIGH risk with River Bridge blocked by a fallen tree. The nearest open shelter is Central Community Gymnasium. For life-threatening emergencies, call 112."
}
```

---

## 3. Admin Endpoints (`x-admin-password` required)

### 3.1 `GET /api/admin/feeds`
Returns zones with risk level, reason, estimated population, draft alerts pending review, and recent ingested feed items.

**Request:**
```http
GET /api/admin/feeds HTTP/1.1
Host: localhost:5000
x-admin-password: adminsecret123
```

**Response (200 OK):**
```json
{
  "zones": [
    {
      "_id": "674ef001a1b2c3d4e5f60001",
      "name": "North Harbor Ward",
      "riskLevel": "SEVERE",
      "riskReason": "Storm surge warning and active sea ingress along fishing docks.",
      "estimatedPopulation": 45000,
      "centroid": {
        "type": "Point",
        "coordinates": [80.290, 13.090]
      },
      "polygon": {
        "type": "Polygon",
        "coordinates": [
          [
            [80.275, 13.070],
            [80.305, 13.070],
            [80.305, 13.110],
            [80.275, 13.110],
            [80.275, 13.070]
          ]
        ]
      },
      "updatedAt": "2026-10-03T08:00:00.000Z"
    }
  ],
  "draftAlerts": [
    {
      "_id": "674ef006a1b2c3d4e5f60050",
      "zone": {
        "_id": "674ef001a1b2c3d4e5f60001",
        "name": "North Harbor Ward",
        "riskLevel": "SEVERE"
      },
      "title": "DRAFT ALERT: High Tidal Storm Surge Warning in North Harbor",
      "message": "CRITICAL: Severe sea surge expected within 2 hours. Mandatory evacuation of coastline within 500m to North Harbor Relief Shelter. Dial 112.",
      "severity": "SEVERE",
      "status": "DRAFT",
      "source": "OPEN_METEO",
      "createdAt": "2026-10-03T08:05:00.000Z",
      "sentAt": null
    }
  ],
  "recentFeedItems": [
    {
      "_id": "674ef007a1b2c3d4e5f60060",
      "source": "OPEN_METEO",
      "zone": {
        "_id": "674ef001a1b2c3d4e5f60001",
        "name": "North Harbor Ward"
      },
      "severity": "SEVERE",
      "summary": "Open-Meteo Forecast: 135mm 24h precipitation with gusts exceeding 75 km/h.",
      "raw": {
        "precipitation": 135,
        "wind_speed": 76.4,
        "units": "metric"
      },
      "fetchedAt": "2026-10-03T08:00:00.000Z"
    }
  ]
}
```

---

### 3.2 `GET /api/admin/reports`
Returns all submitted citizen reports, with `RESCUE` reports sorted by `priority` descending at top, followed by chronological reports.

**Request:**
```http
GET /api/admin/reports HTTP/1.1
Host: localhost:5000
x-admin-password: adminsecret123
```

**Response (200 OK):**
```json
[
  {
    "_id": "674ef003a1b2c3d4e5f60020",
    "type": "RESCUE",
    "description": "Family of 4 stranded on second-floor balcony due to rising canal floodwaters.",
    "location": {
      "type": "Point",
      "coordinates": [80.232, 13.022]
    },
    "status": "UNVERIFIED",
    "priority": 89,
    "rescue": {
      "peopleCount": 4,
      "hasChildrenOrElderly": true,
      "medicalEmergency": true,
      "trapped": true,
      "floorInfo": "2nd Floor balcony, blue residential building"
    },
    "createdAt": "2026-10-03T08:15:00.000Z"
  },
  {
    "_id": "674ef003a1b2c3d4e5f60021",
    "type": "BLOCKED_ROUTE",
    "description": "Huge uprooted banyan tree and collapsed utility pole blocking 4-lane River Bridge approach.",
    "location": {
      "type": "Point",
      "coordinates": [80.242, 13.072]
    },
    "status": "LIKELY",
    "priority": null,
    "createdAt": "2026-10-03T08:12:00.000Z"
  }
]
```

---

### 3.3 `PATCH /api/admin/reports/:id`
Updates report verification status (`VERIFIED` or `RESOLVED`).

**Request:**
```http
PATCH /api/admin/reports/674ef003a1b2c3d4e5f60020 HTTP/1.1
Host: localhost:5000
x-admin-password: adminsecret123
Content-Type: application/json

{
  "status": "VERIFIED"
}
```

**Response (200 OK):**
```json
{
  "_id": "674ef003a1b2c3d4e5f60020",
  "type": "RESCUE",
  "description": "Family of 4 stranded on second-floor balcony due to rising canal floodwaters.",
  "location": {
    "type": "Point",
    "coordinates": [80.232, 13.022]
  },
  "status": "VERIFIED",
  "priority": 89,
  "rescue": {
    "peopleCount": 4,
    "hasChildrenOrElderly": true,
    "medicalEmergency": true,
    "trapped": true,
    "floorInfo": "2nd Floor balcony, blue residential building"
  },
  "createdAt": "2026-10-03T08:15:00.000Z"
}
```

---

### 3.4 `POST /api/admin/alerts`
Approves a draft alert or creates a new manual broadcast for a zone, marks it `SENT`, and stamps `sentAt`.

**Request (Approve Existing Draft):**
```http
POST /api/admin/alerts HTTP/1.1
Host: localhost:5000
x-admin-password: adminsecret123
Content-Type: application/json

{
  "draftId": "674ef006a1b2c3d4e5f60050",
  "title": "GOVT CRITICAL ALERT: Immediate Evacuation of North Harbor",
  "message": "EMERGENCY: North Harbor coastal surge expected within 2 hours. Move immediately to North Harbor Relief Shelter (0.5km). Avoid Marina Bypass. Emergency call 112."
}
```

**Request (Direct Zone Broadcast):**
```http
POST /api/admin/alerts HTTP/1.1
Host: localhost:5000
x-admin-password: adminsecret123
Content-Type: application/json

{
  "zoneId": "674ef001a1b2c3d4e5f60005"
}
```

**Response (201 Created):**
```json
{
  "_id": "674ef006a1b2c3d4e5f60050",
  "zone": {
    "_id": "674ef001a1b2c3d4e5f60001",
    "name": "North Harbor Ward",
    "riskLevel": "SEVERE",
    "riskReason": "Storm surge warning and active sea ingress along fishing docks.",
    "estimatedPopulation": 45000
  },
  "title": "GOVT CRITICAL ALERT: Immediate Evacuation of North Harbor",
  "message": "EMERGENCY: North Harbor coastal surge expected within 2 hours. Move immediately to North Harbor Relief Shelter (0.5km). Avoid Marina Bypass. Emergency call 112.",
  "severity": "SEVERE",
  "status": "SENT",
  "source": "OPEN_METEO",
  "createdAt": "2026-10-03T08:05:00.000Z",
  "sentAt": "2026-10-03T08:25:00.000Z"
}
```
