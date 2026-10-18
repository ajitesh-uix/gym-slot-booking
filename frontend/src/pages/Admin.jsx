import { useEffect, useState } from 'react';
import { CalendarPlus, RefreshCw } from 'lucide-react';
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

function defaultStartLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setMinutes(0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

export default function Admin() {
  const [sessions, setSessions] = useState([]);
  const [title, setTitle] = useState('Open Gym');
  const [startTime, setStartTime] = useState(defaultStartLocal());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.createSession({
        title,
        startTime: new Date(startTime).toISOString(),
      });
      setMessage(`Created session #${created.id}: ${created.title}`);
      setTitle('Open Gym');
      setStartTime(defaultStartLocal());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <header className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Session dashboard</h1>
        <p>
          Create one-hour sessions (capacity 20). Duplicate start times are rejected by the API.
        </p>
      </header>

      <form className="admin-form" onSubmit={handleCreate}>
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
          />
        </label>
        <label className="field">
          <span>Start time</span>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <CalendarPlus size={16} />
          {submitting ? 'Creating…' : 'Create session'}
        </button>
      </form>

      {message && <div className="banner success">{message}</div>}
      {error && <div className="banner error">{error}</div>}

      <div className="toolbar">
        <h2 className="subhead">Existing sessions</h2>
        <button type="button" className="btn btn-ghost" onClick={load}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="state">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="state">No sessions yet.</p>
      ) : (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id} className="session-row">
              <div>
                <h3>
                  #{s.id} · {s.title}
                </h3>
                <p className="meta">{formatWhen(s.startTime)} · 60 min</p>
                <p className="subtle">
                  {s.confirmedCount} confirmed · {s.availableSlots} available / {s.maxCapacity}
                </p>
              </div>
              <span className={`pill ${s.availableSlots > 0 ? 'ok' : 'warn'}`}>
                {s.availableSlots > 0 ? 'Open' : 'Full'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
