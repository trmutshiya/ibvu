// IBVU v6.0 — what changed in this file since v5.9:
// - A photo sent with a herb now really reaches admin. It goes to the server
//   together with the form's security check, is checked to be a real picture
//   and is kept privately until someone with herb review approves it.
//   (The security check's answer can only be used once, so when there is a
//   photo the server checks it while receiving the photo.)
// - If the photo cannot be sent, the person is told and nothing is submitted,
//   so they can try again or remove the photo.
//
// IBVU v5.9 — what changed in this file: the photo warning's wording now comes from admin → Pages → Herbarium (same wording as before until edited).
//
// IBVU v5.7 — what changed in this file:
// - Optional photo with a herb submission. A warning asks people to add only
//   their own photo; if they add one they must tick "This is my own photo and
//   I give IBVU permission to publish it." The photo is shrunk in the browser
//   and waits for an admin to review it before it is shown on the herb's page.
// - In the preview build (no database connection) the literature check is
//   skipped and the form says so, so the form can be tried end to end.
// Everything else (fields, security check, PubMed screening, saving) is unchanged.
import { useState, useEffect, useRef } from 'react';
import { SUPABASE_READY, SUBMISSIONS_KEY, sbInsert } from '../lib/supabase.js';
import { proxyPubMed, EDGE_VERIFY_TURNSTILE_URL, TURNSTILE_SITE_KEY } from '../lib/edge.js';
import { SUPABASE_ANON_KEY } from '../lib/supabase.js';
import { fileToImage, submitHerbPhoto, usePage } from '../lib/content.js';

const BLANK = { name: "", otherNames: "", uses: "", country: "", email: "", consent: false };

export default function SubmitForm() {
  const [form, setForm]             = useState(BLANK);
  const [screening, setScreening]   = useState(null);
  const [paperCount, setPaperCount] = useState(0);
  const [done, setDone]             = useState(false);
  const [errors, setErrors]         = useState({});
  const pageWords = usePage("herbarium");
  const [tsToken, setTsToken]       = useState("");
  const [photo, setPhoto]           = useState("");    // optional photo of the herb
  const [photoMine, setPhotoMine]   = useState(false); // "this is my own photo" tick
  const [photoError, setPhotoError] = useState("");
  const photoInputRef               = useRef(null);
  const tsContainerRef              = useRef(null);
  const tsWidgetIdRef               = useRef(null);

  useEffect(function() {
    if (location.protocol === "file:" || location.hostname === "localhost") {
      setTsToken("__local_bypass__");
      return;
    }
    function renderWidget() {
      if (window.turnstile && tsContainerRef.current && tsWidgetIdRef.current === null) {
        tsWidgetIdRef.current = window.turnstile.render(tsContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: function(token) { setTsToken(token); },
          "expired-callback": function() { setTsToken(""); },
          "error-callback": function() { setTsToken(""); },
          theme: "light",
        });
      }
    }
    if (window.turnstile) { renderWidget(); }
    else {
      const t = setInterval(function() {
        if (window.turnstile) { clearInterval(t); renderWidget(); }
      }, 200);
      return function() { clearInterval(t); };
    }
    return function() {
      if (tsWidgetIdRef.current !== null) {
        try { window.turnstile.remove(tsWidgetIdRef.current); } catch(_) {}
        tsWidgetIdRef.current = null;
      }
    };
  }, []);

  function handle(e) {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: val }));
    setErrors(er => ({ ...er, [e.target.name]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim())    e.name    = "Required";
    if (!form.uses.trim())    e.uses    = "Required";
    if (!form.country.trim()) e.country = "Required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
    if (photo && !photoMine) e.photo = "Please confirm this is your own photo, or remove it.";
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!tsToken) {
      setErrors(prev => ({ ...prev, _turnstile: "Please wait for the security check to complete." }));
      return;
    }
    setScreening("checking");

    try {
      const sendsPhoto = !!(photo && photoMine);
      let photoSent = false;
      if (tsToken !== "__local_bypass__" && sendsPhoto && SUPABASE_READY) {
        // The server checks the security token while receiving the photo.
        const sent = await submitHerbPhoto(form.name, photo, tsToken);
        if (!sent || !sent.ok) {
          setTsToken("");
          if (tsWidgetIdRef.current !== null) { try { window.turnstile.reset(tsWidgetIdRef.current); } catch(_) {} }
          setErrors(prev => ({ ...prev, photo: (sent && sent.error) || "The photo could not be sent. Please try again, or remove it." }));
          setScreening(null);
          return;
        }
        photoSent = true;
      } else if (tsToken !== "__local_bypass__") {
        const tvRes = await fetch(EDGE_VERIFY_TURNSTILE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ token: tsToken }),
        });
        if (!tvRes.ok) { setScreening("error"); return; }
        const tvData = await tvRes.json();
        if (!tvData.success) {
          setTsToken("");
          if (tsWidgetIdRef.current !== null) { try { window.turnstile.reset(tsWidgetIdRef.current); } catch(_) {} }
          setErrors(prev => ({ ...prev, _turnstile: "Security check failed. Please try again." }));
          setScreening(null);
          return;
        }
      }

      // Without a database connection (the preview build) the literature check
      // cannot run, so the submission is simply kept for review.
      let count = 0;
      let status = "pending";
      if (SUPABASE_READY) {
        const names = [form.name.trim(), ...form.otherNames.split(",").map(s => s.trim()).filter(Boolean)];
        const term  = names.map(n => '"' + n + '"[Title/Abstract]').join(" OR ");
        const data  = await proxyPubMed("esearch", { db: "pubmed", term: term, retmax: 1, retmode: "json" });
        count = parseInt(data.esearchresult?.count || "0", 10);
        status = count > 0 ? "pending" : "insufficient-evidence";
        setScreening(count > 0 ? "passed" : "flagged");
      } else {
        setScreening("preview");
      }
      setPaperCount(count);

      const entry = {
        id:         Date.now(),
        timestamp:  new Date().toISOString(),
        name:       form.name.trim(),
        otherNames: form.otherNames.trim(),
        uses:       form.uses.trim(),
        country:    form.country.trim(),
        email:      form.email.trim(),
        consent:    form.consent,
        status,
        paperCount: count,
      };

      if (SUPABASE_READY) {
        await sbInsert(entry);
      } else {
        const prev = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || "[]");
        localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify([...prev, entry]));
      }
      // Preview: the photo (if any) waits in this browser for review.
      if (sendsPhoto && !photoSent && !SUPABASE_READY) submitHerbPhoto(form.name, photo);
      setDone(true);
    } catch (_) {
      setScreening("error");
    }
  }

  async function pickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try { setPhoto(await fileToImage(file, 1200, 0.8)); setPhotoError(""); setErrors(er => ({ ...er, photo: undefined })); }
    catch (err) { setPhotoError(err.message); }
  }

  if (done && screening === "preview") {
    return (
      <div className="result-card">
        <h3>Submission Received</h3>
        <p>Your herb has been submitted for review.{photo ? " Your photo will be checked before it is shown." : ""}</p>
        <p className="preview-note">Preview only: without the database connection the literature check did not run and this submission was saved in this browser only.</p>
        <button className="result-new-btn" onClick={() => { setDone(false); setForm(BLANK); setScreening(null); setPaperCount(0); setPhoto(""); setPhotoMine(false); }}>
          Submit another herb →
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="result-card">
        <h3>{screening === "passed" ? "Submission Received" : "Submission Flagged"}</h3>
        <p>
          {screening === "passed"
            ? "Your herb has been submitted for review. We found " + paperCount + " paper" + (paperCount === 1 ? "" : "s") + " in PubMed — good evidence basis. " + (form.consent ? "We'll be in touch at " + form.email + "." : "We'll review it and may publish it in the catalogue.")
            : "We couldn't find peer-reviewed literature for this herb in PubMed. Your submission has been saved and flagged for manual review. It may still be published if evidence is found through other means."}
        </p>
        <span className={"result-badge " + (screening === "passed" ? "green" : "amber")}>
          {screening === "passed" ? "✓ Evidence found · " + paperCount + " papers" : "⚠ Insufficient evidence"}
        </span>
        <button className="result-new-btn" onClick={() => { setDone(false); setForm(BLANK); setScreening(null); setPaperCount(0); setPhoto(""); setPhotoMine(false); }}>
          Submit another herb →
        </button>
      </div>
    );
  }

  return (
    <div className="form-wrap">
      <h2>Submit an Herb</h2>
      <p>Contribute a plant to the Herbarium. Submissions are automatically screened against PubMed before review.</p>

      <div className="form-row">
        <div className="form-group">
          <label>Common Name *</label>
          <input name="name" value={form.name} onChange={handle} placeholder="e.g. Lavender" />
          {errors.name && <span style={{ color: "#c62828", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1 }}>{errors.name}</span>}
        </div>
        <div className="form-group">
          <label>Country of Origin *</label>
          <input name="country" value={form.country} onChange={handle} placeholder="e.g. Zimbabwe" />
          {errors.country && <span style={{ color: "#c62828", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1 }}>{errors.country}</span>}
        </div>
      </div>

      <div className="form-group">
        <label>Other Names (comma-separated)</label>
        <input name="otherNames" value={form.otherNames} onChange={handle} placeholder="e.g. Wild ginger, Cape ginger" />
      </div>

      <div className="form-group">
        <label>Traditional Uses (comma-separated) *</label>
        <input name="uses" value={form.uses} onChange={handle} placeholder="e.g. Fever reduction, Wound healing, Digestive aid" />
        {errors.uses && <span style={{ color: "#c62828", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1 }}>{errors.uses}</span>}
      </div>

      <div className="form-group">
        <label>Your Email Address *</label>
        <input name="email" type="email" value={form.email} onChange={handle} placeholder="e.g. you@email.com" />
        {errors.email && <span style={{ color: "#c62828", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1 }}>{errors.email}</span>}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
          Used to notify you of publication status. See consent option below.
        </div>
      </div>

      <div className="photo-field">
        <label className="photo-label" htmlFor="herb-photo">Photo of the Herb (optional)</label>
        <p className="photo-warning">{pageWords.photoWarning}</p>
        {photo ? (
          <div className="photo-chosen">
            <img src={photo} alt="The photo you chose" />
            <button type="button" className="photo-btn" onClick={() => { setPhoto(""); setPhotoMine(false); setErrors(er => ({ ...er, photo: undefined })); }}>Remove photo</button>
          </div>
        ) : (
          <button type="button" className="photo-btn" onClick={() => photoInputRef.current && photoInputRef.current.click()}>Choose a photo</button>
        )}
        <input id="herb-photo" ref={photoInputRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        {photoError && <span className="photo-error">{photoError}</span>}
        {photo && (
          <div className="consent-row photo-consent">
            <input type="checkbox" id="photo-mine" checked={photoMine} onChange={e => { setPhotoMine(e.target.checked); setErrors(er => ({ ...er, photo: undefined })); }} />
            <label htmlFor="photo-mine">This is my own photo and I give IBVU permission to publish it.</label>
          </div>
        )}
        {errors.photo && <span className="photo-error">{errors.photo}</span>}
      </div>

      <div className="consent-row">
        <input type="checkbox" id="consent" name="consent" checked={form.consent} onChange={handle} />
        <label htmlFor="consent">
          I consent to being contacted by IBVU regarding this submission and future updates from the Herbarium Scientifica. Your email will only be used for this purpose and will not be shared with third parties.
        </label>
      </div>

      <div ref={tsContainerRef} style={{ margin: "20px 0 8px" }} />
      {errors._turnstile && (
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 1, color: "#c62828", marginBottom: 10 }}>
          {errors._turnstile}
        </div>
      )}

      <button
        className="submit-btn"
        onClick={handleSubmit}
        disabled={screening === "checking" || !tsToken}
        style={{ opacity: (screening === "checking" || !tsToken) ? 0.6 : 1, cursor: (screening === "checking" || !tsToken) ? "not-allowed" : "pointer" }}
      >
        {screening === "checking" ? "Screening…" : "Submit for Review →"}
      </button>

      {screening === "checking" && (
        <div className="screen-status checking">
          <div className="screen-spinner" />
          Searching PubMed for evidence…
        </div>
      )}
      {screening === "error" && (
        <div className="screen-status error">
          ⚠ Could not reach PubMed. Check your connection and try again.
        </div>
      )}
    </div>
  );
}
