import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, ShieldCheck, Timer } from 'lucide-react';
import { GymImage, images } from '../images';
import { useAuth } from '../authContext';

const lifts = [
  {
    title: 'Deadlift',
    blurb: 'Posterior-chain power with bar path focus and controlled tension.',
    src: images.deadlift,
    alt: 'Athlete performing a barbell deadlift in a gym',
  },
  {
    title: 'Bench Press',
    blurb: 'Upper-body strength built through stable setup and progressive loading.',
    src: images.bench,
    alt: 'Athlete performing a barbell bench press',
  },
  {
    title: 'Squats',
    blurb: 'Leg drive and bracing under the bar inside a full squat rack.',
    src: images.squat,
    alt: 'Athlete performing a barbell squat in a squat rack',
  },
];

const programs = [
  {
    title: 'Strength Training',
    text: 'Compound lifts, structured progression, and recoverable volume.',
    src: images.strength,
    alt: 'Athlete lifting heavy weights for strength training',
  },
  {
    title: 'Personal Training',
    text: 'One-to-one coaching cues tailored to your session goals.',
    src: images.personal,
    alt: 'Personal trainer coaching a client with dumbbells',
  },
  {
    title: 'Functional Fitness',
    text: 'Movement patterns that transfer to sport and daily performance.',
    src: images.functional,
    alt: 'Athlete doing functional fitness training with kettlebells',
  },
];

export default function Home() {
  const { user } = useAuth();
  const bookTo = user ? '/sessions' : '/auth';

  return (
    <>
      <section className="hero">
        <GymImage
          src={images.hero}
          alt="Athlete training intensely in a modern gym"
          className="hero-media"
        />
        <div className="hero-veil" />
        <div className="hero-content">
          <p className="brand-mark">FITBOOK</p>
          <h1>BUILT BY DISCIPLINE.</h1>
          <p className="hero-lead">
            Train smarter, protect your time, and build consistency with reserved gym sessions.
          </p>
          <div className="hero-ctas">
            <Link to={bookTo} className="btn btn-primary btn-lg">
              Book a Session <ArrowRight size={18} />
            </Link>
            <a href="#training" className="btn btn-outline btn-lg">
              Explore Training
            </a>
          </div>
        </div>
      </section>

      <section className="section highlights" aria-label="Platform highlights">
        <div className="highlight-grid">
          <article>
            <CalendarClock size={22} />
            <h3>Reserved sessions</h3>
            <p>One-hour slots with live seat counts from the booking API.</p>
          </article>
          <article>
            <Timer size={22} />
            <h3>Waitlist FIFO</h3>
            <p>Full sessions auto-queue you; cancellations promote the next member.</p>
          </article>
          <article>
            <ShieldCheck size={22} />
            <h3>Secure check-in</h3>
            <p>One-time codes, valid only during the session hour.</p>
          </article>
        </div>
      </section>

      <section className="section" id="lifts">
        <div className="section-head">
          <h2>Featured work</h2>
          <p>Three foundations of strength — photographed as they are trained.</p>
        </div>
        <div className="lift-grid">
          {lifts.map((lift) => (
            <article key={lift.title} className="lift-card">
              <GymImage src={lift.src} alt={lift.alt} className="lift-img" />
              <div className="lift-body">
                <h3>{lift.title}</h3>
                <p>{lift.blurb}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="training">
        <div className="section-head">
          <h2>Training programs</h2>
          <p>Choose a path. Book a session. Show up ready.</p>
        </div>
        <div className="program-grid">
          {programs.map((p) => (
            <article key={p.title} className="program-card">
              <GymImage src={p.src} alt={p.alt} className="program-img" />
              <div className="program-body">
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                <Link to="/programs" className="text-link">
                  View programs <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section facilities">
        <div className="split">
          <div>
            <h2>Facilities built for serious training</h2>
            <p>
              Free weights, racks, benches, and open floor space — environments designed for
              focused work, not distractions.
            </p>
            <ul className="plain-list">
              <li>Olympic platforms and squat racks</li>
              <li>Full free-weight and machine zones</li>
              <li>Open conditioning floor</li>
            </ul>
          </div>
          <GymImage
            src={images.facilities}
            alt="Gym floor with racks, free weights, and training equipment"
            className="split-img"
          />
        </div>
      </section>

      <section className="section community">
        <div className="split reverse">
          <GymImage
            src={images.community}
            alt="Group of athletes training together in a gym"
            className="split-img"
          />
          <div>
            <h2>Member experience</h2>
            <p>
              Book ahead, manage your waitlist status, and check in with a secure code when your
              session starts — all from one account.
            </p>
            <Link to={bookTo} className="btn btn-primary">
              Book a Session
            </Link>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <h2>Your next session is waiting.</h2>
        <p>Reserve a one-hour slot and protect the time you commit to training.</p>
        <Link to={bookTo} className="btn btn-primary btn-lg">
          Book a Session
        </Link>
      </section>
    </>
  );
}
