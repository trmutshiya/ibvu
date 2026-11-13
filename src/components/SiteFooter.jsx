// IBVU v6.03 — what changed in this file: a "Read past issues" link under the newsletter sign-up.
//
// IBVU v6.02 — what changed in this file since v6.0:
// - The newsletter box asks which mailing lists to join (IBVU Monthly is
//   ticked to start with). The person then gets an email with a Confirm
//   button and is added only after pressing it.
// - "Subscribe to our newsletter" links elsewhere on a page scroll down to
//   this box with the matching list ticked (see openNewsletter in lists.js).
//
// IBVU v6.0 — what changed in this file: the newsletter sign-up now really saves the sign-up and emails hello@ibvu.org (through the server), after an invisible Cloudflare spam check.
//
// IBVU v5.92 — what changed in this file: a small "Privacy" link at the very bottom of the footer.
//
// IBVU v5.91 — what changed in this file since v5.9: the footer shows the IBVU
// logo (the round tree mark) in place of the "IBVU" wordmark. The logo can be
// swapped in admin → Pages → Newsletter and footer.
//
// IBVU v5.9 — what changed in this file: the newsletter wording, the footer line and the Herbarium disclaimer now come from admin → Pages (Newsletter and footer; Herbarium). Same wording as before until edited.
//
// IBVU v5.6 — what changed in this file since v5.3:
// - The newsletter form now checks the email address, shows a thank-you
//   message, and carries a consent line.
// - PREVIEW MODE: the sign-up is not sent or saved yet (see src/lib/messages.js).
// Unchanged: the small disclaimer shows only where `disclaimer` is switched on
// (the Educate pages), and the footer line.
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToNewsletter, isEmail } from '../lib/messages.js';
import { usePage, PREVIEW_MODE } from '../lib/content.js';
import { useTurnstile } from '../lib/turnstile.js';
import { MAILING_LISTS, listNames } from '../lib/lists.js';
import logoImg from '../assets/ibvu-logo.webp';

function Newsletter() {
  const c = usePage("site");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [lists, setLists] = useState(["monthly"]);
  const [source, setSource] = useState("newsletter box");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done | failed
  const [result, setResult] = useState({});
  const [failure, setFailure] = useState("");
  const spamCheck = useTurnstile();
  const sectionRef = useRef(null);
  const emailRef = useRef(null);
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  const toggle = key => setLists(ls => ls.includes(key) ? ls.filter(k => k !== key) : [...ls, key]);

  // "Subscribe to our newsletter" links: tick that list and bring the box into view.
  useEffect(() => {
    function open(e) {
      const list = e.detail && e.detail.list;
      if (list) setLists([list]);
      setSource(window.location.pathname + " link");
      setStatus(s => (s === "done" ? "idle" : s));
      if (sectionRef.current) sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => { if (emailRef.current) emailRef.current.focus({ preventScroll: true }); }, 600);
    }
    window.addEventListener("ibvu:newsletter", open);
    return () => window.removeEventListener("ibvu:newsletter", open);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!isEmail(form.email)) { setError("Please enter your email address."); return; }
    if (lists.length === 0) { setError("Please choose at least one thing to hear about."); return; }
    setError(""); setStatus("sending"); setFailure("");
    let token = "";
    if (!PREVIEW_MODE) {
      try { token = await spamCheck.getToken(); }
      catch (err) { setFailure(err.message); setStatus("failed"); return; }
    }
    const r = await subscribeToNewsletter({ ...form, lists, source }, token).catch(() => ({ ok: false }));
    setResult(r);
    if (!r.ok) setFailure(r.error || "");
    setStatus(r.ok ? "done" : "failed");
  }

  return (
    <section className="newsletter-section" id="newsletter" ref={sectionRef}>
      <div className="newsletter-inner">
        {c.newsletterEyebrow && <p className="newsletter-eyebrow">{c.newsletterEyebrow}</p>}
        <h2>{c.newsletterHeading}</h2>
        {c.newsletterTagline && <p className="newsletter-tagline">{c.newsletterTagline}</p>}

        {status === "done" ? (
          <div className="newsletter-form newsletter-done" role="status">
            {result.confirmSent === false
              ? <p className="newsletter-thanks">You're already on {listNames(lists)}. Thank you.</p>
              : <>
                  <p className="newsletter-thanks">{c.newsletterThanks}</p>
                  <p className="newsletter-note">We've sent an email to {form.email.trim()}. Press Confirm in it to start receiving {listNames(lists)}.</p>
                </>}
            {result.preview && result.confirmToken && (
              <p className="newsletter-note">Preview only: no email was sent. <Link to={"/newsletter/confirm?t=" + result.confirmToken}>Confirm now (preview)</Link></p>
            )}
          </div>
        ) : (
          <form className="newsletter-form" onSubmit={submit} noValidate>
            <div className="nf-row">
              <div className="nf-field">
                <label htmlFor="nl-fname">First Name</label>
                <input id="nl-fname" type="text" placeholder="First name" autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
              </div>
              <div className="nf-field">
                <label htmlFor="nl-lname">Last Name</label>
                <input id="nl-lname" type="text" placeholder="Last name" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
              </div>
            </div>
            <div className="nf-row">
              <div className="nf-field full">
                <label htmlFor="nl-email">Email</label>
                <input id="nl-email" ref={emailRef} type="email" placeholder="you@email.com" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!error} />
              </div>
            </div>
            <fieldset className="nf-lists">
              <legend>What would you like to hear about?</legend>
              {MAILING_LISTS.map(l => (
                <label className="nf-list" key={l.key}>
                  <input type="checkbox" checked={lists.includes(l.key)} onChange={() => toggle(l.key)} />
                  <span><strong>{l.name}</strong> {l.about}</span>
                </label>
              ))}
            </fieldset>
            {error && <p className="newsletter-error" role="alert">{error}</p>}
            {status === "failed" && <p className="newsletter-error" role="alert">{failure ? failure + " " : "Sorry, that did not work. "}If it keeps happening, email hello@ibvu.org.</p>}
            <div className="spam-check" ref={spamCheck.ref} />
            <button type="submit" className="newsletter-submit" disabled={status === "sending"}>{status === "sending" ? "Subscribing…" : c.newsletterButton}</button>
            {c.newsletterNote && <p className="newsletter-note">{c.newsletterNote}</p>}
            <p className="newsletter-past"><Link to="/newsletter">Read past issues →</Link></p>
          </form>
        )}
      </div>
    </section>
  );
}

export default function SiteFooter({ disclaimer = false }) {
  const c = usePage("site");
  const herbarium = usePage("herbarium");
  return (
    <>
      <Newsletter />
      <footer className="site-footer">
        <div className="footer-inner">
          <img className="footer-logo" src={c.footerLogo || logoImg} alt="IBVU. Regulate, Educate, Innovate." width="170" height="170" loading="lazy" />

          {disclaimer && herbarium.disclaimer && (
            <p className="disclaimer-small">
              <strong>Disclaimer</strong>
              {herbarium.disclaimer}
            </p>
          )}

          <div className="footer-bottom">{c.footerLine}</div>
          <p className="footer-links"><Link to="/privacy">Privacy</Link></p>
        </div>
      </footer>
    </>
  );
}
