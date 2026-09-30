import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/errorHandler';
import { validate, z } from '../middleware/validate';
import { authMiddleware } from '../middleware';
import {
  forgotPassword,
  getProfile,
  login,
  resendOtp,
  resetPassword,
  signup,
  updateProfile,
  verifyEmail,
} from '../controllers/authController';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test', message: { message: 'Too many authentication attempts. Please try again later.' } });
const passwordSchema = z.string().min(8).regex(/[A-Z]/).regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes');

router.post('/signup', authLimiter, validate(z.object({ name: z.string().trim().min(1).max(255), email: z.string().trim().email().max(254), password: passwordSchema })), asyncHandler(signup));
router.post('/login', authLimiter, validate(z.object({ email: z.string().trim().email().max(254), password: z.string().min(1) })), asyncHandler(login));
router.post('/verify-email', authLimiter, validate(z.object({ email: z.string().trim().email().max(254), otp: z.string().regex(/^\d{6}$/) })), asyncHandler(verifyEmail));
router.post('/resend-otp', authLimiter, validate(z.object({ email: z.string().trim().email().max(254) })), asyncHandler(resendOtp));
router.post('/forgot-password', authLimiter, validate(z.object({ email: z.string().trim().email().max(254) })), asyncHandler(forgotPassword));
router.post('/reset-password', authLimiter, validate(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: passwordSchema })), asyncHandler(resetPassword));
router.get('/me', authMiddleware, asyncHandler(getProfile));
router.put('/profile', authMiddleware, validate(z.object({ name: z.string().trim().min(1).max(255).optional(), password: passwordSchema.optional(), currentPassword: z.string().min(1).max(1024).optional() })), asyncHandler(updateProfile));

export default router;
