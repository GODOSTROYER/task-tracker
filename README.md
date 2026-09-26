# ProductSpace Task Tracker

A workspace task tracker built for the ProductSpace Full Stack Developer Intern screening: Next.js 16 / React 19, an Express + TypeScript API, PostgreSQL through Sequelize, email verification, and Board, List, Table and Timeline views.

![ProductSpace Task Tracker - Kanban board](docs/task-tracker-board.png)

## Features

- Email-verified accounts with bcrypt passwords and seven-day JWT sessions.
- Single-owner workspaces and tasks; API queries enforce ownership.
- Tasks with description, status, priority, due date and ordering; transactional drag-and-drop updates.
- A starter workspace on verification, profile editing and email password resets.
- Session validation through `GET /api/auth/me`; password changes and resets revoke previously issued sessions.

## Run locally

Use Node.js 24, PostgreSQL (local or Neon) and an SMTP account. From the repository root:

```bash
npm ci
npm --prefix server ci
cp server/.env.example server/.env
cp .env.example .env.local
```

Set `DATABASE_URL`, a strong `JWT_SECRET`, SMTP credentials and sender details in `server/.env`. Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000` in `.env.local`. Then:

```bash
npm run build:server
npm run db:migrate
npm run db:check
npm run dev:server
```

In another terminal run `npm run dev` and open `http://localhost:3000`. The API listens on port 5000. **Schema changes are explicit: runtime startup and API requests never synchronize tables.**

## Architecture

The Next.js frontend uses `lib/api.ts` and the auth context. The Express app in `server/src/app.ts` is shared by the local server and `api/index.js` Vercel entry point. Routes validate inputs with Zod; controllers enforce ownership and transactions; Sequelize models access PostgreSQL. Runtime initialization checks connectivity only.

See [architecture](docs/architecture.md), [implementation](docs/implementation.md) and [requirement mapping](docs/screening-requirements-comparison.md).

## API overview

Routes below include the `/api` prefix. Protected routes require `Authorization: Bearer <token>`.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | Public | Register and email a verification code |
| POST | `/api/auth/login` | Public | Sign in to a verified account |
| POST | `/api/auth/verify-email` | Public | Verify code, seed starter workspace, return session |
| POST | `/api/auth/resend-otp` | Public | Request another verification code |
| POST | `/api/auth/forgot-password` | Public | Request reset email |
| POST | `/api/auth/reset-password` | Public | Consume reset token and set password |
| GET | `/api/auth/me` | JWT | Validate session and return current user |
| PUT | `/api/auth/profile` | JWT | Update name or password; password requires `currentPassword` and returns a fresh token |
| GET, POST | `/api/workspaces` | JWT | List or create workspaces |
| GET, PUT, DELETE | `/api/workspaces/:id` | JWT | Read, rename or delete owned workspace and its tasks |
| POST | `/api/workspaces/demo` | JWT | Create sample workspace |
| GET, POST | `/api/tasks` | JWT | List tasks (optional `workspaceId` filter) or create a task |
| PUT | `/api/tasks/:id/move` | JWT | Move relative to a task or status using `{overId}`; return updated workspace tasks |
| PUT | `/api/tasks/batch` | JWT | Atomically update up to 500 unique tasks |
| PUT, DELETE | `/api/tasks/:id` | JWT | Update or delete owned task |
| GET | `/api/health` | Public | Process liveness |
| GET | `/api/ready` | Public | Database connectivity and required migration readiness |

## Configuration

[server/.env.example](server/.env.example) documents `PORT`, `DATABASE_URL`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`, `FROM_NAME` and `FRONTEND_URL`.

`CORS_ORIGINS` optionally overrides the permitted browser origins. Set `TRUST_PROXY_HOPS` only for a known proxy topology. On Vercel, leave `NEXT_PUBLIC_API_BASE_URL` unset to use same-origin `/api` requests.

## Checks and safe database tests

From the root:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm --prefix server run build
npm run build
```

Integration tests require a **disposable** PostgreSQL database. They migrate and truncate application tables. Set both variables in the shell running the tests (PowerShell example):

```powershell
$env:DATABASE_URL_TEST = 'postgresql://postgres:postgres@localhost:5432/task_tracker_test'
$env:ALLOW_TEST_DATABASE_RESET = 'true'
npm test
```

The database name must end in `_test`, and the target must differ from `DATABASE_URL`. There is no fallback to the application database. Email is mocked. `npm --prefix server run test:coverage` uses the same safety gates.

## Migrations and deployment

The transactional, additive migration creates missing baseline tables, adds verification-attempt tracking and indexes, and records its baseline in `schema_migrations`. It adopts the existing schema without deleting user, workspace or task rows. Integration coverage exercises adoption of an existing schema and repeated migration runs.

For deployment, install with `npm ci && npm --prefix server ci`, set `DATABASE_URL` to the intended database and complete this required release gate **before deploying the new application**:

```bash
npm run build:server
npm run db:migrate
npm run db:check
```

`db:check` is read-only and must pass; readiness returns 503 when the required migration is missing. Review the target and take an appropriate backup first. Migrations are not run by the Vercel build or function cold starts. [vercel.json](vercel.json) contains the install/build commands and API rewrite; configure backend variables and the deployed `FRONTEND_URL` in the deployment environment.

The authentication upgrade rejects old JWTs that lack the password-bound session version. Existing plaintext verification codes and reset tokens no longer match the hashed checks; users must request new codes or links. Account and task data are preserved. Migration SQL does not itself revoke tokens; the upgraded authentication code changes their acceptance.

These instructions describe deployment preparation; the maintenance work did not access a production database or deploy the application.

## Limits and dependency status

- Workspaces have one owner; sharing is not implemented.
- SMTP delivery requires a configured provider. OTPs expire after ten minutes; reset links after one hour. Challenges are stored as keyed hashes, verification allows five failed attempts per code, and resend/reset requests have a one-minute cooldown.
- Tokens remain in `localStorage`; there are no refresh tokens or per-device server logout. Password changes/reset revoke old tokens through a password-bound JWT version checked against the current user record.
- Rate limits are in memory (100 API requests and 20 authentication attempts per 15 minutes per IP), so separate function instances do not share counters. This is not a claim of production readiness.
- A moderate transitive [`uuid` advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) remains through Sequelize. It concerns supplied-buffer APIs in v3/v5/v6; the inspected Sequelize paths use v1/v4 without supplied buffers. No incompatible forced override was introduced. Reassess with dependency updates rather than treating this as a clean audit.

## Author

**Arnav Bule** — [arnavbule.in](https://www.arnavbule.in) | [GitHub](https://github.com/GODOSTROYER)
