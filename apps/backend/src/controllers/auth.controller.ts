import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';

const generateTokens = (user: { id: string, email: string }) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET as string,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, platformId } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { platforms: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user has access to the requested platform
    if (platformId) {
      const hasAccess = user.platforms.some((p: any) => p.platformId === platformId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this platform.' });
      }
    }

    const { accessToken, refreshToken } = generateTokens(user);

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

    // Persist a session record with a hashed copy of the refresh token
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await prisma.session.create({
      data: {
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


export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;

  // Delete the matching session record if a refresh token is present
  if (refreshToken) {
    try {
      // Decode the access token to get userId for scoping the session lookup
      const accessToken = req.cookies?.vyntrise_session;
      let userId: string | undefined;
      if (accessToken) {
        try {
          const decoded = jwt.verify(accessToken, process.env.JWT_SECRET as string) as { id: string };
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

  let decoded: { id: string; email: string };
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as { id: string; email: string };
  } catch {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  // Find the session that matches the incoming refresh token
  const sessions = await prisma.session.findMany({ where: { userId: decoded.id } });
  let matchedSession: (typeof sessions)[number] | undefined;
  for (const session of sessions) {
    const matches = await bcrypt.compare(refreshToken, session.hashedToken);
    if (matches) {
      matchedSession = session;
      break;
    }
  }

  if (!matchedSession) {
    return res.status(403).json({ message: 'Session not found or revoked' });
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens({ id: decoded.id, email: decoded.email });
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
