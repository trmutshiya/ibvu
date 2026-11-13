// IBVU v6.03 — new file. Small pieces shared by the admin screens (they were
// inside AdminArea.jsx until v6.02 and are unchanged): the delete button with
// an "are you sure" step, and the image picker that uploads a picture.
import { useState, useRef } from 'react';
import { uploadSiteImage } from '../../lib/content.js';

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

export function ImageField({ value, onChange, onError, label = "Image", folder = "pages" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadSiteImage(file, { folder })); } catch (err) { onError(err.message); }
    setBusy(false);
  }
  return (
    <div className="cadmin-image">
      {value ? <img src={value} alt="" /> : <div className="cadmin-image-empty">{busy ? "Uploading…" : "No image chosen"}</div>}
      <div className="cadmin-image-actions">
        <button type="button" className="cadmin-btn" disabled={busy} onClick={() => ref.current.click()}>{busy ? "Uploading…" : value ? "Change image" : "Choose " + label.toLowerCase()}</button>
        {value && <button type="button" className="cadmin-btn" onClick={() => onChange("")}>Remove</button>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}

