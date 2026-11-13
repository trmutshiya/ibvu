// IBVU v6.02 — new file. The two pages behind the links in mailing list emails:
//   ibvu.org/newsletter/confirm?t=…  "Confirm": the person is added to the
//                                    lists they asked for.
//   ibvu.org/unsubscribe?t=…         the person chooses which lists to stay
//                                    on, or leaves all of them.
// Each link carries a private token, so nobody can confirm or unsubscribe
// someone else. These pages are not listed for search engines.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import { usePageTitle } from '../lib/site.js';
import { confirmSubscription, unsubscribeInfo, unsubscribe } from '../lib/messages.js';
import { MAILING_LISTS, listNames } from '../lib/lists.js';

function Shell({ title, children }) {
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <div className="page-header">
          <p className="page-eyebrow">✦ IBVU ✦</p>
          <h1>{title}</h1>
        </div>
        <div className="soon-panel subscription-panel">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function NewsletterConfirm() {
  usePageTitle("Confirm your subscription");
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const [state, setState] = useState({ status: "working" });

  useEffect(() => {
    if (!token) { setState({ status: "bad" }); return; }
    let live = true;
    confirmSubscription(token).then(r => { if (live) setState(r && r.ok ? { status: "done", lists: r.lists || [] } : { status: "bad", error: r && r.error }); })
      .catch(() => live && setState({ status: "bad" }));
    return () => { live = false; };
  }, [token]);

  return (
    <Shell title="Your subscription">
      {state.status === "working" && <p>Confirming…</p>}
      {state.status === "done" && (
        <>
          <h2>Thank you, you're subscribed</h2>
          <p>{state.lists.length ? "You'll receive: " + listNames(state.lists) + "." : "You're all set."} Every email has a link to unsubscribe.</p>
          <Link className="page-back" to="/">← IBVU home</Link>
        </>
      )}
      {state.status === "bad" && (
        <>
          <h2>This link did not work</h2>
          <p>{state.error || "It may have been copied incompletely."} You can sign up again with the newsletter box below.</p>
        </>
      )}
    </Shell>
  );
}

export function Unsubscribe() {
  usePageTitle("Your email preferences");
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const [state, setState] = useState({ status: "loading" });
  const [keep, setKeep] = useState([]);

  useEffect(() => {
    if (!token) { setState({ status: "bad" }); return; }
    let live = true;
    unsubscribeInfo(token).then(r => {
      if (!live) return;
      if (r && r.ok) { setState({ status: "choose", email: r.email, lists: r.lists || [] }); setKeep(r.lists || []); }
      else setState({ status: "bad", error: r && r.error });
    }).catch(() => live && setState({ status: "bad" }));
    return () => { live = false; };
  }, [token]);

  async function save(keepLists) {
    setState(s => ({ ...s, status: "saving" }));
    const r = await unsubscribe(token, keepLists).catch(() => ({ ok: false }));
    setState(s => r && r.ok ? { ...s, status: "saved", lists: r.lists || [] } : { ...s, status: "choose", error: (r && r.error) || "That did not work. Please try again." });
  }

  const subscribed = MAILING_LISTS.filter(l => (state.lists || []).includes(l.key));
  return (
    <Shell title="Your email preferences">
      {state.status === "loading" && <p>Loading…</p>}
      {state.status === "bad" && (
        <>
          <h2>This link did not work</h2>
          <p>{state.error || "It may have been copied incompletely."} To unsubscribe, use the link in any of our emails, or email <a href="mailto:hello@ibvu.org">hello@ibvu.org</a>.</p>
        </>
      )}
      {(state.status === "choose" || state.status === "saving") && (
        subscribed.length === 0 ? (
          <><h2>You're not subscribed to anything</h2><p>{state.email} is not on any of our mailing lists.</p></>
        ) : (
          <div className="subscription-choices">
            <p>Emails to <strong>{state.email}</strong>. Untick what you no longer want.</p>
            {subscribed.map(l => (
              <label className="consent-row" key={l.key}>
                <input type="checkbox" checked={keep.includes(l.key)} onChange={e => setKeep(k => e.target.checked ? [...k, l.key] : k.filter(x => x !== l.key))} />
                <span><strong>{l.name}</strong>: {l.about}</span>
              </label>
            ))}
            {state.error && <p className="site-form-failed" role="alert">{state.error}</p>}
            <div className="subscription-actions">
              <button type="button" className="buy-btn" disabled={state.status === "saving"} onClick={() => save(keep)}>Save my choices</button>
              <button type="button" className="text-link" disabled={state.status === "saving"} onClick={() => save([])}>Unsubscribe from everything</button>
            </div>
          </div>
        )
      )}
      {state.status === "saved" && (
        state.lists.length
          ? <><h2>Saved</h2><p>You'll now receive: {listNames(state.lists)}.</p></>
          : <><h2>You've been unsubscribed</h2><p>You won't receive any more emails from our mailing lists.</p></>
      )}
    </Shell>
  );
}
