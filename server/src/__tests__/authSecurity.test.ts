import jwt from 'jsonwebtoken';
import { challengeDigest, generateOtp, generateToken, sessionVersion } from '../authSecurity';

describe('Authentication cryptography', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'isolated-auth-test-secret'; });
  it('generates six numeric digits and keyed irreversible records', () => {
    const code = generateOtp();
    expect(code).toMatch(/^[1-9][0-9]{5}$/);
    expect(challengeDigest(code)).toHaveLength(64);
    const first = challengeDigest(code);
    process.env.JWT_SECRET = 'different-isolated-secret';
    expect(challengeDigest(code)).not.toBe(first);
    process.env.JWT_SECRET = 'isolated-auth-test-secret';
  });
  it('binds each signed session to the current password hash and a seven-day expiry', () => {
    const token = generateToken({ id: 'test-user', password: 'hash-before-reset' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    expect(decoded.id).toBe('test-user');
    expect(decoded.version).toBe(sessionVersion('hash-before-reset'));
    expect(decoded.version).not.toBe(sessionVersion('hash-after-reset'));
    expect(decoded.exp! - decoded.iat!).toBe(7 * 24 * 60 * 60);
    expect(decoded).not.toHaveProperty('password');
  });
});
