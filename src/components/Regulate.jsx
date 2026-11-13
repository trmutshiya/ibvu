// IBVU v6.04 — what changed in this file: the "coming soon" picture is shown as framed in admin.
//
// IBVU v5.6 — what changed in this file since v5.5:
// - The wording, the list of services and the "coming soon" tile now come from
//   the editable page content (admin → Pages → Regulate). The built-in wording
//   in src/content/defaults.js is used until someone edits it.
// - The enquiry buttons open the new Contact page with "Advisory services"
//   already selected (they used to open the Contact pop-up).
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import Banner from './Banner.jsx';
import { usePageTitle, useSite } from '../lib/site.js';
import { usePage } from '../lib/content.js';
import advisoryImg from '../assets/regulate-advisory.jpg';
import labImg from '../assets/regulate-lab.jpg';
import Framed from './Framed.jsx';

export default function Regulate() {
  usePageTitle("Regulate");
  const { openContact } = useSite();
  const c = usePage("regulate");
  return (
    <div className="page-shell">
      <SiteHeader />
      <Banner />
      <main className="page-main">

        <section className="product-layout regulate-intro">
          <div className="product-image">
            <img src={advisoryImg} alt="A team in a meeting room discussing work around a table" width="848" height="848" />
          </div>
          <div className="product-text">
            <p className="page-eyebrow">✦ Regulate ✦</p>
            <h1>{c.heading}</h1>
            <p className="product-body">{c.intro}</p>
            {c.buttonLabel && <button className="buy-btn" onClick={() => openContact("advisory")}>{c.buttonLabel}</button>}
          </div>
        </section>

        {c.services.length > 0 && (
          <section className="services-section" aria-labelledby="services-heading">
            <h2 className="section-heading" id="services-heading">{c.servicesHeading}</h2>
            <ol className="services-list">
              {c.services.map((s, i) => (
                <li key={i}>
                  <span className="service-number">{i + 1}</span>
                  <div>
                    <h3 className="service-name">{s.name}</h3>
                    <p className="service-text">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {c.soonTitle && (
          <section className="soon-feature" aria-labelledby="soon-heading">
            <div className="soon-feature-image">
              <Framed value={c.soonImage} fallback={labImg} alt="Laboratory flasks and beakers, two holding sprigs of green leaves" width="1080" height="720" loading="lazy" />
            </div>
            <div className="soon-feature-text">
              {c.soonLabel && <span className="shop-soon-label">{c.soonLabel}</span>}
              <h2 className="soon-feature-title" id="soon-heading">{c.soonTitle}</h2>
              <p className="product-body">{c.soonText}</p>
              {c.soonList.length > 0 && (
                <>
                  <p className="product-list-title">{c.soonListHeading}</p>
                  <ul className="product-list">
                    {c.soonList.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </>
              )}
            </div>
          </section>
        )}

        {c.buttonLabel && (
          <div className="page-cta">
            <button className="buy-btn" onClick={() => openContact("advisory")}>{c.buttonLabel}</button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
