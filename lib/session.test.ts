import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from './api.ts';
import { InvalidSessionError, inspectSession, shouldClearSession } from './session.ts';
const token = (payload: object) => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

test('rate limits and other non-authentication failures retain credentials for retry', () => {
  for (const status of [400, 403, 404, 408, 429, 500, 502, 503]) {
    assert.equal(shouldClearSession(new ApiError('Request failed', status)), false, String(status));
  }
  assert.equal(shouldClearSession(new TypeError('Failed to fetch')), false);
  assert.equal(shouldClearSession(new Error('Unexpected response')), false);
  assert.equal(shouldClearSession(new ApiError('Unauthorized', 401)), true);
});
test('only malformed or expired local tokens invalidate a session before validation', () => {
  for (const invalid of ['invalid', 'header..signature', 'header.invalid.signature', token({ id: 'user', exp: 1 }), token({ id: 'user' })]) {
    assert.throws(() => inspectSession(invalid, 2000), error => error instanceof InvalidSessionError && shouldClearSession(error));
  }
  assert.deepEqual(inspectSession(token({ id: 'user', exp: 10 }), 2000), { userId: 'user', remaining: 8000 });
});
