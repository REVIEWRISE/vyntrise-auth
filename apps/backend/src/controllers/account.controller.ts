import { Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../db/prisma';
import { emailService, notify } from '../services/email.service';
import { logActivity } from '../services/audit.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { BCRYPT_ROUNDS } from '../config/env';

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

    notify(`email-change notice for ${oldEmail}`, () =>
      emailService.sendEmailChangeNotification(oldEmail, newEmail)
    );

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

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });

    // Delete sessions except the current one (its id is embedded in the access token,
    // so this works the same whether the caller is cookie-based or Bearer-only).
    const currentSessionId = req.user!.sessionId;
    let signedOut: number;
    if (currentSessionId) {
      ({ count: signedOut } = await prisma.session.deleteMany({
        where: { userId: req.user!.id, id: { not: currentSessionId } },
      }));
    } else {
      // Legacy fallback: token predates sessionId (only possible for up to 15 minutes
      // after this deploy) — safest default is to sign the user out everywhere.
      ({ count: signedOut } = await prisma.session.deleteMany({ where: { userId: req.user!.id } }));
    }

    // The one alert that matters most: it is how a user finds out their account was taken
    // over, so it goes to the address on file even though the change succeeded.
    notify(`password-changed notice for ${user.email}`, () =>
      emailService.sendPasswordChangedEmail(user.email, signedOut)
    );

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/account/sessions
export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.id },
      orderBy: { lastUsedAt: 'desc' },
    });
    const currentSessionId = req.user!.sessionId;
    return res.json(
      sessions.map((s: { id: string; createdAt: Date; lastUsedAt: Date; userAgent: string | null }) => ({
        id: s.id,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        userAgent: s.userAgent,
        // Lets the UI label "this device" so nobody signs themselves out trying to end
        // someone else's session.
        isCurrent: s.id === currentSessionId,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/account/sessions — sign out everywhere except the current device
export const revokeOtherSessions = async (req: AuthRequest, res: Response) => {
  try {
    const currentSessionId = req.user!.sessionId;

    const { count } = await prisma.session.deleteMany({
      where: {
        userId: req.user!.id,
        // A token predating sessionId can't identify which session is the caller's, so the
        // safe reading is to end all of them rather than guess and leave an attacker signed in.
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
    });

    logActivity({
      action: 'SESSION_REVOKED',
      actorId: req.user!.id,
      targetType: 'session',
      metadata: { scope: 'all_other_devices', count },
    });

    if (count > 0) {
      notify('sessions-revoked notice', async () => {
        const user = await prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { email: true },
        });
        if (user) await emailService.sendSessionsRevokedEmail(user.email, count);
      });
    }

    return res.json({ message: `Signed out of ${count} other ${count === 1 ? 'device' : 'devices'}`, count });
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

    logActivity({
      action: 'SESSION_REVOKED',
      actorId: req.user!.id,
      targetType: 'session',
      targetId: session.id,
    });

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

    // Delete sessions and platform access, then the user, in a transaction
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: req.user!.id } }),
      prisma.userPlatformAccess.deleteMany({ where: { userId: req.user!.id } }),
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
