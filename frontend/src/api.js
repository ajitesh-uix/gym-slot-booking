const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  register: (body) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getSessions: (date) =>
    request(date ? `/sessions?date=${encodeURIComponent(date)}` : '/sessions'),
  getSession: (id) => request(`/sessions/${id}`),
  createSession: (body) =>
    request('/sessions', { method: 'POST', body: JSON.stringify(body) }),
  getMyBookings: () => request('/bookings/mine'),
  bookSession: (sessionId) =>
    request('/bookings', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),
  cancelBooking: (id) => request(`/bookings/${id}`, { method: 'DELETE' }),
  generateCheckIn: (bookingId) =>
    request(`/checkin/generate/${bookingId}`, { method: 'POST' }),
  validateCheckIn: (code, bookingId) =>
    request('/checkin/validate', {
      method: 'POST',
      body: JSON.stringify({ code, bookingId }),
    }),
};

export function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function loadUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
