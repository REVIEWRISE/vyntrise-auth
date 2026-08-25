import { Request, Response, NextFunction } from 'express';

// Minimal in-memory sliding-window limiter — no new dependency for a single unauthenticated
// route. Per-process only (fine for this app's single-instance deployment); a multi-instance
// deployment would need a shared store instead.
export const rateLimit = (windowMs: number, max: number) => {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
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
