import { ApiError } from './api.ts';

export class InvalidSessionError extends Error {}

/** Decode only to schedule expiry; the server still verifies the token signature. */
export function inspectSession(token: string, now = Date.now()): { userId: string; remaining: number } {
  try {
    const segments = token.split('.');
    if (segments.length !== 3 || !segments[1]) throw new Error();
    const payload = JSON.parse(atob(segments[1].replace(/-/g, '+').replace(/_/g, '/')));
    const remaining = payload.exp * 1000 - now;
    if (typeof payload.id !== 'string' || !Number.isFinite(remaining) || remaining <= 0) throw new Error();
    return { userId: payload.id, remaining };
  } catch {
    throw new InvalidSessionError('Your session has expired or is invalid.');
  }
}

export function shouldClearSession(error: unknown): boolean {
  return error instanceof InvalidSessionError || (error instanceof ApiError && error.status === 401);
}
