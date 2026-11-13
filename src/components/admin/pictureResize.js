// IBVU v6.10 — new file. Drag-to-resize for pictures in admin's newsletter previews
// ("Preview as email", "Preview as web page") and the cover in Write, as in the trial
// Tatenda approved (ibvu-newsletter-pictures-trial-v2.html).
//
// Pictures marked data-i ("cover", or "0", "1", … for pictures in the text) can be
// clicked to choose them. The chosen one gets a gold outline and four corner handles:
// drag outwards to make it larger, inwards to make it smaller (both sides move, as the
// picture is centred). Sizes are pixels of the 544 px email column, from 100 px to full
// width; it clicks into "Tile size" and "Full width" as it passes them. On a narrower
// screen the picture is shown smaller in proportion, and the drag allows for that.
// Works inside the email preview's frame too (same page, no scripts in the frame).
import { tileWidth, shownWidth, EMAIL_COLUMN } from '../../lib/frame.js';

const MIN_PX = 100, SNAP = 10;

const CSS = `
  img[data-i] { cursor: pointer; }
  [data-pic-box]:has(img[data-i]):hover, img[data-i]:hover { outline: 2px dashed rgba(201,168,76,.85); outline-offset: 3px; }
  .rz-picked, .rz-picked:hover { outline: 3px solid #c9a84c !important; outline-offset: 3px; }
  .rz-h { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: #fff; border: 2px solid #c9a84c; box-shadow: 0 1px 4px rgba(0,0,0,.35); z-index: 50; touch-action: none; }
  .rz-h.tl, .rz-h.br { cursor: nwse-resize; } .rz-h.tr, .rz-h.bl { cursor: nesw-resize; }
  .rz-tip { position: absolute; z-index: 51; transform: translate(-50%, -100%); background: #3d2c1e; color: #f5f0e8; font: 11px/1.2 'DM Mono', Menlo, monospace; padding: 5px 9px; border-radius: 2px; white-space: nowrap; pointer-events: none; }
  .rz-tip.snap { background: #4d6b4d; }
`;

export const ratioOf = img => (img && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.5);

// root: a document (the email frame) or an element (web preview, Write).
// columnWidth(img): the width of the column the picture sits in, in screen pixels.
// widthOf(key): its current width (px of the 544 px column).
// onPick(key, ratio), onResize(key, px).
// Returns a function that removes everything it added.
export function attachPictureResize(root, { picked, columnWidth, widthOf, onPick, onResize }) {
  if (!root) return () => {};
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const win = doc.defaultView;
  const undo = [];
  const style = doc.createElement("style");
  style.textContent = CSS;
  (doc.head || doc.body).appendChild(style);
  undo.push(() => style.remove());

  root.querySelectorAll("img[data-i]").forEach(img => {
    const key = img.getAttribute("data-i");
    const box = img.closest("[data-pic-box]") || img;
    const choose = e => { e.preventDefault(); e.stopPropagation(); onPick(key, ratioOf(img)); };
    box.addEventListener("click", choose, true);
    undo.push(() => box.removeEventListener("click", choose, true));
    if (key !== picked) return;

    box.classList.add("rz-picked");
    undo.push(() => box.classList.remove("rz-picked"));
    const handles = ["tl", "tr", "bl", "br"].map(k => {
      const h = doc.createElement("span");
      h.className = "rz-h " + k;
      h.setAttribute("aria-hidden", "true");
      doc.body.appendChild(h);
      return h;
    });
    const tip = doc.createElement("span");
    tip.className = "rz-tip"; tip.hidden = true;
    doc.body.appendChild(tip);
    undo.push(() => { handles.forEach(h => h.remove()); tip.remove(); });

    const place = () => {
      const r = box.getBoundingClientRect(), sx = win.scrollX, sy = win.scrollY;
      const at = { tl: [r.left, r.top], tr: [r.right, r.top], bl: [r.left, r.bottom], br: [r.right, r.bottom] };
      handles.forEach(h => { const [x, y] = at[h.classList[1]]; h.style.left = x + sx + "px"; h.style.top = y + sy + "px"; });
      tip.style.left = (r.left + r.right) / 2 + sx + "px"; tip.style.top = r.top + sy - 8 + "px";
    };
    place();
    img.addEventListener("load", place);
    win.addEventListener("resize", place);
    undo.push(() => { img.removeEventListener("load", place); win.removeEventListener("resize", place); });

    handles.forEach(h => h.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopPropagation();
      h.setPointerCapture(e.pointerId);
      const side = h.classList.contains("tr") || h.classList.contains("br") ? 1 : -1;
      const x0 = e.clientX, startShown = box.getBoundingClientRect().width;
      const base = Math.min(columnWidth(img) || EMAIL_COLUMN, EMAIL_COLUMN);
      const tile = tileWidth(ratioOf(img));
      let px = widthOf(key);
      const move = ev => {
        px = Math.max(MIN_PX, Math.min(EMAIL_COLUMN, (startShown + 2 * side * (ev.clientX - x0)) / base * EMAIL_COLUMN));
        let label = "";
        if (Math.abs(px - tile) <= SNAP) { px = tile; label = "Tile size · "; }
        else if (EMAIL_COLUMN - px <= SNAP) { px = EMAIL_COLUMN; label = "Full width · "; }
        px = Math.round(px);
        box.style.width = shownWidth(px);
        if (box !== img) img.style.width = "100%";
        tip.hidden = false; tip.textContent = label + px + " px wide"; tip.classList.toggle("snap", !!label);
        place();
      };
      const up = () => {
        h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
        tip.hidden = true;
        onResize(key, px);
      };
      h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    }));
  });
  return () => undo.forEach(f => f());
}

// The inner width of an element (without its padding).
export function innerWidth(el) {
  if (!el) return 0;
  const cs = el.ownerDocument.defaultView.getComputedStyle(el);
  return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}
