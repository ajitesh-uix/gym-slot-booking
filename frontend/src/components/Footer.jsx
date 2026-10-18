import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand">FITBOOK</span>
          <p>Book smarter. Train harder. Build consistency one session at a time.</p>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/programs">Training</Link>
          <Link to="/sessions">Sessions</Link>
          <Link to="/bookings">My Bookings</Link>
          <Link to="/auth">Log in</Link>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} FITBOOK. Built for focused training.</p>
      </div>
    </footer>
  );
}
