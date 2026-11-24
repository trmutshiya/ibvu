// IBVU v6.15 — new file. Herb review: add a submission's names and uses to a herb that is
// already in the Herbarium, instead of publishing it as a new herb.
// The herb as it is now sits next to what the person sent; the reviewer ticks what to add.
// Uses can carry the country they came from ("Coughs (traditional use in Ghana)").
// Nothing changes on the site until "Add ticked items" is pressed; the edit log records
// what was added and from which submission.
import { useState, useMemo } from 'react';
import { sbUpdateHerb, sbInsertStaticHerb, sbUpdateReviewStatus, sbLogHerbEdit } from '../lib/supabase.js';
import { newItems, splitNames, combineLists, STRENGTH_LABEL } from '../lib/dupes.js';

export default function AdditionsPanel({ submission, targets, adminLabel, onDone, onCancel }) {
  const [targetRef, setTargetRef] = useState(targets[0] ? targets[0].herb.ref : "");
  const [picked, setPicked] = useState(null);   // null = everything new is ticked
  const [tagCountry, setTagCountry] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const t = targets.find(x => x.herb.ref === targetRef) || targets[0];
  const herb = t && t.herb;
  const country = (submission.country || "").trim();

  const offer = useMemo(() => herb ? {
    names: newItems([submission.name, ...splitNames(submission.otherNames)], [herb.name, ...(herb.altNames || [])]),
    uses: newItems(submission.uses, herb.uses || []),
  } : { names: [], uses: [] }, [herb, submission]);
  const isPicked = k => picked === null ? true : !!picked[k];
  const toggle = k => setPicked(p => {
    const base = p === null ? Object.fromEntries([...offer.names.map(n => ["n:" + n, true]), ...offer.uses.map(u => ["u:" + u, true])]) : p;
    return { ...base, [k]: !base[k] };
  });
  const names = offer.names.filter(n => isPicked("n:" + n));
  const uses = offer.uses.filter(u => isPicked("u:" + u));
  const tagged = u => tagCountry && country ? u + " (traditional use in " + country + ")" : u;

  async function apply() {
    if (!herb) return;
    setSaving(true); setError("");
    try {
      const otherNames = combineLists(herb.altNames || [], names).join(", ");
      const allUses = [...(herb.uses || []), ...uses.map(tagged)];
      const isBuiltIn = String(herb.ref).startsWith("builtin:");
      if (names.length || uses.length) {
        if (isBuiltIn) {
          // A built-in herb becomes a published copy that can be changed (as Edit does).
          await sbInsertStaticHerb({
            name: herb.name, latin: herb.latinName || herb.latin || "", category: herb.category || "Herbal Medicine",
            origin: herb.origin || "", description: herb.description || "", other_names: otherNames,
            uses: allUses, conditions: herb.conditions || [], color: herb.color || "#a8c5a0",
          }, adminLabel);
        } else {
          await sbUpdateHerb(herb.uuid || herb.id, { name: herb.name, other_names: otherNames, uses: allUses }, adminLabel);
        }
      }
      await sbUpdateReviewStatus(submission.id, "approved");
      if (!isBuiltIn) {
        await sbLogHerbEdit(herb.uuid || herb.id, herb.name, "add-from-submission", adminLabel, {
          from_submission: submission.id, added_other_names: names, added_uses: uses.map(tagged), country,
        });
      }
      onDone();
    } catch (err) {
      setError(err.message || String(err));
      setSaving(false);
    }
  }

  return (
    <div className="completion-overlay">
      <div className="completion-panel" role="dialog" aria-label={"Add to an existing herb"}>
        <div className="completion-header">
          <span className="cp-eyebrow">Add to an existing herb</span>
          <h3 className="cp-herb-name">{submission.name}{herb ? " → " + herb.name : ""}</h3>
        </div>
        <div className="completion-body">
          {targets.length > 1 && (
            <div className="cp-row">
              <span className="cp-label">Which herb is it?</span>
              {targets.map(x => (
                <label key={x.herb.ref} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" name="addto" checked={x.herb.ref === targetRef} onChange={() => { setTargetRef(x.herb.ref); setPicked(null); }} />
                  <span><strong>{x.herb.name}</strong> {(x.herb.latinName || x.herb.latin) && <em style={{ color: "var(--muted)" }}>{x.herb.latinName || x.herb.latin}</em>}
                    {x.strength && <span className={"dupe-badge " + x.strength} style={{ marginLeft: 8 }}>{x.strength === "adds" ? "Chosen by submitter" : STRENGTH_LABEL[x.strength]}</span>}
                    {x.reasons && x.reasons.length > 0 && <span className="dupe-why">{x.reasons.join("; ")}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          {submission.matchNote && <p className="cmp-note">Why it matched when sent: {submission.matchNote}</p>}
          {herb && (
            <div className="cmp-grid">
              <div className="cmp-h">Field</div><div className="cmp-h">{herb.name} now</div><div className="cmp-h">Sent{country ? " from " + country : ""} · tick to add</div>
              <div className="cmp-f">Latin name</div><div><em>{herb.latinName || herb.latin || "—"}</em></div><div><span className="cmp-note">The submission has no Latin name</span></div>
              <div className="cmp-f">Other names</div>
              <div>{(herb.altNames || []).length ? herb.altNames.map(n => <span className="cmp-chip" key={n}>{n}</span>) : <span className="cmp-note">none</span>}</div>
              <div>{offer.names.length ? offer.names.map(n => (
                <label key={n}><input type="checkbox" checked={isPicked("n:" + n)} onChange={() => toggle("n:" + n)} /><span className="cmp-chip new">{n}</span></label>
              )) : <span className="cmp-note">nothing new</span>}</div>
              <div className="cmp-f">Uses</div>
              <div>{(herb.uses || []).length ? herb.uses.map(u => <span className="cmp-chip" key={u}>{u}</span>) : <span className="cmp-note">none</span>}</div>
              <div>{offer.uses.length ? offer.uses.map(u => (
                <label key={u}><input type="checkbox" checked={isPicked("u:" + u)} onChange={() => toggle("u:" + u)} /><span className="cmp-chip new">{tagged(u)}</span></label>
              )) : <span className="cmp-note">nothing new</span>}
                {country && offer.uses.length > 0 && (
                  <label style={{ marginTop: 6 }}><input type="checkbox" checked={tagCountry} onChange={e => setTagCountry(e.target.checked)} /><span className="cmp-note" style={{ marginTop: 2 }}>Show the country with each new use</span></label>
                )}
              </div>
            </div>
          )}
          {herb && String(herb.ref).startsWith("builtin:") && (names.length > 0 || uses.length > 0) && (
            <p className="cmp-note">{herb.name} is a built-in herb: adding to it publishes an editable copy (as Edit does).</p>
          )}
          {error && <div style={{ color: "#c62828", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{error}</div>}
        </div>
        <div className="completion-footer">
          <button className="admin-btn outline" onClick={onCancel}>Cancel</button>
          <button className="admin-btn solid" onClick={apply} disabled={saving || !herb}>
            {saving ? "Saving…" : names.length + uses.length ? "Add ticked items to " + (herb ? herb.name : "the herb") + " →" : "Nothing to add: mark as done →"}
          </button>
        </div>
      </div>
    </div>
  );
}
