// IBVU v5.92 — new file. The Privacy page: ibvu.org/privacy.
// Its wording is edited in admin → Pages → Privacy. The built-in wording is a
// draft to be checked by someone qualified before the site goes live.
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import { usePageTitle } from '../lib/site.js';
import { usePage, PREVIEW_MODE } from '../lib/content.js';

export default function Privacy() {
  const c = usePage("privacy");
  usePageTitle(c.heading || "Privacy", c.lead);
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <div className="page-header">
          <p className="page-eyebrow">✦ IBVU ✦</p>
          <h1>{c.heading}</h1>
          {c.lead && <p className="page-lead">{c.lead}</p>}
        </div>
        <div className="plain-page">
          {PREVIEW_MODE && <p className="preview-note">Draft for review: this wording has not yet been checked by someone qualified.</p>}
          {c.updated && <p className="plain-page-date">{c.updated}</p>}
          {c.sections.map((s, i) => (
            <section key={i}>
              {s.title && <h2>{s.title}</h2>}
              {String(s.text || "").split(/\n\s*\n/).map((para, j) => <p key={j}>{para}</p>)}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
