const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(503).json({ message: 'Admin API not configured' });
  }
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_API_KEY) {
    return res.status(401).json({ message: 'Invalid or missing admin key' });
  }
  next();
}
