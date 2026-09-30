import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from './models/User';
import { jwtSecret, sessionVersion } from './authSecurity';

export interface AuthRequest extends Request { user?: { id: string }; }

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ message: 'No token provided' }); return; }
  let decoded: jwt.JwtPayload;
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret(), { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.id !== 'string' || typeof payload.version !== 'string') throw new Error('Invalid payload');
    decoded = payload;
  } catch { res.status(401).json({ message: 'Invalid or expired token' }); return; }
  try {
    const user = await User.findByPk(decoded.id);
    if (!user?.isVerified || decoded.version !== sessionVersion(user.password)) {
      res.status(401).json({ message: 'Invalid or expired token' }); return;
    }
    req.user = { id: user.id };
    next();
  } catch (error) { next(error); }
}
