import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { GymImage, images } from '../images';
import { useAuth } from '../authContext';

const programs = [
  {
    title: 'Strength Training',
    subtitle: 'Progressive overload for the big lifts',
    body: 'Barbell-focused programming built around squat, bench, and deadlift variations. Sessions emphasize setup quality, recoverable volume, and measurable weekly progress.',
    src: images.strength,
    alt: 'Athlete performing strength training with a barbell',
  },
  {
    title: 'Beginner Fitness',
    subtitle: 'Build confidence before intensity',
    body: 'A guided on-ramp covering movement patterns, bracing, and session pacing. Ideal if you are returning to training or booking your first structured gym hour.',
    src: images.personal,
    alt: 'Coach guiding a beginner through a fitness session',
  },
  {
    title: 'Functional Training',
    subtitle: 'Move well under fatigue',
    body: 'Conditioning and multi-planar work using kettlebells, bodyweight, and open-floor drills — designed to transfer to sport and everyday performance.',
    src: images.functional,
    alt: 'Athlete performing functional fitness exercises',
  },
];

export default function Programs() {
  const { user } = useAuth();
  const bookTo = user ? '/sessions' : '/auth';

  return (
    <div className="page">
      <header className="page-hero">
        <p className="eyebrow">Training</p>
        <h1>Programs built for consistency</h1>
        <p>
          Informational tracks to frame your sessions. Book a live one-hour slot when you are
          ready to train.
        </p>
      </header>

      <div className="programs-stack">
        {programs.map((p, i) => (
          <article key={p.title} className={`program-feature ${i % 2 === 1 ? 'reverse' : ''}`}>
            <GymImage src={p.src} alt={p.alt} className="program-feature-img" />
            <div>
              <p className="eyebrow">{p.subtitle}</p>
              <h2>{p.title}</h2>
              <p>{p.body}</p>
              <Link to={bookTo} className="btn btn-primary">
                Book a Session <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
