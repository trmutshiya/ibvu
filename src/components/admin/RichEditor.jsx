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
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { uploadSiteImage } from '../../lib/content.js';

export default function RichEditor({ value, onChange, onError, onReady, placeholder = "Write your article…" }) {
  const fileRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ allowBase64: true }),
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
      editor.chain().focus().setImage({ src }).run();
    } catch (err) { if (onError) onError(err.message); }
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

      <EditorContent editor={editor} className="rte-content article-body" />
    </div>
  );
}
