import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../db/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.vyntrise_session) {
    token = req.cookies.vyntrise_session;
  }

  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; email: string };
    
    // Check if user still has an active session (refresh token)
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      // Verify the refresh token is still valid in the database
      const sessions = await prisma.session.findMany({ where: { userId: decoded.id } });
      
      let hasValidSession = false;
      for (const session of sessions) {
        const matches = await bcrypt.compare(refreshToken, session.hashedToken);
        if (matches) {
          hasValidSession = true;
          break;
        }
      }
      
      if (!hasValidSession) {
        // Session was revoked - clear cookies and reject request
        const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;
        res.clearCookie('refreshToken', { domain: cookieDomain });
        res.clearCookie('vyntrise_session', { domain: cookieDomain });
        res.status(401).json({ message: 'Session revoked. Please login again.' });
        return;
      }
    }
    
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ message: 'Forbidden or Token Expired' });
  }
};
