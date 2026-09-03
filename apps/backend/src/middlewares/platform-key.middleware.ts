import { Request, Response, NextFunction } from 'express';
import { resolveInviteKey, touchInviteKey } from '../services/platform-invite-key.service';

export interface PlatformKeyRequest extends Request {
  inviteKey?: { id: string; platformId: string };
}

/**
 * Authenticates a platform-scoped invite key presented as `Authorization: Bearer <key>`.
 *
 * Two separate checks, and both matter:
 *
 *  1. The key resolves to a live record.
 *  2. The platform that key is bound to is the same platform named in the URL.
 *
 * The second is the reason this middleware exists rather than reusing a generic API-key check. A
 * key for platform A presented against platform B's URL is a valid credential being used outside
 * its scope, which is exactly the case a shared admin key would have allowed. It is rejected as
 * 401 rather than 403 deliberately: 403 would confirm to the holder that platform B exists.
 *
 * The key never travels in the URL — see the route definition. Query strings end up in access
 * logs, proxy logs, and Referer headers, which is why invite and reset tokens in this codebase
 * are already kept out of them.
 */
export const authenticatePlatformKey = async (
  req: PlatformKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Missing or malformed Authorization header' });
      return;
    }

    const rawKey = header.slice('Bearer '.length).trim();
    if (!rawKey) {
      res.status(401).json({ message: 'Missing or malformed Authorization header' });
      return;
    }

    const key = await resolveInviteKey(rawKey);
    if (!key) {
      res.status(401).json({ message: 'Invalid or revoked platform key' });
      return;
    }

    const platformId = String(req.params.platformId);
    if (key.platformId !== platformId) {
      // Same response as an unknown key: a mismatched-scope key must not be able to probe which
      // platform ids exist.
      res.status(401).json({ message: 'Invalid or revoked platform key' });
      return;
    }

    req.inviteKey = { id: key.id, platformId: key.platformId };
    touchInviteKey(key.id);

    next();
  } catch (error) {
    console.error('authenticatePlatformKey error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/** Rate-limit key: counts per invite key, so one platform cannot spend another's budget. */
export const inviteKeyRateKey = (req: Request): string => {
  const id = (req as PlatformKeyRequest).inviteKey?.id;
  return id ? `key:${id}` : `ip:${req.ip ?? 'unknown'}`;
};

/** Rate-limit key: per key *and* target address, mirroring the resend-verification ceiling. */
export const inviteKeyAndEmailRateKey = (req: Request): string => {
  const id = (req as PlatformKeyRequest).inviteKey?.id ?? 'unknown';
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
  return email ? `key:${id}|${email}` : `key:${id}`;
};
