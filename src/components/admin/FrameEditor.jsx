// IBVU v6.09 — what changed in this file:
// - allowWhole: a "Show the whole photo" tick box (herb photos). When ticked the
//   box takes the photo's own shape, so nothing is cut off and there is no empty
//   edge; moving and resizing are switched off. Saved as frame.whole.
// - caption: when given, a "Caption (optional)" box sits under the picture, so a
//   caption can be added straight after a picture is chosen. onSave also returns
//   { caption }.
//
// IBVU v6.05 — what changed in this file since v6.04: the framing window now
// works like the trial Tatenda approved (ibvu-picture-resize-trial-v2.html).
// The gold box is the tile (or the chosen shape) and keeps its size. The
// whole picture is shown faintly around it.
// - Drag the picture to move it inside the box.
// - Drag a corner of the picture to make it larger or smaller (the opposite
//   corner stays put). Smallest = it just fills the box, so there is never an
//   empty edge; largest = three times that. Handles stay reachable at the
//   edge of the dark area.
// - Smaller / Larger / Centre it / Reset buttons; arrow keys move it, + and −
//   change its size. Turn left or right as before.
// - The other places the picture appears are previewed underneath.
// What is saved is unchanged from v6.04 (the point kept in view and the zoom,
// see src/lib/frame.js), so pictures framed in v6.04 open as they were.
//
// IBVU v6.04 — new file. The framing window used everywhere a picture is
// chosen in admin (tiles, covers, page pictures, event pictures, herb photos,
// newsletter covers, and pictures inside articles, posts and newsletters).
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { DEFAULT_FRAME, frameStyles, rotateImage, loadImage } from '../../lib/frame.js';

// One frame showing the picture as it will appear.
export function FramePreview({ src, frame, ratio, className = "", ...rest }) {
  const s = frameStyles(frame && frame.whole ? null : frame);
  if (frame && frame.whole) s.img = { ...s.img, objectFit: "contain" };
  return (
    <div className={"frame-box " + className} style={{ aspectRatio: String(ratio) }} {...rest}>
      <span style={{ ...s.outer, width: "100%", height: "100%" }}>
        <span style={s.move}><img src={src} alt="" style={s.img} draggable="false" /></span>
      </span>
    </div>
  );
}

const MAX_ZOOM = 3;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// framing (x, y, zoom) <-> the picture's place in the box (left, top, width)
function coverWidth(W, H, nat) { return Math.max(W, H * nat); }
function toPos(f, W, H, nat) {
  const w = coverWidth(W, H, nat) * f.z, h = w / nat;
  return { l: -(w - W) * f.x / 100, t: -(h - H) * f.y / 100, w };
}
function toFrame(p, W, H, nat) {
  const cw = coverWidth(W, H, nat);
  const w = clamp(p.w, cw, cw * MAX_ZOOM), h = w / nat;
  const l = clamp(p.l, W - w, 0), t = clamp(p.t, H - h, 0);
  return {
    x: w > W + 0.5 ? clamp(-l / (w - W) * 100, 0, 100) : 50,
    y: h > H + 0.5 ? clamp(-t / (h - H) * 100, 0, 100) : 50,
    z: Math.round(w / cw * 1000) / 1000,
  };
}

// shapes: [{ label, ratio }]. The first is the main one.
// chooseShape: let the person pick the shape (pictures inside the text).
// onSave({ frame, rotatedFile, ratio, shape }) — shape is "original" when the picture keeps its own shape
export default function FrameEditor({ src, frame: initial, shapes, chooseShape = false, title = "Frame the picture", onSave, onCancel, busy = false, allowWhole = false, caption: initialCaption }) {
  const [frame, setFrame] = useState(() => { const { whole: _w, ...f } = { ...DEFAULT_FRAME, ...(initial || {}) }; return f; }); // eslint-disable-line no-unused-vars
  const [whole, setWhole] = useState(!!(initial && initial.whole));
  const [caption, setCaption] = useState(initialCaption || "");
  const withCaption = initialCaption !== undefined;
  const [shown, setShown] = useState(src);          // the picture being framed (changes after turning)
  const [rotatedFile, setRotatedFile] = useState(null);
  const [ratio, setRatio] = useState(shapes[0].ratio);
  const [nat, setNat] = useState(null);             // the picture's own shape (width / height)
  const [stageW, setStageW] = useState(0);
  const [working, setWorking] = useState("");
  const [problem, setProblem] = useState("");
  const stageRef = useRef(null);
  const dialogRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => { setNat(null); loadImage(shown).then(img => setNat(img.naturalWidth / img.naturalHeight)).catch(() => setProblem("The picture could not be loaded.")); }, [shown]);
  useEffect(() => {
    const prev = document.activeElement;
    dialogRef.current && dialogRef.current.focus();
    const onKey = e => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev && prev.focus && prev.focus(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const measure = () => stageRef.current && setStageW(stageRef.current.clientWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const shapeRatio = whole || ratio === "original" ? (nat || 1.5) : ratio;
  // the box: about 60% of the dark area's width, at most 260 px high
  const stageH = stageW < 480 ? 300 : 360;
  let W = Math.min(380, stageW * 0.62), H = W / shapeRatio;
  if (H > stageH - 110) { H = stageH - 110; W = H * shapeRatio; }
  const boxL = (stageW - W) / 2, boxT = (stageH - H) / 2;
  const ready = !!nat && stageW > 0;
  const shownFrame = whole ? DEFAULT_FRAME : frame;
  const pos = ready ? toPos(shownFrame, W, H, nat) : { l: 0, t: 0, w: 0 };
  const picH = ready ? pos.w / nat : 0;

  const setFromPos = useCallback(p => setFrame(toFrame(p, W, H, nat)), [W, H, nat]);
  const zoomBy = k => { // keep the middle of the box where it is
    const w = pos.w * k;
    setFromPos({ w, l: W / 2 - (W / 2 - pos.l) * k, t: H / 2 - (H / 2 - pos.t) * k });
  };

  // move: drag the picture inside the box
  function startMove(e) {
    if (!ready || whole) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode: "move", x: e.clientX, y: e.clientY, p: pos };
  }
  // resize: drag a corner; the opposite corner stays put
  function startResize(e, k) {
    if (!ready || whole) return;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode: "resize", k, x: e.clientX, y: e.clientY, p: pos, h: picH, sx: k.includes("r") ? 1 : -1, sy: k.includes("b") ? 1 : -1 };
  }
  function onMove(e) {
    const d = drag.current; if (!d) return;
    if (d.mode === "move") { setFromPos({ ...d.p, l: d.p.l + e.clientX - d.x, t: d.p.t + e.clientY - d.y }); return; }
    const dx = (e.clientX - d.x) * d.sx, dy = (e.clientY - d.y) * d.sy * nat;
    const cw = coverWidth(W, H, nat);
    const w = clamp(d.p.w + Math.max(dx, dy), cw, cw * MAX_ZOOM), h = w / nat;
    setFromPos({ w, l: d.sx === 1 ? d.p.l : d.p.l + d.p.w - w, t: d.sy === 1 ? d.p.t : d.p.t + d.h - h });
  }
  function endDrag() { drag.current = null; }
  function onKeyDown(e) {
    if (whole) return;
    const step = e.shiftKey ? 20 : 5;
    const m = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (m) { e.preventDefault(); setFromPos({ ...pos, l: pos.l + m[0], t: pos.t + m[1] }); }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.08); }
    if (e.key === "-") { e.preventDefault(); zoomBy(1 / 1.08); }
  }

  async function rotate(right) {
    setWorking("Turning the picture…"); setProblem("");
    try {
      const file = await rotateImage(shown, right);
      setRotatedFile(file);
      setShown(URL.createObjectURL(file));
      setFrame({ ...DEFAULT_FRAME });
    } catch (err) { setProblem(err.message); }
    setWorking("");
  }

  const others = chooseShape ? [] : shapes.slice(1);
  const pct = Math.round(shownFrame.z * 100);
  // corner handles: on the picture's corners, kept inside the dark area
  const corner = (x, y) => ({ left: clamp(x, 10, stageW - 10), top: clamp(y, 10, stageH - 10) });
  const L = boxL + pos.l, T = boxT + pos.t, R = L + pos.w, B = T + picH;
  const handles = { tl: corner(L, T), tr: corner(R, T), bl: corner(L, B), br: corner(R, B) };

  return (
    <div className="frame-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="frame-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialogRef}>
        <div className="frame-head">
          <h2>{title}</h2>
          <button type="button" className="cadmin-btn" onClick={onCancel}>Cancel</button>
        </div>

        {chooseShape && (
          <div className="frame-shapes" role="group" aria-label="Shape">
            {shapes.map(s => (
              <button type="button" key={s.label} className={"cadmin-btn" + (ratio === s.ratio ? " on" : "")} aria-pressed={ratio === s.ratio} onClick={() => { setRatio(s.ratio); setFrame({ ...DEFAULT_FRAME }); }}>{s.label}</button>
            ))}
          </div>
        )}

        {allowWhole && (
          <label className="cadmin-check frame-whole">
            <input type="checkbox" checked={whole} onChange={e => setWhole(e.target.checked)} />
            Show the whole photo (nothing cut off: the tile takes the photo's own shape)
          </label>
        )}
        {whole ? <p className="cadmin-hint frame-hint">The whole photo is shown, in its own shape, at the size of the tile. Untick the box to crop it into the square tile instead.</p> :
        <p className="cadmin-hint frame-hint">The gold box is {chooseShape ? "the picture's shape" : "the " + shapes[0].label.toLowerCase()} and keeps its size. <strong>Drag the picture</strong> to move it; <strong>drag a corner</strong> to make it larger or smaller. The faint part outside the box will not show.</p>}

        <div className="frame-stage" ref={stageRef} style={{ height: stageH }} onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          {ready && (
            <>
              <img className="frame-ghost" src={shown} alt="" draggable="false" style={{ left: L, top: T, width: pos.w, height: picH }} />
              <div className="frame-tile" style={{ left: boxL, top: boxT, width: W, height: H }}>
                <span className="frame-tile-label">{chooseShape ? "Shape" : shapes[0].label}</span>
                <div className="frame-clip" tabIndex={0} role="img" onPointerDown={startMove} onKeyDown={onKeyDown}
                  aria-label="The picture in its box. Drag to move it; arrow keys move it too; + and − change its size.">
                  <img src={shown} alt="" draggable="false" style={{ left: pos.l, top: pos.t, width: pos.w, height: picH }} />
                </div>
              </div>
              <span className="frame-outline" style={{ left: L, top: T, width: pos.w, height: picH }} />
              {!whole && Object.entries(handles).map(([k, at]) => (
                <span key={k} className={"frame-handle " + k} style={at} onPointerDown={e => startResize(e, k)} aria-hidden="true" />
              ))}
              <span className="frame-size">{whole ? "The whole photo" : "Size " + pct + "%" + (pct <= 100 ? " (just fills the box)" : "")}</span>
            </>
          )}
          {!ready && <p className="frame-loading">Loading the picture…</p>}
        </div>

        <div className="frame-row frame-buttons">
          <button type="button" className="cadmin-btn" disabled={!ready || whole || frame.z <= 1} onClick={() => zoomBy(1 / 1.1)}>− Smaller</button>
          <button type="button" className="cadmin-btn" disabled={!ready || whole || frame.z >= MAX_ZOOM} onClick={() => zoomBy(1.1)}>Larger +</button>
          <button type="button" className="cadmin-btn" disabled={!ready || whole} onClick={() => setFrame(f => ({ ...f, x: 50, y: 50 }))}>Centre it</button>
          <button type="button" className="cadmin-btn" disabled={!!working} onClick={() => rotate(false)}>↺ Turn left</button>
          <button type="button" className="cadmin-btn" disabled={!!working} onClick={() => rotate(true)}>↻ Turn right</button>
          <button type="button" className="cadmin-btn" onClick={() => { setFrame({ ...DEFAULT_FRAME }); setShown(src); setRotatedFile(null); setWhole(false); }}>Reset</button>
        </div>

        {!chooseShape && ready && (
          <div className="frame-others">
            <p className="cadmin-hint">How it will look:</p>
            <div className="frame-others-list">
              {[shapes[0], ...others].map(s => (
                <figure key={s.label}><FramePreview src={shown} frame={shownFrame} ratio={whole ? shapeRatio : s.ratio} /><figcaption>{s.label}</figcaption></figure>
              ))}
              <figure className="frame-phone"><FramePreview src={shown} frame={shownFrame} ratio={whole ? shapeRatio : shapes[0].ratio} /><figcaption>Small</figcaption></figure>
            </div>
          </div>
        )}

        {withCaption && (
          <div className="cadmin-field frame-caption">
            <label htmlFor="frame-caption">Caption (optional, shown under the picture)</label>
            <input id="frame-caption" value={caption} maxLength={200} placeholder="For example: Aloe vera growing in Harare" onChange={e => setCaption(e.target.value)} />
          </div>
        )}
        {working && <p className="cadmin-hint" role="status">{working}</p>}
        {problem && <p className="cadmin-problem" role="alert">{problem}</p>}
        <div className="frame-foot">
          <button type="button" className="cadmin-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="cadmin-btn solid" disabled={busy || !!working || !ready} onClick={() => onSave({ frame: whole ? { ...DEFAULT_FRAME, whole: true } : frame, rotatedFile, ratio: shapeRatio, shape: whole ? "original" : ratio, caption: caption.trim() })}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
