/**
 * @file email.ts — Transactional email delivery via SMTP (Nodemailer)
 *
 * Exports:
 *   sendVerificationEmail(to, otp)         — Sends a styled 6-digit OTP email
 *   sendPasswordResetEmail(to, resetToken) — Sends a password reset link email
 *
 * Configuration is pulled from env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME, FRONTEND_URL
 *
 * Defaults to Gmail SMTP on port 587 if not configured.
 */

import nodemailer from 'nodemailer';

// ─── SMTP Configuration ──────────────────────────────────────────────────────

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;
const FROM_NAME = process.env.FROM_NAME || 'Task Tracker';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// ─── Internal Helper ──────────────────────────────────────────────────────────

/** Send a generic HTML email without logging recipient information. */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    html,
  });

}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Send a 6-digit OTP verification email with styled HTML. */
export async function sendVerificationEmail(to: string, otp: string): Promise<void> {
  await sendEmail(
    to,
    'Verify Your Email — Task Tracker',
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e293b;">Verify your email</h2>
        <p style="color: #475569;">Enter this code to complete your registration:</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${otp}</span>
        </div>
        <p style="color: #94a3b8; font-size: 14px;">This code expires in 10 minutes. If you didn't create an account, ignore this email.</p>
      </div>
    `,
  );
}

/** Send a password reset email with a clickable link (valid for 1 hour). */
export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

  await sendEmail(
    to,
    'Reset Your Password — Task Tracker',
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e293b;">Reset your password</h2>
        <p style="color: #475569;">Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Reset Password
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 14px;">This link expires in 1 hour. If you didn't request a reset, ignore this email.</p>
        <p style="color: #cbd5e1; font-size: 12px; word-break: break-all;">Or copy this link: ${resetUrl}</p>
      </div>
    `,
  );
}
