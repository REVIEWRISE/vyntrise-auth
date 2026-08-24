import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../db/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    sessionId?: string;
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; email: string; sessionId?: string };

    if (decoded.sessionId) {
      // Revocation is always enforced when the token carries a session id — a fast, indexed
      // lookup, independent of whether a refreshToken cookie happens to be present. Bearer-only
      // callers (e.g. external SSO integrations) never carry that cookie, so the old check —
      // which only ran `if (refreshToken)` — silently let revoked sessions keep working for them.
      const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });
      if (!session || session.userId !== decoded.id) {
        const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;
        res.clearCookie('refreshToken', { domain: cookieDomain });
        res.clearCookie('vyntrise_session', { domain: cookieDomain });
        res.status(401).json({ message: 'Session revoked. Please login again.' });
        return;
      }
    } else if (req.cookies?.refreshToken) {
      // Legacy fallback for access tokens issued before sessionId was added to the payload —
      // only reachable for up to 15 minutes after this deploy (access tokens are short-lived).
      const refreshToken = req.cookies.refreshToken;
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
        const cookieDomain = req.hostname.includes('vyntrise.com') ? '.vyntrise.com' : undefined;
        res.clearCookie('refreshToken', { domain: cookieDomain });
        res.clearCookie('vyntrise_session', { domain: cookieDomain });
        res.status(401).json({ message: 'Session revoked. Please login again.' });
        return;
      }
    }

    req.user = { id: decoded.id, email: decoded.email, sessionId: decoded.sessionId };
    next();
  } catch {
    res.status(403).json({ message: 'Forbidden or Token Expired' });
  }
};
