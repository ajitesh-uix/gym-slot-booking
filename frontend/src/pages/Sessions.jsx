import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Users } from 'lucide-react';
import { api } from '../api';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toInputDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [date, setDate] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [bookingId, setBookingId] = useState(null);

  async function load(filterDate = date) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSessions(filterDate || undefined);
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleBook(sessionId) {
    setBookingId(sessionId);
    setActionMsg(null);
    setError(null);
    try {
      const booking = await api.bookSession(sessionId);
      setActionMsg(
        booking.status === 'WAITLISTED'
          ? `Waitlisted for session #${sessionId}. You will be promoted if a seat opens.`
          : `Confirmed booking for session #${sessionId}.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBookingId(null);
    }
  }

  const visible = sessions.filter((s) => {
    if (availableOnly && s.availableSlots <= 0) return false;
    if (new Date(s.startTime) <= new Date()) return false;
    return true;
  });

  return (
    <div className="page">
      <header className="page-hero">
        <p className="eyebrow">Sessions</p>
        <h1>Book a workout</h1>
        <p>Live availability from the FITBOOK API — one-hour sessions, max 20 seats.</p>
      </header>

      <div className="toolbar">
        <label className="field-inline">
          <CalendarDays size={16} />
          <span>Date</span>
          <input
            type="date"
            value={date}
            min={toInputDate()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => load(date)}>
          Apply filter
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setDate('');
            load('');
          }}
        >
          Clear
        </button>
        <label className="check-inline">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Available seats only
        </label>
      </div>

      {actionMsg && <div className="banner success">{actionMsg}</div>}
      {error && <div className="banner error">{error}</div>}

      {loading ? (
        <p className="state">Loading sessions…</p>
      ) : visible.length === 0 ? (
        <p className="state">No upcoming sessions match your filters.</p>
      ) : (
        <ul className="session-list">
          {visible.map((s) => {
            const full = s.availableSlots <= 0;
            return (
              <li key={s.id} className="session-row">
                <div>
                  <h3>{s.title}</h3>
                  <p className="meta">
                    <span>
                      <CalendarDays size={14} /> {formatDate(s.startTime)}
                    </span>
                    <span>
                      <Clock size={14} /> {formatTime(s.startTime)} · 60 min
                    </span>
                    <span>
                      <Users size={14} /> {s.availableSlots}/{s.maxCapacity} seats
                    </span>
                  </p>
                  <p className="subtle">Hosted by {s.adminName}</p>
                </div>
                <div className="session-actions">
                  <span className={`pill ${full ? 'warn' : 'ok'}`}>
                    {full ? 'Waitlist' : 'Open'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={bookingId === s.id}
                    onClick={() => handleBook(s.id)}
                  >
                    {bookingId === s.id ? 'Booking…' : full ? 'Join waitlist' : 'Book'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
