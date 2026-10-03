export function adminAuth(req, res, next) {
  const adminPassword = req.headers['x-admin-password'];
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredPassword) {
    return res.status(500).json({ error: 'Server misconfiguration: ADMIN_PASSWORD is not set' });
  }

  if (!adminPassword || adminPassword !== configuredPassword) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
  }

  next();
}
