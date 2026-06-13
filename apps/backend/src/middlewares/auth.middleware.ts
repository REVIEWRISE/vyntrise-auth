import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  // 1. Check Authorization header
  // 2. Fallback to vyntrise_session cookie
  let token = undefined;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.vyntrise_session) {
    token = req.cookies.vyntrise_session;
  }

  if (token) {

    jwt.verify(token, process.env.JWT_SECRET as string, (err, user) => {
      if (err) {
        return res.status(403).json({ message: 'Forbidden or Token Expired' });
      }

      req.user = user as { id: string; email: string };
      next();
    });
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
};
