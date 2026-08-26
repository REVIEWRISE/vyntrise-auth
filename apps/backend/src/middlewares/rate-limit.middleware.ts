import { Request, Response, NextFunction } from 'express';

// Minimal in-memory sliding-window limiter — no new dependency for a handful of unauthenticated
// routes. Per-process only (fine for this app's single-instance deployment); a multi-instance
// deployment would need a shared store instead.
//
// `keyFn` picks what to count. The default is the client IP; auth routes also limit per account
// so that spreading a brute-force run across many IPs still hits a ceiling.
export const rateLimit = (
  windowMs: number,
  max: number,
  keyFn: (req: Request) => string = (req) => req.ip ?? 'unknown'
) => {
  const hits = new Map<string, number[]>();
  let lastSweep = Date.now();

  const sweep = (now: number) => {
    // Without this the map grows once per distinct key forever. Sweeping at most once per
    // window keeps the cost negligible relative to request volume.
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, timestamps] of hits) {
      if (timestamps.every((t) => t <= now - windowMs)) hits.delete(key);
    }
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    sweep(now);

    const key = keyFn(req);
    const windowStart = now - windowMs;

    const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
    timestamps.push(now);
    hits.set(key, timestamps);

    if (timestamps.length > max) {
      res.status(429).json({ message: 'Too many requests, please try again later' });
      return;
    }

    next();
  };
};

// Counts against the IP and, when the body carries one, the target email — so an attacker
// cannot sidestep the per-IP ceiling by rotating addresses, nor the per-account ceiling by
// rotating IPs. Falls back to IP alone for requests with no email.
export const ipAndEmailKey = (req: Request): string => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
  return email ? `${req.ip ?? 'unknown'}|${email}` : (req.ip ?? 'unknown');
};

// Counts every attempt against one account regardless of source IP.
export const emailOnlyKey = (req: Request): string => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
  return email ? `email:${email}` : `ip:${req.ip ?? 'unknown'}`;
};
