// IBVU v5.9 — what changed in this file since v5.6:
// - The About text now comes from admin → Pages → About. Until someone edits
//   it, the pop-up shows exactly the same text as before.
// - The pop-up closes with the Escape key.
// - People signed in to admin see an "Edit" link in the pop-up.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePage, useSession, can } from '../lib/content.js';
import Emph from './Emph.jsx';

export default function InfoPanel({ type, onClose }) {
  const c = usePage("about");
  const session = useSession();
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (type !== "about") return null;

  return (
    <div className="panel" role="dialog" aria-modal="true" aria-label="About IBVU">
      <button className="panel-close" onClick={onClose}>✕ close</button>

      <div className="panel-inner wide">
        <p className="panel-eyebrow">{c.eyebrow}</p>
        <h2 className="panel-title">{c.title}</h2>

        {c.intro.map((p, i) => <p className="panel-body" key={i}><Emph text={p.text} /></p>)}

        {c.pillars.length > 0 && (
          <div className="panel-pillars">
            {c.pillars.map((p, i) => <p key={i}><strong>{p.name}</strong> <Emph text={p.text} /></p>)}
          </div>
        )}

        {c.more.map((p, i) => <p className="panel-body" key={i}><Emph text={p.text} /></p>)}

        {c.signoff && <p className="panel-signoff">{c.signoff}</p>}

        <div className="panel-rule" />
        {c.founders.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 300, letterSpacing: 4, textTransform: "uppercase", color: "rgba(245,240,232,0.65)", marginBottom: 10 }}>{c.foundersHeading}</p>
            {c.founders.map((f, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {f.link
                  ? <a href={f.link} target="_blank" rel="noreferrer" className="panel-contact-link">{f.name} ↗</a>
                  : <span className="panel-contact-link">{f.name}</span>}
              </span>
            ))}
          </div>
        )}
        {session && can(session.role, "pages") && (
          <p className="panel-edit"><Link to="/admin/pages?page=about" onClick={onClose}>✎ Edit this text</Link></p>
        )}
      </div>
    </div>
  );
}
