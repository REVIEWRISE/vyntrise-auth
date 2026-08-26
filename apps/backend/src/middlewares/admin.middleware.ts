import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import prisma from '../db/prisma';

// requireAdmin falls back to "any platform this user administers" when no platformId is given,
// which is tolerable for a read (worst case: the wrong list renders) but not for a mutation —
// a missing parameter would silently delete a membership on some other platform. Destructive
// routes name their platform explicitly or get rejected.
export const requireExplicitPlatform = (req: AuthRequest, res: Response, next: NextFunction) => {
  const platformId = req.query.platformId || req.body?.platformId || req.headers['x-platform-id'];

  if (!platformId) {
    res.status(400).json({ message: 'platformId is required for this operation' });
    return;
  }

  next();
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Usually the platformId comes from the route params or body.
    // If we have a single platform context or a header, we check it.
    // For simplicity, we'll check if the user is an ADMIN in ANY platform,
    // or if a platformId is passed, we check that specific platform.

    const platformId = req.query.platformId || req.body?.platformId || req.headers['x-platform-id'];

    const accessQuery: any = { userId: user.id, role: 'ADMIN' };
    if (platformId) {
      accessQuery.platformId = String(platformId);
    }

    const access = await prisma.userPlatformAccess.findFirst({
      where: accessQuery,
    });

    if (!access) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    // Attach the verified platformId to the request for the controllers to use
    (req as any).adminPlatformId = access.platformId;

    next();
  } catch (error) {
    console.error('requireAdmin error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
