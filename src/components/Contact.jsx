// IBVU v6.02 — what changed in this file since v6.0: an optional tick, "Send
// me occasional updates about …", which appears once an enquiry type is
// chosen. It adds the person (after they confirm by email) to the mailing list
// that matches the enquiry, for example Services for businesses for an
// advisory enquiry. Without the tick nobody is added to any list.
//
// IBVU v6.0 — what changed in this file: the form now really sends (to hello@ibvu.org, through the server), after an invisible Cloudflare spam check. If the check needs a tick, a small box appears above the Send button.
//
// IBVU v5.9 — what changed in this file: the heading, the lines around it, the button wording and the thank-you heading now come from admin → Pages → Contact (same wording as before until edited).
//
// IBVU v5.6 — new file.
// The Contact page: ibvu.org/contact
// A form (name, email, organisation, enquiry type, message) that will be sent
// to hello@ibvu.org. It replaces the Contact pop-up. Links elsewhere on the
// site can pre-select the enquiry type, for example ibvu.org/contact?type=research.
//
// PREVIEW MODE: the form checks what is typed and shows the thank-you screen,
// but nothing is sent yet (see src/lib/messages.js).
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import { usePageTitle } from '../lib/site.js';
import { ENQUIRY_TYPES, CONTACT_EMAIL, sendEnquiry, isEmail } from '../lib/messages.js';
import { usePage, PREVIEW_MODE } from '../lib/content.js';
import { useTurnstile } from '../lib/turnstile.js';
import { LIST_FOR_ENQUIRY, listName } from '../lib/lists.js';
import { Link } from 'react-router-dom';

export default function Contact() {
  const c = usePage("contact");
  usePageTitle(c.heading || "Contact", c.lead);
  const [params] = useSearchParams();
  const asked = params.get("type");
  const [form, setForm] = useState({
    name: "", email: "", organisation: "",
    type: ENQUIRY_TYPES.some(t => t.id === asked) ? asked : "",
    message: "",
    wantsUpdates: false,
  });
  const [sent, setSent] = useState({});
  const updatesList = LIST_FOR_ENQUIRY[form.type];
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | sent | failed
  const [wasPreview, setWasPreview] = useState(false);
  const [failure, setFailure] = useState("");
  const spamCheck = useTurnstile();

  function set(key) { return e => setForm(f => ({ ...f, [key]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    const problems = {};
    if (!form.name.trim()) problems.name = "Please tell us your name.";
    if (!isEmail(form.email)) problems.email = "Please enter an email address we can reply to.";
    if (!form.type) problems.type = "Please choose the type of enquiry.";
    if (!form.message.trim()) problems.message = "Please write your message.";
    setErrors(problems);
    if (Object.keys(problems).length) {
      const first = document.getElementById("contact-" + Object.keys(problems)[0]);
      if (first) first.focus();
      return;
    }
    setStatus("sending"); setFailure("");
    let token = "";
    if (!PREVIEW_MODE) {
      try { token = await spamCheck.getToken(); }
      catch (err) { setFailure(err.message); setStatus("failed"); return; }
    }
    const result = await sendEnquiry({ ...form, wantsUpdates: !!(form.wantsUpdates && updatesList) }, token).catch(() => ({ ok: false }));
    setWasPreview(!!result.preview);
    setSent(result);
    if (!result.ok) setFailure(result.error || "");
    setStatus(result.ok ? "sent" : "failed");
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <div className="page-header">
          {c.eyebrow && <p className="page-eyebrow">✦ {c.eyebrow} ✦</p>}
          <h1>{c.heading}</h1>
          {c.lead && <p className="page-lead">{c.lead}</p>}
        </div>

        {status === "sent" ? (
          <div className="soon-panel" role="status">
            <h2>{c.thanksHeading}</h2>
            <p>We have your message and will reply to {form.email.trim()}.</p>
            {sent.confirmSent && <p>We've also sent you an email to confirm your subscription to {listName(updatesList)}.</p>}
            {wasPreview && <p className="preview-note">Preview only: nothing was sent.{sent.confirmToken ? <> <Link to={"/newsletter/confirm?t=" + sent.confirmToken}>Confirm the subscription now (preview)</Link></> : null}</p>}
          </div>
        ) : (
          <form className="site-form" onSubmit={submit} noValidate>
            <div className="site-form-row">
              <div className="site-field">
                <label htmlFor="contact-name">Name</label>
                <input id="contact-name" type="text" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} />
                {errors.name && <p className="site-field-error">{errors.name}</p>}
              </div>
              <div className="site-field">
                <label htmlFor="contact-email">Email</label>
                <input id="contact-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} />
                {errors.email && <p className="site-field-error">{errors.email}</p>}
              </div>
            </div>
            <div className="site-form-row">
              <div className="site-field">
                <label htmlFor="contact-organisation">Organisation <span className="optional">(optional)</span></label>
                <input id="contact-organisation" type="text" autoComplete="organization" value={form.organisation} onChange={set("organisation")} />
              </div>
              <div className="site-field">
                <label htmlFor="contact-type">Enquiry type</label>
                <select id="contact-type" value={form.type} onChange={set("type")} aria-invalid={!!errors.type}>
                  <option value="">Please choose…</option>
                  {ENQUIRY_TYPES.map(t => <option value={t.id} key={t.id}>{t.label}</option>)}
                </select>
                {errors.type && <p className="site-field-error">{errors.type}</p>}
              </div>
            </div>
            <div className="site-field">
              <label htmlFor="contact-message">Message</label>
              <textarea id="contact-message" rows="7" value={form.message} onChange={set("message")} aria-invalid={!!errors.message} />
              {errors.message && <p className="site-field-error">{errors.message}</p>}
            </div>

            {updatesList && (
              <label className="consent-row contact-updates">
                <input type="checkbox" checked={form.wantsUpdates} onChange={e => setForm(f => ({ ...f, wantsUpdates: e.target.checked }))} />
                <span>Send me occasional updates about {listName(updatesList)}. I'll confirm by email, and can unsubscribe at any time.</span>
              </label>
            )}

            {status === "failed" && (
              <p className="site-form-failed" role="alert">
                {failure ? failure + " " : "Sorry, your message could not be sent. "}If it keeps happening, please email us at <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>.
              </p>
            )}

            <div className="spam-check" ref={spamCheck.ref} />

            <button className="buy-btn" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : c.buttonLabel}</button>
            <p className="site-form-note">We will only use your details to reply to your enquiry. You can also email <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>.</p>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
