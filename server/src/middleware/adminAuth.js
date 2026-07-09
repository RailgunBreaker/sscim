export function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return res.status(503).json({ error: 'Admin API disabled: ADMIN_TOKEN is not set on the server.' });
  }
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
