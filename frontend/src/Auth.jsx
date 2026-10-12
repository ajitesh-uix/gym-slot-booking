import { useState } from 'react';

function Auth() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <h1 className="auth-brand">FITBOOK</h1>
        <p className="auth-subtitle">
          {isLogin ? 'Welcome back — log in to continue' : 'Create your account'}
        </p>

        {/* Form */}
        <form onSubmit={(e) => e.preventDefault()}>
          {!isLogin && (
            <div className="auth-field">
              <label htmlFor="name">Full Name</label>
              <input id="name" type="text" placeholder="John Doe" required />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@example.com" required />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="••••••••" required />
          </div>

          <button type="submit" className="auth-submit">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        {/* Toggle login ↔ register */}
        <p className="auth-switch">
          {isLogin ? "Don't have an account? " : 'Already registered? '}
          <span className="auth-link" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Register' : 'Login'}
          </span>
        </p>

        {/* Back to home */}
        <button
          type="button"
          className="auth-back"
          onClick={() => window.location.reload()}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}

export default Auth;