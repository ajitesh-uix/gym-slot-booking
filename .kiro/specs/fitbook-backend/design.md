# FITBOOK Backend — Technical Design Document

## Overview

FITBOOK is a gym slot booking system. The backend is a REST API built with Node.js (CommonJS), Express 5, Prisma 6, and PostgreSQL. It handles member registration and authentication, gym session management, seat booking with automatic waitlisting, and one-time check-in code generation and validation. A React 19 + Vite frontend consumes the API.

This document describes the technical design that bridges the requirements to implementation tasks. It covers architecture, directory structure, data models, API contracts, key flows (auth, booking, check-in), frontend integration, environment setup, and security considerations.

---

## Architecture

### High-Level Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React 19)                   │
│   fetch('/api/...')   ←→   localStorage (JWT token)         │
└───────────────────────────────┬─────────────────────────────┘
                                │ HTTP (port 5173)
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              Vite Dev Server  (port 5173)                   │
│   /api/* requests are proxied  →  http://localhost:3001     │
│   Static assets (JS, CSS, HTML) are served directly        │
└───────────────────────────────┬─────────────────────────────┘
                                │ HTTP proxy (port 3001)
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                Express 5 API  (port 3001)                   │
│                                                             │
│   Global middleware:                                        │
│     cors()          — allow all origins                     │
│     express.json()  — parse JSON request bodies             │
│     req.prisma      — attach PrismaClient to every request  │
│                                                             │
│   Routes:                                                   │
│     /api/health     — health check (no auth)                │
│     /api/auth       — register / login (no auth)            │
│     /api/sessions   — session CRUD (JWT required)           │
│     /api/bookings   — booking management (JWT required)     │
│     /api/checkin    — check-in generate/validate (JWT req.) │
│                                                             │
│   Error handler:    — catches all next(err) calls           │
└───────────────────────────────┬─────────────────────────────┘
                                │ Prisma Client
                                ▼
┌─────────────────────────────────────────────────────────────┐
│             Prisma 6 ORM  (query builder + migrations)      │
│   Schema: backend/prisma/schema.prisma                      │
│   Migrations: backend/prisma/migrations/                    │
└───────────────────────────────┬─────────────────────────────┘
                                │ TCP (port 5432)
                                ▼
┌─────────────────────────────────────────────────────────────┐
│          PostgreSQL 18  — database: fitbook                 │
│          Tables: User, Session, Booking, CheckIn            │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility |
|---|---|
| **Browser / React** | Renders UI, stores JWT in `localStorage`, makes `fetch` calls to `/api/...` |
| **Vite Dev Server** | Serves the React app in development; proxies all `/api/*` requests to the Express backend, avoiding CORS issues during development |
| **Express API** | Validates input, enforces authentication/authorization, executes business logic, returns JSON responses |
| **Prisma ORM** | Translates JavaScript model calls to SQL; manages migrations and schema; provides type-safe DB access |
| **PostgreSQL** | Durably stores all application data; enforces unique constraints and referential integrity |

### Directory Structure

```
gym slot booking/
├── backend/
│   ├── .env                          ← (you create this — see Environment & Setup)
│   ├── .env.example                  ← template for .env
│   ├── package.json                  ← dependencies & scripts
│   ├── prisma/
│   │   ├── schema.prisma             ← DB models & enums (already exists)
│   │   ├── seed.js                   ← seeds admin, member, 15 sessions (already exists)
│   │   └── migrations/               ← auto-created by prisma migrate
│   └── src/
│       ├── server.js                 ← Express app entry point (already exists)
│       ├── middleware.js             ← authenticate(), requireAdmin() (already exists)
│       └── routes/
│           ├── auth.js               ← POST /register, POST /login (already exists)
│           ├── sessions.js           ← GET /sessions, POST /sessions (already exists)
│           ├── bookings.js           ← POST /bookings, GET /mine, DELETE /:id (already exists)
│           └── checkin.js            ← POST /generate/:id, POST /validate (already exists)
│
└── frontend/
    ├── vite.config.js                ← needs /api proxy added  ← TO DO
    └── src/
        ├── App.jsx                   ← top-level router/state
        ├── Auth.jsx                  ← login/register form     ← TO DO (wire to API)
        └── Dashboard.jsx             ← session listing view    ← TO DO (create this file)
```

---

## Components and Interfaces

### Backend Components

#### `backend/src/server.js` — Express Application Entry Point

Already exists. Sets up global middleware, mounts all route handlers, and starts the HTTP server.

```
Responsibilities:
  - Load environment variables via dotenv
  - Configure cors() and express.json() middleware
  - Attach a PrismaClient instance to every request as req.prisma
  - Mount route handlers at /api/auth, /api/sessions, /api/bookings, /api/checkin
  - Serve GET /api/health → { status: "ok" }
  - Catch unhandled route errors and respond with { error: message }
  - Listen on process.env.PORT (default 3001)
```

#### `backend/src/middleware.js` — JWT & Role Middleware

Already exists. Exports two middleware functions.

```
authenticate(req, res, next):
  - Reads Authorization: Bearer <token> header
  - Verifies token with jwt.verify(token, process.env.JWT_SECRET)
  - Attaches decoded { id, email, role } to req.user
  - Returns 401 if header is missing, token is malformed, or token is expired

requireAdmin(req, res, next):
  - Must be used after authenticate()
  - Returns 403 if req.user.role !== 'ADMIN'
  - Calls next() only for ADMIN users
```

#### `backend/src/routes/auth.js` — Authentication Router

Already exists. Mounted at `/api/auth`.

```
POST /api/auth/register
  Input:  { name, email, password }
  Output: 201 { token, user: { id, name, email, role } }
  Logic:  validate → check duplicate email → bcrypt.hash(password, 10) → create user → sign JWT

POST /api/auth/login
  Input:  { email, password }
  Output: 200 { token, user: { id, name, email, role } }
  Logic:  validate → find user → bcrypt.compare → sign JWT
```

#### `backend/src/routes/sessions.js` — Sessions Router

Already exists. Mounted at `/api/sessions`. All routes require `authenticate`.

```
GET  /api/sessions           → list all sessions (optional ?date=YYYY-MM-DD filter)
GET  /api/sessions/:id       → single session detail
POST /api/sessions           → create session (requires requireAdmin too)
```

Each session response includes: `id`, `title`, `startTime`, `maxCapacity`, `adminName`, `confirmedCount`, `availableSlots`.

#### `backend/src/routes/bookings.js` — Bookings Router

Already exists. Mounted at `/api/bookings`. All routes require `authenticate`.

```
POST   /api/bookings         → book a session (CONFIRMED or WAITLISTED)
GET    /api/bookings/mine    → current user's bookings with nested session + checkin.used
DELETE /api/bookings/:id     → cancel a booking + FIFO waitlist promotion
```

Booking creation and cancellation both use `Serializable` database transactions.

#### `backend/src/routes/checkin.js` — Check-In Router

Already exists. Mounted at `/api/checkin`. All routes require `authenticate`.

```
POST /api/checkin/generate/:bookingId  → generate one-time code (member calls this)
POST /api/checkin/validate             → validate a code (staff calls this)
```

#### `frontend/src/Auth.jsx` — Authentication Form (needs wiring)

Currently renders the login/register form but doesn't call the backend.

**Changes needed:**
- Add state for `name`, `email`, `password`, `error`, `loading`
- Implement `handleSubmit` that calls `POST /api/auth/login` or `POST /api/auth/register`
- Store `token` and `user` in `localStorage` on success
- Call a parent-provided `onLogin(user)` callback to switch to Dashboard view
- Display `error` state to the user on API failure
- Disable submit button while `loading === true`

#### `frontend/src/Dashboard.jsx` — Session Listing View (needs creation)

Does not exist yet. This is the post-login destination.

**Minimum responsibilities:**
- Read token from `localStorage` and include it in all API calls
- Fetch and display sessions from `GET /api/sessions`
- Allow booking a session via `POST /api/bookings`
- Show logged-in user name and a Logout button

#### `frontend/vite.config.js` — Vite Configuration (needs update)

Currently has no proxy. Needs the `/api` proxy block added:

```js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

This ensures that `fetch('/api/auth/login')` in the browser is transparently forwarded to `http://localhost:3001/api/auth/login` during development.

### API Interface — All Endpoints

#### Authentication

| Method | Path | Auth | Role | Request Body | Success | Errors |
|---|---|---|---|---|---|---|
| `GET` | `/api/health` | None | — | — | `200 { status: "ok" }` | — |
| `POST` | `/api/auth/register` | None | — | `{ name, email, password }` | `201 { token, user }` | `400` missing/short, `409` duplicate email |
| `POST` | `/api/auth/login` | None | — | `{ email, password }` | `200 { token, user }` | `400` missing, `401` wrong credentials |

#### Sessions

| Method | Path | Auth | Role | Request Body | Success | Errors |
|---|---|---|---|---|---|---|
| `GET` | `/api/sessions` | JWT | Any | — (optional `?date=YYYY-MM-DD`) | `200 [ ...sessions ]` | `401` |
| `GET` | `/api/sessions/:id` | JWT | Any | — | `200 { session }` | `400` bad id, `401`, `404` |
| `POST` | `/api/sessions` | JWT | ADMIN | `{ title, startTime }` | `201 { session }` | `400`, `401`, `403`, `409` |

Session object shape:
```json
{
  "id": 1,
  "title": "Morning Yoga",
  "startTime": "2025-07-15T07:00:00.000Z",
  "maxCapacity": 20,
  "adminName": "Admin User",
  "confirmedCount": 5,
  "availableSlots": 15
}
```

#### Bookings

| Method | Path | Auth | Role | Request Body | Success | Errors |
|---|---|---|---|---|---|---|
| `POST` | `/api/bookings` | JWT | Any | `{ sessionId }` | `201 { booking + session }` | `400`, `401`, `404`, `409` |
| `GET` | `/api/bookings/mine` | JWT | Any | — | `200 [ ...bookings ]` | `401` |
| `DELETE` | `/api/bookings/:id` | JWT | Any | — | `200 { cancelled, promoted }` | `400`, `401`, `403`, `404` |

#### Check-In

| Method | Path | Auth | Role | Request Body | Success | Errors |
|---|---|---|---|---|---|---|
| `POST` | `/api/checkin/generate/:bookingId` | JWT | Any | — | `200 { code, message }` | `400`, `401`, `403`, `404` |
| `POST` | `/api/checkin/validate` | JWT | Any | `{ code, bookingId }` | `200 { message }` | `400`, `401`, `404` |

---

## Data Models

All four models are defined in `backend/prisma/schema.prisma`.

### Enums

```
Role          → MEMBER | ADMIN
BookingStatus → CONFIRMED | WAITLISTED | CANCELLED
```

### User

| Column | Type | Constraints |
|---|---|---|
| `id` | Int | Primary key, auto-increment |
| `email` | String | **Unique** |
| `password` | String | Stores bcrypt hash (never plaintext) |
| `name` | String | |
| `role` | Role | Default: `MEMBER` |
| `createdAt` | DateTime | Default: `now()` |

Relations:
- Has many `Session` (as admin creator) via `AdminSessions`
- Has many `Booking`

### Session

| Column | Type | Constraints |
|---|---|---|
| `id` | Int | Primary key, auto-increment |
| `title` | String | |
| `startTime` | DateTime | **Unique** — no two sessions at the same time |
| `maxCapacity` | Int | Default: `20` |
| `adminId` | Int | Foreign key → `User.id` |
| `createdAt` | DateTime | Default: `now()` |

Relations:
- Belongs to one `User` (admin) via `AdminSessions`
- Has many `Booking`

### Booking

| Column | Type | Constraints |
|---|---|---|
| `id` | Int | Primary key, auto-increment |
| `userId` | Int | Foreign key → `User.id` |
| `sessionId` | Int | Foreign key → `Session.id` |
| `status` | BookingStatus | Default: `CONFIRMED` |
| `createdAt` | DateTime | Default: `now()` |

Relations:
- Belongs to one `User`
- Belongs to one `Session`
- Has one optional `CheckIn`

> Duplicate active bookings (same user + session with CONFIRMED or WAITLISTED status) are prevented at the application layer inside the booking transaction.

### CheckIn

| Column | Type | Constraints |
|---|---|---|
| `id` | Int | Primary key, auto-increment |
| `bookingId` | Int | **Unique** — one CheckIn per Booking |
| `codeHash` | String | SHA-256 hash of the one-time code |
| `used` | Boolean | Default: `false` |
| `createdAt` | DateTime | Default: `now()` |

Relations:
- Belongs to one `Booking`

---

## Key Flows

### Authentication Flow

**Registration:**

```
Client → POST /api/auth/register { name, email, password }

1. Validate: name, email, password all present; password ≥ 6 chars
2. Check for duplicate: prisma.user.findUnique({ where: { email } })
   → If found: 409 "Email already registered"
3. Hash password: bcrypt.hash(password, 10)  (~100ms — resists brute force)
4. Create user:   prisma.user.create({ role: 'MEMBER' })  (role always hardcoded)
5. Sign JWT:      jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '24h' })
6. Return 201:    { token, user: { id, name, email, role } }
```

**Login:**

```
Client → POST /api/auth/login { email, password }

1. Validate: email and password present
2. Find user: prisma.user.findUnique({ where: { email } })
   → If not found: 401 "Invalid email or password"  (same message prevents email enumeration)
3. Compare:  bcrypt.compare(password, user.password)
   → If false: 401 "Invalid email or password"
4. Sign JWT: jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '24h' })
5. Return 200: { token, user: { id, name, email, role } }
```

**Every protected request:**

```
Authorization: Bearer <token>

authenticate() middleware:
  1. Extract token from Authorization header
  2. jwt.verify(token, JWT_SECRET) — throws if expired or tampered
  3. Attach decoded { id, email, role } to req.user
  4. Call next()
```

### Booking & Waitlist Logic

Both operations use **Serializable** database transactions to prevent race conditions.

**Creating a Booking (`POST /api/bookings`):**

```
Open Serializable transaction:

1. Fetch session → 404 if not found
2. Reject if session.startTime <= now → 400 "Cannot book a past session"
3. Check for duplicate active booking (CONFIRMED or WAITLISTED for same user+session)
   → 409 if found
4. Count current CONFIRMED bookings for the session
5. status = confirmedCount < maxCapacity ? 'CONFIRMED' : 'WAITLISTED'
6. Create booking with computed status
7. Commit → return 201 with booking + nested session
```

**Cancelling a Booking (`DELETE /api/bookings/:id`):**

```
Open Serializable transaction:

1. Fetch booking (with session) → 404 if not found
2. Ownership check: booking.userId === req.user.id → else 403
3. Reject if already CANCELLED → 400
4. Reject if session.startTime <= now → 400
5. UPDATE booking status = 'CANCELLED'
6. If the cancelled booking was CONFIRMED:
   a. Find oldest WAITLISTED booking for same session (ORDER BY createdAt ASC)
   b. If found → UPDATE that booking status = 'CONFIRMED'
7. Commit → return 200: { cancelled: bookingId, promoted: promotedId | null }

Note: If the cancelled booking was WAITLISTED, step 6 is skipped.
A waitlisted cancellation does not free a confirmed slot.
```

### Check-In Code Flow

**Generate (`POST /api/checkin/generate/:bookingId`):**

```
1. Fetch booking (with session + checkin)
2. Ownership check → 403 if not owner
3. Status check: must be CONFIRMED → 400 if not
4. Time window check: now must be within [session.startTime, startTime + 60min]
5. Reject if existing checkin.used === true → 400 "Already checked in"
6. Generate: code = crypto.randomBytes(4).toString('hex').toUpperCase()
   → 8-char uppercase hex, e.g. "A3F1B90C"
7. Hash:     codeHash = sha256(code)  — plaintext is NOT stored
8. Upsert CheckIn: { bookingId, codeHash, used: false }
   (overwrites old hash if regenerated before check-in)
9. Return 200: { code: "A3F1B90C", message: "Show this code at the gym front desk" }
```

**Validate (`POST /api/checkin/validate`):**

```
Staff enters member's code at the front desk terminal.

1. Validate input: code and bookingId both present
2. Fetch CheckIn record (with booking → session)
   → 404 if not found
3. Reject if checkin.used === true → 400 "Code already used"
4. Time window check: same as generation
5. Hash provided code: inputHash = sha256(code)
6. Compare: inputHash === checkin.codeHash
   → 401 "Invalid code" if mismatch
7. Mark used: UPDATE checkin SET used = true
8. Return 200: { message: "Check-in successful!" }
   A second attempt will now fail at step 3.
```

---

## Error Handling

All route handlers follow the same error pattern:

```js
try {
  // route logic
} catch (err) {
  next(err);  // passes to centralized error handler
}
```

The centralized error handler in `server.js`:
- Reads `err.status` (or defaults to 500)
- Returns `{ error: err.message }` JSON
- Logs the full stack server-side for debugging

**Intentional errors** are created with:
```js
throw Object.assign(new Error('Session not found'), { status: 404 });
```

**Prisma errors** surface automatically. For example, the unique constraint violation on `Session.startTime` produces Prisma error code `P2002`, which is caught and converted to a 409.

**HTTP status code usage:**

| Code | Meaning | When used |
|---|---|---|
| 200 | OK | Successful GET, DELETE |
| 201 | Created | Successful POST that creates a resource |
| 400 | Bad Request | Missing/invalid input, business rule violation |
| 401 | Unauthorized | Missing, expired, or invalid JWT; wrong credentials; invalid check-in code |
| 403 | Forbidden | Authenticated but wrong role or wrong resource owner |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate email, duplicate booking, duplicate session time |
| 500 | Internal Server Error | Unhandled exceptions |

---

## Testing Strategy

No test framework currently exists. When tests are added, the recommended approach for each layer:

### Unit Tests (recommended: Jest or Vitest)

Test pure functions and middleware in isolation:
- `authenticate()` — test with valid token, missing header, expired token, tampered token
- `requireAdmin()` — test with ADMIN role, MEMBER role
- `signToken()` helper in `auth.js`
- Input validation branches in each route handler

### Integration Tests (recommended: Supertest + Jest)

Test the full request/response cycle against a real test database:
- Auth round-trips: register → login → use token on protected route
- Booking round-trips: create → list → cancel → verify promotion
- Check-in round-trip: generate → validate → attempt reuse

### Property-Based Tests (check-in round-trip integrity)

Requirement 15 defines a round-trip property:

> For any valid CONFIRMED booking during the session window, generating a code and immediately validating it with the returned code must always succeed.

This is a natural fit for property testing: generate random valid booking states and assert the generate→validate round-trip always returns `{ message: "Check-in successful!" }`.

### Concurrency Tests (overbooking prevention)

Send N concurrent `POST /api/bookings` requests for a session with 1 remaining slot. Assert exactly 1 CONFIRMED and N-1 WAITLISTED bookings are created. This validates the Serializable transaction behavior.

---

## Environment & Setup

Run these commands in order. Everything runs from the `backend/` directory unless noted.

### Step 1 — Create the `.env` file

```bash
# In the backend/ directory
cp .env.example .env
```

Then open `backend/.env` and fill in real values:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/fitbook"
JWT_SECRET="replace-with-a-long-random-string-at-least-32-chars"
PORT=3001
```

- Replace `YOUR_PASSWORD` with your PostgreSQL `postgres` user password
- The `fitbook` database will be created automatically by Prisma

### Step 2 — Install backend dependencies

```bash
# In the backend/ directory
npm install
```

### Step 3 — Run database migrations

```bash
# In the backend/ directory
npx prisma migrate dev --name init
```

Creates all four tables and generates the Prisma client.

### Step 4 — Generate Prisma client (if needed separately)

```bash
# In the backend/ directory
npx prisma generate
```

Only needed if you pulled new schema changes without running a migration.

### Step 5 — Seed the database

```bash
# In the backend/ directory
npm run seed
```

Creates:
- `admin@fitbook.com` / `admin123` (ADMIN)
- `member@fitbook.com` / `member123` (MEMBER)
- 15 sessions across the next 3 calendar days

Safe to run multiple times (idempotent upserts).

### Step 6 — Start the backend server

```bash
# In the backend/ directory
npm run dev
```

Expected output: `FITBOOK API running on http://localhost:3001`

Verify: `curl http://localhost:3001/api/health` → `{"status":"ok"}`

### Step 7 — Add the Vite proxy (frontend)

Edit `frontend/vite.config.js` to add the `server.proxy` block shown in the Components section above.

### Step 8 — Start the frontend

```bash
# In the frontend/ directory
npm run dev
```

App opens at `http://localhost:5173`.

### Summary

| Step | Directory | Command | What it does |
|---|---|---|---|
| 1 | `backend/` | `cp .env.example .env` + edit | Creates environment config |
| 2 | `backend/` | `npm install` | Installs Node dependencies |
| 3 | `backend/` | `npx prisma migrate dev --name init` | Creates DB tables |
| 4 | `backend/` | `npx prisma generate` | Regenerates Prisma client (if needed) |
| 5 | `backend/` | `npm run seed` | Seeds test users and sessions |
| 6 | `backend/` | `npm run dev` | Starts API on port 3001 |
| 7 | `frontend/` | Edit `vite.config.js` | Adds `/api` proxy |
| 8 | `frontend/` | `npm run dev` | Starts React app on port 5173 |

---

## Security Considerations

### Password Hashing

Passwords are never stored in plaintext. `bcrypt.hash(password, 10)` applies a cost factor of 10 (~100ms per hash), making brute-force attacks slow. `bcrypt.compare()` is used at login — it handles timing-safe comparison internally.

### JWT Signing and Expiry

JWTs are signed with `JWT_SECRET` (HS256). The payload is `{ id, email, role }` and tokens expire after 24 hours. `jwt.verify()` rejects tampered or expired tokens with a 401. The secret must be long, random, and never committed to source control.

### No Plaintext Check-In Code Storage

The one-time check-in code is generated with `crypto.randomBytes(4)` (cryptographically secure PRNG). Only its SHA-256 hash is stored. The plaintext is returned once in the API response and then discarded. Database compromise does not expose usable codes.

### CORS

`cors()` is applied globally with no origin restriction for development. For production, restrict to the actual frontend origin:

```js
app.use(cors({ origin: 'https://your-domain.com' }));
```

### Serializable Transactions

Booking creation and cancellation/promotion run under `Serializable` isolation — the strictest PostgreSQL level. This prevents race conditions: two concurrent users cannot both see "1 slot remaining" and both get CONFIRMED bookings. One transaction will be retried after the other commits.

### Role-Based Access Control

`requireAdmin()` guards `POST /api/sessions`. The registration endpoint always assigns `MEMBER` — the `role` field from the request body is ignored. Admin accounts can only be created via the seed script or direct database access.

### Input Validation and Error Safety

All route handlers validate required fields before touching the database. Integer IDs are parsed with `parseInt` and checked with `isNaN`. Dates are validated with `isNaN(date.getTime())`. Error responses always use the `{ error: "..." }` shape — internal stack traces are logged server-side only.

### Email Enumeration Prevention

The login endpoint returns the same `401 "Invalid email or password"` for both an unknown email and a wrong password. This prevents callers from discovering which emails are registered by observing different error messages.

---

## Correctness Properties

These invariants must hold at all times regardless of concurrent requests or input variation.

Property 1: Password never stored in plaintext — For any registered user, `user.password` in the database must always be a bcrypt hash string (starts with `$2b$`), never the original password string.
**Validates: Requirements 4.1**

Property 2: JWT payload integrity — For any token returned by `/api/auth/login` or `/api/auth/register`, decoding it with `JWT_SECRET` must produce `{ id, email, role }` that exactly matches the corresponding User record in the database.
**Validates: Requirements 5.1, 5.2**

Property 3: MEMBER-only self-registration — For any user created via `POST /api/auth/register`, `user.role` must always be `MEMBER`, regardless of any `role` field included in the request body.
**Validates: Requirements 4.5**

Property 4: No overbooking — For any Session, the count of Bookings with `status = CONFIRMED` must never exceed `session.maxCapacity` (20). This must hold even under concurrent booking requests, enforced by Serializable transactions.
**Validates: Requirements 10.1, 10.3**

Property 5: FIFO waitlist promotion — When a CONFIRMED Booking is cancelled and a WAITLISTED Booking is promoted, the promoted Booking must always be the one with the earliest `createdAt` timestamp among all WAITLISTED Bookings for that Session.
**Validates: Requirements 12.2**

Property 6: Waitlisted cancellation does not promote — When a WAITLISTED Booking is cancelled, no other Booking's status changes. The total CONFIRMED count for the Session must remain unchanged.
**Validates: Requirements 12.3**

Property 7: No duplicate active bookings — For any `(userId, sessionId)` pair, there must never be more than one Booking with `status IN (CONFIRMED, WAITLISTED)` at the same time.
**Validates: Requirements 10.7**

Property 8: Check-in code round-trip — For any CONFIRMED Booking during its Session's one-hour window, calling `POST /api/checkin/generate/:bookingId` and then `POST /api/checkin/validate` with the returned code and bookingId must always produce `{ message: "Check-in successful!" }`.
**Validates: Requirements 15.1**

Property 9: One-time use enforcement — After a successful `POST /api/checkin/validate`, any subsequent call with the same `code` and `bookingId` must return `400 { error: "Code already used" }`.
**Validates: Requirements 15.2**

Property 10: No plaintext code persisted — For any CheckIn record, `checkin.codeHash` must always be a 64-character hex string (SHA-256 output). The plaintext code must never appear in any database column.
**Validates: Requirements 13.3**

Property 11: Protected routes reject unauthenticated requests — Any request to `/api/sessions`, `/api/bookings`, or `/api/checkin` without a valid `Authorization: Bearer <token>` header must return `401` before any database query is executed.
**Validates: Requirements 6.2, 6.3**

Property 12: Admin-only routes reject MEMBER tokens — `POST /api/sessions` with a valid MEMBER JWT must always return `403`, never `201`.
**Validates: Requirements 9.7, 6.4**
