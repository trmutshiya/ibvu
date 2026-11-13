// IBVU v6.06 — what changed in this file:
// - The herb photo is a small square tile (about 5 × 5 cm on a laptop, 3 × 3 cm on a
//   phone) beside the herb's name, instead of a large picture under it. Clicking it
//   shows the whole photo full screen. The "educational purposes" line sits under it.
// - Related herbs: up to four other herbs that share the most conditions, as cards
//   (with their photo tiles), above the share links.
//
// IBVU v6.04 — what changed in this file: the herb photo is shown as framed in admin → Herb photos.
//
// IBVU v5.92 — what changed in this file: the share link uses the herb's own address (herb.slug).
//
// IBVU v5.9 — what changed in this file: the line under a herb photo now comes from admin → Pages → Herbarium (same wording as before until edited).
//
// IBVU v5.7 — what changed in this file: an approved photo of the herb, when
// there is one, is shown under the heading with a small "educational purposes"
// line beneath it. Share buttons (LinkedIn, WhatsApp, copy link) sit at the
// foot of the herb's page. Nothing else changed.
import { useState } from 'react';
import Framed from './Framed.jsx';
import HerbCard from './HerbCard.jsx';
import { Lightbox } from './Media.jsx';
import { wholeSrc } from '../lib/frame.js';
import ScientificSection from './ScientificSection.jsx';
import { useHerbPhoto, herbKey, usePage } from '../lib/content.js';
import { ShareButtons } from './Share.jsx';

// Other herbs for the same conditions, most shared conditions first.
function relatedHerbs(herb, herbs, count = 4) {
  const mine = new Set(herb.conditions || []);
  if (!mine.size || !herbs) return [];
  return herbs
    .filter(h => h.slug !== herb.slug && herbKey(h.name) !== herbKey(herb.name) && !h.duplicate)
    .map(h => ({ h, score: (h.conditions || []).filter(c => mine.has(c)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.h.name.localeCompare(b.h.name))
    .slice(0, count)
    .map(x => x.h);
}

export default function HerbProfile({ herb, herbs, conditionId, onBack }) {
  const photo = useHerbPhoto(herb.name);
  const words = usePage("herbarium");
  const [big, setBig] = useState(false);
  const related = relatedHerbs(herb, herbs);
  return (
    <div>
      <button className="back-btn" onClick={onBack}>← All Herbs</button>
      <div className="profile-header">
        <div>
          <h1>{herb.name}</h1>
          <p className="latin">{herb.latinName}</p>
          <div className="tags">
            <span className="tag">{herb.category}</span>
            <span className="tag gold">{herb.family}</span>
          </div>
        </div>
        {photo && (
          <figure className="herb-thumb">
            <button type="button" className="herb-thumb-btn" onClick={() => setBig(true)} aria-label={"View the photo of " + herb.name + " full size"}>
              <Framed value={photo} ratio="1" alt={"Photo of " + herb.name} />
            </button>
            {words.photoCaption && <figcaption>{words.photoCaption}</figcaption>}
          </figure>
        )}
      </div>
      {big && <Lightbox src={wholeSrc(photo)} alt={"Photo of " + herb.name} onClose={() => setBig(false)} />}
      <div className="sections">
        <div className="section">
          <div className="section-header"><span className="section-icon">☿</span><span className="section-label">Identity</span></div>
          <div className="section-body">
            <div className="info-grid">
              <div className="info-item"><label>Common Name</label><p>{herb.name}</p></div>
              <div className="info-item"><label>Latin Name</label><p><em>{herb.latinName}</em></p></div>
              <div className="info-item"><label>Plant Family</label><p>{herb.family}</p></div>
              <div className="info-item"><label>Origin</label><p>{herb.origin}</p></div>
              <div className="info-item"><label>Part Used</label><p>{herb.partUsed}</p></div>
              <div className="info-item"><label>Category</label><p>{herb.category}</p></div>
            </div>
          </div>
        </div>
        <div className="section">
          <div className="section-header"><span className="section-icon">◈</span><span className="section-label">Other Names</span></div>
          <div className="section-body">
            <div className="alt-names">
              {(herb.altNames || []).map((n, i) => <span className="alt-name" key={i}>{n}</span>)}
              {(!herb.altNames || herb.altNames.length === 0) && <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Not recorded</span>}
            </div>
          </div>
        </div>
        <div className="section">
          <div className="section-header"><span className="section-icon">✦</span><span className="section-label">Overview</span></div>
          <div className="section-body">
            <p style={{ lineHeight: 1.8, fontSize: "1.05rem", color: "var(--bark)", marginBottom: 20 }}>{herb.description}</p>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>Traditional Uses</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {herb.uses.map((u, i) => <span className="tag" key={i}>{u}</span>)}
              </div>
            </div>
          </div>
        </div>
        <div className="section">
          <div className="section-header"><span className="section-icon">⚗</span><span className="section-label">Scientific Literature</span></div>
          <div className="section-body"><ScientificSection herb={herb} conditionId={conditionId} /></div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="related-herbs" aria-labelledby="related-heading">
          <h2 id="related-heading" className="related-title">Related herbs</h2>
          <p className="related-sub">Other herbs for the same conditions</p>
          <div className="related-grid">{related.map(h => <HerbCard herb={h} key={h.slug || h.name} />)}</div>
        </section>
      )}
      <ShareButtons path={"/educate/hs/" + (herb.slug || herbKey(herb.name))} text={herb.name + " in the IBVU Herbarium Scientifica"} label="Share this herb" />
    </div>
  );
}
