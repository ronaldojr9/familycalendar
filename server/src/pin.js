import crypto from 'node:crypto';
import { getHousehold } from './db.js';

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPin(pin, stored) {
  if (!stored || pin == null) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(pin), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// Middleware for PIN-gated mutations. The client sends the PIN in the
// x-family-pin header after prompting the user (no session/auth system).
export function requirePin(req, res, next) {
  const household = getHousehold();
  if (!household) return res.status(409).json({ error: 'Household not set up yet' });
  if (!verifyPin(req.get('x-family-pin'), household.pin_hash)) {
    return res.status(401).json({ error: 'Parental PIN required', pin_required: true });
  }
  next();
}
