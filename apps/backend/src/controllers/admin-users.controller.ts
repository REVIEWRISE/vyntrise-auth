import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { AdminContext, AdminRequest } from '../middlewares/admin.middleware';
import { logActivity } from '../services/audit.service';
import { emailService, notify } from '../services/email.service';
import { sendVerificationEmail } from './email-verification.controller';

const PAGE_SIZE_MAX = 100;

function paging(query: AdminRequest['query']) {
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 25, 1), PAGE_SIZE_MAX);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function userFilter(query: AdminRequest['query']): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (typeof query.q === 'string' && query.q.trim()) {
    where.email = { contains: query.q.trim(), mode: 'insensitive' };
  }
  switch (query.status) {
    case 'verified':
      where.emailVerified = true;
      break;
    case 'unverified':
      where.emailVerified = false;
      break;
    case 'disabled':
      where.disabledAt = { not: null };
      break;
    case 'active':
      where.disabledAt = null;
      break;
  }
  return where;
}

const userColumns = {
  id: true,
  email: true,
  emailVerified: true,
  isSuperAdmin: true,
  disabledAt: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

// GET /api/admin/users?platformId=&q=&role=&status=&page=&pageSize=
// Members of one platform the caller administers (requireAdmin resolves which).
export const listPlatformUsers = async (req: AdminRequest, res: Response) => {
  try {
    const platformId = req.adminPlatformId!;
    const { page, pageSize, skip } = paging(req.query);

    const where: Prisma.UserPlatformAccessWhereInput = {
      platformId,
      user: userFilter(req.query),
      ...(req.query.role === 'ADMIN' || req.query.role === 'USER' ? { role: req.query.role } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.userPlatformAccess.count({ where }),
      prisma.userPlatformAccess.findMany({
        where,
        include: { user: { select: userColumns } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    res.json({
      page,
      pageSize,
      total,
      items: rows.map((r) => ({ ...r.user, role: r.role, accessCreatedAt: r.createdAt })),
    });
  } catch (error) {
    console.error('listPlatformUsers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/admin/users/all — every account, super-admin only.
export const listAllUsers = async (req: AdminRequest, res: Response) => {
  try {
    const { page, pageSize, skip } = paging(req.query);
    const where = userFilter(req.query);

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          ...userColumns,
          platforms: { select: { role: true, platform: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    res.json({
      page,
      pageSize,
      total,
      items: rows.map(({ platforms, ...u }) => ({
        ...u,
        platforms: platforms.map((p) => ({ id: p.platform.id, name: p.platform.name, role: p.role })),
      })),
    });
  } catch (error) {
    console.error('listAllUsers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// A platform admin may look at a user only if that user belongs to a platform they administer;
// a super-admin may look at anyone. Answering 404 otherwise keeps user ids from being probed.
async function visibleTo(ctx: AdminContext, userId: string): Promise<boolean> {
  if (ctx.isSuperAdmin) return !!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }));
  const shared = await prisma.userPlatformAccess.findFirst({
    where: { userId, platformId: { in: ctx.adminPlatformIds } },
    select: { id: true },
  });
  return !!shared;
}

// GET /api/admin/users/:userId — the User 360 view.
export const getUserDetail = async (req: AdminRequest, res: Response) => {
  try {
    const ctx = req.admin!;
    const userId = String(req.params.userId);

    if (!(await visibleTo(ctx, userId))) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...userColumns,
        emailVerifiedAt: true,
        disabledReason: true,
        updatedAt: true,
        platforms: {
          where: ctx.isSuperAdmin ? {} : { platformId: { in: ctx.adminPlatformIds } },
          select: { role: true, createdAt: true, platform: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const sessionCount = await prisma.session.count({ where: { userId } });
    const disabledBy = user.disabledAt
      ? await prisma.auditLog.findFirst({
          where: { action: 'USER_DISABLED', targetType: 'user', targetId: userId },
          orderBy: { createdAt: 'desc' },
          select: { actor: { select: { email: true } } },
        })
      : null;

    const { platforms, ...profile } = user;
    res.json({
      ...profile,
      disabledByEmail: disabledBy?.actor?.email ?? null,
      sessionCount,
      memberships: platforms.map((p) => ({
        platformId: p.platform.id,
        platformName: p.platform.name,
        role: p.role,
        joinedAt: p.createdAt,
        canManage: ctx.isSuperAdmin || ctx.adminPlatformIds.includes(p.platform.id),
      })),
    });
  } catch (error) {
    console.error('getUserDetail error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/admin/users/:userId/sessions — super-admin only: sessions span every platform.
export const listUserSessions = async (req: AdminRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: String(req.params.userId) },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true },
      orderBy: { lastUsedAt: 'desc' },
    });
    res.json(sessions.map((s) => ({ ...s, isCurrent: s.id === req.user?.sessionId })));
  } catch (error) {
    console.error('listUserSessions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/admin/users/:userId/sessions[/:sessionId]
export const revokeUserSessions = async (req: AdminRequest, res: Response) => {
  try {
    const userId = String(req.params.userId);
    const sessionId = req.params.sessionId ? String(req.params.sessionId) : undefined;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { count } = await prisma.session.deleteMany({
      where: { userId, ...(sessionId ? { id: sessionId } : {}) },
    });
    if (sessionId && count === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    logActivity({
      action: 'USER_SESSIONS_REVOKED_BY_ADMIN',
      actorId: req.admin!.userId,
      targetType: 'user',
      targetId: userId,
      metadata: { email: user.email, count, ...(sessionId ? { sessionId } : { scope: 'all' }) },
      req,
    });

    if (count > 0) {
      notify(`sessions-revoked notice to ${user.email}`, () =>
        emailService.sendSessionsRevokedEmail(user.email, count)
      );
    }

    res.json({ message: `Revoked ${count} ${count === 1 ? 'session' : 'sessions'}`, count });
  } catch (error) {
    console.error('revokeUserSessions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/admin/users/:userId/disable { reason? }
// Disabling deletes every session in the same transaction, so the user's live access tokens
// fail authenticateJWT on their next request and refresh has nothing to rotate.
export const disableUser = async (req: AdminRequest, res: Response) => {
  try {
    const actorId = req.admin!.userId;
    const userId = String(req.params.userId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';

    if (userId === actorId) {
      return res.status(400).json({ message: 'You cannot disable your own account' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.disabledAt) return res.status(409).json({ message: 'Account is already disabled' });

    if (user.isSuperAdmin) {
      const others = await prisma.user.count({
        where: { isSuperAdmin: true, disabledAt: null, id: { not: userId } },
      });
      if (others === 0) {
        return res.status(409).json({ message: 'Cannot disable the last active super-admin' });
      }
    }

    const [, sessions] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { disabledAt: new Date(), disabledReason: reason || null, disabledById: actorId },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);

    logActivity({
      action: 'USER_DISABLED',
      actorId,
      targetType: 'user',
      targetId: userId,
      metadata: { email: user.email, reason, sessionsRevoked: sessions.count },
      req,
    });

    res.json({ message: 'Account disabled', sessionsRevoked: sessions.count });
  } catch (error) {
    console.error('disableUser error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/admin/users/:userId/enable
export const enableUser = async (req: AdminRequest, res: Response) => {
  try {
    const userId = String(req.params.userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.disabledAt) return res.status(409).json({ message: 'Account is not disabled' });

    await prisma.user.update({
      where: { id: userId },
      data: { disabledAt: null, disabledReason: null, disabledById: null },
    });

    logActivity({
      action: 'USER_ENABLED',
      actorId: req.admin!.userId,
      targetType: 'user',
      targetId: userId,
      metadata: { email: user.email },
      req,
    });

    res.json({ message: 'Account enabled' });
  } catch (error) {
    console.error('enableUser error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/admin/users/:userId/resend-verification
export const resendUserVerification = async (req: AdminRequest, res: Response) => {
  try {
    const ctx = req.admin!;
    const userId = String(req.params.userId);

    if (!(await visibleTo(ctx, userId))) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        platforms: { select: { platformId: true, platform: { select: { name: true } } } },
      },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.emailVerified) {
      return res.status(409).json({ message: 'This email address is already confirmed' });
    }

    // Name the platform the admin is acting for in the email, falling back to any membership.
    const membership =
      user.platforms.find((p) => ctx.adminPlatformIds.includes(p.platformId)) ?? user.platforms[0];

    await sendVerificationEmail(user, membership?.platform.name ?? 'Vyntrise');

    logActivity({
      action: 'VERIFICATION_RESENT_BY_ADMIN',
      platformId: membership?.platformId ?? null,
      actorId: ctx.userId,
      targetType: 'user',
      targetId: userId,
      metadata: { email: user.email },
      req,
    });

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('resendUserVerification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
