import { Request, Response } from 'express';
import prisma from '../db/prisma';

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
      recentActivity: [], // Placeholder for future activity logs
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

    const users = accessRecords.map(record => ({
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
      orderBy: { createdAt: 'desc' },
    });

    res.json(invites);
  } catch (error) {
    console.error('getInvites error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
