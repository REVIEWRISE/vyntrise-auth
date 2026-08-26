import { Request, Response } from 'express';
import prisma from '../db/prisma';
import crypto from 'crypto';
import { emailService } from '../services/email.service';
import { logActivity } from '../services/audit.service';
import { hashToken } from '../utils/token';

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

    // Check if there's already an active unused invite for this email+platform
    const existing = await prisma.invitation.findUnique({
      where: { email_platformId: { email, platformId } },
    });
    if (existing && !existing.isUsed && existing.expiresAt > new Date()) {
      return res.status(409).json({ message: 'An active invitation already exists for this email' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Only the digest is persisted — the raw token exists solely in the link below.
    const storedToken = hashToken(token);

    // Store the role in the invitation so it can be applied during registration
    const invitation = await prisma.invitation.upsert({
      where: { email_platformId: { email, platformId } },
      update: { token: storedToken, expiresAt, isUsed: false, role },
      create: { email, platformId, token: storedToken, expiresAt, role },
    });

    const registerLink = `${process.env.FRONTEND_URL}/register?token=${token}`;

    logActivity({
      action: 'INVITE_CREATED',
      platformId,
      actorId: (req as any).user?.id,
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: { email, role },
    });

    console.log('[createInvite] 📧 Sending invitation email');
    console.log('[createInvite] To:', email);
    console.log('[createInvite] Register Link:', registerLink);
    console.log('[createInvite] Platform ID:', platformId);
    console.log('[createInvite] Role:', role);

    // Send invite email non-blocking
    emailService.sendInviteEmail(email, registerLink)
      .then(() => {
        console.log('[createInvite] ✅ Invitation email sent successfully to:', email);
      })
      .catch((err: Error) => {
        console.error('[createInvite] ❌ Failed to send invite email to:', email);
        console.error('[createInvite] Error:', err);
      });

    res.status(201).json({
      message: 'Invitation created',
      token,
      registerLink,
    });
  } catch (error) {
    console.error('createInvite error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPlatforms = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const adminAccess = await prisma.userPlatformAccess.findMany({
      where: { userId, role: 'ADMIN' },
      select: { platformId: true },
    });
    const platformIds = adminAccess.map((a) => a.platformId);

    const platforms = await prisma.platform.findMany({
      where: { id: { in: platformIds } },
      orderBy: { createdAt: 'desc' },
    });

    // Get user counts separately to avoid _count issues with the driver adapter
    const results = await Promise.all(
      platforms.map(async (p) => {
        const userCount = await prisma.userPlatformAccess.count({
          where: { platformId: p.id },
        });
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.createdAt,
          userCount,
        };
      })
    );

    res.json(results);
  } catch (error) {
    console.error('getPlatforms error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPlatformById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = (req as any).user?.id;

    // Scoped to this specific platform, not "admin of any platform" — otherwise an
    // admin of platform A could read platform B's details just by guessing its id.
    const access = await prisma.userPlatformAccess.findFirst({
      where: { userId, platformId: id, role: 'ADMIN' },
    });
    if (!access) {
      return res.status(403).json({ message: 'Forbidden: Admin access required for this platform' });
    }

    const platform = await prisma.platform.findUnique({ where: { id } });
    if (!platform) {
      return res.status(404).json({ message: 'Platform not found' });
    }

    const userCount = await prisma.userPlatformAccess.count({ where: { platformId: id } });

    res.json({
      id: platform.id,
      name: platform.name,
      description: platform.description,
      allowSelfRegistration: platform.allowSelfRegistration,
      createdAt: platform.createdAt,
      userCount,
    });
  } catch (error) {
    console.error('getPlatformById error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updatePlatformSettings = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = (req as any).user?.id;

    // Scoped to this specific platform, not "admin of any platform" — same reasoning as
    // getPlatformById: otherwise an admin of platform A could edit platform B by guessing its id.
    const access = await prisma.userPlatformAccess.findFirst({
      where: { userId, platformId: id, role: 'ADMIN' },
    });
    if (!access) {
      return res.status(403).json({ message: 'Forbidden: Admin access required for this platform' });
    }

    const { allowSelfRegistration } = req.body;
    const previous = await prisma.platform.findUnique({ where: { id } });

    const platform = await prisma.platform.update({
      where: { id },
      data: { allowSelfRegistration: !!allowSelfRegistration },
    });

    // Opening a platform to public sign-up is a security-relevant change, so it needs the same
    // trail as platform and invite creation.
    if (previous && previous.allowSelfRegistration !== platform.allowSelfRegistration) {
      logActivity({
        action: 'PLATFORM_SETTINGS_CHANGED',
        platformId: id,
        actorId: userId,
        targetType: 'platform',
        targetId: id,
        metadata: {
          setting: 'allowSelfRegistration',
          from: previous.allowSelfRegistration,
          to: platform.allowSelfRegistration,
        },
      });
    }

    const userCount = await prisma.userPlatformAccess.count({ where: { platformId: id } });

    res.json({
      id: platform.id,
      name: platform.name,
      description: platform.description,
      allowSelfRegistration: platform.allowSelfRegistration,
      createdAt: platform.createdAt,
      userCount,
    });
  } catch (error) {
    console.error('updatePlatformSettings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

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
    });

    res.status(201).json(platform);
  } catch (error) {
    console.error('createPlatform error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
