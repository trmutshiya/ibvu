// IBVU v5.9 — new file.
// The sign-in screen shown before any admin section. It is the screen herb
// review used to have, reworded for the whole of admin (see src/lib/auth.js).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMO_SIGN_IN, requestCode, checkCode } from '../../lib/auth.js';
import { isEmail } from '../../lib/messages.js';

export default function AdminSignIn() {
  const [step, setStep] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [known, setKnown] = useState(true); // preview only

  async function send(e) {
    e.preventDefault();
    if (!isEmail(email)) { setProblem("Please enter your email address."); return; }
    setBusy(true); setProblem("");
    const result = await requestCode(email);
    setBusy(false);
    if (!result.ok) { setProblem(result.error); return; }
    setKnown(result.known !== false);
    setStep("code");
  }

  async function verify(e) {
    e.preventDefault();
    if (code.length < 4) { setProblem("Enter the code from your email."); return; }
    setBusy(true); setProblem("");
    const result = await checkCode(email, code);
    setBusy(false);
    if (!result.ok) setProblem(result.error);
    // On success the admin area notices the sign-in and shows itself.
  }

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-box">
        <h1>IBVU Admin</h1>
        <p>Sign in to continue</p>

        {step === "email" ? (
          <form onSubmit={send} noValidate>
            <label className="visually-hidden" htmlFor="signin-email">Your email address</label>
            <input id="signin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" autoComplete="email" autoFocus />
            {problem && <div className="error-msg" role="alert">{problem}</div>}
            <button type="submit" className="admin-login-btn" disabled={busy}>{busy ? "Sending…" : "Send sign-in code →"}</button>
            {DEMO_SIGN_IN && <p className="preview-note signin-note">Preview only: this file cannot send emails. Sign in with hello@ibvu.org, or any address added on the People page. Any 6 digits work as the code.</p>}
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <p className="signin-sent">If {email.trim()} has access, a sign-in code is on its way to that inbox.</p>
            <label className="visually-hidden" htmlFor="signin-code">Sign-in code</label>
            <input id="signin-code" type="text" inputMode="numeric" maxLength={10} value={code} onChange={e => setCode(e.target.value.trim())} placeholder="Sign-in code" autoComplete="one-time-code" autoFocus
              style={{ letterSpacing: "6px", textAlign: "center", fontSize: "1.2rem" }} />
            {problem && <div className="error-msg" role="alert">{problem}</div>}
            <button type="submit" className="admin-login-btn" disabled={busy}>{busy ? "Checking…" : "Sign in →"}</button>
            {DEMO_SIGN_IN && (known
              ? <p className="preview-note signin-note">Preview only: no email was sent. Type any 6 digits.</p>
              : <p className="preview-note signin-note">Preview only: this address is not on the People page, so on the real site no code would be sent and no code will work.</p>)}
            <button type="button" className="admin-back-link" style={{ marginBottom: 8 }} onClick={() => { setStep("email"); setProblem(""); setCode(""); }}>← Use a different email</button>
          </form>
        )}
        <Link className="admin-back-link signin-site" to="/">← Back to the site</Link>
      </div>
    </div>
  );
}
