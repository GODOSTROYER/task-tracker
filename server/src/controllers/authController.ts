import crypto from 'crypto';
import { Request, Response } from 'express';
import { Transaction } from 'sequelize';
import { sequelize } from '../config';
import { challengeDigest, generateOtp, generateToken } from '../authSecurity';
import User from '../models/User';
import Workspace from '../models/Workspace';
import Task from '../models/Task';
import { sendPasswordResetEmail, sendVerificationEmail } from '../email';
import { AuthRequest } from '../middleware';
import { AppError } from '../middleware/errorHandler';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function publicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email };
}

async function createDefaultWorkspaceAndTasks(userId: string, transaction: Transaction): Promise<Workspace> {
  const workspace = await Workspace.create({ name: 'Getting Started', ownerId: userId }, { transaction });
  await Task.bulkCreate([
    {
      title: 'Create your first ProductSpace task',
      description: 'Use the New task button to add work to this workspace.',
      status: 'todo',
      priority: 'medium',
      position: 1024,
      ownerId: userId,
      workspaceId: workspace.id,
    },
    {
      title: 'Drag a task across the board',
      description: 'Move this card through the workflow to confirm ordering and status updates.',
      status: 'in-progress',
      priority: 'low',
      position: 2048,
      ownerId: userId,
      workspaceId: workspace.id,
    },
    {
      title: 'Mark a task completed',
      description: 'Completed tasks stay owned by you and visible only in your account.',
      status: 'completed',
      priority: 'high',
      position: 3072,
      ownerId: userId,
      workspaceId: workspace.id,
    },
  ], { transaction });
  return workspace;
}

export async function signup(req: Request, res: Response) {
  const { name, email, password } = req.body;
  const exists = await User.findOne({ where: { email } });
  if (exists) throw new AppError('Email already in use', 409);

  const otp = generateOtp();
  await User.create({
    name,
    email,
    password,
    verificationOtp: challengeDigest(otp),
    verificationOtpExpiry: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendVerificationEmail(email, otp).catch(() => { throw new AppError('Account created, but verification email delivery failed. Please request another code.', 503); });
  res.status(201).json({ message: 'Account created. Check your email for the verification code.', email });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user || !(await user.comparePassword(password))) throw new AppError('Invalid credentials', 401);
  if (!user.isVerified) throw new AppError('Please verify your email before signing in', 403);

  res.json({ token: generateToken(user), user: publicUser(user) });
}

export async function verifyEmail(req: Request, res: Response) {
  const { email, otp } = req.body;
  const result = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({ where: { email }, transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.isVerified || !user.verificationOtp || !user.verificationOtpExpiry || user.verificationAttempts >= 5) {
      return { error: 'Invalid verification code' };
    }
    if (user.verificationOtpExpiry.getTime() <= Date.now()) return { error: 'Verification code has expired' };
    if (user.verificationOtp !== challengeDigest(otp)) {
      user.verificationAttempts += 1;
      await user.save({ transaction });
      return { error: 'Invalid verification code' };
    }
    user.isVerified = true;
    user.verificationOtp = null;
    user.verificationOtpExpiry = null;
    user.verificationAttempts = 0;
    await user.save({ transaction });
    const existingWorkspace = await Workspace.findOne({ where: { ownerId: user.id }, transaction });
    if (!existingWorkspace) await createDefaultWorkspaceAndTasks(user.id, transaction);
    return { user };
  });
  if (!result.user) throw new AppError(result.error, 400);
  res.json({ message: 'Email verified', token: generateToken(result.user), user: publicUser(result.user) });
}

export async function resendOtp(req: Request, res: Response) {
  const { email } = req.body;
  const otp = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({ where: { email }, transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.isVerified) return null;
    if (user.verificationOtpExpiry && user.verificationOtpExpiry.getTime() - OTP_TTL_MS + 60000 > Date.now()) return null;
    const code = generateOtp();
    user.verificationOtp = challengeDigest(code);
    user.verificationOtpExpiry = new Date(Date.now() + OTP_TTL_MS);
    user.verificationAttempts = 0;
    await user.save({ transaction });
    return code;
  });
  if (otp) await sendVerificationEmail(email, otp).catch(() => console.error('Verification email delivery failed'));
  res.json({ message: 'Verification code sent if the account exists and is not already verified.' });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  const token = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({ where: { email }, transaction, lock: transaction.LOCK.UPDATE });
    if (!user) return null;
    if (user.resetTokenExpiry && user.resetTokenExpiry.getTime() - RESET_TTL_MS + 60000 > Date.now()) return null;
    const value = crypto.randomBytes(32).toString('hex');
    user.resetToken = challengeDigest(value);
    user.resetTokenExpiry = new Date(Date.now() + RESET_TTL_MS);
    await user.save({ transaction });
    return value;
  });
  if (token) await sendPasswordResetEmail(email, token).catch(() => console.error('Password reset email delivery failed'));
  res.json({ message: 'If email exists, reset instructions sent' });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body;
  await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({ where: { resetToken: challengeDigest(token) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() <= Date.now()) throw new AppError('Invalid or expired reset token', 400);
    user.password = password;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save({ transaction });
  });
  res.json({ message: 'Password reset successfully' });
}

export async function getProfile(req: AuthRequest, res: Response) {
  const user = await User.findByPk(req.user!.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ user: publicUser(user) });
}

export async function updateProfile(req: AuthRequest, res: Response) {
  const user = await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(req.user!.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new AppError('User not found', 404);
    if (typeof req.body.password === 'string') {
      if (!req.body.currentPassword || !(await user.comparePassword(req.body.currentPassword))) throw new AppError('Current password is incorrect', 400);
      user.password = req.body.password;
      user.resetToken = null;
      user.resetTokenExpiry = null;
    }
    if (typeof req.body.name === 'string') user.name = req.body.name;
    await user.save({ transaction });
    return user;
  });
  res.json({ message: 'Profile updated', user: publicUser(user), ...(req.body.password ? { token: generateToken(user) } : {}) });
}
