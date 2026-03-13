import { useState, useEffect } from 'react';
import { CONDITION_GROUPS } from '../constants/conditions.js';
import { COLOUR_PALETTE } from '../lib/utils.js';
import { normaliseOrigin } from '../lib/utils.js';
import { sbPublish, sbUpdateReviewStatus, sbLogHerbEdit } from '../lib/supabase.js';
import { gbifLookup, gbifNativeRange, runConditionScreens, generateDescription } from '../lib/edge.js';

export default function CompletionPanel({ submission, onPublish, onCancel, adminEmail }) {
  const [loadLatin,  setLoadLatin]  = useState(true);
  const [loadOrigin, setLoadOrigin] = useState(true);
  const [loadConds,  setLoadConds]  = useState(true);
  const [loadDesc,   setLoadDesc]   = useState(true);
  const [latinName,  setLatinName]  = useState("");
  const [category,   setCategory]   = useState("");
  const [origin,     setOrigin]     = useState("");
  const [description,setDesc]       = useState("");
  const [otherNames, setOtherNames] = useState(submission.otherNames || "");
  const [condResults,setCondResults]= useState([]);
  const [color,      setColor]      = useState(COLOUR_PALETTE[0]);
  const [publishing, setPublishing] = useState(false);
  const [pubError,   setPubError]   = useState("");

  useEffect(function() {
    const baseOrigin = normaliseOrigin(submission.country) || submission.country;

    gbifLookup(submission.name).then(function(result) {
      if (result) {
        setLatinName(result.latin || "");
        if (result.usageKey) {
          gbifNativeRange(result.usageKey).then(function(localities) {
            const mapped  = localities.map(normaliseOrigin).filter(Boolean);
            const regions = [...new Set([baseOrigin, ...mapped])].filter(Boolean);
            setOrigin(regions.slice(0, 4).join(", "));
            setLoadOrigin(false);
          }).catch(function() { setOrigin(baseOrigin); setLoadOrigin(false); });
        } else { setOrigin(baseOrigin); setLoadOrigin(false); }
      } else { setOrigin(baseOrigin); setLoadOrigin(false); }
      setLoadLatin(false);
    }).catch(function() { setOrigin(baseOrigin); setLoadLatin(false); setLoadOrigin(false); });

    runConditionScreens(submission.name, submission.otherNames).then(function(results) {
      setCondResults(results.map(r => ({ ...r, checked: r.count >= 5 })));
      setLoadConds(false);
    }).catch(function() {
      setCondResults(CONDITION_GROUPS.map(g => ({ ...g, count: 0, checked: false })));
      setLoadConds(false);
    });

    generateDescription(
      submission.name, "", submission.uses,
      baseOrigin, submission.paperCount
    ).then(function(text) { setDesc(text); setLoadDesc(false); })
     .catch(function() { setLoadDesc(false); });
  }, []);

  function toggleCond(id) {
    setCondResults(prev => prev.map(r => r.id === id ? { ...r, checked: !r.checked } : r));
  }

  async function handlePublish() {
    setPublishing(true); setPubError("");
    try {
      const herbData = {
        submission_id:     submission.id,
        name:              submission.name,
        otherNames:        otherNames,
        latin:             latinName || submission.name,
        category:          category || "Herbal Medicine",
        origin:            origin,
        description:       description,
        uses:              submission.uses.split(",").map(u => u.trim()).filter(Boolean),
        conditions:        condResults.filter(r => r.checked).map(r => r.id),
        color:             color,
        pubmed_count:      submission.paperCount,
        submitter_email:   submission.email   || null,
        submitter_consent: submission.consent || false,
      };
      await sbPublish(herbData);
      await sbUpdateReviewStatus(submission.id, "approved");
      sbLogHerbEdit(null, herbData.name, "approve", adminEmail, herbData);
      onPublish(herbData);
    } catch (err) {
      setPubError("Publish failed — check console. " + err.message);
      setPublishing(false);
    }
  }

  const allLoaded = !loadLatin && !loadOrigin && !loadConds && !loadDesc;

  return (
    <div className="completion-overlay">
      <div className="completion-panel">
        <div className="completion-header">
          <h3>Complete Entry — {submission.name}</h3>
          <button className="completion-close" onClick={onCancel}>✕</button>
        </div>

        <div className="completion-body">
          <div className="cp-row">
            <span className="cp-label">Other Names (comma-separated · editable)</span>
            <input value={otherNames} onChange={e => setOtherNames(e.target.value)} placeholder="e.g. Wild ginger, Cape ginger" />
          </div>

          <div className="cp-two">
            <div className="cp-row">
              <span className="cp-label">Latin Name (GBIF)</span>
              {loadLatin
                ? <div className="cp-loading"><div className="screen-spinner" />Looking up via GBIF…</div>
                : <input value={latinName} onChange={e => setLatinName(e.target.value)} placeholder="Genus species" />
              }
            </div>
            <div className="cp-row">
              <span className="cp-label">Category</span>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Adaptogen, Nervine" />
            </div>
          </div>

          <div className="cp-row">
            <span className="cp-label">Origin (auto-normalised · GBIF range expanded)</span>
            {loadOrigin
              ? <div className="cp-loading"><div className="screen-spinner" />Normalising regions…</div>
              : <input value={origin} onChange={e => setOrigin(e.target.value)} />
            }
          </div>

          <div className="cp-row">
            <span className="cp-label">Conditions — ranked by PubMed evidence · click to toggle</span>
            {loadConds
              ? <div className="cp-loading"><div className="screen-spinner" />Searching PubMed across all 12 condition groups… (~40s)</div>
              : <div className="cond-checklist">
                  {condResults.map(r => (
                    <div key={r.id} className={"cond-check-item" + (r.checked ? " checked" : "")} onClick={() => toggleCond(r.id)}>
                      <span className="cond-check-box">{r.checked ? "●" : "○"}</span>
                      <span className="cond-check-lbl">{r.label}</span>
                      <span className="cond-check-cnt">{r.count} paper{r.count !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
            }
          </div>

          <div className="cp-row">
            <span className="cp-label">Description — Claude-generated · editable</span>
            {loadDesc
              ? <div className="cp-loading"><div className="screen-spinner" />Generating with Claude…</div>
              : <textarea rows={5} value={description} onChange={e => setDesc(e.target.value)} placeholder="Botanical description will appear here…" />
            }
          </div>

          <div className="cp-row">
            <span className="cp-label">Card Colour</span>
            <div className="colour-palette">
              {COLOUR_PALETTE.map(c => (
                <div key={c} className={"colour-swatch" + (color === c ? " active" : "")} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>

          {pubError && <div style={{ color: "#c62828", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{pubError}</div>}
        </div>

        <div className="completion-footer">
          <button className="admin-btn outline" onClick={onCancel}>Cancel</button>
          <button
            className="admin-btn solid"
            onClick={handlePublish}
            disabled={publishing || !allLoaded}
            style={{ opacity: (!allLoaded || publishing) ? 0.6 : 1, cursor: (!allLoaded || publishing) ? "wait" : "pointer" }}
          >
            {publishing ? "Publishing…" : allLoaded ? "Publish to Herbarium →" : "Auto-completing…"}
          </button>
        </div>
      </div>
    </div>
  );
}
