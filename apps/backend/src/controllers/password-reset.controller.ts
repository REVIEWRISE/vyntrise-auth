import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../db/prisma';
import { emailService } from '../services/email.service';

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  // Validate email presence and format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
    res.status(400).json({ message: 'Valid email address is required' });
    return;
  }

  // Look up user — silently skip if not found (anti-enumeration)
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      update: { token, expiresAt, isUsed: false, createdAt: new Date() },
      create: { userId: user.id, token, expiresAt, isUsed: false },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    try {
      await emailService.sendPasswordResetEmail(email, resetLink);
    } catch (err) {
      console.error('[forgotPassword] Failed to send reset email:', err);
      res.status(500).json({ message: 'Failed to send reset email' });
      return;
    }
  }

  // Always return 200 — do not reveal whether the email is registered
  res.status(200).json({ message: 'If that email is registered, a reset link has been sent' });
}

export async function validateResetToken(req: Request, res: Response): Promise<void> {
  const token = String(req.params.token);

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      token,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    res.status(400).json({ valid: false, message: 'Invalid or expired reset token' });
    return;
  }

  res.status(200).json({ valid: true });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body;

  // Validate token
  if (!token || typeof token !== 'string') {
    res.status(400).json({ message: 'Token is required' });
    return;
  }

  // Validate password
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ message: 'Password must be at least 8 characters' });
    return;
  }

  // Look up a valid, unused, non-expired token
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      token,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    res.status(400).json({ message: 'Invalid or expired reset token' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { isUsed: true },
    }),
    prisma.session.deleteMany({
      where: { userId: record.userId },
    }),
  ]);

  res.status(200).json({ message: 'Password reset successfully' });
}
