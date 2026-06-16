import { Request, Response } from 'express';
import prisma from '../db/prisma';
import crypto from 'crypto';
import { emailService } from '../services/email.service';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const platformId = (req as any).adminPlatformId;

    const totalUsers = await prisma.userPlatformAccess.count({
      where: { platformId },
    });

    const pendingInvites = await prisma.invitation.count({
      where: { platformId, isUsed: false },
    });

    res.json({
      totalUsers,
      pendingInvites,
      recentActivity: [],
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
      include: {
        platform: {
          select: { name: true }
        }
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

    // Store the role in the invitation so it can be applied during registration
    const invitation = await prisma.invitation.upsert({
      where: { email_platformId: { email, platformId } },
      update: { token, expiresAt, isUsed: false, role },
      create: { email, platformId, token, expiresAt, role },
    });

    const registerLink = `${process.env.FRONTEND_URL}/register?token=${token}`;

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
      token: invitation.token,
      registerLink,
    });
  } catch (error) {
    console.error('createInvite error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPlatforms = async (req: Request, res: Response) => {
  try {
    const platforms = await prisma.platform.findMany({
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

export const createPlatform = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Platform name is required' });
    }

    const existing = await prisma.platform.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return res.status(409).json({ message: 'A platform with that name already exists' });
    }

    const platform = await prisma.platform.create({
      data: { name: name.trim(), description: description?.trim() || null },
    });

    // Auto-grant the creating admin access to the new platform
    const userId = (req as any).user?.id;
    if (userId) {
      await prisma.userPlatformAccess.create({
        data: { userId, platformId: platform.id, role: 'ADMIN' },
      });
    }

    res.status(201).json(platform);
  } catch (error) {
    console.error('createPlatform error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
