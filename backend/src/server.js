require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const bookingRoutes = require('./routes/bookings');
const checkinRoutes = require('./routes/checkin');

const prisma = new PrismaClient();
const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Attach prisma to every request so routes can use req.prisma
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// --- Routes ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/checkin', checkinRoutes);

// --- 404 catch-all: unmatched routes return JSON, not HTML ---
app.use((req, res, next) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// --- Centralized error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// --- Start ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`FITBOOK API running on http://localhost:${PORT}`);
});
