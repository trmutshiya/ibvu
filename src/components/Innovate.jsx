// IBVU v5.6 — new file.
// The Innovate page: ibvu.org/innovate
//   - the IBVU banner
//   - heading, subtitle and introduction beside the laboratory photo
//   - "Our platforms" tiles (Herbarium Scientifica, AI Discovery Platform)
//   - "Research and development" tiles (In Vitro Research, Research Collaborations)
//   - a button to the Contact page
// The wording and tiles come from the editable page content (admin → Pages →
// Innovate); the built-in wording is in src/content/defaults.js.
import { Link } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import Banner from './Banner.jsx';
import { usePageTitle, useSite } from '../lib/site.js';
import { usePage } from '../lib/content.js';
import labImg from '../assets/pillar-innovate.jpg';

// A link that works for both pages on this site ("/educate/hs") and outside addresses ("https://…").
export function SmartLink({ to, className, children }) {
  if (/^https?:\/\//i.test(to) || to.startsWith("mailto:")) return <a className={className} href={to}>{children}</a>;
  return <Link className={className} to={to}>{children}</Link>;
}

function Tile({ tile }) {
  return (
    <article className="info-tile">
      {tile.status && <span className="shop-soon-label">{tile.status}</span>}
      <h3 className="info-tile-title">{tile.title}</h3>
      {tile.tagline && <p className="info-tile-tagline">{tile.tagline}</p>}
      <p className="info-tile-text">{tile.text}</p>
      {tile.link && tile.linkLabel && <SmartLink className="pillar-link" to={tile.link}>{tile.linkLabel} →</SmartLink>}
    </article>
  );
}

export default function Innovate() {
  usePageTitle("Innovate");
  const { openContact } = useSite();
  const c = usePage("innovate");
  return (
    <div className="page-shell">
      <SiteHeader />
      <Banner />
      <main className="page-main">

        <section className="product-layout innovate-intro">
          <div className="product-image">
            <img src={labImg} alt="Two scientists in a laboratory examining plant samples in test tubes" width="900" height="600" />
          </div>
          <div className="product-text">
            <p className="page-eyebrow">✦ {c.heading} ✦</p>
            <h1>{c.subtitle}</h1>
            <p className="product-body">{c.intro}</p>
          </div>
        </section>

        {c.platforms.length > 0 && (
          <section className="tile-section">
            <h2 className="section-heading">{c.platformsHeading}</h2>
            <div className="info-tile-grid">{c.platforms.map((t, i) => <Tile tile={t} key={i} />)}</div>
          </section>
        )}

        {c.research.length > 0 && (
          <section className="tile-section">
            <h2 className="section-heading">{c.researchHeading}</h2>
            <div className="info-tile-grid">{c.research.map((t, i) => <Tile tile={t} key={i} />)}</div>
          </section>
        )}

        {c.buttonLabel && (
          <div className="page-cta">
            <button className="buy-btn" onClick={() => openContact("research")}>{c.buttonLabel}</button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
