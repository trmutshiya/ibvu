// IBVU v6.10 — what changed in this file: tileMode (used by Newsletters):
// - a new picture starts at tile size: it fits inside a 340 × 227 px tile in its own
//   shape (after cropping a new picture, tile size of its new shape);
// - drag a corner to any size from 100 px to the full 544 px email column; it clicks
//   into "Tile size" and "Full width" as it passes them;
// - the size is kept in pixels of the email column (data-px, with data-w as a share of
//   it) and shown as min(px, share), so on a phone it shrinks in proportion;
// - the picture bar has − Smaller, Larger +, Tile size and Full width (no left/right:
//   emails show pictures centred).
// Articles and blog posts work as before.
//
// IBVU v6.09 — what changed in this file: the framing window that opens after adding a
// picture (and "Crop and frame…") now has a Caption box, so a caption can be added
// straight away. "Caption…" in the picture bar still works as before.
//
// IBVU v6.05 — what changed in this file: drag to resize pictures in the text
// (as in the approved trial). Click a picture and handles appear on its
// corners and sides: drag outwards to make it larger, inwards to make it
// smaller. It clicks into Small (a third), Medium (half), Large (three
// quarters) and Full as it passes them, and any size in between works (from
// a fifth of the column up to full width). A label shows the size while
// dragging; Shift + ← / → change it in small steps. The size is saved as a
// percentage of the column (data-w), with a pixel width for emails.
// Saving the crop window without changing anything no longer makes a copy.
//
// IBVU v6.04 — what changed in this file: picture tools. Click a picture in
// the text and a bar appears: size (small, medium, large, full width),
// position (left, centre, right; text flows around small and medium pictures
// on the left or right), "Crop and frame…" (the framing window, with a choice
// of shape; a cropped copy is saved and the original kept, so "Undo crop"
// can bring it back), "Caption…" (a grey line under the picture on the site),
// and Remove. A new picture opens the framing window; afterwards the cursor
// moves below the picture, so typing carries on in the text (click the
// picture to bring its bar back).
// In emails, pictures keep their size; left and right placement is not
// supported by most email programs, so there they sit one under another.
//
// IBVU v6.03 — what changed in this file: optional onReady and placeholder. onReady
// hands the editor to the newsletter screen so it can add ready-made blocks
// ("Add from the site") where the cursor is.
//
// IBVU v6.0 — what changed in this file: pictures added inside an article are uploaded to the picture store (on the real site) instead of being kept inside the article's text.
//
// IBVU v5.6 — new file.
// The writing area for articles: headings, bold, italic, quotes, lists, links
// and images, with undo and redo. Built on the TipTap editor.
import { useRef, useState, useEffect } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { uploadSiteImage } from '../../lib/content.js';
import { renderFramed, isDefaultFrame, loadImage, tileWidth, shownWidth, EMAIL_COLUMN as COL } from '../../lib/frame.js';
import FrameEditor from './FrameEditor.jsx';

// Picture sizes: the width on the site (index.css) and in emails (pixels).
const SIZES = [
  { key: "small", label: "Small", email: 200 },
  { key: "medium", label: "Medium", email: 300 },
  { key: "large", label: "Large", email: 450 },
  { key: "full", label: "Full width", email: null },
];
// Sizes as a share of the column; the size names follow from the width.
const SIZE_W = { small: 33.33, medium: 50, large: 75 };
const SNAPS = [{ v: 33.33, n: "Small" }, { v: 50, n: "Medium" }, { v: 75, n: "Large" }, { v: 100, n: "Full" }];
const MIN_W = 20, SNAP_RANGE = 2.5, EMAIL_COLUMN = 544;
export function sizeFor(w) { return w < 42 ? "small" : w < 66 ? "medium" : w < 87 ? "large" : null; }
const widthOf = a => a.w || SIZE_W[a.size] || 100;
// tileMode (newsletters): the width in pixels of the 544 px email column.
const MIN_PX = 100, PX_SNAP = 10;
const pxOf = a => a.px || (a.w ? Math.round(COL * a.w / 100) : COL);
const pxAttrs = px => { const r = Math.round(Math.max(MIN_PX, Math.min(COL, px))); return { px: r, w: Math.round(r / COL * 10000) / 100, size: null }; };

// A picture in the editor, with drag handles when it is selected.
function PictureView({ node, updateAttributes, selected, extension }) {
  const a = node.attrs;
  const tile = !!(extension && extension.options.tileMode);
  const [live, setLive] = useState(null); // { w, snap } while dragging (tileMode: { px, snap })
  const ref = useRef(null);
  const w = live && !tile ? live.w : widthOf(a);

  function start(e, side) {
    e.preventDefault(); e.stopPropagation();
    const el = ref.current, column = el.parentElement;
    const cs = getComputedStyle(column);
    const colW = column.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const startPx = el.getBoundingClientRect().width;
    const centred = tile || !a.align;
    const x0 = e.clientX;
    const img = el.querySelector("img");
    const ratio = img && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.5;
    let last = tile ? pxOf(a) : widthOf(a);
    const move = ev => {
      let dx = (ev.clientX - x0) * side;
      if (centred) dx *= 2;                      // centred pictures grow on both sides
      if (tile) {
        const base = Math.min(colW, COL);        // a narrow screen shows everything smaller
        let px = Math.max(MIN_PX, Math.min(COL, (startPx + dx) / base * COL));
        const t = tileWidth(ratio);
        const snap = Math.abs(px - t) <= PX_SNAP ? "Tile size" : COL - px <= PX_SNAP ? "Full width" : "";
        if (snap === "Tile size") px = t;
        if (snap === "Full width") px = COL;
        last = px;
        setLive({ px: Math.round(px), snap });
        return;
      }
      let p = Math.max(MIN_W, Math.min(100, (startPx + dx) / colW * 100));
      const snap = SNAPS.find(s => Math.abs(s.v - p) <= SNAP_RANGE);
      if (snap) p = snap.v;
      last = p;
      setLive({ w: p, snap: snap ? snap.n : "", px: Math.round(colW * p / 100) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLive(null);
      if (tile) { updateAttributes(pxAttrs(last)); return; }
      const r = Math.round(last * 100) / 100;
      updateAttributes({ w: r >= 100 ? null : r, size: sizeFor(r) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const size = tile ? null : sizeFor(w);
  const width = tile ? shownWidth(live ? live.px : pxOf(a)) : w + "%";
  const tip = !live ? "" : tile ? (live.snap ? live.snap + " · " : "") + live.px + " px wide"
    : (live.snap ? live.snap + " · " : "") + Math.round(live.w) + "% · about " + live.px + " px";
  return (
    <NodeViewWrapper ref={ref} className={"rte-pic" + (selected ? " sel" : "") + (live ? " dragging" : "")}
      data-align={tile ? undefined : a.align || undefined} data-size={size || undefined} style={{ width }}>
      <img src={a.src} alt={a.alt || ""} draggable="false" />
      {a.caption && <span className="rte-pic-caption">{a.caption}</span>}
      {selected && ["tl", "tr", "bl", "br", "ml", "mr"].map(k => (
        <span key={k} className={"rte-handle " + k} aria-hidden="true" onPointerDown={e => start(e, k.endsWith("r") ? 1 : -1)} />
      ))}
      {live && <span className={"rte-size-tip" + (live.snap ? " snapped" : "")}>{tip}</span>}
    </NodeViewWrapper>
  );
}

const PLACES = [{ key: "left", label: "Left" }, { key: "center", label: "Centre" }, { key: "right", label: "Right" }];
const CROP_SHAPES = [
  { label: "Its own shape", ratio: "original" },
  { label: "Wide", ratio: 16 / 9 },
  { label: "Landscape", ratio: 3 / 2 },
  { label: "Square", ratio: 1 },
  { label: "Portrait", ratio: 4 / 5 },
];

// The picture with its size, position and (after cropping) its original.
const FramedImage = Image.extend({
  addOptions() { return { ...this.parent?.(), tileMode: false }; },
  addAttributes() {
    return {
      ...this.parent?.(),
      size: {
        default: null,
        parseHTML: el => el.getAttribute("data-size"),
        renderHTML: a => {
          if (!a.size) return {};
          const s = SIZES.find(x => x.key === a.size);
          return { "data-size": a.size, ...(!a.w && s && s.email ? { width: String(s.email) } : {}) };
        },
      },
      w: {
        default: null,
        parseHTML: el => { const v = parseFloat(el.getAttribute("data-w")); return Number.isFinite(v) ? v : null; },
        renderHTML: a => (a.px ? { "data-w": String(a.w || Math.round(a.px / COL * 10000) / 100), style: "width:" + shownWidth(a.px), width: String(a.px) }
          : a.w ? { "data-w": String(a.w), style: "width:" + a.w + "%", width: String(Math.round(EMAIL_COLUMN * a.w / 100)) } : {}),
      },
      // v6.10, newsletters: the width in pixels of the 544 px email column
      px: {
        default: null,
        parseHTML: el => { const v = parseInt(el.getAttribute("data-px"), 10); return Number.isFinite(v) ? v : null; },
        renderHTML: a => (a.px ? { "data-px": String(a.px) } : {}),
      },
      align: {
        default: null,
        parseHTML: el => el.getAttribute("data-align"),
        renderHTML: a => (a.align ? { "data-align": a.align } : {}),
      },
      caption: {
        default: null,
        parseHTML: el => el.getAttribute("data-caption"),
        renderHTML: a => (a.caption ? { "data-caption": a.caption, title: a.caption } : {}),
      },
      orig: {
        default: null,
        parseHTML: el => el.getAttribute("data-orig"),
        renderHTML: a => (a.orig ? { "data-orig": a.orig } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(PictureView, { stopEvent: ({ event }) => !!(event.target && event.target.closest && event.target.closest(".rte-handle")) });
  },
  // Shift + ← / → make the selected picture smaller or larger.
  addKeyboardShortcuts() {
    const step = d => () => {
      const sel = this.editor.state.selection;
      if (!(sel instanceof NodeSelection) || sel.node.type.name !== this.name) return false;
      if (this.options.tileMode) return this.editor.commands.updateAttributes(this.name, pxAttrs(pxOf(sel.node.attrs) + d * 4));
      const w = Math.max(MIN_W, Math.min(100, widthOf(sel.node.attrs) + d));
      return this.editor.commands.updateAttributes(this.name, { w: w >= 100 ? null : w, size: sizeFor(w) });
    };
    return { "Shift-ArrowLeft": step(-5), "Shift-ArrowRight": step(5) };
  },
});

export default function RichEditor({ value, onChange, onError, onReady, placeholder = "Write your article…", tileMode = false }) {
  const fileRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [cropping, setCropping] = useState(false);
  const [fresh, setFresh] = useState(false); // the crop window is open for a picture just added
  const [captionOpen, setCaptionOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      FramedImage.configure({ allowBase64: true, tileMode }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => { if (editor && onReady) onReady(editor); }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  const Btn = ({ label, active, onClick, title }) => (
    <button type="button" className={"rte-btn" + (active ? " on" : "")} onMouseDown={e => e.preventDefault()} onClick={onClick} title={title || label}>{label}</button>
  );

  function openLink() {
    setLinkUrl(editor.getAttributes("link").href || "https://");
    setLinkOpen(true);
  }
  function applyLink(e) {
    e.preventDefault();
    const url = linkUrl.trim();
    if (!url || url === "https://") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
  }
  async function addImage(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const src = await uploadSiteImage(file, { maxSide: 1400, quality: 0.8, folder: "articles" });
      let extra = {};
      if (tileMode) { // a new picture starts at tile size
        let ratio = 1.5;
        try { const im = await loadImage(src); ratio = im.naturalWidth / im.naturalHeight; } catch { /* keep 3:2 */ }
        extra = pxAttrs(tileWidth(ratio));
      }
      editor.chain().focus().setImage({ src, ...extra }).run();
      // select the new picture so its tools (and the framing window) apply to it
      let at = null;
      editor.state.doc.descendants((node, pos) => { if (node.type.name === "image" && node.attrs.src === src) at = pos; });
      if (at !== null) { editor.commands.setNodeSelection(at); setFresh(true); setCropping(true); }
    } catch (err) { if (onError) onError(err.message); }
  }

  const onImage = editor.isActive("image");
  const img = onImage ? editor.getAttributes("image") : {};
  const setImg = attrs => editor.chain().focus().updateAttributes("image", attrs).run();
  // tileMode: tile size for the chosen picture's shape
  let tileNow = tileWidth(1.5);
  if (tileMode && onImage) {
    const el = editor.view.dom.querySelector(".rte-pic.sel img");
    if (el && el.naturalHeight) tileNow = tileWidth(el.naturalWidth / el.naturalHeight);
  }

  // Puts the cursor just below the selected picture.
  function leavePicture() {
    const { to } = editor.state.selection;
    if (!editor.state.doc.resolve(to).nodeAfter) editor.chain().insertContentAt(to, { type: "paragraph" }).run();
    editor.chain().focus().setTextSelection(to + 1).run();
  }
  function closeCrop() { setCropping(false); if (fresh) { setFresh(false); leavePicture(); } }

  async function saveCrop({ frame, rotatedFile, ratio, shape, caption: newCaption }) {
    if ((newCaption || "") !== (img.caption || "")) setImg({ caption: newCaption || null });
    // Nothing changed: keep the picture as it is (no cropped copy).
    if (!rotatedFile && shape === "original" && isDefaultFrame(frame)) { closeCrop(); return; }
    setSaving(true);
    try {
      const original = img.orig || img.src;
      let base = original;
      if (rotatedFile) base = await uploadSiteImage(rotatedFile, { maxSide: 1400, quality: 0.8, folder: "articles" });
      const file = await renderFramed(base, frame, ratio, 1400);
      const src = await uploadSiteImage(file, { maxSide: 1400, quality: 0.82, folder: "articles" });
      // a picture just added keeps to tile size in its new shape
      setImg({ src, orig: base, ...(tileMode && fresh ? pxAttrs(tileWidth(typeof ratio === "number" ? ratio : 1.5)) : {}) });
      closeCrop();
    } catch (err) { if (onError) onError(err.message); }
    setSaving(false);
  }

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        <Btn label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Btn label="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="rte-gap" />
        <Btn label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Btn label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Btn label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <span className="rte-gap" />
        <Btn label="• List" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bulleted list" />
        <Btn label="1. List" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list" />
        <span className="rte-gap" />
        <Btn label="Link" active={editor.isActive("link")} onClick={openLink} />
        <Btn label="Image" onClick={() => fileRef.current && fileRef.current.click()} />
        <span className="rte-gap" />
        <Btn label="Undo" onClick={() => editor.chain().focus().undo().run()} />
        <Btn label="Redo" onClick={() => editor.chain().focus().redo().run()} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={addImage} />
      </div>

      {linkOpen && (
        <form className="rte-link" onSubmit={applyLink}>
          <label htmlFor="rte-link-url">Link address</label>
          <input id="rte-link-url" type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} autoFocus />
          <button type="submit" className="cadmin-btn solid">Apply</button>
          <button type="button" className="cadmin-btn" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}>Remove link</button>
          <button type="button" className="cadmin-btn" onClick={() => setLinkOpen(false)}>Cancel</button>
        </form>
      )}

      {onImage && (
        <div className="rte-imagebar" role="toolbar" aria-label="Picture">
          <span className="rte-imagebar-label">Picture:</span>
          {tileMode ? (
            <>
              <Btn label="− Smaller" onClick={() => setImg(pxAttrs(pxOf(img) - 20))} />
              <Btn label="Larger +" onClick={() => setImg(pxAttrs(pxOf(img) + 20))} />
              <Btn label="Tile size" active={pxOf(img) === tileNow} onClick={() => setImg(pxAttrs(tileNow))} />
              <Btn label="Full width" active={pxOf(img) >= COL} onClick={() => setImg(pxAttrs(COL))} />
              <span className="rte-imagebar-size">{pxOf(img)} px wide</span>
            </>
          ) : (
            <>
              {SIZES.map(s => <Btn key={s.key} label={s.label} active={Math.abs(widthOf(img) - (SIZE_W[s.key] || 100)) < 0.5} onClick={() => setImg({ size: s.key === "full" ? null : s.key, w: s.key === "full" ? null : SIZE_W[s.key] })} />)}
              <span className="rte-gap" />
              {PLACES.map(p => <Btn key={p.key} label={p.label} active={(img.align || "center") === p.key} onClick={() => setImg({ align: p.key === "center" ? null : p.key })} />)}
            </>
          )}
          <span className="rte-gap" />
          <Btn label="Crop and frame…" onClick={() => setCropping(true)} />
          <Btn label={img.caption ? "Edit caption" : "Caption…"} active={!!img.caption} onClick={() => { setCaption(img.caption || ""); setCaptionOpen(true); }} />
          {img.orig && <Btn label="Undo crop" onClick={() => setImg({ src: img.orig, orig: null })} />}
          <Btn label="Remove" onClick={() => editor.chain().focus().deleteSelection().run()} />
        </div>
      )}

      {onImage && captionOpen && (
        <form className="rte-link" onSubmit={e => { e.preventDefault(); setImg({ caption: caption.trim() || null }); setCaptionOpen(false); }}>
          <label htmlFor="rte-caption">Caption (shown in small grey text under the picture)</label>
          <input id="rte-caption" value={caption} maxLength={200} onChange={e => setCaption(e.target.value)} autoFocus />
          <button type="submit" className="cadmin-btn solid">Apply</button>
          {img.caption && <button type="button" className="cadmin-btn" onClick={() => { setImg({ caption: null }); setCaptionOpen(false); }}>Remove caption</button>}
          <button type="button" className="cadmin-btn" onClick={() => setCaptionOpen(false)}>Cancel</button>
        </form>
      )}

      {!onImage && /<img/.test(value || "") && <p className="rte-caption-note">Click a picture to change its size, position, crop or caption.</p>}
      {onImage && !captionOpen && <p className="rte-caption-note">{tileMode ? "Drag a corner or side handle to make the picture smaller or larger. It clicks into Tile size and Full width as it passes them. On a phone every picture shows smaller, in proportion." : "Drag a corner or side handle to make the picture smaller or larger. It clicks into Small, Medium, Large and Full as it passes them."}</p>}
      <EditorContent editor={editor} className="rte-content article-body" />

      {cropping && onImage && (
        <FrameEditor src={img.orig || img.src} shapes={CROP_SHAPES} chooseShape caption={img.caption || ""} busy={saving} title="Crop and frame the picture"
          onCancel={closeCrop} onSave={saveCrop} />
      )}
    </div>
  );
}
