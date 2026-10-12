const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware');

const router = express.Router();

// POST /api/checkin/generate/:bookingId — generate one-time code
router.post('/generate/:bookingId', authenticate, async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    if (isNaN(bookingId))
      return res.status(400).json({ error: 'Invalid booking ID' });

    const booking = await req.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { session: true, checkin: true },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id)
      return res.status(403).json({ error: 'Not your booking' });
    if (booking.status !== 'CONFIRMED')
      return res.status(400).json({ error: 'Only confirmed bookings can check in' });

    // Must be during the session hour
    const now = new Date();
    const sessionEnd = new Date(
      booking.session.startTime.getTime() + 60 * 60 * 1000
    );
    if (now < booking.session.startTime || now > sessionEnd) {
      return res
        .status(400)
        .json({ error: 'Check-in is only available during the session hour' });
    }

    // Already used?
    if (booking.checkin?.used) {
      return res.status(400).json({ error: 'Already checked in' });
    }

    // Generate secure random code, store its hash
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F1B90C"
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    await req.prisma.checkIn.upsert({
      where: { bookingId },
      update: { codeHash, used: false },
      create: { bookingId, codeHash },
    });

    res.json({ code, message: 'Show this code at the gym front desk' });
  } catch (err) {
    next(err);
  }
});

// POST /api/checkin/validate — staff validates a check-in code
router.post('/validate', authenticate, async (req, res, next) => {
  try {
    const { code, bookingId } = req.body;
    if (!code || !bookingId) {
      return res.status(400).json({ error: 'code and bookingId are required' });
    }

    const checkin = await req.prisma.checkIn.findUnique({
      where: { bookingId: parseInt(bookingId) },
      include: { booking: { include: { session: true } } },
    });

    if (!checkin) return res.status(404).json({ error: 'No check-in code found' });
    if (checkin.used) return res.status(400).json({ error: 'Code already used' });

    // Must be during session hour
    const now = new Date();
    const sessionEnd = new Date(
      checkin.booking.session.startTime.getTime() + 60 * 60 * 1000
    );
    if (now < checkin.booking.session.startTime || now > sessionEnd) {
      return res.status(400).json({ error: 'Code only valid during the session hour' });
    }

    // Compare hashes
    const inputHash = crypto.createHash('sha256').update(code).digest('hex');
    if (inputHash !== checkin.codeHash) {
      return res.status(401).json({ error: 'Invalid code' });
    }

    // Mark as used (one-time)
    await req.prisma.checkIn.update({
      where: { id: checkin.id },
      data: { used: true },
    });

    res.json({ message: 'Check-in successful!' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
