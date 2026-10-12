const express = require('express');
const { authenticate, requireAdmin } = require('../middleware');

const router = express.Router();

// GET /api/sessions — list sessions, optional ?date=YYYY-MM-DD filter
router.get('/', authenticate, async (req, res, next) => {
  try {
    const where = {};

    if (req.query.date) {
      const day = new Date(req.query.date);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      where.startTime = { gte: day, lt: next };
    }

    const sessions = await req.prisma.session.findMany({
      where,
      include: {
        _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
        admin: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Flatten _count into a friendlier shape
    const result = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      startTime: s.startTime,
      maxCapacity: s.maxCapacity,
      adminName: s.admin.name,
      confirmedCount: s._count.bookings,
      availableSlots: s.maxCapacity - s._count.bookings,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id — single session detail
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid session ID' });

    const session = await req.prisma.session.findUnique({
      where: { id },
      include: {
        _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
        admin: { select: { name: true } },
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({
      ...session,
      adminName: session.admin.name,
      confirmedCount: session._count.bookings,
      availableSlots: session.maxCapacity - session._count.bookings,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions — admin only, create 1-hr session
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { title, startTime } = req.body;

    if (!title || !startTime) {
      return res.status(400).json({ error: 'Title and startTime are required' });
    }

    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    if (start <= new Date()) {
      return res.status(400).json({ error: 'Session must be in the future' });
    }

    // Duplicate start time prevented by DB unique constraint
    const session = await req.prisma.session.create({
      data: { title, startTime: start, maxCapacity: 20, adminId: req.user.id },
    });

    res.status(201).json(session);
  } catch (err) {
    // Prisma unique constraint violation
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A session already exists at this start time' });
    }
    next(err);
  }
});

module.exports = router;
