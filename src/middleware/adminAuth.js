import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAdmin(req, res, next) {
  const authorization = req.get('authorization');
  const [scheme, token] = authorization?.split(' ') || [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Admin login required.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.type !== 'admin' || payload.sub !== config.adminUsername) {
      return res.status(401).json({ error: 'Admin login required.' });
    }
    return next();
  } catch {
    return res.status(401).json({ error: 'Admin session expired. Please log in again.' });
  }
}
