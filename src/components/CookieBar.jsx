// IBVU v6.09 — what changed in this file: the bar is now a smaller card in the
// bottom-left corner (full width on a phone). Text first, then the Cookie Policy link,
// then Accept All and Reject All side by side underneath. Same brown (#3d2c1e).
//
// IBVU v6.08 — what changed in this file: new wording (paragraphs allowed), Accept All
// first, then Reject All (same size and style), and a "Cookie Policy" link that opens
// the cookie section of the Privacy page.
//
// IBVU v6.07 — new file. The cookie bar: asks once whether Google Analytics may
// be used (see src/lib/analytics.js). Accept and Reject are equally easy, as UK
// rules expect. Nothing is collected unless the visitor accepts. "Cookie
// settings" in the footer opens the bar again so the choice can be changed.
// Not shown in admin, or in the double-click preview file. The wording is
// editable in admin → Pages → Newsletter and footer.
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { needsChoice, setConsent, getConsent } from '../lib/analytics.js';
import { usePage } from '../lib/content.js';

export function openCookieSettings() { window.dispatchEvent(new CustomEvent("ibvu:cookies")); }

export default function CookieBar() {
  const { pathname } = useLocation();
  const c = usePage("site");
  const [open, setOpen] = useState(() => needsChoice(pathname));
  const [asked, setAsked] = useState(false); // opened from "Cookie settings"

  useEffect(() => { if (!asked) setOpen(needsChoice(pathname)); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const reopen = () => { setAsked(true); setOpen(true); };
    window.addEventListener("ibvu:cookies", reopen);
    return () => window.removeEventListener("ibvu:cookies", reopen);
  }, []);

  if (!open || /^\/admin(\/|$)/.test(pathname)) return null;
  const choose = choice => { setConsent(choice); setOpen(false); setAsked(false); };
  const current = getConsent();
  return (
    <div className="cookie-bar" role="region" aria-label="Cookie choice">
      <div className="cookie-text">
        {String(c.cookieText || "").split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
        <p className="cookie-links">
          <Link to="/privacy#analytics-and-cookies">{c.cookieLink || "Cookie Policy"}</Link>
          {asked && current && <span className="cookie-now"> · You chose: {current === "granted" ? c.cookieAccept || "Accept" : c.cookieReject || "Reject"}.</span>}
        </p>
      </div>
      <div className="cookie-actions">
        <button type="button" className="cookie-btn" onClick={() => choose("granted")}>{c.cookieAccept || "Accept All"}</button>
        <button type="button" className="cookie-btn" onClick={() => choose("denied")}>{c.cookieReject || "Reject All"}</button>
      </div>
    </div>
  );
}
