import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../authContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    setOpen(false);
    navigate('/');
  }

  const linkClass = ({ isActive }) =>
    `nav-link${isActive ? ' is-active' : ''}`;

  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          FITBOOK
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav className={`nav-links${open ? ' is-open' : ''}`}>
          <NavLink to="/" end className={linkClass} onClick={() => setOpen(false)}>
            Home
          </NavLink>
          <NavLink to="/programs" className={linkClass} onClick={() => setOpen(false)}>
            Training
          </NavLink>
          {user && (
            <>
              <NavLink to="/sessions" className={linkClass} onClick={() => setOpen(false)}>
                Sessions
              </NavLink>
              <NavLink to="/bookings" className={linkClass} onClick={() => setOpen(false)}>
                My Bookings
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>
                  Admin
                </NavLink>
              )}
            </>
          )}
          <div className="nav-actions">
            {user ? (
              <>
                <span className="nav-user">{user.name}</span>
                <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/auth" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Log in
                </Link>
                <Link to="/auth?mode=register" className="btn btn-primary" onClick={() => setOpen(false)}>
                  Join
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
