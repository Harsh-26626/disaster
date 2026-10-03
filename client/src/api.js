const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// Public API endpoints
export async function getMapData() {
  return request('/api/map');
}

export async function createReport(reportData) {
  return request('/api/report', {
    method: 'POST',
    body: JSON.stringify(reportData)
  });
}

export async function getSentAlerts() {
  return request('/api/alerts');
}

export async function sendChatMessage(message) {
  return request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

// Admin API endpoints (x-admin-password required)
export async function getAdminFeeds(adminPassword) {
  return request('/api/admin/feeds', {
    headers: { 'x-admin-password': adminPassword }
  });
}

export async function getAdminReports(adminPassword) {
  return request('/api/admin/reports', {
    headers: { 'x-admin-password': adminPassword }
  });
}

export async function updateReportStatus(reportId, status, adminPassword) {
  return request(`/api/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'x-admin-password': adminPassword },
    body: JSON.stringify({ status })
  });
}

export async function broadcastAlert(payload, adminPassword) {
  return request('/api/admin/alerts', {
    method: 'POST',
    headers: { 'x-admin-password': adminPassword },
    body: JSON.stringify(payload)
  });
}

export async function refreshFeeds(adminPassword) {
  return request('/api/admin/feeds/refresh', {
    method: 'POST',
    headers: { 'x-admin-password': adminPassword }
  });
}
