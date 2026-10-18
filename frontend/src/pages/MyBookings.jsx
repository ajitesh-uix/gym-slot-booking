import { useEffect, useState } from 'react';
import { CalendarDays, KeyRound, XCircle } from 'lucide-react';
import { api } from '../api';

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function inSessionWindow(startTime) {
  const start = new Date(startTime).getTime();
  const end = start + 60 * 60 * 1000;
  const now = Date.now();
  return now >= start && now <= end;
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [codes, setCodes] = useState({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMyBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCancel(id) {
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      const result = await api.cancelBooking(id);
      setMessage(
        result.promoted
          ? `Booking #${result.cancelled} cancelled. Waitlist booking #${result.promoted} promoted.`
          : `Booking #${result.cancelled} cancelled.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCheckIn(booking) {
    setBusyId(booking.id);
    setError(null);
    setMessage(null);
    try {
      const data = await api.generateCheckIn(booking.id);
      setCodes((prev) => ({ ...prev, [booking.id]: data.code }));
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-hero">
        <p className="eyebrow">Account</p>
        <h1>My bookings</h1>
        <p>Confirmed, waitlisted, and cancelled reservations for your account.</p>
      </header>

      {message && <div className="banner success">{message}</div>}
      {error && <div className="banner error">{error}</div>}

      {loading ? (
        <p className="state">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <p className="state">You have no bookings yet. Reserve a session to get started.</p>
      ) : (
        <ul className="booking-list">
          {bookings.map((b) => {
            const canCancel =
              (b.status === 'CONFIRMED' || b.status === 'WAITLISTED') &&
              new Date(b.session.startTime) > new Date();
            const canCheckIn =
              b.status === 'CONFIRMED' &&
              inSessionWindow(b.session.startTime) &&
              !b.checkin?.used;
            const statusClass =
              b.status === 'CONFIRMED'
                ? 'ok'
                : b.status === 'WAITLISTED'
                  ? 'warn'
                  : 'muted';

            return (
              <li key={b.id} className="booking-row">
                <div>
                  <div className="row-top">
                    <h3>{b.session.title}</h3>
                    <span className={`pill ${statusClass}`}>{b.status}</span>
                  </div>
                  <p className="meta">
                    <CalendarDays size={14} /> {formatWhen(b.session.startTime)} · 60 min
                  </p>
                  {b.checkin?.used && (
                    <p className="subtle">Already checked in</p>
                  )}
                  {codes[b.id] && (
                    <p className="checkin-code">
                      <KeyRound size={16} /> Code: <strong>{codes[b.id]}</strong>
                    </p>
                  )}
                </div>
                <div className="session-actions">
                  {canCheckIn && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busyId === b.id}
                      onClick={() => handleCheckIn(b)}
                    >
                      {codes[b.id] ? 'Refresh code' : 'Get check-in code'}
                    </button>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busyId === b.id}
                      onClick={() => handleCancel(b.id)}
                    >
                      <XCircle size={16} />
                      {busyId === b.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
