import { useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../authContext';
import { GymImage, images } from '../images';

export default function Auth() {
  const [params] = useSearchParams();
  const startRegister = params.get('mode') === 'register';
  const [isLogin, setIsLogin] = useState(!startRegister);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/sessions';

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = isLogin
        ? await api.login({ email, password })
        : await api.register({ name, email, password });
      login(data.token, data.user);
      navigate(data.user.role === 'ADMIN' ? '/admin' : redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-visual">
        <GymImage
          src={images.auth}
          alt="Athlete training with a barbell in a dark gym"
          className="auth-visual-img"
        />
        <div className="auth-visual-copy">
          <p className="brand-mark">FITBOOK</p>
          <h2>Show up. Train. Repeat.</h2>
        </div>
      </div>

      <div className="auth-panel">
        <Link to="/" className="auth-home-link">
          ← Back to Home
        </Link>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-lead">
          {isLogin
            ? 'Log in to browse sessions and manage bookings.'
            : 'Register as a member. Admin accounts are provisioned separately.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {!isLogin && (
            <label className="field">
              <span>Full name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Lee"
                required
                autoComplete="name"
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <div className="banner error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Register'}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account? " : 'Already registered? '}
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
          >
            {isLogin ? 'Register' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
