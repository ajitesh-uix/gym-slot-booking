const express = require('express');
const { authenticate } = require('../middleware');

const router = express.Router();

// POST /api/bookings — book a session (or auto-join waitlist)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    // Use a serializable transaction to prevent overbooking
    const booking = await req.prisma.$transaction(
      async (tx) => {
        // Lock: fetch session
        const session = await tx.session.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          throw Object.assign(new Error('Session not found'), { status: 404 });
        }
        if (session.startTime <= new Date()) {
          throw Object.assign(new Error('Cannot book a past session'), {
            status: 400,
          });
        }

        // Prevent duplicate booking (same user + session, still active)
        const duplicate = await tx.booking.findFirst({
          where: {
            userId: req.user.id,
            sessionId,
            status: { in: ['CONFIRMED', 'WAITLISTED'] },
          },
        });
        if (duplicate) {
          throw Object.assign(
            new Error('You already have an active booking for this session'),
            { status: 409 }
          );
        }

        // Count confirmed bookings inside this transaction
        const confirmedCount = await tx.booking.count({
          where: { sessionId, status: 'CONFIRMED' },
        });

        const status =
          confirmedCount < session.maxCapacity ? 'CONFIRMED' : 'WAITLISTED';

        return tx.booking.create({
          data: { userId: req.user.id, sessionId, status },
          include: { session: true },
        });
      },
      { isolationLevel: 'Serializable' }
    );

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/mine — current user's bookings
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const bookings = await req.prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        session: true,
        checkin: { select: { used: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/bookings/:id — cancel + FIFO waitlist promotion
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id);
    if (isNaN(bookingId))
      return res.status(400).json({ error: 'Invalid booking ID' });

    const result = await req.prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { session: true },
        });

        if (!booking) {
          throw Object.assign(new Error('Booking not found'), { status: 404 });
        }
        if (booking.userId !== req.user.id) {
          throw Object.assign(new Error('Not your booking'), { status: 403 });
        }
        if (booking.status === 'CANCELLED') {
          throw Object.assign(new Error('Already cancelled'), { status: 400 });
        }
        if (booking.session.startTime <= new Date()) {
          throw Object.assign(
            new Error('Cannot cancel after session has started'),
            { status: 400 }
          );
        }

        // Cancel
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'CANCELLED' },
        });

        // If confirmed slot freed, promote first waitlisted (FIFO)
        let promoted = null;
        if (booking.status === 'CONFIRMED') {
          const nextInLine = await tx.booking.findFirst({
            where: { sessionId: booking.sessionId, status: 'WAITLISTED' },
            orderBy: { createdAt: 'asc' }, // FIFO
          });

          if (nextInLine) {
            await tx.booking.update({
              where: { id: nextInLine.id },
              data: { status: 'CONFIRMED' },
            });
            promoted = nextInLine.id;
          }
        }

        return { cancelled: bookingId, promoted };
      },
      { isolationLevel: 'Serializable' }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
