import request from 'supertest';
import nodemailer from 'nodemailer';

function latestOtp(): string {
  const mailer = nodemailer.createTransport({});
  const calls = (mailer.sendMail as jest.Mock).mock.calls;
  return calls[calls.length - 1][0].html.match(/letter-spacing: 8px; color: #4f46e5;">(\d{6})/)[1];
}
function latestResetToken(): string {
  const mailer = nodemailer.createTransport({});
  const calls = (mailer.sendMail as jest.Mock).mock.calls;
  return calls[calls.length - 1][0].html.match(/token=([a-f0-9]{64})/)[1];
}

import app from '../app';
import User from '../models/User';
import Workspace from '../models/Workspace';
import Task from '../models/Task';
import jwt from 'jsonwebtoken';

async function signupUser(email = 'test@example.com') {
  await request(app)
    .post('/api/auth/signup')
    .send({ name: 'Test User', email, password: 'Password1!' });

  return User.findOne({ where: { email } });
}

describe('Auth Endpoints', () => {
  it('creates an unverified user and sends an OTP', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test User', email: 'test@example.com', password: 'Password1!' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('test@example.com');

    const user = await User.findOne({ where: { email: 'test@example.com' } });
    expect(user?.isVerified).toBe(false);
    expect(user?.verificationOtp).toHaveLength(64);
  });

  it('rejects duplicate signup and weak password input', async () => {
    await signupUser('dup@example.com');

    const duplicate = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Duplicate', email: 'dup@example.com', password: 'Password1!' });
    expect(duplicate.status).toBe(409);

    const weak = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Weak', email: 'weak@example.com', password: 'short' });
    expect(weak.status).toBe(400);
  });

  it('requires email verification before login', async () => {
    await signupUser('login@example.com');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'Password1!' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('verify');
  });

  it('verifies email, creates default workspace, and returns a JWT', async () => {
    const user = await signupUser('verify@example.com');

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'verify@example.com', otp: latestOtp() });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('verify@example.com');

    const verified = await User.findOne({ where: { email: 'verify@example.com' } });
    expect(verified?.isVerified).toBe(true);

    const workspace = await Workspace.findOne({ where: { ownerId: verified!.id } });
    expect(workspace?.name).toBe('Getting Started');
  });

  it('rejects invalid or expired OTPs and can resend an OTP', async () => {
    const user = await signupUser('otp@example.com');
    user!.verificationOtpExpiry = new Date(Date.now() - 1000);
    await user!.save();

    const expired = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'otp@example.com', otp: latestOtp() });
    expect(expired.status).toBe(400);
    expect(expired.body.message).toContain('expired');

    const resend = await request(app)
      .post('/api/auth/resend-otp')
      .send({ email: 'otp@example.com' });
    expect(resend.status).toBe(200);

    const refreshed = await User.findOne({ where: { email: 'otp@example.com' } });
    expect(refreshed!.verificationOtp).not.toBe(user!.verificationOtp);
  });

  it('supports forgot password and reset password', async () => {
    const user = await signupUser('reset@example.com');
    await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'reset@example.com', otp: latestOtp() });

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@example.com' });
    expect(forgot.status).toBe(200);

    const withToken = await User.findOne({ where: { email: 'reset@example.com' } });
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: latestResetToken(), password: 'NewPassword1!' });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'NewPassword1!' });
    expect(login.status).toBe(200);
  });

  it('updates profile for the authenticated user', async () => {
    const user = await signupUser('profile@example.com');
    const verify = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'profile@example.com', otp: latestOtp() });

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${verify.body.token}`)
      .send({ name: 'Updated User' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated User');
  });
  it('locks verification after five guesses and never accepts the stored digest', async () => {
    const user = await signupUser('attempts@example.com');
    const code = latestOtp();
    expect(user!.verificationOtp).not.toBe(code);
    const wrong = code === '100000' ? '100001' : '100000';
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app).post('/api/auth/verify-email').send({ email: user!.email, otp: wrong });
      expect(response.status).toBe(400);
    }
    expect((await user!.reload()).verificationAttempts).toBe(5);
    expect((await request(app).post('/api/auth/verify-email').send({ email: user!.email, otp: code })).status).toBe(400);
  });

  it('requires the current password and revokes old sessions after password changes', async () => {
    await signupUser('sessions@example.com');
    const verified = await request(app).post('/api/auth/verify-email').send({ email: 'sessions@example.com', otp: latestOtp() });
    const oldToken = verified.body.token;
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`)).status).toBe(200);
    const missing = await request(app).put('/api/auth/profile').set('Authorization', `Bearer ${oldToken}`).send({ password: 'ChangedPassword1!' });
    expect(missing.status).toBe(400);
    const changed = await request(app).put('/api/auth/profile').set('Authorization', `Bearer ${oldToken}`).send({ password: 'ChangedPassword1!', currentPassword: 'Password1!' });
    expect(changed.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${changed.body.token}`)).status).toBe(200);
  });

  it('stores only reset digests, consumes a reset once, and revokes existing sessions', async () => {
    const user = await signupUser('single-reset@example.com');
    const verified = await request(app).post('/api/auth/verify-email').send({ email: user!.email, otp: latestOtp() });
    await request(app).post('/api/auth/forgot-password').send({ email: user!.email });
    const token = latestResetToken();
    expect((await user!.reload()).resetToken).not.toBe(token);
    const digestAttempt = await request(app).post('/api/auth/reset-password').send({ token: user!.resetToken, password: 'NewPassword1!' });
    expect(digestAttempt.status).toBe(400);
    const responses = await Promise.all([1, 2].map(() => request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassword1!' })));
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${verified.body.token}`)).status).toBe(401);
  });

  it('does not expose SMTP failures or reset requests for missing accounts', async () => {
    await signupUser('smtp@example.com');
    const mailer = nodemailer.createTransport({});
    (mailer.sendMail as jest.Mock).mockRejectedValueOnce(new Error('SMTP secret should never be returned'));
    const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const existing = await request(app).post('/api/auth/forgot-password').send({ email: 'smtp@example.com' });
      const missing = await request(app).post('/api/auth/forgot-password').send({ email: 'missing@example.com' });
      expect(existing.status).toBe(200);
      expect(existing.body).toEqual(missing.body);
    } finally { logger.mockRestore(); }
  });

  it('preserves the current OTP during the resend cooldown', async () => {
    const user = await signupUser('cooldown@example.com');
    const digest = user!.verificationOtp;
    await request(app).post('/api/auth/resend-otp').send({ email: user!.email });
    expect((await user!.reload()).verificationOtp).toBe(digest);
  });

  it('rolls verification back when starter task creation fails', async () => {
    const user = await signupUser('rollback@example.com');
    const code = latestOtp();
    const seed = jest.spyOn(Task, 'bulkCreate').mockRejectedValueOnce(new Error('Simulated seed failure'));
    const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const failed = await request(app).post('/api/auth/verify-email').send({ email: user!.email, otp: code });
      expect(failed.status).toBe(500);
      expect((await user!.reload()).isVerified).toBe(false);
      expect(await Workspace.count({ where: { ownerId: user!.id } })).toBe(0);
    } finally { seed.mockRestore(); logger.mockRestore(); }
    expect((await request(app).post('/api/auth/verify-email').send({ email: user!.email, otp: code })).status).toBe(200);
  });

  it('rejects legacy sessions without a password version and deleted accounts', async () => {
    const user = await signupUser('deleted@example.com');
    const verified = await request(app).post('/api/auth/verify-email').send({ email: user!.email, otp: latestOtp() });
    const legacy = jwt.sign({ id: user!.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${legacy}`)).status).toBe(401);
    await user!.destroy();
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${verified.body.token}`)).status).toBe(401);
  });

});
