import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppError } from './middleware/errorHandler';

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new AppError('JWT secret is not configured', 500);
  return secret || 'change_me';
}

// A keyed digest prevents offline brute force of low-entropy email codes.
export function challengeDigest(value: string): string {
  return crypto.createHmac('sha256', jwtSecret()).update(value).digest('hex');
}
export function generateOtp(): string { return crypto.randomInt(100000, 1000000).toString(); }
export function sessionVersion(passwordHash: string): string { return challengeDigest(`session:${passwordHash}`); }
export function generateToken(user: { id: string; password: string }): string {
  return jwt.sign({ id: user.id, version: sessionVersion(user.password) }, jwtSecret(), { expiresIn: '7d', algorithm: 'HS256' });
}
