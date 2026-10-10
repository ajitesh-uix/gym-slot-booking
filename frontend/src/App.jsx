import './App.css';

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <h2>FITBOOK</h2>
        <div>
          <a href="#home">Home</a>
          <a href="#slots">Book Slots</a>
          <a href="#about">About</a>
        </div>
        <button className="login">Login</button>
      </nav>

      <main className="hero" id="home">
        <div className="hero-text">
          <p className="tag">YOUR FITNESS, YOUR SCHEDULE</p>
          <h1>
            Train Better.
            <br />
            <span>Book Smarter.</span>
          </h1>
          <p className="description">
            Reserve your gym time in seconds.
            Skip the waiting and focus on your goals.
          </p>
          <a className="book-btn" href="#slots">
            Book Your Slot →
          </a>
        </div>

        <div className="hero-card">
          <img src="/gym-guy.png" alt="Gym athlete" className="hero-card-img" />
          <h2>MAKE EVERY<br />WORKOUT COUNT</h2>
          <p>Your next session starts here.</p>
        </div>
      </main>

      <section className="features" id="slots">
        <h2>Why FITBOOK?</h2>
        <div className="feature-grid">
          <article>
            <span>📅</span>
            <h3>Easy Booking</h3>
            <p>Choose a time that fits your day.</p>
          </article>
          <article>
            <span>⏱️</span>
            <h3>Save Time</h3>
            <p>Spend less time waiting for equipment.</p>
          </article>
          <article>
            <span>💪</span>
            <h3>Stay Consistent</h3>
            <p>Make fitness part of your routine.</p>
          </article>
        </div>
      </section>

      <footer id="about">
        FITBOOK — Your fitness, on your schedule.
      </footer>
    </div>
  );
}

export default App;