import { useState } from 'react';
import { CONDITION_GROUPS } from '../constants/conditions.js';
import { COLOUR_PALETTE } from '../lib/utils.js';
import { sbInsertStaticHerb, sbUpdateHerb } from '../lib/supabase.js';
import { Sentry } from '../lib/sentry.js';

export default function EditPanel({ herb, onSave, onCancel, isStatic, adminEmail }) {
  const [name,        setName]        = useState(herb.name        || "");
  const [otherNames,  setOtherNames]  = useState(herb.otherNames  || herb.other_names || "");
  const [latin,       setLatin]       = useState(herb.latin       || herb.latinName || "");
  const [category,    setCategory]    = useState(herb.category    || "Herbal Medicine");
  const [origin,      setOrigin]      = useState(herb.origin      || "");
  const [usesText,    setUsesText]    = useState(Array.isArray(herb.uses) ? herb.uses.join("\n") : (herb.uses || ""));
  const [description, setDescription] = useState(herb.description || "");
  const [conditions,  setConditions]  = useState(Array.isArray(herb.conditions) ? herb.conditions : []);
  const [color,       setColor]       = useState(herb.color       || COLOUR_PALETTE[0]);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState("");

  function toggleCond(id) {
    setConditions(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }

  async function handleSave() {
    setSaving(true); setSaveError("");
    try {
      const updates = {
        name, other_names: otherNames, latin, category, origin, description,
        uses: usesText.split("\n").map(s => s.trim()).filter(Boolean),
        conditions, color,
      };
      if (isStatic) {
        const newRow = await sbInsertStaticHerb(updates, adminEmail);
        onSave({ ...herb, ...updates, _promoted: true, _supabaseRow: newRow });
      } else {
        await sbUpdateHerb(herb.id, updates, adminEmail);
        onSave({ ...herb, ...updates });
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { area: "herb-save" } });
      setSaveError("Save failed: " + err.message); setSaving(false);
    }
  }

  return (
    <div className="completion-overlay">
      <div className="completion-panel">
        <div className="completion-header">
          <span className="cp-eyebrow">{isStatic ? "Edit Built-in Herb" : "Edit Published Entry"}</span>
          <h3 className="cp-herb-name">{herb.name}</h3>
          {isStatic && (
            <div style={{ marginTop: 8, fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 1, color: "#7a6040", background: "#f5ecd7", border: "1px solid #e0c888", borderRadius: 3, padding: "5px 10px" }}>
              ⚠ Built-in herb — saving will publish it to Supabase so changes persist
            </div>
          )}
        </div>
        <div className="completion-body">
          <div className="cp-row">
            <span className="cp-label">Common Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Baobab" />
          </div>
          <div className="cp-row">
            <span className="cp-label">Other Names (comma-separated)</span>
            <input value={otherNames} onChange={e => setOtherNames(e.target.value)} placeholder="e.g. Wild ginger, Cape ginger" />
          </div>
          <div className="cp-row">
            <span className="cp-label">Latin Name</span>
            <input value={latin} onChange={e => setLatin(e.target.value)} placeholder="e.g. Adansonia digitata" />
          </div>
          <div className="cp-row">
            <span className="cp-label">Category</span>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {["Herbal Medicine","Adaptogenic Herb","Antioxidant","Culinary Herb","Aromatic Herb","Root Medicine","Tree Medicine","Aquatic Plant"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="cp-row">
            <span className="cp-label">Origin / Region</span>
            <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="e.g. Southern Africa, East Africa" />
          </div>
          <div className="cp-row">
            <span className="cp-label">Traditional Uses (one per line)</span>
            <textarea rows={3} value={usesText} onChange={e => setUsesText(e.target.value)} placeholder={"Anti-inflammatory\nAntifungal\nDigestive aid"} />
          </div>
          <div className="cp-row">
            <span className="cp-label">Description</span>
            <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Botanical description…" />
          </div>
          <div className="cp-row">
            <span className="cp-label">Conditions</span>
            <div className="cond-checklist">
              {CONDITION_GROUPS.map(r => (
                <div key={r.id} className={"cond-check-item" + (conditions.includes(r.id) ? " checked" : "")} onClick={() => toggleCond(r.id)}>
                  <span className="cond-check-box">{conditions.includes(r.id) ? "●" : "○"}</span>
                  <span className="cond-check-lbl">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="cp-row">
            <span className="cp-label">Card Colour</span>
            <div className="colour-palette">
              {COLOUR_PALETTE.map(c => (
                <div key={c} className={"colour-swatch" + (color === c ? " active" : "")} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
          {saveError && <div style={{ color: "#c62828", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{saveError}</div>}
        </div>
        <div className="completion-footer">
          <button className="admin-btn outline" onClick={onCancel}>Cancel</button>
          <button className="admin-btn solid" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes →"}
          </button>
        </div>
      </div>
    </div>
  );
}
