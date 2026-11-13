// IBVU v5.9 — what changed in this file since v5.6:
// - The introduction and the three cards' wording (and, optionally, their
//   photos) now come from admin → Pages → Home. Until someone edits them the
//   page shows exactly the same wording and photos as before.
// - Where each card leads is fixed: Regulate page, Herbarium, Innovate page.
import { Link } from 'react-router-dom';
import regulateImg from '../assets/pillar-regulate.jpg';
import educateImg from '../assets/pillar-educate.jpg';
import innovateImg from '../assets/pillar-innovate.jpg';
import { usePage } from '../lib/content.js';
import Emph from './Emph.jsx';

// The fixed part of each card, in the same order as the wording in admin.
const CARDS = [
  { id: "regulate", image: regulateImg, alt: "Hands typing on a laptop at a desk", to: "/regulate" },
  { id: "educate",  image: educateImg,  alt: "A lecturer speaking with students in a lecture hall" },
  { id: "innovate", image: innovateImg, alt: "Two scientists in a laboratory examining plant samples in test tubes", to: "/innovate" },
];

export default function PillarsSection({ onEducation }) {
  const c = usePage("home");
  const pillars = CARDS.map((card, i) => ({ ...card, ...(c.pillars[i] || {}), image: (c.pillars[i] && c.pillars[i].image) || card.image, custom: !!(c.pillars[i] && c.pillars[i].image) }));

  return (
    <section className="pillars-section" id="pillars">
      <div className="pillars-intro">
        <div className="pillars-rule" />
        <p className="pillars-lead">{c.lead}</p>
        <p className="pillars-sub"><Emph text={c.sub} as="span" /></p>
      </div>

      <div className="pillars-grid">
        {pillars.map(p => (
          <article className="pillar-card" id={"pillar-" + p.id} key={p.id}>
            <div className="pillar-image">
              <img src={p.image} alt={p.custom ? "" : p.alt} width="900" height="600" loading="lazy" />
            </div>
            <div className="pillar-text">
              <h2 className="pillar-title">{p.title}</h2>
              <p className="pillar-tagline">{p.tagline}</p>
              <p className="pillar-body">{p.text}</p>
              {p.to
                ? <Link className="pillar-link" to={p.to}>{p.linkLabel} →</Link>
                : <button className="pillar-link" onClick={onEducation}>{p.linkLabel} →</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
