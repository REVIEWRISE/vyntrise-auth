import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../db/prisma';
import { emailService } from '../services/email.service';
import { emailConfig } from '../config/email';
import { hashToken } from '../utils/token';
import { BCRYPT_ROUNDS } from '../config/env';

// Tokens are stored hashed. Rows created before that change still hold the raw value, so the
// lookup falls back to it — reset tokens live one hour, so this fallback can be deleted any
// time after that window has passed post-deploy.
const tokenLookup = (token: string) => ({
  OR: [{ token: hashToken(token) }, { token }],
  isUsed: false,
  expiresAt: { gt: new Date() },
});

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
      update: { token: hashToken(token), expiresAt, isUsed: false, createdAt: new Date() },
      create: { userId: user.id, token: hashToken(token), expiresAt, isUsed: false },
    });

    const resetLink = `${emailConfig.appUrl}/reset-password?token=${token}`;

    try {
      await emailService.sendPasswordResetEmail(email, resetLink);
    } catch (err) {
      // Never surface the failure to the caller: a send is only attempted for addresses that
      // exist, so a distinct status here would reveal exactly what the 200-always response
      // below is designed to hide.
      console.error('[forgotPassword] Failed to send reset email for user', user.id, err);
    }
  }

  // Always return 200 — do not reveal whether the email is registered
  res.status(200).json({ message: 'If that email is registered, a reset link has been sent' });
}

export async function validateResetToken(req: Request, res: Response): Promise<void> {
  const token = String(req.params.token);

  const record = await prisma.passwordResetToken.findFirst({ where: tokenLookup(token) });

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
  const record = await prisma.passwordResetToken.findFirst({ where: tokenLookup(token) });

  if (!record) {
    res.status(400).json({ message: 'Invalid or expired reset token' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

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
