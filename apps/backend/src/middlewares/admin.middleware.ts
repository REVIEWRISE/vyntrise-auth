import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import prisma from '../db/prisma';

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
