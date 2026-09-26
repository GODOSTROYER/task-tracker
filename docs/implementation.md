# Implementation details

## Frontend

Next.js 16 and React 19 provide App Router pages, styled with Tailwind and shadcn/ui. Workspace detail pages expose Board, List, Table and Timeline views. Drag-and-drop uses dnd-kit and sends relative `{overId}` moves to `PUT /api/tasks/:id/move`. The server applies the move against current ordering while holding the workspace lock and returns updated workspace tasks. This avoids sending a stale full-workspace snapshot or hitting the 500-item batch limit during drag-and-drop. `/tasks` redirects to `/workspaces` so task management has one main route.

`lib/api.ts` handles typed requests, JSON errors and session changes. The auth context validates stored tokens against `/api/auth/me` rather than trusting cached user data. It rechecks on focus and storage changes and schedules expiration handling. Network/server failures surface a retry state. Settings sends `currentPassword` when changing passwords and stores the fresh token returned by the API.

## Authentication

Passwords use bcrypt hooks on the User model. New passwords require at least eight characters, an uppercase letter and a special character, with a maximum of 72 UTF-8 bytes. JWTs last seven days and use HS256. Their version is an HMAC derived from the stored password hash; middleware checks it against the current verified user on every protected request. Password changes and resets therefore invalidate earlier tokens. Profile password changes verify the current password and return a replacement session; reset requires signing in again.

Six-digit OTPs use cryptographic randomness and expire after ten minutes. Reset tokens use 32 random bytes and expire after one hour. Both are persisted as HMAC-SHA256 digests keyed by the JWT secret. Each OTP permits five failed attempts; resending resets the attempt counter. Resend and reset-email generation enforce a one-minute cooldown and use generic responses. Row locks serialize challenge consumption and updates. Email verification and initial workspace/task creation share a transaction.

Old JWTs without a session version, plaintext OTPs and plaintext reset tokens cease to work after this upgrade. Existing users must sign in or request fresh challenges. The additive database migration preserves account/workspace/task rows; authentication code, not migration SQL, enforces this compatibility change.

## API and persistence

Express middleware provides Helmet headers, an explicit CORS origin allowlist, a 100 KB JSON body limit, configurable trusted proxy hops and in-memory rate limiting. The general limit is 100 requests per 15 minutes per IP; public auth endpoints also share a 20-attempt limit. These counters are per process and are disabled during integration tests.

Zod validates UUIDs, actual calendar dates, statuses, priorities and integer positions. Batch task requests accept 1–500 unique task IDs. Ownership is checked before modification; workspace/task locks and a parameterized batch update make reordering atomic. Concurrent appends allocate positions under a workspace lock. Errors return client-appropriate messages without exposing unexpected internal details.

Runtime database initialization only connects. `npm run build:server` followed by `npm run db:migrate` from the root applies transactional additive SQL to the configured `DATABASE_URL` before deployment. Require the read-only `npm run db:check` to pass before releasing; readiness also checks the migration marker and required attempt-counter column. Build/preview jobs do not migrate production databases. The migration adopts the existing baseline schema, adds missing columns/indexes and records its baseline; repeated runs preserve rows. See [architecture](architecture.md) for the request and deployment boundaries.

## Verification

`npm run test:unit` runs frontend helper and server unit tests without an integration database. Jest/Supertest integration tests use a separately provisioned disposable PostgreSQL database and mocked Nodemailer. They cover auth/session behavior, ownership, task ordering and validation, atomic batch failure, concurrent changes, and existing-schema migration adoption/repeatability.

Before importing database configuration, the integration setup requires `DATABASE_URL_TEST`, a database name ending in `_test`, and `ALLOW_TEST_DATABASE_RESET=true`. It rejects the same host/port/database as `DATABASE_URL`; there is no production URL fallback. Test setup applies migrations and truncates application tables. Export these variables in the invoking shell; see the [README](../README.md) for commands. Coverage can be collected with `npm --prefix server run test:coverage`; no coverage percentage is claimed here.

This maintenance work did not access a production database or deploy the app. Local checks cannot establish production readiness or validate real SMTP delivery. The remaining moderate Sequelize → uuid advisory concerns supplied-buffer v3/v5/v6 APIs; inspected ORM calls use v1/v4 without supplied buffers. An incompatible forced dependency override was deliberately avoided; future upgrades should reassess the advisory.
