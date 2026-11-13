// IBVU v5.9 — new file.
// Shows a piece of editable text, turning words written between *stars* into
// italics (or into whatever tag is asked for). Used for page wording that is
// edited in admin → Pages.
export default function Emph({ text, as: Tag = "em" }) {
  return String(text || "").split(/\*([^*]+)\*/g).map((part, i) => (i % 2 ? <Tag key={i}>{part}</Tag> : part));
}
