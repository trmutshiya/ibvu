// IBVU v6.10 — what changed in this file: ImageField keeps a newsletter cover's width
// (see src/lib/frame.js) when the caption or framing is changed; a new picture starts
// without one (the newsletter then sets it to tile size).
//
// IBVU v6.09 — what changed in this file: ImageField can take a caption (withCaption):
// a "Caption (optional)" box under the picture and in the framing window. Used for
// article, blog and newsletter covers; the caption is kept with the picture (see
// src/lib/frame.js), so nothing in the database changes. Reset framing keeps the caption.
//
// IBVU v6.06 — what changed in this file: herb photos are framed as a square (the herb
// page and the Herbarium list show them as small square tiles).
//
// IBVU v6.04 — what changed in this file: the image picker frames pictures.
// After a picture is chosen the framing window opens (move, zoom in, turn,
// reset; FrameEditor.jsx). "Frame picture" opens it again at any time, also
// for the built-in photos. The small preview shows the picture as framed, and
// a line says how big a picture works best.
//
// IBVU v6.03 — new file. Small pieces shared by the admin screens (they were
// inside AdminArea.jsx until v6.02 and are unchanged): the delete button with
// an "are you sure" step, and the image picker that uploads a picture.
import { useState, useRef, useEffect } from 'react';
import { uploadSiteImage } from '../../lib/content.js';
import { parseImage, buildImage, isDefaultFrame } from '../../lib/frame.js';
import FrameEditor, { FramePreview } from './FrameEditor.jsx';

// Delete with an "are you sure" step, without a browser pop-up.
export function DeleteButton({ onDelete, label = "Delete", question = "Delete for good?", confirmLabel = "Yes, delete" }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className="cadmin-btn danger" onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span className="cadmin-confirm">
      {question}
      <button type="button" className="cadmin-btn danger solid" onClick={() => { setAsking(false); onDelete(); }}>{confirmLabel}</button>
      <button type="button" className="cadmin-btn" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}

// shapes: where the picture appears, e.g. [{ label: "Tile", ratio: 3 / 2 }].
// fallback: the built-in photo used when none is chosen (page pictures).
// hint: a line under the buttons (by default, the best size to upload).
export const SHAPES = {
  tile: { label: "Tile", ratio: 3 / 2 },
  event: { label: "Event picture (upcoming and past)", ratio: 3 / 2 },
  wide: { label: "Picture", ratio: 3 / 2 },
  herb: { label: "Herb photo (herb page and Herbarium list)", ratio: 1 },
};

export function ImageField({ value, onChange, onError, label = "Image", folder = "pages", shapes = [SHAPES.tile], fallback = "", hint = "Best at least 1200 pixels wide.", withCaption = false }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [framing, setFraming] = useState(false);
  const [saving, setSaving] = useState(false);
  const parsed = parseImage(value);
  const original = parsed.orig || parsed.src;        // the picture as uploaded
  const showSrc = parsed.orig ? parsed.orig : (parsed.src || fallback);
  const own = !!(parsed.src || parsed.orig);
  const caption = parsed.caption || "";
  const [capText, setCapText] = useState(caption);
  useEffect(() => { setCapText(caption); }, [caption]);
  const setCaption = text => onChange(buildImage(parsed.src, parsed.frame, parsed.orig, text.trim(), parsed.width));

  async function pick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try { onChange(buildImage(await uploadSiteImage(file, { folder }), null, "", withCaption ? caption : "")); setFraming(true); } catch (err) { onError(err.message); }
    setBusy(false);
  }

  async function saveFrame({ frame, rotatedFile, caption: newCaption }) {
    setSaving(true);
    try {
      let src = original || "";
      if (rotatedFile) src = await uploadSiteImage(rotatedFile, { folder });
      const cap = withCaption ? (newCaption || "") : "";
      setCapText(cap);
      onChange(buildImage(src, frame, "", cap, rotatedFile ? 0 : parsed.width));
      setFraming(false);
    } catch (err) { onError(err.message); }
    setSaving(false);
  }

  return (
    <div className="cadmin-image">
      {showSrc
        ? <FramePreview src={showSrc} frame={parsed.frame} ratio={shapes[0].ratio} className="cadmin-image-preview" />
        : <div className="cadmin-image-empty">{busy ? "Uploading…" : "No image chosen"}</div>}
      <div className="cadmin-image-actions">
        <button type="button" className="cadmin-btn" disabled={busy} onClick={() => ref.current.click()}>{busy ? "Uploading…" : own ? "Change image" : "Choose " + label.toLowerCase()}</button>
        {showSrc && <button type="button" className="cadmin-btn" onClick={() => setFraming(true)}>Frame picture</button>}
        {(parsed.orig || (parsed.frame && !isDefaultFrame(parsed.frame))) && <button type="button" className="cadmin-btn" onClick={() => onChange(buildImage(parsed.orig || parsed.src, null, "", caption, parsed.width))}>Reset framing</button>}
        {own && <button type="button" className="cadmin-btn" onClick={() => onChange("")}>{fallback ? "Use the built-in photo" : "Remove"}</button>}
      </div>
      {hint && <p className="cadmin-hint cadmin-image-hint">{hint}</p>}
      {withCaption && own && (
        <div className="cadmin-field cadmin-image-caption">
          <label>Caption (optional, shown under the picture when the {label.toLowerCase().includes("cover") ? "item" : "page"} is open)
            <input value={capText} maxLength={200} placeholder="No caption" onChange={e => setCapText(e.target.value)} onBlur={() => { if (capText.trim() !== caption) setCaption(capText); }} />
          </label>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      {framing && showSrc && (
        <FrameEditor src={showSrc} frame={parsed.frame} shapes={shapes} caption={withCaption ? caption : undefined} busy={saving} title={"Frame the " + label.toLowerCase()}
          onCancel={() => setFraming(false)} onSave={saveFrame} />
      )}
    </div>
  );
}
