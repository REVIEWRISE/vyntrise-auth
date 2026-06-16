import { Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../db/prisma';
import { emailService } from '../services/email.service';
import { AuthRequest } from '../middlewares/auth.middleware';

// GET /api/account/me
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { platforms: { include: { platform: true } } },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      platforms: user.platforms.map((p: { platformId: string; platform: { name: string }; role: string; createdAt: Date }) => ({
        platformId: p.platformId,
        platformName: p.platform.name,
        role: p.role,
        joinedAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /api/account/email
export const changeEmail = async (req: AuthRequest, res: Response) => {
  try {
    const { newEmail, currentPassword } = req.body;

    // Validate inputs
    if (!newEmail || typeof newEmail !== 'string') {
      return res.status(400).json({ message: 'newEmail is required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ message: 'newEmail must be a valid email address' });
    }
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ message: 'currentPassword is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Check if newEmail is already taken by another user
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== req.user!.id) {
      return res.status(409).json({ message: 'Email address is already in use' });
    }

    const oldEmail = user.email;
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { email: newEmail },
    });

    console.log('[changeEmail] 📧 Sending email change notifications');
    console.log('[changeEmail] Old Email:', oldEmail);
    console.log('[changeEmail] New Email:', newEmail);

    // Non-blocking notification
    emailService.sendEmailChangeNotification(oldEmail, newEmail)
      .then(() => {
        console.log('[changeEmail] ✅ Email change notifications sent successfully');
      })
      .catch((err: Error) => {
        console.error('[changeEmail] ❌ Failed to send email change notification');
        console.error('[changeEmail] Error:', err);
      });

    return res.json({ id: updated.id, email: updated.email, createdAt: updated.createdAt });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /api/account/password
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate inputs
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ message: 'currentPassword is required' });
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'newPassword is required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'newPassword must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });

    // Delete sessions except the current one (matched by refreshToken cookie)
    const refreshTokenCookie = req.cookies?.refreshToken;
    const sessions = await prisma.session.findMany({ where: { userId: req.user!.id } });

    if (refreshTokenCookie && sessions.length > 0) {
      let currentSessionId: string | undefined;
      for (const session of sessions) {
        const matches = await bcrypt.compare(refreshTokenCookie, session.hashedToken);
        if (matches) {
          currentSessionId = session.id;
          break;
        }
      }

      if (currentSessionId) {
        await prisma.session.deleteMany({
          where: { userId: req.user!.id, id: { not: currentSessionId } },
        });
      } else {
        // Cookie present but no match — delete all
        await prisma.session.deleteMany({ where: { userId: req.user!.id } });
      }
    } else {
      // No cookie — delete all sessions
      await prisma.session.deleteMany({ where: { userId: req.user!.id } });
    }

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/account/sessions
export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({ where: { userId: req.user!.id } });
    return res.json(
      sessions.map((s: { id: string; createdAt: Date; lastUsedAt: Date; userAgent: string | null }) => ({
        id: s.id,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        userAgent: s.userAgent,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/account/sessions/:sessionId
export const revokeSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: String(req.params.sessionId) },
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.userId !== req.user!.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await prisma.session.delete({ where: { id: session.id } });
    return res.json({ message: 'Session revoked' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/account
export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'password is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { platforms: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    // Sole-admin guard
    const adminPlatforms = user.platforms.filter((p: { role: string; platformId: string }) => p.role === 'ADMIN');
    for (const p of adminPlatforms) {
      const adminCount = await prisma.userPlatformAccess.count({
        where: { platformId: p.platformId, role: 'ADMIN' },
      });
      if (adminCount === 1) {
        return res.status(409).json({
          message: 'Transfer or remove admin role before deleting your account',
        });
      }
    }

    // Delete sessions then user in a transaction
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: req.user!.id } }),
      prisma.user.delete({ where: { id: req.user!.id } }),
    ]);

    // Clear cookies using same domain logic as auth.controller
    const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;
    res.clearCookie('refreshToken', { domain: cookieDomain });
    res.clearCookie('vyntrise_session', { domain: cookieDomain });

    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
