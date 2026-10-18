# Implementation Plan: FITBOOK Backend

## Overview

All backend source files are already written and complete (`server.js`,
`middleware.js`, all route files, `schema.prisma`, `seed.js`, `package.json`,
`.env.example`, `.gitignore`). The tasks below cover environment configuration,
database initialisation, server verification, endpoint testing, a property-based
test for check-in round-trip integrity (Requirement 15), and the three remaining
frontend changes.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1] },
    { "wave": 2, "tasks": [2] },
    { "wave": 3, "tasks": [3] },
    { "wave": 4, "tasks": [4, 5, 6, 7] },
    { "wave": 5, "tasks": [8] },
    { "wave": 6, "tasks": [9] },
    { "wave": 7, "tasks": [10] }
  ]
}
```

## Tasks

- [x] 1. Environment Configuration
  Create the `backend/.env` file from the provided template, populate it with real credentials, and confirm the file is excluded from version control before any other step is attempted.
  - [x] 1.1 Copy `backend/.env.example` to `backend/.env`
  - [x] 1.2 Set `DATABASE_URL` to the real PostgreSQL connection string (e.g. `postgresql://postgres:YOUR_PASSWORD@localhost:5432/fitbook`)
  - [x] 1.3 Set `JWT_SECRET` to a secure random string of at least 32 characters
  - [x] 1.4 Confirm `backend/.env` is listed in `backend/.gitignore` and is NOT staged or committed
  Requirements: 1

- [x] 2. Install Dependencies and Initialise Database
  Install all Node dependencies declared in `backend/package.json`, run the Prisma migration to create the database schema, verify the four tables exist, then seed the database with the admin user, member user, and 15 sessions.
  - [x] 2.1 Run `npm install` inside `backend/` and confirm `node_modules` is populated
  - [x] 2.2 Run `npx prisma migrate dev --name init` inside `backend/` to create the `User`, `Session`, `Booking`, and `CheckIn` tables and generate the Prisma client
  - [x] 2.3 Connect to PostgreSQL and verify all four tables exist in the `fitbook` database
  - [x] 2.4 Run `npm run seed` inside `backend/` to populate seed data
  - [x] 2.5 Verify the seed: confirm `admin@fitbook.com` (ADMIN), `member@fitbook.com` (MEMBER), and exactly 15 Session records across the next 3 calendar days are present in the database
  - [x] 2.6 Run `npm run seed` a second time and confirm the row counts remain the same (idempotent upserts)
  Requirements: 2

- [x] 3. Verify Backend Server Starts and Health Check Works
  Start the Express server and confirm it binds to the expected port and responds correctly to the health-check endpoint before any feature testing begins.
  - [x] 3.1 Run `npm run dev` inside `backend/` and confirm the console prints `FITBOOK API running on http://localhost:3001`
  - [x] 3.2 Send `GET http://localhost:3001/api/health` (curl or Postman) and verify the response is `HTTP 200` with body `{ "status": "ok" }`
  - [x] 3.3 Confirm that a request to a non-existent route returns a JSON error body rather than an HTML error page
  Requirements: 3

- [x] 4. Verify Authentication Endpoints
  Manually test every branch of the register and login routes to confirm the already-written code satisfies all authentication acceptance criteria.
  - [x] 4.1 `POST /api/auth/register` with `{ name, email, password }` → expect `201` with `token` and `user.role === "MEMBER"`
  - [x] 4.2 `POST /api/auth/register` with the same email again → expect `409 { "error": "Email already registered" }`
  - [x] 4.3 `POST /api/auth/register` with a password shorter than 6 characters → expect `400 { "error": "Password must be at least 6 characters" }`
  - [x] 4.4 `POST /api/auth/register` with `role: "ADMIN"` in the body → confirm response still shows `role: "MEMBER"`
  - [x] 4.5 `POST /api/auth/login` with correct credentials → expect `200` with `token` and matching `user` object
  - [x] 4.6 `POST /api/auth/login` with a wrong password → expect `401 { "error": "Invalid email or password" }`
  - [x] 4.7 Access any protected endpoint without a token → expect `401 { "error": "No token provided" }`
  Requirements: 4, 5, 6

- [x] 5. Verify Session Endpoints
  Manually test session listing, detail retrieval, and admin-only creation to confirm the already-written route handlers satisfy all session acceptance criteria.
  - [x] 5.1 `GET /api/sessions` with a valid member JWT → expect `200` with a non-empty array of session objects each containing `id`, `title`, `startTime`, `maxCapacity`, `adminName`, `confirmedCount`, `availableSlots`
  - [x] 5.2 `GET /api/sessions?date=YYYY-MM-DD` using a date that has seeded sessions → expect only sessions on that day returned
  - [x] 5.3 `GET /api/sessions/:id` with a valid id → expect `200` with full session detail
  - [x] 5.4 `GET /api/sessions/abc` (non-integer id) → expect `400 { "error": "Invalid session ID" }`
  - [x] 5.5 `POST /api/sessions` with an ADMIN JWT and `{ title, startTime }` in the future → expect `201` with the new session
  - [x] 5.6 `POST /api/sessions` with a MEMBER JWT → expect `403 { "error": "Admin access required" }`
  Requirements: 7, 8, 9

- [x] 6. Verify Booking Endpoints
  Manually test booking creation, retrieval, and cancellation — including waitlist and FIFO promotion — to confirm the already-written route handlers satisfy all booking acceptance criteria.
  - [x] 6.1 `POST /api/bookings` with a valid JWT and an available `sessionId` → expect `201` with `status: "CONFIRMED"` and nested `session`
  - [x] 6.2 Attempt the same booking again (same user + session) → expect `409 { "error": "You already have an active booking for this session" }`
  - [x] 6.3 `GET /api/bookings/mine` → expect `200` with an array containing the booking just created, including nested `session` and `checkin`
  - [x] 6.4 `DELETE /api/bookings/:id` for the confirmed booking → expect `200 { "cancelled": <id>, "promoted": null }`
  - [x] 6.5 Attempt to cancel the same booking again → expect `400 { "error": "Already cancelled" }`
  - [x] 6.6 Fill a session to 20 confirmed bookings, then book as a different user → expect `201` with `status: "WAITLISTED"`
  - [x] 6.7 Cancel one of the 20 confirmed bookings and verify the waitlisted booking is promoted to CONFIRMED (check `promoted` field in response)
  Requirements: 10, 11, 12

- [x] 7. Write Property-Based Test for Check-In Round-Trip Integrity
  Install fast-check and Jest as dev dependencies, then write a property-based test that verifies the generate → validate round-trip always succeeds for valid CONFIRMED bookings, and that a second validate always returns "Code already used".
  - [x] 7.1 Install `fast-check` and `jest` as dev dependencies in `backend/` (`npm install --save-dev fast-check jest @jest/globals`)
  - [x] 7.2 Add a `"test"` script to `backend/package.json`: `"test": "jest --testPathPattern=tests"`
  - [x] 7.3 Create `backend/tests/checkin.property.test.js` with a property-based test that uses `fc.assert` / `fc.property`, sets up a CONFIRMED booking whose session `startTime` is within the current one-hour window, calls `POST /api/checkin/generate/:bookingId` to get the `code`, immediately calls `POST /api/checkin/validate` with `{ code, bookingId }` and asserts `200 { "message": "Check-in successful!" }`, then calls validate again with the same inputs and asserts `400 { "error": "Code already used" }`
  - [x] 7.4 Run `npm test` in `backend/` and confirm the property-based test passes with no counterexamples reported by fast-check
  Requirements: 15

- [x] 8. Add Vite API Proxy
  Edit `frontend/vite.config.js` to forward all `/api/*` requests to the Express backend so that `fetch('/api/...')` calls work correctly from the browser during development.
  - [x] 8.1 Open `frontend/vite.config.js` and add a `server.proxy` entry: `'/api': { target: 'http://localhost:3001', changeOrigin: true }`
  - [x] 8.2 Start both servers (`npm run dev` in `backend/` and `frontend/`), then open `http://localhost:5173/api/health` in the browser and verify it returns `{ "status": "ok" }`
  Requirements: 16

- [x] 9. Wire Auth.jsx to the Backend API
  Replace the no-op form submit in `frontend/src/Auth.jsx` with controlled state and a real `handleSubmit` that calls the backend, persists credentials on success, and calls an `onLogin` prop to hand off to the Dashboard.
  - [x] 9.1 Add controlled state: `name`, `email`, `password`, `error` (string or null), `loading` (boolean); bind each input to its corresponding state value via `value` / `onChange`
  - [x] 9.2 Implement `handleSubmit(e)`: prevent default, set `loading = true` and `error = null`, call `POST /api/auth/register` or `POST /api/auth/login`, on 2xx store `token` and `user` in `localStorage` and call `onLogin(user)`, on 4xx/5xx set `error = data.error`, always set `loading = false` in a `finally` block
  - [x] 9.3 Display the `error` string inside the form when it is non-null, and set `disabled={loading}` on the submit button
  - [x] 9.4 Manually test: register a new user, log in as that user, log in with wrong password (confirm inline error displays), and verify the JWT appears in browser DevTools → Application → Local Storage
  Requirements: 16

- [x] 10. Create Dashboard Component and Wire App.jsx
  Create `frontend/src/Dashboard.jsx` as the post-login session-listing view and update `frontend/src/App.jsx` to track auth state and conditionally render the Dashboard or the landing page.
  - [x] 10.1 Create `frontend/src/Dashboard.jsx` that reads the JWT from `localStorage`, fetches `GET /api/sessions` with an `Authorization: Bearer <token>` header, renders each session's `title`, formatted `startTime`, and `availableSlots`, and includes a Logout button that clears `localStorage` and resets auth state
  - [x] 10.2 Update `frontend/src/App.jsx` to add `user` state initialised from `localStorage` on first render (or `null`), pass an `onLogin(user)` callback to `<Auth />`, and render `<Dashboard />` when `user` is non-null, otherwise render the existing landing / Auth flow
  - [x] 10.3 Manually verify the full end-to-end flow: land on homepage → navigate to Auth → log in → see Dashboard with sessions → click Logout → return to homepage
  Requirements: 16

## Notes

- Tasks 1–7 are strictly backend. Tasks 8–10 are frontend integration tasks.
- Task 7 requires the server to be running (Task 3 complete) because the property-based test exercises the live HTTP endpoints.
- The existing backend code files must NOT be rewritten; only configuration, wiring, and tests are needed.
- For Task 7, if mocking the session time window is complex, insert a test session with `startTime` equal to `new Date()` directly via Prisma in the test `beforeEach`, then clean up in `afterEach`.
