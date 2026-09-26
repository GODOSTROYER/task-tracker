# Screening requirements and implementation

The repository implements the requested Node.js/Express, React/Tailwind and PostgreSQL/Sequelize stack. This maps source features to the screening requirements; it is not a production-readiness certification.

| Requirement | Implementation |
| --- | --- |
| Signup and login | `/api/auth/signup`, `/api/auth/login`, email verification and bcrypt password hooks |
| JWT and protected routes | HS256 bearer tokens with password-bound session versions; task, workspace, profile and `/api/auth/me` routes require a verified user |
| Multi-user tasks | Owner-filtered CRUD and workspace ownership checks; transactional ordering updates |
| Backend organization | Routes, controllers, models, Zod validation, auth and centralized error middleware |
| Frontend | Next.js 16 / React 19, Tailwind, auth pages, workspaces, Board/List/Table/Timeline views and settings |
| API integration and state | Typed fetch wrapper, auth context with server session validation, loading/error states |
| PostgreSQL persistence | Sequelize models, foreign keys, ownership/order indexes and explicit additive migrations |
| Verification | Unit tests and Jest/Supertest integration tests with mocked email and a gated disposable database |

Run migrations before deployment; runtime requests do not create or alter tables. Integration tests require `DATABASE_URL_TEST` naming a separate database ending in `_test` and `ALLOW_TEST_DATABASE_RESET=true`, and truncate that database's application tables.

See the [README](../README.md) for reproducible setup and operational limits, including per-instance rate limits, browser token storage, SMTP requirements and the remaining Sequelize/uuid advisory. No production database access or deployment was performed as part of the maintenance work.
