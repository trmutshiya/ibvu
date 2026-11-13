// IBVU v6.08 — what changed in this file: each section has its own address (for example
// ibvu.org/privacy#analytics-and-cookies), so the cookie bar's link opens the right part.
//
// IBVU v5.92 — new file. The Privacy page: ibvu.org/privacy.
// Its wording is edited in admin → Pages → Privacy. The built-in wording is a
// draft to be checked by someone qualified before the site goes live.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import { usePageTitle } from '../lib/site.js';
import { usePage, PREVIEW_MODE } from '../lib/content.js';
import { slugify } from '../lib/slug.js';

export default function Privacy() {
  const c = usePage("privacy");
  usePageTitle(c.heading || "Privacy", c.lead);
  // ibvu.org/privacy#analytics-and-cookies opens at that section (the cookie bar links there).
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => { const el = document.getElementById(decodeURIComponent(hash.slice(1))); if (el) el.scrollIntoView({ block: "start" }); }, 50);
    return () => clearTimeout(t);
  }, [hash]);
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
            <section key={i} id={s.title ? slugify(s.title) : undefined}>
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
