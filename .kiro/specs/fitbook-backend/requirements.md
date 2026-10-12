# Requirements Document

## Introduction

FITBOOK is a gym slot booking application. The backend provides a REST API that powers member registration, authentication, gym session management, seat booking with automatic waitlisting, and QR/code-based check-in. The backend is built with Node.js, Express 5, Prisma 6, and PostgreSQL and is consumed by a React 19 + Vite frontend.

This document covers:
1. Environment setup and server bootstrapping
2. Authentication (register, login, JWT)
3. Session management
4. Booking and waitlist management
5. Check-in code generation and validation
6. Frontend integration of the Auth form

---

## Glossary

- **API**: The Express REST API served at `http://localhost:3001`
- **Server**: The Express application defined in `backend/src/server.js`
- **Auth_Router**: The Express router handling `/api/auth` routes
- **Session_Router**: The Express router handling `/api/sessions` routes
- **Booking_Router**: The Express router handling `/api/bookings` routes
- **CheckIn_Router**: The Express router handling `/api/checkin` routes
- **Authenticator**: The `authenticate()` middleware in `backend/src/middleware.js`
- **Admin_Guard**: The `requireAdmin()` middleware in `backend/src/middleware.js`
- **DB**: The PostgreSQL database named `fitbook` running on `localhost:5432`
- **Prisma**: The Prisma ORM client used for all DB access
- **JWT**: A JSON Web Token signed with `JWT_SECRET`, valid for 24 hours
- **MEMBER**: A user role with access to booking and check-in features
- **ADMIN**: A user role with additional access to create sessions and seed data
- **Session**: A one-hour gym timeslot with a title, start time, and maximum capacity of 20
- **Booking**: A reservation linking a User to a Session with status CONFIRMED, WAITLISTED, or CANCELLED
- **CheckIn**: A one-time-use record linking a Booking to a SHA-256-hashed 8-character hex code
- **Waitlist**: The ordered queue of WAITLISTED bookings, ordered by `createdAt` ascending (FIFO)
- **Auth_Form**: The React component `frontend/src/Auth.jsx` that renders login and register UI

---

## Requirements

### Requirement 1: Environment Configuration

**User Story:** As a developer, I want a `.env` file derived from `.env.example`, so that the Server can connect to the DB and sign JWTs.

#### Acceptance Criteria

1. THE Server SHALL read `DATABASE_URL` and `JWT_SECRET` from the `.env` file at startup via `dotenv`.
2. IF `DATABASE_URL` is not set, THEN THE Server SHALL fail to start and emit a connection error to the console.
3. IF `JWT_SECRET` is not set, THEN THE Authenticator SHALL throw an error when attempting to sign or verify a JWT.

---

### Requirement 2: Database Initialisation

**User Story:** As a developer, I want Prisma migrations and client generation to be run, so that the DB schema matches the Prisma schema and the Prisma client is ready to use.

#### Acceptance Criteria

1. WHEN `npx prisma migrate dev --name init` is executed, THE DB SHALL contain tables for `User`, `Session`, `Booking`, and `CheckIn` that match `backend/prisma/schema.prisma`.
2. WHEN `npx prisma generate` is executed, THE Prisma client SHALL be regenerated and available for import by the Server.
3. WHEN `npm run seed` is executed in the `backend` directory, THE DB SHALL contain one ADMIN user with email `admin@fitbook.com`, one MEMBER user with email `member@fitbook.com`, and 15 Session records spread across the next 3 calendar days.
4. WHEN the seed script is run more than once, THE DB SHALL contain exactly one record per seeded entity (idempotent upserts).

---

### Requirement 3: Server Bootstrap and Health Check

**User Story:** As a developer, I want to confirm the Server is running, so that I can verify the deployment before testing other endpoints.

#### Acceptance Criteria

1. WHEN the Server starts, THE Server SHALL listen on the port defined by the `PORT` environment variable, defaulting to `3001`.
2. WHEN a `GET /api/health` request is received, THE Server SHALL respond with HTTP 200 and the JSON body `{ "status": "ok" }`.
3. THE Server SHALL attach the Prisma client instance to every incoming request as `req.prisma` before any route handler executes.
4. WHEN an unhandled error is thrown inside a route handler, THE Server SHALL respond with the error's `status` property (or 500 if absent) and a JSON body containing `{ "error": "<message>" }`.
5. THE Server SHALL accept cross-origin requests from all origins via the CORS middleware.

---

### Requirement 4: Member Registration

**User Story:** As a new gym member, I want to register an account with my name, email, and password, so that I can log in and book sessions.

#### Acceptance Criteria

1. WHEN a `POST /api/auth/register` request is received with a valid `name`, `email`, and `password` (minimum 6 characters), THE Auth_Router SHALL create a new User record with role MEMBER, hash the password using bcrypt with 10 rounds, and respond with HTTP 201 containing a JWT and the user's `id`, `name`, `email`, and `role`.
2. IF a `POST /api/auth/register` request is missing `name`, `email`, or `password`, THEN THE Auth_Router SHALL respond with HTTP 400 and `{ "error": "Name, email, and password are required" }`.
3. IF a `POST /api/auth/register` request contains a `password` shorter than 6 characters, THEN THE Auth_Router SHALL respond with HTTP 400 and `{ "error": "Password must be at least 6 characters" }`.
4. IF a `POST /api/auth/register` request contains an `email` that is already registered, THEN THE Auth_Router SHALL respond with HTTP 409 and `{ "error": "Email already registered" }`.
5. THE Auth_Router SHALL never assign the ADMIN role through the public registration endpoint.

---

### Requirement 5: Member and Admin Login

**User Story:** As a registered user, I want to log in with my email and password, so that I receive a JWT to authenticate subsequent requests.

#### Acceptance Criteria

1. WHEN a `POST /api/auth/login` request is received with a valid `email` and matching `password`, THE Auth_Router SHALL respond with HTTP 200 containing a JWT and the user's `id`, `name`, `email`, and `role`.
2. THE Auth_Router SHALL sign JWTs with the `JWT_SECRET` environment variable and set the expiry to 24 hours.
3. IF a `POST /api/auth/login` request is missing `email` or `password`, THEN THE Auth_Router SHALL respond with HTTP 400 and `{ "error": "Email and password are required" }`.
4. IF a `POST /api/auth/login` request contains an unrecognised `email` or a non-matching `password`, THEN THE Auth_Router SHALL respond with HTTP 401 and `{ "error": "Invalid email or password" }`.

---

### Requirement 6: JWT Authentication Middleware

**User Story:** As the system, I want all protected routes to verify the caller's JWT, so that unauthenticated or tampered requests are rejected.

#### Acceptance Criteria

1. WHEN a protected route receives a request with a valid `Authorization: Bearer <token>` header, THE Authenticator SHALL decode the token and attach `{ id, email, role }` to `req.user`, then call `next()`.
2. IF a protected route receives a request with no `Authorization` header, THEN THE Authenticator SHALL respond with HTTP 401 and `{ "error": "No token provided" }`.
3. IF a protected route receives a request with a malformed, expired, or tampered token, THEN THE Authenticator SHALL respond with HTTP 401 and `{ "error": "Invalid or expired token" }`.
4. WHEN the Admin_Guard middleware is applied to a route and `req.user.role` is not `ADMIN`, THE Admin_Guard SHALL respond with HTTP 403 and `{ "error": "Admin access required" }`.

---

### Requirement 7: Session Listing

**User Story:** As a logged-in member, I want to browse available gym sessions, so that I can choose one to book.

#### Acceptance Criteria

1. WHEN a `GET /api/sessions` request is received with a valid JWT, THE Session_Router SHALL respond with HTTP 200 and a JSON array of Session objects ordered by `startTime` ascending.
2. THE Session_Router SHALL include in each Session object: `id`, `title`, `startTime`, `maxCapacity`, `adminName`, `confirmedCount` (count of CONFIRMED bookings), and `availableSlots` (`maxCapacity` minus `confirmedCount`).
3. WHEN a `GET /api/sessions` request includes a `?date=YYYY-MM-DD` query parameter, THE Session_Router SHALL return only Session records whose `startTime` falls within that calendar day.
4. IF the `?date` query parameter is not a valid date, THE Session_Router SHALL return an empty array.
5. IF a `GET /api/sessions` request contains no valid JWT, THEN THE Authenticator SHALL respond with HTTP 401 before the Session_Router is invoked.

---

### Requirement 8: Single Session Detail

**User Story:** As a logged-in member, I want to view the details of a specific session, so that I can decide whether to book it.

#### Acceptance Criteria

1. WHEN a `GET /api/sessions/:id` request is received with a valid JWT and an integer `:id`, THE Session_Router SHALL respond with HTTP 200 and the full Session object including `confirmedCount` and `availableSlots`.
2. IF the `:id` parameter is not an integer, THEN THE Session_Router SHALL respond with HTTP 400 and `{ "error": "Invalid session ID" }`.
3. IF no Session with the given `:id` exists, THEN THE Session_Router SHALL respond with HTTP 404 and `{ "error": "Session not found" }`.

---

### Requirement 9: Session Creation (Admin)

**User Story:** As an admin, I want to create new gym sessions, so that members can discover and book them.

#### Acceptance Criteria

1. WHEN a `POST /api/sessions` request is received with a valid ADMIN JWT and a body containing `title` and `startTime`, THE Session_Router SHALL create a new Session record with `maxCapacity` fixed at 20 and respond with HTTP 201 and the created Session.
2. THE Session_Router SHALL assign the `adminId` of the new Session to the `id` of the authenticated admin user.
3. IF the `POST /api/sessions` body is missing `title` or `startTime`, THEN THE Session_Router SHALL respond with HTTP 400 and `{ "error": "Title and startTime are required" }`.
4. IF the `startTime` value cannot be parsed as a valid date, THEN THE Session_Router SHALL respond with HTTP 400 and `{ "error": "Invalid date format" }`.
5. IF the `startTime` is in the past or equals the current time, THEN THE Session_Router SHALL respond with HTTP 400 and `{ "error": "Session must be in the future" }`.
6. IF a Session with the same `startTime` already exists, THEN THE Session_Router SHALL respond with HTTP 409 and `{ "error": "A session already exists at this start time" }`.
7. WHEN a `POST /api/sessions` request is received with a MEMBER JWT, THE Admin_Guard SHALL respond with HTTP 403 before the Session_Router creates any record.

---

### Requirement 10: Booking a Session

**User Story:** As a logged-in member, I want to book a gym session, so that I have a guaranteed spot or a waitlist position.

#### Acceptance Criteria

1. WHEN a `POST /api/bookings` request is received with a valid JWT and a body containing a valid `sessionId`, and the Session has fewer than 20 CONFIRMED bookings, THE Booking_Router SHALL create a Booking with status CONFIRMED and respond with HTTP 201 and the created Booking including the nested Session.
2. WHEN a `POST /api/bookings` request is received and the Session already has 20 CONFIRMED bookings, THE Booking_Router SHALL create a Booking with status WAITLISTED and respond with HTTP 201.
3. THE Booking_Router SHALL execute the capacity check and Booking creation inside a single Serializable database transaction to prevent overbooking under concurrent load.
4. IF the `POST /api/bookings` body is missing `sessionId`, THEN THE Booking_Router SHALL respond with HTTP 400 and `{ "error": "sessionId is required" }`.
5. IF the referenced Session does not exist, THEN THE Booking_Router SHALL respond with HTTP 404 and `{ "error": "Session not found" }`.
6. IF the Session's `startTime` is in the past or equal to the current time, THEN THE Booking_Router SHALL respond with HTTP 400 and `{ "error": "Cannot book a past session" }`.
7. IF the authenticated user already has a CONFIRMED or WAITLISTED booking for the same Session, THEN THE Booking_Router SHALL respond with HTTP 409 and `{ "error": "You already have an active booking for this session" }`.

---

### Requirement 11: Viewing My Bookings

**User Story:** As a logged-in member, I want to see all my bookings, so that I can track my upcoming and past reservations.

#### Acceptance Criteria

1. WHEN a `GET /api/bookings/mine` request is received with a valid JWT, THE Booking_Router SHALL respond with HTTP 200 and a JSON array of all Booking records belonging to the authenticated user, ordered by `createdAt` descending.
2. THE Booking_Router SHALL include in each Booking object the nested `session` record and a `checkin` object containing only the `used` boolean field.

---

### Requirement 12: Cancelling a Booking

**User Story:** As a logged-in member, I want to cancel a booking I no longer need, so that another member can take my spot.

#### Acceptance Criteria

1. WHEN a `DELETE /api/bookings/:id` request is received with a valid JWT and the Booking belongs to the authenticated user and has a CONFIRMED or WAITLISTED status, THE Booking_Router SHALL update the Booking status to CANCELLED and respond with HTTP 200 and `{ "cancelled": <bookingId>, "promoted": <promotedBookingId | null> }`.
2. WHEN a CONFIRMED Booking is cancelled and at least one WAITLISTED Booking exists for the same Session, THE Booking_Router SHALL promote the oldest WAITLISTED Booking (lowest `createdAt`) to CONFIRMED status within the same Serializable transaction.
3. WHEN a WAITLISTED Booking is cancelled, THE Booking_Router SHALL NOT promote any other Booking.
4. THE Booking_Router SHALL execute the cancellation and optional promotion inside a single Serializable database transaction.
5. IF the `:id` parameter is not an integer, THEN THE Booking_Router SHALL respond with HTTP 400 and `{ "error": "Invalid booking ID" }`.
6. IF no Booking with the given `:id` exists, THEN THE Booking_Router SHALL respond with HTTP 404 and `{ "error": "Booking not found" }`.
7. IF the Booking does not belong to the authenticated user, THEN THE Booking_Router SHALL respond with HTTP 403 and `{ "error": "Not your booking" }`.
8. IF the Booking already has status CANCELLED, THEN THE Booking_Router SHALL respond with HTTP 400 and `{ "error": "Already cancelled" }`.
9. IF the Session's `startTime` is in the past or equal to the current time, THEN THE Booking_Router SHALL respond with HTTP 400 and `{ "error": "Cannot cancel after session has started" }`.

---

### Requirement 13: Check-In Code Generation

**User Story:** As a logged-in member attending a session, I want to generate a one-time check-in code, so that gym staff can verify my attendance.

#### Acceptance Criteria

1. WHEN a `POST /api/checkin/generate/:bookingId` request is received with a valid JWT and the current time is within the Session's one-hour window (from `startTime` to `startTime + 60 minutes`), THE CheckIn_Router SHALL generate an 8-character uppercase hexadecimal code, store its SHA-256 hash in the `CheckIn` record, and respond with HTTP 200 and `{ "code": "<code>", "message": "Show this code at the gym front desk" }`.
2. THE CheckIn_Router SHALL use a cryptographically secure random byte generator (`crypto.randomBytes`) to produce the 8-character code.
3. THE CheckIn_Router SHALL store only the SHA-256 hash of the code in the DB; the plaintext code SHALL NOT be persisted.
4. IF a CheckIn record already exists for the Booking, THE CheckIn_Router SHALL overwrite it with a new code hash and reset `used` to `false`, provided the Booking has not already been checked in.
5. IF the `bookingId` parameter is not an integer, THEN THE CheckIn_Router SHALL respond with HTTP 400 and `{ "error": "Invalid booking ID" }`.
6. IF no Booking with the given `bookingId` exists, THEN THE CheckIn_Router SHALL respond with HTTP 404 and `{ "error": "Booking not found" }`.
7. IF the Booking does not belong to the authenticated user, THEN THE CheckIn_Router SHALL respond with HTTP 403 and `{ "error": "Not your booking" }`.
8. IF the Booking status is not CONFIRMED, THEN THE CheckIn_Router SHALL respond with HTTP 400 and `{ "error": "Only confirmed bookings can check in" }`.
9. IF the current time is before the Session's `startTime` or after `startTime + 60 minutes`, THEN THE CheckIn_Router SHALL respond with HTTP 400 and `{ "error": "Check-in is only available during the session hour" }`.
10. IF the existing CheckIn record for the Booking has `used` set to `true`, THEN THE CheckIn_Router SHALL respond with HTTP 400 and `{ "error": "Already checked in" }`.

---

### Requirement 14: Check-In Code Validation

**User Story:** As gym staff, I want to validate a member's check-in code, so that I can confirm they are present for their booked session.

#### Acceptance Criteria

1. WHEN a `POST /api/checkin/validate` request is received with a valid JWT and a matching `code` and `bookingId` for an unused CheckIn, and the current time is within the Session's one-hour window, THE CheckIn_Router SHALL mark the CheckIn record as `used: true` and respond with HTTP 200 and `{ "message": "Check-in successful!" }`.
2. THE CheckIn_Router SHALL validate the code by computing the SHA-256 hash of the provided plaintext `code` and comparing it to the stored `codeHash`; plaintext codes SHALL NOT be stored or logged.
3. IF `code` or `bookingId` is absent from the request body, THEN THE CheckIn_Router SHALL respond with HTTP 400 and `{ "error": "code and bookingId are required" }`.
4. IF no CheckIn record exists for the given `bookingId`, THEN THE CheckIn_Router SHALL respond with HTTP 404 and `{ "error": "No check-in code found" }`.
5. IF the CheckIn record has `used` set to `true`, THEN THE CheckIn_Router SHALL respond with HTTP 400 and `{ "error": "Code already used" }`.
6. IF the current time is outside the Session's one-hour window, THEN THE CheckIn_Router SHALL respond with HTTP 400 and `{ "error": "Code only valid during the session hour" }`.
7. IF the SHA-256 hash of the provided `code` does not match the stored `codeHash`, THEN THE CheckIn_Router SHALL respond with HTTP 401 and `{ "error": "Invalid code" }`.

---

### Requirement 15: Check-In Code Round-Trip Integrity

**User Story:** As the system, I want the check-in code to survive a generate-then-validate round trip, so that codes generated for valid bookings can always be validated successfully.

#### Acceptance Criteria

1. FOR ALL valid CONFIRMED Bookings during the Session window, generating a check-in code via `POST /api/checkin/generate/:bookingId` and immediately validating it via `POST /api/checkin/validate` with the returned code SHALL produce a `{ "message": "Check-in successful!" }` response (round-trip property).
2. THE CheckIn_Router SHALL ensure that after a successful validation, a second `POST /api/checkin/validate` with the same code and `bookingId` returns HTTP 400 with `{ "error": "Code already used" }` (one-time use enforcement).

---

### Requirement 16: Frontend Auth Form Integration

**User Story:** As a member using the web app, I want the login and register forms to call the backend API, so that I can authenticate and receive a JWT stored in the browser.

#### Acceptance Criteria

1. WHEN the Auth_Form's register form is submitted with `name`, `email`, and `password`, THE Auth_Form SHALL send a `POST /api/auth/register` request to the API and, on a 201 response, store the returned JWT in `localStorage` and redirect the user to the session listing view.
2. WHEN the Auth_Form's login form is submitted with `email` and `password`, THE Auth_Form SHALL send a `POST /api/auth/login` request to the API and, on a 200 response, store the returned JWT in `localStorage` and redirect the user to the session listing view.
3. IF the API responds with a 4xx status, THE Auth_Form SHALL display the error message from the response body to the user without reloading the page.
4. WHILE an API request is in-flight, THE Auth_Form SHALL disable the submit button to prevent duplicate submissions.
5. THE Auth_Form SHALL read the Vite-proxied base URL so that API calls resolve correctly in both development (`/api/...`) and production environments.
