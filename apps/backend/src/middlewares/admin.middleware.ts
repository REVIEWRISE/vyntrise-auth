import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import prisma from '../db/prisma';

export interface AdminContext {
  userId: string;
  isSuperAdmin: boolean;
  // Platforms the caller holds ADMIN on through a membership. A super-admin may administer any
  // platform regardless, so this list is not the whole story for them — use canAdminister().
  adminPlatformIds: string[];
}

export interface AdminRequest extends AuthRequest {
  admin?: AdminContext;
  adminPlatformId?: string;
}

// Read from the database on every request rather than carried in the JWT, so revoking
// super-admin (or a platform role) takes effect on the very next call, not when a token expires.
export async function getAdminContext(userId: string): Promise<AdminContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isSuperAdmin: true,
      disabledAt: true,
      platforms: { where: { role: 'ADMIN' }, select: { platformId: true } },
    },
  });
  if (!user || user.disabledAt) return null;

  return {
    userId,
    isSuperAdmin: user.isSuperAdmin,
    adminPlatformIds: user.platforms.map((p) => p.platformId),
  };
}

export function canAdminister(ctx: AdminContext, platformId: string): boolean {
  return ctx.isSuperAdmin || ctx.adminPlatformIds.includes(platformId);
}

function requestedPlatformId(req: AdminRequest): string | undefined {
  const raw = req.query.platformId || req.body?.platformId || req.headers['x-platform-id'];
  return raw ? String(raw) : undefined;
}

async function platformExists(platformId: string): Promise<boolean> {
  return !!(await prisma.platform.findUnique({ where: { id: platformId }, select: { id: true } }));
}

// Attaches req.admin for any caller who administers something — at least one platform, or
// everything as a super-admin. Everyone else is refused here.
export const loadAdminContext = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const ctx = await getAdminContext(userId);
    if (!ctx || (!ctx.isSuperAdmin && ctx.adminPlatformIds.length === 0)) {
      res.status(403).json({ message: 'Forbidden: Admin access required' });
      return;
    }

    req.admin = ctx;
    next();
  } catch (error) {
    console.error('loadAdminContext error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const requireSuperAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const ctx = req.admin ?? (await getAdminContext(userId));
    if (!ctx?.isSuperAdmin) {
      res.status(403).json({ message: 'Forbidden: Super-admin access required' });
      return;
    }

    req.admin = ctx;
    next();
  } catch (error) {
    console.error('requireSuperAdmin error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// requireAdmin falls back to "any platform this user administers" when no platformId is given,
// which is tolerable for a read (worst case: the wrong list renders) but not for a mutation —
// a missing parameter would silently delete a membership on some other platform. Destructive
// routes name their platform explicitly or get rejected.
export const requireExplicitPlatform = (req: AdminRequest, res: Response, next: NextFunction) => {
  if (!requestedPlatformId(req)) {
    res.status(400).json({ message: 'platformId is required for this operation' });
    return;
  }

  next();
};

// Admin of the platform named in the route, specifically — not "admin of some platform". Used
// by every route that reads or manages one platform by id, so the check cannot be forgotten in
// a controller. A super-admin passes for any platform that exists.
export const requirePlatformAdminParam = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const platformId = String(req.params.id ?? req.params.platformId);
    const ctx = req.admin ?? (await getAdminContext(userId));

    if (!ctx || !canAdminister(ctx, platformId)) {
      res.status(403).json({ message: 'Forbidden: Admin access required for this platform' });
      return;
    }

    // A super-admin's bypass skips the membership lookup that would otherwise prove the platform
    // exists, so confirm it here and give a clean 404 rather than a foreign-key error later.
    if (!ctx.adminPlatformIds.includes(platformId) && !(await platformExists(platformId))) {
      res.status(404).json({ message: 'Platform not found' });
      return;
    }

    req.admin = ctx;
    next();
  } catch (error) {
    console.error('requirePlatformAdminParam error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const requireAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const ctx = req.admin ?? (await getAdminContext(userId));
    if (!ctx) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const platformId = requestedPlatformId(req);
    let resolved: string | undefined;

    if (platformId) {
      if (ctx.adminPlatformIds.includes(platformId)) {
        resolved = platformId;
      } else if (ctx.isSuperAdmin && (await platformExists(platformId))) {
        resolved = platformId;
      }
    } else {
      // No platform named: fall back to the first one this user administers by membership.
      resolved = ctx.adminPlatformIds[0];
    }

    if (!resolved) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    req.admin = ctx;
    // Attach the verified platformId to the request for the controllers to use
    req.adminPlatformId = resolved;

    next();
  } catch (error) {
    console.error('requireAdmin error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export type AdminScope = { all: true } | { all: false; platformIds: string[] };

// For read endpoints that can span platforms (analytics, audit). A super-admin who names no
// platform — or names "all" — sees everything; anyone else is pinned to one platform they
// administer. Returns null when the named platform is out of the caller's reach.
export function resolveScope(req: AdminRequest): AdminScope | null {
  const ctx = req.admin;
  if (!ctx) return null;

  const platformId = requestedPlatformId(req);

  if (ctx.isSuperAdmin && (!platformId || platformId === 'all')) {
    return { all: true };
  }

  if (!platformId || platformId === 'all') {
    const first = ctx.adminPlatformIds[0];
    return first ? { all: false, platformIds: [first] } : null;
  }

  return canAdminister(ctx, platformId) ? { all: false, platformIds: [platformId] } : null;
}
