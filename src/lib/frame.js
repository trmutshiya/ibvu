// IBVU v6.04 — new file. How a picture sits in its frame.
//
// Admin can move a picture and zoom in (to crop) inside the shape it is shown
// in. A picture always fills its box: there is no zooming out and nothing
// around it. The framing is kept at the end of the picture's address, after
// "#frame=", so nothing in the database had to change and every picture saved
// before v6.04 still works (it simply has no framing):
//
//   https://…/photo.jpg#frame=40,30,1.25
//                             x  y  zoom
//
//   x, y  the point to keep in view, 0–100 (% across, % down). 50,50 = centre.
//   zoom  1–3 (100% to 300%). Above 100% the edges are cropped.
//
// A page picture that uses the built-in photo keeps only the framing
// ("#frame=…" with no address in front); the built-in photo is used.
//
// Newsletter covers are also saved as a ready-framed copy (email programs
// ignore framing). Then the address is that copy, followed by
// "&orig=<the original picture>" so the framing can be changed again later.

export const DEFAULT_FRAME = { x: 50, y: 50, z: 1 };
const MARK = "#frame=";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

// "url#frame=…" → { src, frame (or null), orig }
export function parseImage(value) {
  const text = String(value || "");
  const at = text.lastIndexOf(MARK);
  if (at < 0) return { src: text, frame: null, orig: "" };
  const src = text.slice(0, at);
  const [spec, ...rest] = text.slice(at + MARK.length).split("&");
  const [x, y, z] = spec.split(",");
  const frame = { x: clamp(num(x, 50), 0, 100), y: clamp(num(y, 50), 0, 100), z: clamp(num(z, 1), 1, 3) };
  const origPart = rest.find(p => p.startsWith("orig="));
  return { src, frame, orig: origPart ? decodeURIComponent(origPart.slice(5)) : "" };
}

export function isDefaultFrame(f) {
  return !f || (f.x === 50 && f.y === 50 && f.z === 1);
}

// { src, frame, orig } → "url#frame=…"
export function buildImage(src, frame, orig = "") {
  if (!frame || (isDefaultFrame(frame) && !orig)) return src || "";
  const r = n => Math.round(n * 100) / 100;
  return (src || "") + MARK + [r(frame.x), r(frame.y), r(frame.z)].join(",") + (orig ? "&orig=" + encodeURIComponent(orig) : "");
}

// Just the picture's address, for places that cannot frame (sharing, emails).
export function plainSrc(value, fallback = "") {
  return parseImage(value).src || fallback;
}

// The whole picture as uploaded (no framing, not the ready-framed copy):
// what an open article shows at the top.
export function wholeSrc(value) {
  const p = parseImage(value);
  return p.orig || p.src;
}

// The page's own value with the built-in photo filled in where needed.
export function withFallback(value, fallback) {
  const p = parseImage(value);
  if (p.src) return value;
  return p.frame ? buildImage(fallback, p.frame) : fallback;
}

// The styles that put the picture where it was framed.
export function frameStyles(frame) {
  const f = frame || DEFAULT_FRAME;
  const pos = f.x + "% " + f.y + "%";
  return {
    outer: { display: "block", position: "relative", overflow: "hidden" },
    move: { display: "block", position: "relative", width: "100%", height: "100%", transform: f.z === 1 ? undefined : "scale(" + f.z + ")", transformOrigin: pos },
    img: { width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, display: "block" },
  };
}

// Draws the framed picture onto a canvas (for ready-framed copies and crops).
// Mirrors what the styles above show on the page.
export function drawFramed(ctx, img, frame, W, H) {
  const f = frame || DEFAULT_FRAME;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s0 = Math.max(W / iw, H / ih);
  const dw = iw * s0, dh = ih * s0;
  const ox = (W - dw) * f.x / 100, oy = (H - dh) * f.y / 100;
  const Ox = W * f.x / 100, Oy = H * f.y / 100;
  ctx.drawImage(img, Ox + (ox - Ox) * f.z, Oy + (oy - Oy) * f.z, dw * f.z, dh * f.z);
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!/^data:/.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The picture could not be loaded."));
    img.src = src;
  });
}

// A framed copy of the picture as a JPEG file, up to `width` pixels wide.
// ratio "original" keeps the picture's own shape.
export async function renderFramed(src, frame, ratio, width = 1400) {
  const img = await loadImage(src);
  const r = ratio === "original" ? img.naturalWidth / img.naturalHeight : ratio;
  const W = Math.round(Math.min(width, img.naturalWidth * (frame ? frame.z : 1))), H = Math.round(W / r);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  drawFramed(canvas.getContext("2d"), img, frame, W, H);
  return canvasToFile(canvas, "framed.jpg");
}

// The picture turned a quarter turn (right: true = clockwise).
export async function rotateImage(src, right = true) {
  const img = await loadImage(src);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = ih; canvas.height = iw;
  const ctx = canvas.getContext("2d");
  ctx.translate(ih / 2, iw / 2);
  ctx.rotate((right ? 90 : -90) * Math.PI / 180);
  ctx.drawImage(img, -iw / 2, -ih / 2);
  return canvasToFile(canvas, "rotated.jpg");
}

function canvasToFile(canvas, name) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(b => (b ? resolve(new File([b], name, { type: "image/jpeg" })) : reject(new Error("The picture could not be saved."))), "image/jpeg", 0.88);
    } catch {
      reject(new Error("This picture cannot be changed here. Upload it again and try once more."));
    }
  });
}
