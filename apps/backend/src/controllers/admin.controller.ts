import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { AdminRequest } from '../middlewares/admin.middleware';
import {
  invalidateOriginCache,
  normalizeOrigins,
  normalizeRedirectUris,
} from '../services/platform-security.service';
import { emailService, notify } from '../services/email.service';
import { logActivity } from '../services/audit.service';
import { createInvitation } from '../services/invite.service';
import {
  generateInviteKey,
  getActiveInviteKey,
  revokeInviteKeys,
} from '../services/platform-invite-key.service';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const platformId = (req as any).adminPlatformId;

    const totalUsers = await prisma.userPlatformAccess.count({
      where: { platformId },
    });

    const pendingInvites = await prisma.invitation.count({
      where: { platformId, isUsed: false },
    });

    const recentLogs = await prisma.auditLog.findMany({
      where: { platformId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { actor: { select: { email: true } } },
    });

    const recentActivity = recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      actorEmail: log.actor?.email ?? null,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    res.json({
      totalUsers,
      pendingInvites,
      recentActivity,
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const platformId = (req as any).adminPlatformId;

    const accessRecords = await prisma.userPlatformAccess.findMany({
      where: { platformId },
      include: {
        user: {
          select: { id: true, email: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const users = accessRecords.map((record: any) => ({
      ...record.user,
      role: record.role,
      accessCreatedAt: record.createdAt,
    }));

    res.json(users);
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Refuses to strip the last ADMIN from a platform, which would leave it unmanageable — the
// same invariant deleteAccount enforces before letting a sole admin delete themselves.
async function wouldOrphanPlatform(platformId: string, userId: string): Promise<boolean> {
  const access = await prisma.userPlatformAccess.findUnique({
    where: { userId_platformId: { userId, platformId } },
  });
  if (access?.role !== 'ADMIN') return false;

  const adminCount = await prisma.userPlatformAccess.count({
    where: { platformId, role: 'ADMIN' },
  });
  return adminCount <= 1;
}

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const platformId = (req as any).adminPlatformId;
    const actorId = (req as any).user?.id;
    const userId = String(req.params.userId);
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'Role must be USER or ADMIN' });
    }

    const access = await prisma.userPlatformAccess.findUnique({
      where: { userId_platformId: { userId, platformId } },
      include: { user: { select: { email: true } }, platform: { select: { name: true } } },
    });

    if (!access) {
      return res.status(404).json({ message: 'User is not a member of this platform' });
    }

    if (access.role === role) {
      return res.status(200).json({ message: 'Role unchanged', role });
    }

    if (role === 'USER' && await wouldOrphanPlatform(platformId, userId)) {
      return res.status(409).json({
        message: 'This is the only admin for this platform. Promote another admin first.',
      });
    }

    await prisma.userPlatformAccess.update({
      where: { userId_platformId: { userId, platformId } },
      data: { role },
    });

    logActivity({
      action: 'USER_ROLE_CHANGED',
      platformId,
      actorId,
      targetType: 'user',
      targetId: userId,
      metadata: { email: access.user.email, from: access.role, to: role },
    });

    notify(`role change to ${access.user.email}`, () =>
      emailService.sendRoleChangedEmail(access.user.email, access.platform.name, role)
    );

    res.json({ message: 'Role updated', role });
  } catch (error) {
    console.error('updateUserRole error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const removeUserFromPlatform = async (req: Request, res: Response) => {
  try {
    const platformId = (req as any).adminPlatformId;
    const actorId = (req as any).user?.id;
    const userId = String(req.params.userId);

    const access = await prisma.userPlatformAccess.findUnique({
      where: { userId_platformId: { userId, platformId } },
      include: { user: { select: { email: true } }, platform: { select: { name: true } } },
    });

    if (!access) {
      return res.status(404).json({ message: 'User is not a member of this platform' });
    }

    if (await wouldOrphanPlatform(platformId, userId)) {
      return res.status(409).json({
        message: 'This is the only admin for this platform. Promote another admin first.',
      });
    }

    // Only this platform's membership is removed. The account itself and any access it has to
    // other platforms are left alone, so sessions stay valid — the next request simply finds
    // no access record for this platform.
    await prisma.userPlatformAccess.delete({
      where: { userId_platformId: { userId, platformId } },
    });

    logActivity({
      action: 'USER_REMOVED_FROM_PLATFORM',
      platformId,
      actorId,
      targetType: 'user',
      targetId: userId,
      metadata: { email: access.user.email, role: access.role },
    });

    notify(`removal notice to ${access.user.email}`, () =>
      emailService.sendRemovedFromPlatformEmail(access.user.email, access.platform.name)
    );

    res.json({ message: 'User removed from platform' });
  } catch (error) {
    console.error('removeUserFromPlatform error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const revokeInvite = async (req: Request, res: Response) => {
  try {
    const platformId = (req as any).adminPlatformId;
    const actorId = (req as any).user?.id;
    const id = String(req.params.id);

    const invite = await prisma.invitation.findUnique({ where: { id } });

    // Scoped to the caller's platform so an admin of one platform can't revoke another's
    // invitations by guessing an id.
    if (!invite || invite.platformId !== platformId) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    await prisma.invitation.delete({ where: { id } });

    logActivity({
      action: 'INVITE_REVOKED',
      platformId,
      actorId,
      targetType: 'invitation',
      targetId: id,
      metadata: { email: invite.email, role: invite.role },
    });

    res.json({ message: 'Invitation revoked' });
  } catch (error) {
    console.error('revokeInvite error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getInvites = async (req: Request, res: Response) => {
  try {
    const platformId = (req as any).adminPlatformId;

    const invites = await prisma.invitation.findMany({
      where: { platformId },
      // The token is deliberately not selected — the list view never renders it, and an
      // invite token is a credential that shouldn't ride along in an API response.
      select: {
        id: true,
        email: true,
        role: true,
        isUsed: true,
        expiresAt: true,
        createdAt: true,
        platformId: true,
        platform: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invites);
  } catch (error) {
    console.error('getInvites error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createInvite = async (req: Request, res: Response) => {
  try {
    const platformId = (req as any).adminPlatformId;
    const { email, role = 'USER' } = req.body;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email address is required' });
    }

    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'Role must be USER or ADMIN' });
    }

    const result = await createInvitation({
      platformId,
      email,
      role,
      actorId: (req as any).user?.id,
      origin: 'admin',
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    // An existing account is granted access immediately, so there is no link to hand back.
    if (result.granted) {
      return res.status(201).json({
        message: 'User already has an account and was added to the platform',
        granted: true,
        token: null,
        registerLink: null,
      });
    }

    res.status(201).json({
      message: 'Invitation created',
      granted: false,
      token: result.token,
      registerLink: result.registerLink,
    });
  } catch (error) {
    console.error('createInvite error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// The caller's identity for the console: who they are, whether they are a super-admin, and the
// platforms they can administer. The frontend gates the whole admin area on this.
export const getAdminMe = async (req: Request, res: Response) => {
  try {
    const ctx = (req as AdminRequest).admin!;
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, email: true, isSuperAdmin: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const platforms = await prisma.platform.findMany({
      where: ctx.isSuperAdmin ? {} : { id: { in: ctx.adminPlatformIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    res.json({
      ...user,
      platforms: platforms.map((p) => ({
        ...p,
        // A super-admin may administer a platform without being a member of it.
        role: ctx.adminPlatformIds.includes(p.id) ? 'ADMIN' : 'SUPER_ADMIN',
      })),
    });
  } catch (error) {
    console.error('getAdminMe error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// One grouped query for every platform's member count, instead of a count per platform.
async function memberCounts(platformIds: string[]): Promise<Map<string, number>> {
  const groups = await prisma.userPlatformAccess.groupBy({
    by: ['platformId'],
    where: { platformId: { in: platformIds } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.platformId, g._count._all]));
}

export const getPlatforms = async (req: Request, res: Response) => {
  try {
    const ctx = (req as AdminRequest).admin!;

    const platforms = await prisma.platform.findMany({
      where: ctx.isSuperAdmin ? {} : { id: { in: ctx.adminPlatformIds } },
      orderBy: { createdAt: 'desc' },
    });
    const counts = await memberCounts(platforms.map((p) => p.id));

    res.json(
      platforms.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        allowSelfRegistration: p.allowSelfRegistration,
        redirectUriCount: p.redirectUris.length,
        createdAt: p.createdAt,
        userCount: counts.get(p.id) ?? 0,
      }))
    );
  } catch (error) {
    console.error('getPlatforms error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

async function platformDetail(id: string) {
  const platform = await prisma.platform.findUnique({ where: { id } });
  if (!platform) return null;

  const userCount = await prisma.userPlatformAccess.count({ where: { platformId: id } });
  // Metadata only — the key itself is unrecoverable after the call that created it.
  const inviteKey = await getActiveInviteKey(id);

  return {
    id: platform.id,
    name: platform.name,
    description: platform.description,
    allowSelfRegistration: platform.allowSelfRegistration,
    redirectUris: platform.redirectUris,
    allowedOrigins: platform.allowedOrigins,
    createdAt: platform.createdAt,
    userCount,
    inviteKey,
  };
}

// Behind requirePlatformAdminParam: scoped to this specific platform, not "admin of any
// platform" — otherwise an admin of platform A could read platform B by guessing its id.
export const getPlatformById = async (req: Request, res: Response) => {
  try {
    const detail = await platformDetail(String(req.params.id));
    if (!detail) {
      return res.status(404).json({ message: 'Platform not found' });
    }
    res.json(detail);
  } catch (error) {
    console.error('getPlatformById error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Behind requirePlatformAdminParam, same scoping as getPlatformById. Every field is optional;
// only those present in the body change.
export const updatePlatformSettings = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const admin = (req as AdminRequest).admin!;
    const userId = admin.userId;
    const viaSuperAdmin = !admin.adminPlatformIds.includes(id);
    const { name, description, allowSelfRegistration, redirectUris, allowedOrigins } = req.body ?? {};

    const previous = await prisma.platform.findUnique({ where: { id } });
    if (!previous) {
      return res.status(404).json({ message: 'Platform not found' });
    }

    const data: Prisma.PlatformUpdateInput = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Platform name cannot be empty' });
      }
      const trimmed = name.trim();
      if (trimmed !== previous.name) {
        const clash = await prisma.platform.findUnique({ where: { name: trimmed } });
        if (clash) return res.status(409).json({ message: 'A platform with that name already exists' });
        data.name = trimmed;
      }
    }
    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return res.status(400).json({ message: 'Description must be a string' });
      }
      data.description = description?.trim() || null;
    }
    if (allowSelfRegistration !== undefined) {
      data.allowSelfRegistration = !!allowSelfRegistration;
    }
    if (redirectUris !== undefined) {
      const result = normalizeRedirectUris(redirectUris);
      if (!result.ok) return res.status(400).json({ message: result.message });
      data.redirectUris = result.values;
    }
    if (allowedOrigins !== undefined) {
      const result = normalizeOrigins(allowedOrigins);
      if (!result.ok) return res.status(400).json({ message: result.message });
      data.allowedOrigins = result.values;
    }

    const platform = await prisma.platform.update({ where: { id }, data });

    const base = {
      platformId: id,
      actorId: userId,
      targetType: 'platform',
      targetId: id,
      req,
    } as const;
    const marker: Record<string, Prisma.InputJsonValue> = viaSuperAdmin ? { viaSuperAdmin: true } : {};

    // Opening a platform to public sign-up is a security-relevant change, so it needs the same
    // trail as platform and invite creation.
    if (previous.allowSelfRegistration !== platform.allowSelfRegistration) {
      logActivity({
        ...base,
        action: 'PLATFORM_SETTINGS_CHANGED',
        metadata: {
          setting: 'allowSelfRegistration',
          from: previous.allowSelfRegistration,
          to: platform.allowSelfRegistration,
          ...marker,
        },
      });
    }
    if (previous.name !== platform.name || previous.description !== platform.description) {
      logActivity({
        ...base,
        action: 'PLATFORM_SETTINGS_CHANGED',
        metadata: {
          setting: 'profile',
          from: { name: previous.name, description: previous.description },
          to: { name: platform.name, description: platform.description },
          ...marker,
        },
      });
    }

    const redirectsChanged = !sameList(previous.redirectUris, platform.redirectUris);
    const originsChanged = !sameList(previous.allowedOrigins, platform.allowedOrigins);
    if (redirectsChanged || originsChanged) {
      const diff: Record<string, Prisma.InputJsonValue> = { ...marker };
      if (redirectsChanged) diff.redirectUris = { from: previous.redirectUris, to: platform.redirectUris };
      if (originsChanged) diff.allowedOrigins = { from: previous.allowedOrigins, to: platform.allowedOrigins };
      logActivity({ ...base, action: 'PLATFORM_SECURITY_CHANGED', metadata: diff });
    }
    if (originsChanged) invalidateOriginCache();

    res.json(await platformDetail(id));
  } catch (error) {
    console.error('updatePlatformSettings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Super-admin only (see admin.routes). Creating platforms used to be open to any platform admin,
// which let an admin of one tenant mint arbitrary new tenants.
export const createPlatform = async (req: Request, res: Response) => {
  try {
    const { name, description, allowSelfRegistration } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Platform name is required' });
    }

    const existing = await prisma.platform.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return res.status(409).json({ message: 'A platform with that name already exists' });
    }

    const platform = await prisma.platform.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        allowSelfRegistration: !!allowSelfRegistration,
      },
    });

    // Auto-grant the creating admin access to the new platform
    const userId = (req as any).user?.id;
    if (userId) {
      await prisma.userPlatformAccess.create({
        data: { userId, platformId: platform.id, role: 'ADMIN' },
      });
    }

    logActivity({
      action: 'PLATFORM_CREATED',
      platformId: platform.id,
      actorId: userId,
      targetType: 'platform',
      targetId: platform.id,
      metadata: { name: platform.name },
      req,
    });

    res.status(201).json(platform);
  } catch (error) {
    console.error('createPlatform error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Super-admin only, and only with the platform's exact name echoed back, so it cannot happen
// from a stray click or a replayed request for a different platform. Memberships, invitations
// and invite keys go with it; audit rows survive with platformId nulled (onDelete: SetNull).
export const deletePlatform = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const actorId = (req as any).user?.id ?? null;
    const confirmName = req.body?.confirmName;

    const platform = await prisma.platform.findUnique({ where: { id } });
    if (!platform) {
      return res.status(404).json({ message: 'Platform not found' });
    }
    if (typeof confirmName !== 'string' || confirmName !== platform.name) {
      return res.status(400).json({ message: 'confirmName must match the platform name exactly' });
    }

    const memberCount = await prisma.userPlatformAccess.count({ where: { platformId: id } });

    await prisma.$transaction([
      prisma.invitation.deleteMany({ where: { platformId: id } }),
      prisma.platformInviteKey.deleteMany({ where: { platformId: id } }),
      prisma.userPlatformAccess.deleteMany({ where: { platformId: id } }),
      prisma.platform.delete({ where: { id } }),
    ]);

    invalidateOriginCache();

    // platformId null: the platform no longer exists, so the row would fail its foreign key.
    // The id and name live on in metadata.
    logActivity({
      action: 'PLATFORM_DELETED',
      platformId: null,
      actorId,
      targetType: 'platform',
      targetId: id,
      metadata: { platformId: id, name: platform.name, memberCount },
      req,
    });

    res.json({ message: 'Platform deleted' });
  } catch (error) {
    console.error('deletePlatform error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Every key the platform has had, newest first, revoked ones included, for the keys tab.
export const getPlatformInviteKeys = async (req: Request, res: Response) => {
  try {
    const keys = await prisma.platformInviteKey.findMany({
      where: { platformId: String(req.params.id) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdBy: { select: { email: true } },
      },
    });
    res.json(keys.map(({ createdBy, ...k }) => ({ ...k, createdByEmail: createdBy?.email ?? null })));
  } catch (error) {
    console.error('getPlatformInviteKeys error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Public metadata of the JWT signing keys. The private key is never selected.
export const getSigningKeys = async (_req: Request, res: Response) => {
  try {
    const keys = await prisma.signingKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, kid: true, algorithm: true, isActive: true, createdAt: true, retiredAt: true },
    });
    res.json(keys);
  } catch (error) {
    console.error('getSigningKeys error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getSuperAdmins = async (_req: Request, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: { isSuperAdmin: true },
      select: { id: true, email: true, disabledAt: true, lastLoginAt: true },
      orderBy: { email: 'asc' },
    });
    res.json(admins);
  } catch (error) {
    console.error('getSuperAdmins error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Platform invite keys ─────────────────────────────────────────────────────────────────────
// Human-operated management of the credential a platform's backend uses to create invitations.
// Both routes sit behind requirePlatformAdminParam, so they are scoped to one platform the
// caller actually administers.

export const issuePlatformInviteKey = async (req: Request, res: Response) => {
  try {
    const platformId = String(req.params.id);
    const actorId = (req as any).user?.id ?? null;

    const platform = await prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) {
      return res.status(404).json({ message: 'Platform not found' });
    }

    const existing = await getActiveInviteKey(platformId);
    const key = await generateInviteKey(platformId, actorId);

    logActivity({
      action: 'INVITE_KEY_CREATED',
      platformId,
      actorId,
      targetType: 'platformInviteKey',
      targetId: key.id,
      // `replaced` makes a rotation legible in the trail: a second key appearing without it
      // would look like two live credentials rather than one succeeding another.
      metadata: existing ? { prefix: key.prefix, replaced: existing.id } : { prefix: key.prefix },
    });

    // The only response that will ever contain rawKey.
    res.status(201).json({
      message: 'Invite key created. Copy it now — it cannot be shown again.',
      rawKey: key.rawKey,
      key: { id: key.id, prefix: key.prefix, createdAt: key.createdAt, lastUsedAt: null },
    });
  } catch (error) {
    console.error('issuePlatformInviteKey error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const revokePlatformInviteKey = async (req: Request, res: Response) => {
  try {
    const platformId = String(req.params.id);
    const actorId = (req as any).user?.id ?? null;

    const existing = await getActiveInviteKey(platformId);
    const revoked = await revokeInviteKeys(platformId);

    if (revoked === 0) {
      return res.status(404).json({ message: 'No active invite key for this platform' });
    }

    logActivity({
      action: 'INVITE_KEY_REVOKED',
      platformId,
      actorId,
      targetType: 'platformInviteKey',
      targetId: existing?.id,
      metadata: existing ? { prefix: existing.prefix } : {},
    });

    res.json({ message: 'Invite key revoked' });
  } catch (error) {
    console.error('revokePlatformInviteKey error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
