# Mini Task Tracker

**Live Deployment:** [https://wldd-task-tracker.arnavbule.me](https://wldd-task-tracker.arnavbule.me)

A full-stack task management app built with **Next.js 15**, **Express**, **MongoDB**, and **Redis**.

## Tech Stack

| Layer    | Technology                                                   |
| -------- | ------------------------------------------------------------ |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui    |
| Backend  | Node.js, Express, TypeScript, Zod validation                 |
| Database | MongoDB (Mongoose ODM)                                       |
| Caching  | Redis (ioredis)                                              |
| Auth     | JWT + bcrypt, email verification via Nodemailer (Gmail SMTP) |
| Testing  | Jest, Supertest, mongodb-memory-server, ioredis-mock         |

## Features

- **JWT Authentication** — signup, login, email verification (6-digit OTP), forgot/reset password
- **Task CRUD** — create, read, update, delete tasks with ownership guards
- **Redis Caching** — `GET /api/tasks` cached per user; invalidated on every mutation
- **Mongoose Indexes** — on `owner` and `status` fields for query performance
- **Optimistic UI** — instant feedback on create/update/delete/toggle
- **Task Filtering** — by status, date range, and free-text search
- **Password Strength** — live requirement indicators (8+ chars, uppercase, special character)

## Project Structure

```
.
├── app/                  # Next.js pages (login, signup, verify-email, tasks, etc.)
├── components/           # Shared React components (navbar, UI primitives)
├── lib/                  # API helper, auth context
├── server/               # Express backend
│   ├── src/
│   │   ├── __tests__/    # Jest test suites
│   │   ├── config/       # Redis + DB config
│   │   ├── middleware/    # Auth + cache middleware
│   │   ├── models/       # Mongoose schemas (User, Task)
│   │   ├── routes/       # Express routes (auth, tasks)
│   │   ├── utils/        # Email service (Nodemailer)
│   │   ├── app.ts        # Express app setup
│   │   └── server.ts     # Server entry point
│   ├── .env.example
│   └── package.json
├── .env.example
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (Atlas or local)
- Redis (local or cloud)
- Gmail account with [App Password](https://myaccount.google.com/apppasswords) (for sending OTP/reset emails)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/wldd-task-tracker.git
cd wldd-task-tracker
```

### 2. Backend setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your MongoDB URI, Redis URL, JWT secret, and Gmail SMTP credentials
npm run dev
```

The API server starts at `http://localhost:5000`.

### 3. Frontend setup

```bash
# From root directory
npm install
cp .env.example .env.local
# Edit .env.local if your backend runs on a different port
npm run dev
```

The frontend starts at `http://localhost:3000`.

## Environment Variables

### Backend (`server/.env`)

| Variable       | Description                    | Example                  |
| -------------- | ------------------------------ | ------------------------ |
| `PORT`         | Server port                    | `5000`                   |
| `MONGO_URI`    | MongoDB connection string      | `mongodb+srv://...`      |
| `REDIS_URL`    | Redis connection URL           | `redis://localhost:6379` |
| `JWT_SECRET`   | Secret for signing JWTs        | `your_secret_here`       |
| `SMTP_HOST`    | SMTP server host               | `smtp.gmail.com`         |
| `SMTP_PORT`    | SMTP server port               | `587`                    |
| `SMTP_USER`    | SMTP username (email)          | `you@gmail.com`          |
| `SMTP_PASS`    | Gmail App Password             | `abcdefghijklmnop`       |
| `FROM_EMAIL`   | Sender email address           | `you@gmail.com`          |
| `FROM_NAME`    | Sender display name            | `Task Tracker`           |
| `FRONTEND_URL` | Frontend URL (for reset links) | `http://localhost:3000`  |

### Frontend (`.env.local`)

| Variable                   | Description     | Example                 |
| -------------------------- | --------------- | ----------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL | `http://localhost:5000` |

## API Endpoints

### Auth

| Method | Endpoint                    | Description                       |
| ------ | --------------------------- | --------------------------------- |
| POST   | `/api/auth/signup`          | Register (sends verification OTP) |
| POST   | `/api/auth/verify-email`    | Verify email with OTP             |
| POST   | `/api/auth/resend-otp`      | Resend verification OTP           |
| POST   | `/api/auth/login`           | Login (JWT-based)                 |
| POST   | `/api/auth/forgot-password` | Send password reset email         |
| POST   | `/api/auth/reset-password`  | Reset password with token         |

### Tasks (requires `Authorization: Bearer <token>`)

| Method | Endpoint         | Description                  |
| ------ | ---------------- | ---------------------------- |
| GET    | `/api/tasks`     | List tasks (cached in Redis) |
| POST   | `/api/tasks`     | Create a task                |
| PUT    | `/api/tasks/:id` | Update a task                |
| DELETE | `/api/tasks/:id` | Delete a task                |

## Testing

```bash
cd server

# Run tests
npm test

# Run with coverage report
npm run test:coverage
```

Tests use **mongodb-memory-server** (in-memory MongoDB) and **ioredis-mock** (Redis mock) — no external services needed.

### Coverage Target

Configured for **≥ 70%** on statements, branches, functions, and lines.

## License

MIT
