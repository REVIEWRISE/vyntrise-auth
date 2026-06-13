import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../db/prisma';

export const createInvite = async (req: Request, res: Response) => {
  try {
    // In a real scenario, this endpoint should be protected and only accessible by Platform Admins.
    const { email, platformId } = req.body;

    const platform = await prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) {
      return res.status(404).json({ message: 'Platform not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

    const invitation = await prisma.invitation.create({
      data: {
        email,
        platformId,
        token,
        expiresAt
      }
    });

    // TODO: Send email with the invitation link containing the token
    // e.g., sendEmail(email, `https://vyntrise.com/register?token=${token}`)

    res.status(201).json({ message: 'Invitation created', token: invitation.token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const registerViaInvite = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { platform: true }
    });

    if (!invitation || invitation.isUsed) {
      return res.status(400).json({ message: 'Invalid or expired invitation token' });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({ message: 'Invitation has expired' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email: invitation.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: invitation.email,
          password: hashedPassword
        }
      });
    }

    // Link user to the platform
    await prisma.userPlatformAccess.create({
      data: {
        userId: user.id,
        platformId: invitation.platformId
      }
    });

    // Mark invitation as used
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { isUsed: true }
    });

    res.status(201).json({ message: 'User registered and linked to platform successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
