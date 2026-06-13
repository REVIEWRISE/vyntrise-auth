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

    res.json({ accessToken, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const logout = (req: Request, res: Response) => {
  const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;
  res.clearCookie('refreshToken', { domain: cookieDomain });
  res.clearCookie('vyntrise_session', { domain: cookieDomain });
  res.json({ message: 'Logged out successfully' });
};

export const refresh = (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token not found' });
  }

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens({ id: user.id, email: user.email });
    const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;

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
  });
};
