// IBVU v6.15 — new file. Admin → Duplicates (ibvu.org/admin/duplicates), for people with the
// herb review tick.
// - Possible duplicates: pairs of herbs in the Herbarium that may be the same plant (see
//   src/lib/dupes.js), strongest first, with why. "Not a duplicate" takes a pair off the list.
// - Merge: the two herbs side by side. For each field pick which version to keep; lists
//   (other names, uses, conditions) can be combined. The kept herb keeps its address; the
//   other one is hidden (not deleted) and its address forwards to the kept herb. Its photo
//   moves across if the kept herb has none. Every merge can be undone.
// - Merged herbs: what was merged into what, with Undo.
// Needs database step 5; without it the page says so and changes nothing.
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { HERBS_FALLBACK } from '../../constants/herbs.js';
import { CONDITION_GROUPS } from '../../constants/conditions.js';
import {
  SUPABASE_READY, SUPABASE_URL, SUPABASE_ANON_KEY, sbFetchApprovedFull, sbFetchStaticHerbs, sbFetchHerbMerges, sbAddMerge, sbRemoveMerge,
  sbFetchNotDuplicates, sbAddNotDuplicate, sbRemoveNotDuplicate, sbUpdateHerb, sbInsertStaticHerb,
  sbMoveHerbPhoto, sbLogHerbEdit,
} from '../../lib/supabase.js';
import { mergeHerbs } from '../../lib/herbs.js';
import { findDuplicatePairs, splitNames, combineLists, STRENGTH_LABEL } from '../../lib/dupes.js';
import { useContent, herbKey, formatDate } from '../../lib/content.js';

const FIELDS = [
  ["name", "Name"], ["latinName", "Latin name"], ["category", "Category"], ["origin", "Origin"], ["description", "Description"],
];
const LISTS = [["altNames", "Other names"], ["uses", "Uses"], ["conditions", "Conditions"]];
const condLabel = id => (CONDITION_GROUPS.find(g => g.id === id) || {}).label || id;
const isBuiltIn = h => String(h.ref).startsWith("builtin:");
const kind = h => isBuiltIn(h) ? "built-in herb" : "published " + (h.created_at ? formatDate(h.created_at.slice(0, 10), false) : "");

// The values a herb would be saved with.
function valuesOf(h) {
  return {
    name: h.name || "", latinName: h.latinName || h.latin || "", category: h.category || "", origin: h.origin || "",
    description: h.description || "", altNames: h.altNames || [], uses: h.uses || [], conditions: h.conditions || [],
    pubmedCount: h.pubmedCount || h.pubmed_count || 0, color: h.color || "#a8c5a0",
  };
}
function toRow(v) {
  return {
    name: v.name, latin: v.latinName, category: v.category || "Herbal Medicine", origin: v.origin, description: v.description,
    other_names: v.altNames.join(", "), uses: v.uses, conditions: v.conditions, color: v.color, pubmed_count: v.pubmedCount || null,
  };
}

export default function HerbMergeAdmin({ adminLabel = "Admin", onError }) {
  const { herbPhotos } = useContent();
  const [approved, setApproved] = useState([]);
  const [statics, setStatics] = useState(HERBS_FALLBACK);
  const [merges, setMerges] = useState([]);
  const [notDupes, setNotDupes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(!!SUPABASE_READY);   // live database with step 5 run?
  const [merging, setMerging] = useState(null);   // { a, b }
  const [pickA, setPickA] = useState("");
  const [pickB, setPickB] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  async function load() {
    const [rows, st, mg, nd] = await Promise.all([
      sbFetchApprovedFull(), sbFetchStaticHerbs(), sbFetchHerbMerges(true), sbFetchNotDuplicates(),
    ]);
    setApproved(rows);
    if (st.length) setStatics(st);
    setMerges(mg);
    setNotDupes(nd);
    // Is the merges table there? (An empty answer and a missing table look alike, so ask.)
    if (SUPABASE_READY) {
      try {
        const r = await fetch(SUPABASE_URL + "/rest/v1/herb_merges?select=from_ref&limit=1", { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } });
        setReady(r.ok);
      } catch { setReady(false); }
    }
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  // Oldest first, as the Herbarium lists them, so every herb gets the same address here.
  const shaped = useMemo(() => approved.slice().sort((x, y) => String(x.created_at || "").localeCompare(String(y.created_at || ""))).map(r => ({
    ...r, uuid: r.id, ref: "approved:" + r.id, latinName: r.latin, altNames: splitNames(r.other_names),
    uses: Array.isArray(r.uses) ? r.uses : splitNames(r.uses), pubmedCount: r.pubmed_count || 0,
  })), [approved]);
  const herbs = useMemo(() => mergeHerbs(statics, shaped, merges), [statics, shaped, merges]);
  const allByRef = useMemo(() => Object.fromEntries(mergeHerbs(statics, shaped).map(h => [h.ref, h])), [statics, shaped]);
  const pairs = useMemo(() => findDuplicatePairs(herbs, new Set(notDupes)), [herbs, notDupes]);
  const sorted = herbs.slice().sort((x, y) => x.name.localeCompare(y.name));

  async function notDuplicate(p) {
    try { await sbAddNotDuplicate(p.key, adminLabel); setNotDupes(n => [...n, p.key]); }
    catch (e) { onError && onError(e.message); }
  }
  async function undoNotDuplicate(key) {
    try { await sbRemoveNotDuplicate(key); setNotDupes(n => n.filter(k => k !== key)); }
    catch (e) { onError && onError(e.message); }
  }
  async function undoMerge(m) {
    if (!window.confirm("Undo this merge? " + (m.from_name || "The herb") + " will show in the Herbarium again" + (m.before && m.before.values ? ", and " + (m.into_name || "the kept herb") + " goes back to how it was before the merge." : "."))) return;
    setBusy(true);
    try {
      const keeper = allByRef[m.into_ref];
      if (m.before && m.before.values && keeper && !isBuiltIn(keeper)) {
        await sbUpdateHerb(keeper.uuid, toRow(m.before.values), adminLabel);
      }
      await sbRemoveMerge(m.from_ref);
      if (keeper && !isBuiltIn(keeper)) await sbLogHerbEdit(keeper.uuid, keeper.name, "unmerge", adminLabel, { unmerged: m.from_ref, unmerged_name: m.from_name });
      setDone("Undone: " + (m.from_name || "the herb") + " is back in the Herbarium.");
      await load();
    } catch (e) { onError && onError(e.message); }
    setBusy(false);
  }

  function openMerge(a, b) {
    // Keep a published herb rather than a built-in one, and the older of two published ones.
    const keepFirst = isBuiltIn(a) === isBuiltIn(b) ? (a.created_at || "") <= (b.created_at || "") : !isBuiltIn(a);
    setMerging(keepFirst ? { a, b } : { a: b, b: a });
    setDone("");
  }

  if (!loaded) return <p className="cadmin-hint">Loading…</p>;

  return (
    <section className="herb-merge">
      <div className="cadmin-section-head"><h2>Duplicates</h2></div>
      <p className="cadmin-hint">Herbs that may be the same plant, found from their names, other names and Latin names. Merging keeps one herb (and its address); the other is hidden, its address forwards to the kept herb, and the merge can be undone. Submissions that match a herb are shown in <Link to="/admin/herbreview">Herb review</Link>.</p>
      {!ready && (SUPABASE_READY
        ? <p className="cadmin-problem" role="alert">Merging is not switched on yet: it needs database step 5 (supabase/migrations/20261124_step5_duplicates_merge.sql). The list below still shows possible duplicates.</p>
        : <p className="cadmin-note">Merging works on the live database. This preview is not connected to it, so the list below is only for looking.</p>)}
      {done && <p className="cadmin-done" role="status">{done}</p>}

      <h3 className="cadmin-h3">Possible duplicates {pairs.length > 0 && <span className="cadmin-count">{pairs.length}</span>}</h3>
      {pairs.length === 0 && <p className="cadmin-empty">No possible duplicates found.</p>}
      <div className="cadmin-list">
        {pairs.map(p => (
          <div className="cadmin-item" key={p.key} data-pair={p.key}>
            <div className="cadmin-item-main">
              <p className="cadmin-item-title">{p.a.name} <span className="cadmin-item-meta" style={{ display: "inline" }}>and</span> {p.b.name}</p>
              <p className="cadmin-item-meta"><span className={"dupe-badge " + p.strength}>{STRENGTH_LABEL[p.strength]}</span> {p.reasons.join("; ")}</p>
              <p className="cadmin-item-meta"><em>{p.a.latinName || "no Latin name"}</em> ({kind(p.a)}) · <em>{p.b.latinName || "no Latin name"}</em> ({kind(p.b)})</p>
            </div>
            <div className="cadmin-item-actions">
              <button type="button" className="cadmin-btn solid" disabled={!ready} onClick={() => openMerge(p.a, p.b)}>Merge…</button>
              <button type="button" className="cadmin-btn" disabled={!ready} onClick={() => notDuplicate(p)}>Not a duplicate</button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="cadmin-h3">Merge any two herbs</h3>
      <div className="cadmin-filter">
        <label className="visually-hidden" htmlFor="mg-a">First herb</label>
        <select id="mg-a" value={pickA} onChange={e => setPickA(e.target.value)}>
          <option value="">Choose a herb…</option>
          {sorted.map(h => <option key={h.ref} value={h.ref}>{h.name}{h.latinName ? " (" + h.latinName + ")" : ""}{isBuiltIn(h) ? " · built-in" : ""}</option>)}
        </select>
        <label className="visually-hidden" htmlFor="mg-b">Second herb</label>
        <select id="mg-b" value={pickB} onChange={e => setPickB(e.target.value)}>
          <option value="">…and the herb it duplicates</option>
          {sorted.filter(h => h.ref !== pickA).map(h => <option key={h.ref} value={h.ref}>{h.name}{h.latinName ? " (" + h.latinName + ")" : ""}{isBuiltIn(h) ? " · built-in" : ""}</option>)}
        </select>
        <button type="button" className="cadmin-btn solid" disabled={!ready || !pickA || !pickB || pickA === pickB}
          onClick={() => openMerge(herbs.find(h => h.ref === pickA), herbs.find(h => h.ref === pickB))}>Merge…</button>
      </div>

      <h3 className="cadmin-h3">Merged herbs {merges.length > 0 && <span className="cadmin-count plain">{merges.length}</span>}</h3>
      {merges.length === 0 && <p className="cadmin-empty">Nothing has been merged.</p>}
      <div className="cadmin-list">
        {merges.map(m => (
          <div className="cadmin-item" key={m.from_ref}>
            <div className="cadmin-item-main">
              <p className="cadmin-item-title">{m.from_name || m.from_ref} → {m.into_name || m.into_ref}</p>
              <p className="cadmin-item-meta">Merged {m.merged_at ? formatDate(m.merged_at.slice(0, 10), false) : ""}{m.merged_by ? " by " + m.merged_by : ""}. Hidden from the Herbarium; its address forwards to {m.into_name || "the kept herb"}.</p>
            </div>
            <div className="cadmin-item-actions">
              <button type="button" className="cadmin-btn" disabled={busy} onClick={() => undoMerge(m)}>Undo merge</button>
            </div>
          </div>
        ))}
      </div>

      {notDupes.length > 0 && (
        <>
          <h3 className="cadmin-h3">Marked “not a duplicate” <span className="cadmin-count plain">{notDupes.length}</span></h3>
          <div className="cadmin-list">
            {notDupes.map(k => {
              const [x, y] = k.split("|").map(r => allByRef[r]);
              return (
                <div className="cadmin-item" key={k}>
                  <div className="cadmin-item-main"><p className="cadmin-item-meta">{x ? x.name : k.split("|")[0]} and {y ? y.name : k.split("|")[1]}</p></div>
                  <div className="cadmin-item-actions"><button type="button" className="cadmin-btn" onClick={() => undoNotDuplicate(k)}>Put back on the list</button></div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {merging && (
        <MergeDialog
          pair={merging}
          herbPhotos={herbPhotos}
          adminLabel={adminLabel}
          onSwap={() => setMerging(m => ({ a: m.b, b: m.a }))}
          onCancel={() => setMerging(null)}
          onDone={async msg => { setMerging(null); setDone(msg); setPickA(""); setPickB(""); await load(); }}
        />
      )}
    </section>
  );
}

function MergeDialog({ pair, herbPhotos, adminLabel, onSwap, onCancel, onDone }) {
  const { a: keep, b: other } = pair;     // a is kept, b is merged into it
  const K = valuesOf(keep), O = valuesOf(other);
  const [pick, setPick] = useState(() => Object.fromEntries(FIELDS.map(([f]) => [f, K[f] ? "keep" : (O[f] ? "other" : "keep")])));
  const [listPick, setListPick] = useState({ altNames: "both", uses: "both", conditions: "both" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setPick(Object.fromEntries(FIELDS.map(([f]) => [f, K[f] ? "keep" : (O[f] ? "other" : "keep")])));
  }, [keep.ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const listValue = f => listPick[f] === "keep" ? K[f] : listPick[f] === "other" ? O[f] : combineLists(K[f], O[f]);
  const final = {
    ...K,
    ...Object.fromEntries(FIELDS.map(([f]) => [f, pick[f] === "other" ? O[f] : K[f]])),
    altNames: listValue("altNames").filter(n => n.toLowerCase() !== (pick.name === "other" ? O.name : K.name).toLowerCase()),
    uses: listValue("uses"), conditions: listValue("conditions"),
    pubmedCount: Math.max(K.pubmedCount || 0, O.pubmedCount || 0),
  };
  // A name that is dropped stays findable as an other name.
  const droppedName = pick.name === "other" ? K.name : O.name;
  if (droppedName && droppedName.toLowerCase() !== final.name.toLowerCase() && !final.altNames.some(n => n.toLowerCase() === droppedName.toLowerCase())) {
    final.altNames = [...final.altNames, droppedName];
  }
  const keepPhoto = herbPhotos[herbKey(keep.name)], otherPhoto = herbPhotos[herbKey(other.name)];

  async function apply() {
    setSaving(true); setError("");
    try {
      let keeperRef = keep.ref, keeperId = keep.uuid, before = null;
      if (isBuiltIn(keep)) {
        const row = await sbInsertStaticHerb(toRow(final), adminLabel);   // an editable published copy
        keeperRef = "approved:" + row.id; keeperId = row.id;
      } else {
        before = { values: K };
        await sbUpdateHerb(keep.uuid, toRow(final), adminLabel);
      }
      await sbAddMerge({ from_ref: other.ref, into_ref: keeperRef, from_name: other.name, into_name: final.name, merged_by: adminLabel, before });
      // Photos are kept by name: keep the kept herb's photo under its (maybe new) name, or
      // move the other herb's photo across if the kept herb has none.
      const toKey = herbKey(final.name);
      if (keepPhoto && herbKey(keep.name) !== toKey) await sbMoveHerbPhoto(herbKey(keep.name), toKey, final.name);
      else if (!keepPhoto && otherPhoto && herbKey(other.name) !== toKey) await sbMoveHerbPhoto(herbKey(other.name), toKey, final.name);
      await sbLogHerbEdit(keeperId, final.name, "merge", adminLabel, { merged_from: other.ref, merged_from_name: other.name, kept: toRow(final) });
      onDone(other.name + " was merged into " + final.name + ".");
    } catch (e) {
      setError(e.message || String(e));
      setSaving(false);
    }
  }

  const radio = (f, side, text) => (
    <div><label><input type="radio" name={"mf-" + f} checked={pick[f] === side} onChange={() => setPick(p => ({ ...p, [f]: side }))} />
      <span>{text ? (f === "latinName" ? <em>{text}</em> : f === "description" ? text.slice(0, 220) + (text.length > 220 ? "…" : "") : text) : <span className="cmp-note">empty</span>}</span></label></div>
  );
  const chips = (f, list) => list.length ? list.map(x => <span className="cmp-chip" key={x}>{f === "conditions" ? condLabel(x) : x}</span>) : <span className="cmp-note">none</span>;

  return (
    <div className="completion-overlay">
      <div className="completion-panel" role="dialog" aria-label="Merge two herbs" style={{ width: "min(960px, 96vw)" }}>
        <div className="completion-header">
          <span className="cp-eyebrow">Merge two herbs</span>
          <h3 className="cp-herb-name">{other.name} → {keep.name}</h3>
        </div>
        <div className="completion-body">
          <p className="cadmin-hint" style={{ margin: 0 }}>For each line, pick the version to keep. <button type="button" className="cadmin-btn" onClick={onSwap}>Keep the other herb instead</button></p>
          <div className="cmp-grid">
            <div className="cmp-h">Field</div>
            <div className="cmp-h">Kept: {keep.name} · {kind(keep)} · /educate/hs/{keep.slug}</div>
            <div className="cmp-h">Merged in: {other.name} · {kind(other)} · /educate/hs/{other.slug}</div>
            {FIELDS.map(([f, label]) => (
              <FieldRow key={f} label={label}>{radio(f, "keep", K[f])}{radio(f, "other", O[f])}</FieldRow>
            ))}
            {LISTS.map(([f, label]) => (
              <FieldRow key={f} label={label}>
                <div>{chips(f, K[f])}</div>
                <div>{chips(f, O[f])}
                  <span className="cmp-note" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
                    {[["keep", "keep left"], ["other", "keep right"], ["both", "combine"]].map(([v, t]) => (
                      <label key={v} style={{ display: "inline-flex" }}><input type="radio" name={"ml-" + f} checked={listPick[f] === v} onChange={() => setListPick(p => ({ ...p, [f]: v }))} /> {t}</label>
                    ))}
                  </span>
                </div>
              </FieldRow>
            ))}
            <FieldRow label="Literature count"><div>{K.pubmedCount || "—"}</div><div>{O.pubmedCount || "—"} <span className="cmp-note">the higher count is kept</span></div></FieldRow>
            <FieldRow label="Photo"><div>{keepPhoto ? "has a photo" : <span className="cmp-note">none</span>}</div><div>{otherPhoto ? (keepPhoto ? "has a photo (the kept herb’s photo stays)" : "has a photo: it moves to the kept herb") : <span className="cmp-note">none</span>}</div></FieldRow>
            <FieldRow label="Address"><div>/educate/hs/{keep.slug} <span className="cmp-note">stays</span></div><div>/educate/hs/{other.slug} <span className="cmp-note">forwards to the kept herb</span></div></FieldRow>
          </div>
          {isBuiltIn(keep) && <p className="cmp-note">{keep.name} is a built-in herb: merging publishes an editable copy of it with the values above.</p>}
          {isBuiltIn(other) && <p className="cmp-note">{other.name} is a built-in herb: it is hidden from the Herbarium.</p>}
          {error && <div style={{ color: "#c62828", fontFamily: "'DM Mono', monospace", fontSize: 11 }} role="alert">{error}</div>}
        </div>
        <div className="completion-footer">
          <button className="admin-btn outline" onClick={onCancel}>Cancel</button>
          <button className="admin-btn solid" onClick={apply} disabled={saving}>{saving ? "Merging…" : "Merge into one herb →"}</button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (<><div className="cmp-f">{label}</div>{children}</>);
}
