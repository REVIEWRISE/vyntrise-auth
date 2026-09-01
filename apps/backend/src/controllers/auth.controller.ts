import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../db/prisma';
import { logActivity } from '../services/audit.service';
import { BCRYPT_ROUNDS } from '../config/env';
import { emailService, notify } from '../services/email.service';
import { signAccessToken, signRefreshToken, verifyToken } from '../services/signing-key.service';
import { sendVerificationEmail } from './email-verification.controller';

// A hash of an unguessable value, compared against when no user is found so the "no such
// account" path costs the same as a wrong password — otherwise the timing difference alone
// reveals which addresses are registered. Generated at load so it is always a well-formed
// hash at the current cost factor; a hand-written constant risks bcrypt rejecting the format
// and returning early, which would defeat the purpose silently.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

// Signing moved behind the key service so both tokens come from the rotating RS256 key pair
// rather than the shared JWT_SECRET. Now async — the active key is a database read on a cold
// cache — so every call site awaits.
const generateTokens = async (user: { id: string, email: string }, sessionId: string) => {
  const claims = { id: user.id, email: user.email, sessionId };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(claims),
    signRefreshToken(claims),
  ]);

  return { accessToken, refreshToken };
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, platformId } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { platforms: true }
    });

    // Always run a comparison, even with no user, so both paths take the same time.
    const isPasswordValid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !isPasswordValid) {
      logActivity({
        action: 'LOGIN_FAILED',
        actorId: user?.id,
        targetType: 'user',
        metadata: { email: String(email ?? ''), reason: user ? 'bad_password' : 'no_such_user' },
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Checked only once the password is known to be correct, so an unauthenticated caller can
    // never use this response to learn which addresses are registered or pending confirmation.
    if (!user.emailVerified) {
      logActivity({
        action: 'LOGIN_BLOCKED_UNVERIFIED',
        actorId: user.id,
        targetType: 'user',
        targetId: user.id,
        metadata: { email: user.email },
      });

      return res.status(403).json({
        message: 'Confirm your email address before signing in — check your inbox for the link.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Check if user has access to the requested platform
    if (platformId) {
      const hasAccess = user.platforms.some((p: any) => p.platformId === platformId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this platform.' });
      }
    }

    // Generate the session id up front so it can be embedded in both tokens — this lets
    // revocation checks be a fast, always-enforced primary-key lookup instead of a bcrypt
    // scan that only ran when a refreshToken cookie happened to be present.
    const sessionId = crypto.randomUUID();
    const { accessToken, refreshToken } = await generateTokens(user, sessionId);

    // Determine domain for cookies (use .vyntrise.com in production)
    const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;

    // Set HTTP-only cookie for refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Lax for cross-subdomain navigation
      domain: cookieDomain,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Set session cookie for SSO across subdomains
    res.cookie('vyntrise_session', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: cookieDomain,
      maxAge: 15 * 60 * 1000 // 15 mins (matches JWT expiration)
    });

    // Persist a session record with a hashed copy of the refresh token. Deliberately left at
    // cost 10 rather than BCRYPT_ROUNDS: refresh tokens are high-entropy JWTs, not guessable
    // secrets, so the extra work factor buys nothing and this sits on the login/refresh path.
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        hashedToken,
        userAgent: req.headers['user-agent'] ?? null,
      }
    });

    res.json({ accessToken, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, platformId } = req.body;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email address is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters' });
    }
    if (!platformId || typeof platformId !== 'string') {
      return res.status(400).json({ message: 'platformId is required' });
    }

    const platform = await prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) {
      return res.status(404).json({ message: 'Platform not found' });
    }
    if (!platform.allowSelfRegistration) {
      return res.status(403).json({ message: 'This platform does not allow self-registration' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword },
    });

    await prisma.userPlatformAccess.create({
      data: { userId: user.id, platformId, role: 'USER' },
    });

    logActivity({
      action: 'USER_SELF_REGISTERED',
      platformId,
      actorId: user.id,
      targetType: 'user',
      targetId: user.id,
      metadata: { email },
    });

    // The row exists but cannot be signed into until the address is confirmed — see the
    // emailVerified gate in login(). Without this, anyone could register under a stranger's
    // address and permanently occupy it, since User.email is unique.
    try {
      await sendVerificationEmail(user, platform.name);
    } catch (error) {
      // The account has already been created, so a 500 here would be a trap: the retry hits
      // the "already exists" branch, and that account cannot be signed into yet. Report the
      // success that did happen and let the user pull a fresh link from /resend-verification.
      console.error('[register] Could not issue a verification token for', user.id, error);
    }

    res.status(201).json({
      message: 'Account created. Check your email for a confirmation link.',
      requiresEmailVerification: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;

  if (refreshToken) {
    try {
      let sessionId: string | undefined;
      try {
        const decoded = await verifyToken(refreshToken, 'refresh');
        sessionId = decoded.sessionId;
      } catch {
        // Refresh token invalid/expired — nothing to look up, fall through.
      }

      if (sessionId) {
        await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
      } else {
        // Legacy fallback for refresh tokens issued before sessionId was added to the
        // payload — only reachable for up to 7 days after this deploy.
        const accessToken = req.cookies?.vyntrise_session;
        let userId: string | undefined;
        if (accessToken) {
          try {
            const decoded = await verifyToken(accessToken, 'access');
            userId = decoded.id;
          } catch {
            // Access token may be expired — try to decode without verification to get the userId
            const decoded = jwt.decode(accessToken) as { id: string } | null;
            userId = decoded?.id;
          }
        }

        if (userId) {
          const sessions = await prisma.session.findMany({ where: { userId } });
          for (const session of sessions) {
            const matches = await bcrypt.compare(refreshToken, session.hashedToken);
            if (matches) {
              await prisma.session.delete({ where: { id: session.id } });
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error deleting session on logout:', error);
    }
  }

  res.clearCookie('refreshToken', { domain: cookieDomain });
  res.clearCookie('vyntrise_session', { domain: cookieDomain });
  res.json({ message: 'Logged out successfully' });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token not found' });
  }

  let decoded: { id: string; email: string; sessionId?: string };
  try {
    decoded = await verifyToken(refreshToken, 'refresh');
  } catch {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  type SessionRow = Awaited<ReturnType<typeof prisma.session.findUnique>>;
  let matchedSession: SessionRow = null;

  if (decoded.sessionId) {
    // Fast path: the session id is embedded in the token, so this is a single indexed
    // lookup instead of a bcrypt scan over every session the user has.
    const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });
    if (session && session.userId === decoded.id && await bcrypt.compare(refreshToken, session.hashedToken)) {
      matchedSession = session;
    }
  } else {
    // Legacy fallback for refresh tokens issued before sessionId was added to the payload.
    const sessions = await prisma.session.findMany({ where: { userId: decoded.id } });
    for (const session of sessions) {
      if (await bcrypt.compare(refreshToken, session.hashedToken)) {
        matchedSession = session;
        break;
      }
    }
  }

  if (!matchedSession) {
    return res.status(403).json({ message: 'Session not found or revoked' });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) {
    return res.status(403).json({ message: 'User not found' });
  }

  const { accessToken, refreshToken: newRefreshToken } = await generateTokens({ id: user.id, email: user.email }, matchedSession.id);
  const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;

  // Rotate the stored hashed token and update lastUsedAt
  const newHashedToken = await bcrypt.hash(newRefreshToken, 10);
  await prisma.session.update({
    where: { id: matchedSession.id },
    data: { hashedToken: newHashedToken, lastUsedAt: new Date() }
  });

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: cookieDomain,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.cookie('vyntrise_session', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: cookieDomain,
    maxAge: 15 * 60 * 1000
  });

  res.json({ accessToken });
};
