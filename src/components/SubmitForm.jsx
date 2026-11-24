// IBVU v6.15 — what changed in this file: catching duplicates.
// - Before sending, the herb is compared with the Herbarium (name and other names; see
//   src/lib/dupes.js). If it is very likely already there, the person is asked "Is it one of
//   these?". They are never blocked: "No, it's a different plant" sends it as before.
// - "Yes, add my information to it" shows what the Herbarium already lists and which of their
//   names and uses are new; they untick anything they don't want to send, and it is sent as
//   additions to that herb (the reviewer decides what is added).
// - Only confident matches are shown here; close spellings are left for the reviewer.
//
// IBVU v6.07 — what changed in this file: a herb submission is counted in Google Analytics (only with consent; no
// details of the submission are sent).
//
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
import { track } from '../lib/analytics.js';
import { useState, useEffect, useRef } from 'react';
import { SUPABASE_READY, SUBMISSIONS_KEY, sbInsert } from '../lib/supabase.js';
import { proxyPubMed, EDGE_VERIFY_TURNSTILE_URL, TURNSTILE_SITE_KEY } from '../lib/edge.js';
import { SUPABASE_ANON_KEY } from '../lib/supabase.js';
import { fileToImage, submitHerbPhoto, usePage } from '../lib/content.js';
import { findMatches, newItems, splitNames } from '../lib/dupes.js';
import { Link } from 'react-router-dom';

const BLANK = { name: "", otherNames: "", uses: "", country: "", email: "", consent: false };

export default function SubmitForm({ herbs = [] }) {
  const [form, setForm]             = useState(BLANK);
  // v6.15: null (not asked yet) | "ask" (Is it one of these?) | "add" (what to add) |
  // "new" (a different plant) | "adding" (sending additions)
  const [matchStep, setMatchStep]   = useState(null);
  const [matches, setMatches]       = useState([]);
  const [target, setTarget]         = useState(null);
  const [offer, setOffer]           = useState({ names: [], uses: [] });
  const [picked, setPicked]         = useState({});
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
    if (["name", "otherNames"].includes(e.target.name)) setMatchStep(null);
  }

  // v6.15: "Is it one of these?"
  function chooseHerb(herb) {
    const names = newItems([form.name, ...splitNames(form.otherNames)], [herb.name, ...(herb.altNames || [])]);
    const uses = newItems(form.uses, herb.uses || []);
    setTarget(herb);
    setOffer({ names, uses });
    setPicked(Object.fromEntries([...names.map(n => ["n:" + n, true]), ...uses.map(u => ["u:" + u, true])]));
    setMatchStep("add");
  }
  function resetAll() {
    setDone(false); setForm(BLANK); setScreening(null); setPaperCount(0); setPhoto(""); setPhotoMine(false);
    setMatchStep(null); setMatches([]); setTarget(null); setOffer({ names: [], uses: [] }); setPicked({});
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

  async function handleSubmit(step = matchStep) {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    // v6.15: ask first if the herb is very likely already in the Herbarium
    if (step === null && herbs.length) {
      const found = findMatches({ name: form.name, otherNames: form.otherNames }, herbs, "likely").slice(0, 3);
      if (found.length) { setMatches(found); setMatchStep("ask"); return; }
    }
    if (!tsToken) {
      setErrors(prev => ({ ...prev, _turnstile: "Please wait for the security check to complete." }));
      return;
    }
    const adding = step === "add" && target;
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

      // v6.15: additions to an existing herb send only what the person kept ticked
      const keptNames = offer.names.filter(n => picked["n:" + n]);
      const keptUses = offer.uses.filter(u => picked["u:" + u]);
      const entry = {
        id:         Date.now(),
        timestamp:  new Date().toISOString(),
        name:       form.name.trim(),
        otherNames: adding ? keptNames.filter(n => n !== form.name.trim()).join(", ") : form.otherNames.trim(),
        uses:       adding ? (keptUses.join(", ") || form.uses.trim()) : form.uses.trim(),
        country:    form.country.trim(),
        email:      form.email.trim(),
        consent:    form.consent,
        status,
        paperCount: count,
      };
      if (adding) {
        const m = matches.find(x => x.herb.ref === target.ref);
        entry.targetHerb = target.ref;
        entry.targetName = target.name;
        entry.matchNote = (m ? m.reasons.join("; ") : "chosen by the person submitting") +
          (keptNames.includes(form.name.trim()) ? "" : ". Name they used: " + form.name.trim());
      }

      if (SUPABASE_READY) {
        await sbInsert(entry);
      } else {
        const prev = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || "[]");
        localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify([...prev, entry]));
      }
      // Preview: the photo (if any) waits in this browser for review.
      if (sendsPhoto && !photoSent && !SUPABASE_READY) submitHerbPhoto(form.name, photo);
      setDone(true);
      if (adding) setMatchStep("adding");
      track("herb_submitted", { with_photo: !!sendsPhoto, additions: !!adding });
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

  if (done && matchStep === "adding" && target) {
    return (
      <div className="result-card">
        <h3>Thank you</h3>
        <p>Your additions to <strong>{target.name}</strong> have been sent. Our team checks them before anything is added to the Herbarium.{form.consent ? " We'll email you at " + form.email + " when they are added." : ""}</p>
        {screening === "preview" && <p className="preview-note">Preview only: this was saved in this browser only.</p>}
        <span className="result-badge green">✓ Sent as additions to {target.name}</span>
        <button className="result-new-btn" onClick={resetAll}>Submit another herb →</button>
      </div>
    );
  }

  if (done && screening === "preview") {
    return (
      <div className="result-card">
        <h3>Submission Received</h3>
        <p>Your herb has been submitted for review.{photo ? " Your photo will be checked before it is shown." : ""}</p>
        <p className="preview-note">Preview only: without the database connection the literature check did not run and this submission was saved in this browser only.</p>
        <button className="result-new-btn" onClick={resetAll}>
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
        <button className="result-new-btn" onClick={resetAll}>
          Submit another herb →
        </button>
      </div>
    );
  }

  // v6.15: the two extra steps are shown above the form; the form stays on the page (hidden)
  // so its security check keeps working.
  let stepPanel = null;
  if (matchStep === "ask") {
    stepPanel = (
      <div className="form-wrap match-step" data-step="ask">
        <h2>Thanks! We may already have this plant</h2>
        <p>Is it one of these? If it is, you can add your names and uses to the existing entry instead of starting a new one.</p>
        {matches.map(m => (
          <div className="match-herb" key={m.herb.ref || m.herb.slug}>
            <div className="match-herb-text">
              <h3>{m.herb.name}</h3>
              {m.herb.latinName && <p className="match-latin">{m.herb.latinName}</p>}
              <p className="match-why">Matched: {m.reasons.join("; ")}</p>
              {m.herb.slug && <Link className="match-open" to={"/educate/hs/" + m.herb.slug} target="_blank" rel="noopener">Open this herb’s page ↗</Link>}
            </div>
            <button type="button" className="submit-btn match-yes" onClick={() => chooseHerb(m.herb)}>Yes, add my information to it</button>
          </div>
        ))}
        <div className="match-actions">
          <button type="button" className="match-no" onClick={() => { setMatchStep("new"); handleSubmit("new"); }}>No, it’s a different plant: send it as a new herb</button>
          <button type="button" className="match-back" onClick={() => setMatchStep(null)}>← Back to my form</button>
        </div>
        {screening === "checking" && <div className="screen-status checking"><div className="screen-spinner" />Searching PubMed for evidence…</div>}
        {screening === "error" && <div className="screen-status error">⚠ Could not reach PubMed. Check your connection and try again.</div>}
        {errors._turnstile && <div className="match-error">{errors._turnstile}</div>}
      </div>
    );
  } else if (matchStep === "add" && target) {
    const already = [...(target.altNames || [])];
    const nothingNew = offer.names.length + offer.uses.length === 0;
    const toggle = k => setPicked(p => ({ ...p, [k]: !p[k] }));
    stepPanel = (
      <div className="form-wrap match-step" data-step="add">
        <h2>What would you like to add to {target.name}?</h2>
        <p className="match-label">Already in the Herbarium</p>
        <div className="match-chips">
          {already.map(n => <span className="match-chip" key={"a" + n}>{n}</span>)}
          {(target.uses || []).map(u => <span className="match-chip" key={"u" + u}>{u}</span>)}
          {already.length + (target.uses || []).length === 0 && <span className="match-none">No other names or uses listed yet.</span>}
        </div>
        {nothingNew ? (
          <p className="match-none">Everything you entered is already listed. Thank you! You can still send it, for example to add your photo, or go back.</p>
        ) : (
          <>
            <p className="match-label">New from you (untick anything you don’t want to send)</p>
            <div className="match-picks">
              {offer.names.map(n => <label className="match-pick" key={"n" + n}><input type="checkbox" checked={!!picked["n:" + n]} onChange={() => toggle("n:" + n)} /> Other name: {n}</label>)}
              {offer.uses.map(u => <label className="match-pick" key={"u" + u}><input type="checkbox" checked={!!picked["u:" + u]} onChange={() => toggle("u:" + u)} /> Use: {u}{form.country ? " (" + form.country.trim() + ")" : ""}</label>)}
            </div>
          </>
        )}
        {errors._turnstile && <div className="match-error">{errors._turnstile}</div>}
        <button type="button" className="submit-btn" onClick={() => handleSubmit("add")}
          disabled={screening === "checking" || !tsToken}
          style={{ opacity: (screening === "checking" || !tsToken) ? 0.6 : 1 }}>
          {screening === "checking" ? "Sending…" : "Send my additions →"}
        </button>
        <div className="match-actions">
          <button type="button" className="match-back" onClick={() => setMatchStep("ask")}>← It’s not this herb</button>
        </div>
        {screening === "error" && <div className="screen-status error">⚠ Could not reach PubMed. Check your connection and try again.</div>}
      </div>
    );
  }

  return (
    <>
    {stepPanel}
    <div className="form-wrap" style={stepPanel ? { display: "none" } : undefined}>
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
        onClick={() => handleSubmit()}
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
    </>
  );
}
