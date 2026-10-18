# FITBOOK — Gym Slot Booking System

Premium fitness booking web app: members reserve one-hour gym sessions, join FIFO waitlists, and check in with secure one-time codes. Admins create sessions (capacity 20, unique start times).

## Features

- Member registration and JWT login (passwords hashed with bcrypt)
- Role-based access: MEMBER and ADMIN (server-side enforcement)
- Session browsing with optional date filter and live seat counts
- Booking with automatic waitlisting when a session is full
- Cancellation with FIFO waitlist promotion (before session start)
- One-time SHA-256 check-in codes, valid only during the session hour
- Admin dashboard to create and review sessions
- Dark cinematic React frontend with photographic program pages

## Technology stack

| Layer    | Stack                                      |
|----------|--------------------------------------------|
| Frontend | React 19, Vite 8, React Router, Lucide     |
| Backend  | Node.js, Express 5, JWT, bcryptjs          |
| Database | PostgreSQL + Prisma 6                      |
| Tests    | Jest + fast-check (check-in round-trip)    |

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ with a database named `fitbook` (or update `DATABASE_URL`)

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in real values. **Never commit `.env`.**

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/fitbook"
JWT_SECRET="change-me-to-a-random-string-at-least-32-chars"
PORT=3001
```

## Backend setup

```bash
cd backend
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

API listens at `http://localhost:3001`. Health check: `GET /api/health` → `{ "status": "ok" }`.

### Seed / demo accounts

After `npm run seed`:

| Email               | Password    | Role   |
|---------------------|-------------|--------|
| admin@fitbook.com   | admin123    | ADMIN  |
| member@fitbook.com  | member123   | MEMBER |

Change these passwords in production. Do not use them outside local demos.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Vite serves at `http://localhost:5173` and proxies `/api/*` to `http://localhost:3001`.

Production build:

```bash
cd frontend
npm run build
npm run preview
```

## Test commands

```bash
# Backend property test (requires .env + running Postgres)
cd backend
npm test

# Frontend lint / build
cd frontend
npm run lint
npm run build
```

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register MEMBER |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/sessions` | Member+ | List sessions (`?date=YYYY-MM-DD`) |
| GET | `/api/sessions/:id` | Member+ | Session detail |
| POST | `/api/sessions` | Admin | Create 1-hour session (cap 20) |
| POST | `/api/bookings` | Member+ | Book or waitlist |
| GET | `/api/bookings/mine` | Member+ | Current user's bookings |
| DELETE | `/api/bookings/:id` | Member+ | Cancel + optional promotion |
| POST | `/api/checkin/generate/:bookingId` | Member+ | Generate check-in code |
| POST | `/api/checkin/validate` | Member+ | Validate one-time code |

Send `Authorization: Bearer <token>` on protected routes.

## Creating an admin account

Public registration always creates `MEMBER`. Admins come from:

1. The seed script (`admin@fitbook.com`), or
2. Manually inserting/updating a user role to `ADMIN` in the database (e.g. Prisma Studio: `npx prisma studio`).

## Design note

FITBOOK uses a dark cinematic palette (black, charcoal, white, lime accent), bold display typography, and full-bleed athlete photography to feel like a premium training brand. Layouts stay sparse: one job per section, strong CTAs, and session/booking UIs that surface real API data rather than decorative fake availability. Motion is limited to subtle hero and hover transitions for presence without clutter.

## Known limitations

- Check-in codes are shown only when generated during the live session hour; staff validation uses the same authenticated API.
- Session date filtering uses the server's date parsing of `YYYY-MM-DD` (timezone edge cases possible near midnight).
- External Unsplash images require network access; SVG fallbacks render if an image fails to load.
- No email notifications or payment integrations.
