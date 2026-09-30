import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, ApiError } from './api.ts';

test('empty successful responses are supported for deletion', async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await api('/api/tasks/example', { method: 'DELETE' }), undefined);
});
test('non-JSON gateway failures produce a useful typed HTTP error', async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('<html>Bad gateway</html>', { status: 502 }));
  await assert.rejects(api('/api/tasks'), error => error instanceof ApiError && error.status === 502 && error.message.includes('502'));
});
test('false request bodies are serialized and abort signals forwarded', async context => {
  const controller = new AbortController();
  context.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, options?: RequestInit) => {
    assert.equal(options?.body, 'false');
    assert.equal(options?.signal, controller.signal);
    return new Response('{}');
  });
  await api('/example', { method: 'POST', body: false, signal: controller.signal });
});
test('a late unauthorized response from an old token cannot clear a newer session', async context => {
  const storage = new Map([['token', 'new-token'], ['user', '{}']]);
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  context.after(() => {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
  });
  context.mock.method(globalThis, 'fetch', async () => new Response('{"message":"Expired"}', { status: 401 }));
  await assert.rejects(api('/api/tasks', { token: 'old-token' }), ApiError);
  assert.equal(storage.get('token'), 'new-token');
  await assert.rejects(api('/api/tasks', { token: 'new-token' }), ApiError);
  assert.equal(storage.has('token'), false);
  assert.equal(storage.has('user'), false);
});
