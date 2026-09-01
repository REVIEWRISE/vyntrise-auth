import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/prisma';
import { emailService, notify } from '../services/email.service';
import { emailConfig } from '../config/email';
import { hashToken } from '../utils/token';
import { logActivity } from '../services/audit.service';

// Long enough that someone can finish signing up after dinner, short enough that an address
// typed by mistake does not stay claimed for weeks.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Issues a fresh verification token and emails it. Any earlier pending token for the user is
 * dropped first, so a resend invalidates the previous link rather than leaving several live
 * at once.
 *
 * Fire-and-forget by design: registration must not fail because the mail server is briefly
 * unreachable, and the user can always request another link.
 */
export async function sendVerificationEmail(
  user: { id: string; email: string },
  platformName: string
): Promise<void> {
  const token = crypto.randomBytes(32).toString('hex');

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, isUsed: false } }),
    prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        email: user.email,
        token: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

  const verifyLink = `${emailConfig.appUrl}/verify-email?token=${token}`;

  notify(`verification link for ${user.email}`, () =>
    emailService.sendVerificationEmail(user.email, verifyLink, platformName)
  );
}

const tokenLookup = (token: string) => ({
  token: hashToken(token),
  isUsed: false,
  expiresAt: { gt: new Date() },
});

/** GET /api/auth/verify-email/:token — lets the page show a useful state before submitting. */
export async function validateVerificationToken(req: Request, res: Response): Promise<void> {
  const record = await prisma.emailVerificationToken.findFirst({
    where: tokenLookup(String(req.params.token)),
  });

  if (!record) {
    res.status(400).json({ valid: false, message: 'This confirmation link is invalid or has expired' });
    return;
  }

  res.status(200).json({ valid: true, email: record.email });
}

/** POST /api/auth/verify-email — body { token } */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ message: 'Token is required' });
    return;
  }

  // Looked up without the isUsed/expiry filter so an already-redeemed token can still be
  // recognised. A link may legitimately be opened twice — a double click, a back button, or a
  // mail scanner that follows it first — and the second attempt should read as success rather
  // than as a scary failure once the address is already confirmed.
  const record = await prisma.emailVerificationToken.findFirst({
    where: { token: hashToken(token) },
  });

  if (!record) {
    res.status(400).json({ message: 'This confirmation link is invalid or has expired' });
    return;
  }

  // The address is re-checked against the user row rather than trusted from the token. If the
  // account changed email after the link was sent, confirming the old address proves nothing
  // about the new one and must not mark it verified.
  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    include: { platforms: { include: { platform: { select: { name: true, id: true } } } } },
  });

  if (!user || user.email !== record.email) {
    res.status(400).json({ message: 'This confirmation link is no longer valid for this account' });
    return;
  }

  if (user.emailVerified) {
    res.status(200).json({ message: 'Email address already confirmed. You can sign in.' });
    return;
  }

  // Only now does staleness matter: the address is still unconfirmed, so an exhausted or
  // expired token genuinely cannot be honoured and a fresh one has to be requested.
  if (record.isUsed || record.expiresAt <= new Date()) {
    res.status(400).json({ message: 'This confirmation link is invalid or has expired' });
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { isUsed: true } }),
  ]);

  const firstPlatform = user.platforms[0]?.platform;

  logActivity({
    action: 'EMAIL_VERIFIED',
    platformId: firstPlatform?.id,
    actorId: user.id,
    targetType: 'user',
    targetId: user.id,
    metadata: { email: user.email },
  });

  // The welcome mail waits until here rather than firing at registration, because this is the
  // first moment the account can actually be signed into.
  if (firstPlatform) {
    notify(`welcome to ${user.email}`, () =>
      emailService.sendWelcomeEmail(user.email, firstPlatform.name, firstPlatform.id)
    );
  }

  res.status(200).json({ message: 'Email address confirmed. You can now sign in.' });
}

/** POST /api/auth/resend-verification — body { email } */
export async function resendVerification(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'Valid email address is required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { platforms: { include: { platform: { select: { name: true } } } } },
  });

  // Only send for accounts that exist and are still unverified — but answer identically either
  // way, for the same reason forgotPassword does: the response must not reveal who is registered.
  if (user && !user.emailVerified) {
    const platformName = user.platforms[0]?.platform.name ?? 'Vyntrise';
    await sendVerificationEmail(user, platformName);
  }

  res.status(200).json({
    message: 'If that address needs confirming, a new link has been sent',
  });
}
