/**
 * Property-based test: check-in generate → validate round-trip (Requirement 15).
 * Requires DATABASE_URL and JWT_SECRET from backend/.env.
 */
require('dotenv').config();
const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const fc = require('fast-check');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const express = require('express');
const cors = require('cors');

const prisma = new PrismaClient();
const PORT = 3099;

let server;
let memberToken;
let memberId;
let adminId;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: {
          ...(data
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
              }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = { raw };
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

beforeAll(async () => {
  if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
    throw new Error('JWT_SECRET and DATABASE_URL must be set in backend/.env');
  }

  const authRoutes = require('../src/routes/auth');
  const sessionRoutes = require('../src/routes/sessions');
  const bookingRoutes = require('../src/routes/bookings');
  const checkinRoutes = require('../src/routes/checkin');

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use((req, _res, next) => {
    req.prisma = prisma;
    next();
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/checkin', checkinRoutes);
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', resolve);
  });

  const email = `pbt-member-${Date.now()}@fitbook.test`;
  const hash = await bcrypt.hash('testpass123', 10);
  const member = await prisma.user.create({
    data: { name: 'PBT Member', email, password: hash, role: 'MEMBER' },
  });
  memberId = member.id;
  memberToken = jwt.sign(
    { id: member.id, email: member.email, role: member.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (admin) {
    adminId = admin.id;
  } else {
    const aHash = await bcrypt.hash('admin123', 10);
    const created = await prisma.user.create({
      data: {
        name: 'PBT Admin',
        email: `pbt-admin-${Date.now()}@fitbook.test`,
        password: aHash,
        role: 'ADMIN',
      },
    });
    adminId = created.id;
  }
}, 60000);

afterAll(async () => {
  if (memberId) {
    await prisma.checkIn.deleteMany({
      where: { booking: { userId: memberId } },
    });
    await prisma.booking.deleteMany({ where: { userId: memberId } });
    await prisma.user.delete({ where: { id: memberId } }).catch(() => {});
  }

  const testSessions = await prisma.session.findMany({
    where: { title: { startsWith: 'PBT Session' } },
  });
  for (const s of testSessions) {
    await prisma.checkIn.deleteMany({
      where: { booking: { sessionId: s.id } },
    });
    await prisma.booking.deleteMany({ where: { sessionId: s.id } });
    await prisma.session.delete({ where: { id: s.id } }).catch(() => {});
  }

  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect();
}, 60000);

describe('Check-in round-trip integrity (Requirement 15)', () => {
  test('generate then validate succeeds; second validate is one-time-use', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 40 }), async (minutesAgo) => {
        const uniqueMs = Date.now() * 1000 + minutesAgo + Math.floor(Math.random() * 1000);
        const sessionStart = new Date(Date.now() - minutesAgo * 60 * 1000);

        const session = await prisma.session.create({
          data: {
            title: `PBT Session ${uniqueMs}`,
            startTime: sessionStart,
            maxCapacity: 20,
            adminId,
          },
        });

        const booking = await prisma.booking.create({
          data: {
            userId: memberId,
            sessionId: session.id,
            status: 'CONFIRMED',
          },
        });

        try {
          const gen = await request(
            'POST',
            `/api/checkin/generate/${booking.id}`,
            null,
            memberToken
          );
          expect(gen.status).toBe(200);
          expect(gen.body.code).toMatch(/^[0-9A-F]{8}$/);

          const first = await request(
            'POST',
            '/api/checkin/validate',
            { code: gen.body.code, bookingId: booking.id },
            memberToken
          );
          expect(first.status).toBe(200);
          expect(first.body.message).toBe('Check-in successful!');

          const second = await request(
            'POST',
            '/api/checkin/validate',
            { code: gen.body.code, bookingId: booking.id },
            memberToken
          );
          expect(second.status).toBe(400);
          expect(second.body.error).toBe('Code already used');
        } finally {
          await prisma.checkIn.deleteMany({ where: { bookingId: booking.id } });
          await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
          await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
        }
      }),
      { numRuns: 10 }
    );
  }, 120000);
});
