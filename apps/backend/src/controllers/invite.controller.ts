import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../db/prisma';
import { logActivity } from '../services/audit.service';
import { hashToken } from '../utils/token';
import { BCRYPT_ROUNDS } from '../config/env';

export const registerViaInvite = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters' });
    }

    // Invitations created before tokens were hashed still hold the raw value, so the lookup
    // accepts either. Invites expire after 7 days, so the legacy arm can be removed any time
    // after that window has passed post-deploy.
    const invitation = await prisma.invitation.findFirst({
      where: { OR: [{ token: hashToken(token) }, { token }] },
      include: { platform: true }
    });

    if (!invitation || invitation.isUsed) {
      return res.status(400).json({ message: 'Invalid or expired invitation token' });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({ message: 'Invitation has expired' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email: invitation.email } });

    if (!user) {
      // New user - create account
      user = await prisma.user.create({
        data: {
          email: invitation.email,
          password: hashedPassword
        }
      });
    } else {
      // Existing user - check if they already have access to this platform
      const existingAccess = await prisma.userPlatformAccess.findUnique({
        where: {
          userId_platformId: {
            userId: user.id,
            platformId: invitation.platformId
          }
        }
      });

      if (existingAccess) {
        return res.status(400).json({ 
          message: 'You already have access to this platform. Please log in instead.' 
        });
      }
    }

    // Link user to the platform with the role from the invitation
    await prisma.userPlatformAccess.create({
      data: {
        userId: user.id,
        platformId: invitation.platformId,
        role: invitation.role || 'USER'
      }
    });

    // Mark invitation as used
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { isUsed: true }
    });

    logActivity({
      action: 'USER_JOINED_PLATFORM',
      platformId: invitation.platformId,
      actorId: user.id,
      targetType: 'user',
      targetId: user.id,
      metadata: { email: user.email, role: invitation.role || 'USER' },
    });

    res.status(201).json({ 
      message: user ? 
        'Platform access granted successfully' : 
        'User registered and linked to platform successfully' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
