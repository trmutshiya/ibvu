// IBVU v5.7 — what changed in this file: the "IBVU" title is now marked as the
// page's main heading (for search engines and screen readers). It looks the same.
//
// IBVU v5.5 — what changed in this file since v5.4.1:
// - Removed the "Herbarium Scientifica · From the Earth" line from the bottom
//   of the animation.
//
// IBVU v5.4.1 — what changed in this file since v5.4:
// - The scroll-down arrow under the tree is now a drawn shape instead of a
//   text character (part of the fix for the arrow glitch; the rest is in index.css).
//
// IBVU v5.2 — what changed in this file since v5.1:
// - This is now the hero at the top of a scrolling home page (it used to be
//   the whole page). The animation itself is unchanged.
// - The "Enter Herbarium" button is removed. The Herbarium is reached through
//   Educate in the header, or "Explore Education" further down the page.
// - The About and Contact links that sat either side of that button are
//   removed too: both are now in the header.
// - In their place is a small scroll-down cue that appears when the animation ends.
// - The About / Contact overlays moved out of this file (see InfoPanel.jsx).
import { BRANCHES, TREE_START, LEVEL_DUR, BRANCH_DUR, LEAVES_AT, MOTES, DROPLETS } from '../constants/animation.js';

export default function Landing({ skipped, onSkip, onScrollDown }) {
  return (
    <section id="home-hero" className={"ibvu-landing" + (skipped ? " anim-skip" : "")}>
      <button className="skip-btn" onClick={onSkip}>skip ›</button>
      <div className="atm">
        {MOTES.map(m => (
          <div key={m.id} className="mote" style={{ left: m.x + "%", top: m.y + "%", width: m.size, height: m.size, "--d": m.dur, "--dl": m.delay }} />
        ))}
      </div>
      <h1 className="ibvu-title">IBVU</h1>
      <div className="ibvu-lower">ibvu</div>
      <div className="scene">
        <div className="bowl-wrap">
          <svg width="100" height="66" viewBox="0 0 100 66" fill="none">
            <ellipse cx="50" cy="22" rx="40" ry="13" stroke="#c9a84c" strokeWidth="1.5" fill="rgba(201,168,76,0.06)" />
            <path d="M10 22 Q50 62 90 22" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <ellipse cx="50" cy="22" rx="30" ry="6" fill="rgba(120,200,240,0.42)" />
            <ellipse cx="46" cy="21" rx="11" ry="2.5" fill="rgba(190,235,255,0.28)" />
            <path d="M90 22 Q100 14 97 5" stroke="#c9a84c" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="water-pour" />
        {DROPLETS.map(d => (
          <div key={d.id} className="droplet" style={{ left: d.left, top: d.top, width: d.size, height: d.size, "--dd": d.dur, "--ddl": d.delay, "--dx": d.dx, "--dy": d.dy }} />
        ))}
        <div className="ripple" />
        <div className="ripple2" />
        <div className="wet-earth" />
        <svg style={{ position: "absolute", bottom: 50, left: "50%", transform: "translateX(-50%)", overflow: "visible" }} width="300" height="310" viewBox="0 0 300 310" fill="none">
          {BRANCHES.map(b => (
            <line key={b.id} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={b.color} strokeWidth={b.sw} strokeLinecap="round"
              style={{ strokeDasharray: b.len, strokeDashoffset: b.len, animation: `drawBranch ${BRANCH_DUR}s ease-out forwards ${(TREE_START + b.level * LEVEL_DUR).toFixed(2)}s` }} />
          ))}
          {BRANCHES.filter(b => b.isLeaf).map(b => (
            <circle key={"lf" + b.id} cx={b.x2} cy={b.y2} r="4" fill="rgba(138,171,138,0.85)"
              style={{ transformOrigin: `${b.x2}px ${b.y2}px`, opacity: 0, transform: "scale(0)", animation: `leafBloom 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards ${LEAVES_AT.toFixed(2)}s` }} />
          ))}
        </svg>
      </div>
      <button className="scroll-cue" onClick={onScrollDown} aria-label="Scroll down to read about IBVU">
        <span className="scroll-cue-line" />
        <span className="scroll-cue-arrow" />
      </button>

    </section>
  );
}
