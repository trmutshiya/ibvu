// IBVU v6.11 — new file. Sending articles and blog posts for review (as in the approved
// mock-up, ibvu-article-review-trial.html).
//
// - ReviewBadge: "Waiting for review" or "Sent back for changes" next to a title.
// - ReviewBar: what can be done now. A Writer sends the article for review (with an
//   optional note) and can take it back while it waits. An Editor or Owner sends it back
//   for changes with a note. Each step emails the right people (see
//   supabase/functions/article-review); a line under the bar says who was emailed.
// - ReviewSide: the comments (on some words, or on the whole article), replies,
//   "Mark done", a box for a new comment, and the article's review history.
import { useState } from 'react';
import { PREVIEW_MODE, ROLES, reviewAction, formatDate } from '../../lib/content.js';

const STATE = {
  review: { cls: "sched", label: "Waiting for review" },
  changes: { cls: "rv-back", label: "Sent back for changes" },
};
export function ReviewBadge({ review }) {
  const s = review && STATE[review.state];
  return s ? <span className={"cadmin-badge " + s.cls}>{s.label}</span> : null;
}

const when = iso => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return today ? "today at " + time : formatDate(iso.slice(0, 10), false) + " at " + time;
};

// What to say after a step that emails people.
export function emailedLine(emailed, who) {
  if (PREVIEW_MODE) return "In the preview no email is sent. On the real site this emails " + who + ".";
  if (emailed > 0) return "Emailed " + who + " (" + emailed + (emailed === 1 ? " person" : " people") + ").";
  return "Done. No email went out (there was nobody else to tell, or the email service did not answer); it shows in admin all the same.";
}

// mayPublish: Editor or Owner. ready(): saves the article first and returns its id (or null).
export function ReviewBar({ review, mayPublish, title, ready, onDone, onProblem }) {
  const state = review ? review.state : "draft";
  const [asking, setAsking] = useState("");   // "" | "send" | "back"
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action, who) {
    onProblem("");
    const id = await ready();
    if (!id) return;
    setBusy(true);
    const r = await reviewAction(action, id, action === "takeback" ? {} : { note: note.trim() });
    setBusy(false);
    if (!r.ok) { onProblem(r.error); return; }
    setAsking(""); setNote("");
    onDone(who ? emailedLine(r.emailed, who) : "");
  }

  const writer = !mayPublish;
  let box = null;
  if (writer && state !== "review") {
    box = asking === "send" ? (
      <div className="rv-ask">
        <label htmlFor="rv-note">Note for the Editors and Owners (optional)</label>
        <textarea id="rv-note" rows="2" maxLength={1000} value={note} placeholder="For example: ready for a look, I was not sure about the second paragraph." onChange={e => setNote(e.target.value)} />
        <div className="cadmin-row">
          <button type="button" className="cadmin-btn go" disabled={busy} onClick={() => run("send", "the Editors and Owners")}>{busy ? "Sending…" : "Send for review"}</button>
          <button type="button" className="cadmin-btn" disabled={busy} onClick={() => setAsking("")}>Cancel</button>
        </div>
        <p className="cadmin-hint">They get an email with a link to it. You can take it back until it is published.</p>
      </div>
    ) : (
      <div className="cadmin-row">
        <button type="button" className="cadmin-btn go" disabled={!title} title={title ? "" : "Give it a title first"} onClick={() => setAsking("send")}>{state === "changes" ? "Send for review again…" : "Send for review…"}</button>
        {!title && <span className="cadmin-hint">Give it a title first.</span>}
      </div>
    );
  } else if (state === "review" && writer && review.sentByMe) {
    box = <div className="cadmin-row"><button type="button" className="cadmin-btn warn" disabled={busy} onClick={() => run("takeback", "the Editors and Owners")}>{busy ? "Taking it back…" : "Take it back"}</button></div>;
  } else if (state === "review" && mayPublish) {
    box = asking === "back" ? (
      <div className="rv-ask">
        <label htmlFor="rv-back">Note to the writer</label>
        <textarea id="rv-back" rows="2" maxLength={1000} value={note} placeholder="For example: lovely, just two small things in the comments." onChange={e => setNote(e.target.value)} />
        <div className="cadmin-row">
          <button type="button" className="cadmin-btn warn" disabled={busy} onClick={() => run("sendback", "the writer")}>{busy ? "Sending…" : "Send it back"}</button>
          <button type="button" className="cadmin-btn" disabled={busy} onClick={() => setAsking("")}>Cancel</button>
        </div>
        <p className="cadmin-hint">The writer gets an email with your note and the open comments, and can change it again.</p>
      </div>
    ) : (
      <div className="cadmin-row">
        <button type="button" className="cadmin-btn warn" onClick={() => setAsking("back")}>Send back to the writer…</button>
        <span className="cadmin-hint">Or press Publish when it is ready.</span>
      </div>
    );
  }

  let banner = null;
  if (state === "review" && writer) banner = (
    <p className="rv-banner review"><strong>Waiting for review</strong>{review.sentAt ? " since " + when(review.sentAt) : ""}. You cannot change it while it waits.{review.note ? <> Your note: <q>{review.note}</q></> : null} Sent by mistake, or want to change something? Take it back.</p>
  );
  if (state === "review" && !writer) banner = (
    <p className="rv-banner review"><strong>Sent for review</strong>{review.sentAt ? " " + when(review.sentAt) : ""}{review.note ? <>: <q>{review.note}</q></> : "."} Read it, add comments, then publish it or send it back.</p>
  );
  if (state === "changes") banner = (
    <p className="rv-banner changes"><strong>Sent back for changes</strong>{review.backBy ? " by the " + review.backBy : ""}{review.backNote ? <>: <q>{review.backNote}</q></> : "."}{writer ? " Make the changes, mark each comment done, then send it for review again." : ""}</p>
  );
  if (!banner && !box) return null;
  return <div className="rv-bar">{banner}{box}</div>;
}

// The comments beside the article.
export function ReviewSide({ articleId, review, comments, mayResolve, onResolved, onShow, onProblem, onDone }) {
  const [text, setText] = useState("");
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState("");
  const top = comments.filter(c => !c.parentId);
  const open = top.filter(c => !c.resolved), done = top.filter(c => c.resolved);
  const repliesTo = id => comments.filter(c => c.parentId === id);
  const who = c => (c.mine ? "You" : (ROLES[c.role] && ROLES[c.role].name) || "Admin");

  async function add(body, parentId) {
    onProblem("");
    setBusy(parentId || "new");
    const r = await reviewAction("comment", articleId, { body, parentId });
    setBusy("");
    if (!r.ok) { onProblem(r.error); return false; }
    if (r.emailed && !parentId) onDone(emailedLine(r.emailed, "the writer"));
    return true;
  }
  async function resolve(c) {
    onProblem("");
    setBusy(c.id);
    const r = await reviewAction("resolve", articleId, { commentId: c.id });
    setBusy("");
    if (!r.ok) { onProblem(r.error); return; }
    if (c.markId) onResolved(c.markId);
  }
  const one = c => (
    <div className={"rv-c" + (c.resolved ? " done" : "")} key={c.id}>
      {c.quote
        ? <button type="button" className="rv-quote" onClick={() => onShow(c.markId)} title="Show these words in the text">“{c.quote.length > 120 ? c.quote.slice(0, 120) + "…" : c.quote}”</button>
        : <p className="rv-quote whole">On the whole text</p>}
      <p className="rv-who">{who(c)} · {when(c.createdAt)}</p>
      <p className="rv-body">{c.body}</p>
      {repliesTo(c.id).map(r => (
        <div className="rv-reply" key={r.id}><p className="rv-who">{who(r)} · {when(r.createdAt)}</p><p className="rv-body">{r.body}</p></div>
      ))}
      {!c.resolved && (
        <>
          <label className="visually-hidden" htmlFor={"rv-r-" + c.id}>Reply</label>
          <textarea id={"rv-r-" + c.id} rows="1" placeholder="Reply…" maxLength={2000} value={replies[c.id] || ""} onChange={e => setReplies(v => ({ ...v, [c.id]: e.target.value }))} />
          <div className="cadmin-row">
            <button type="button" className="cadmin-btn small" disabled={busy === c.id || !(replies[c.id] || "").trim()} onClick={async () => { if (await add(replies[c.id].trim(), c.id)) setReplies(v => ({ ...v, [c.id]: "" })); }}>Reply</button>
            {mayResolve && <button type="button" className="cadmin-btn small" disabled={busy === c.id} onClick={() => resolve(c)}>Mark done</button>}
          </div>
        </>
      )}
    </div>
  );
  const log = review && review.log ? [...review.log].reverse() : [];
  return (
    <aside className="rv-side" aria-label="Comments">
      <h3 className="rv-h">Comments {open.length > 0 && <span className="cadmin-count">{open.length}</span>}</h3>
      {open.length ? open.map(one) : <p className="cadmin-empty">No open comments.</p>}
      <div className="rv-new">
        <label htmlFor="rv-new">A comment on the whole text</label>
        <textarea id="rv-new" rows="2" maxLength={2000} value={text} onChange={e => setText(e.target.value)} />
        <button type="button" className="cadmin-btn small" disabled={busy === "new" || !text.trim()} onClick={async () => { if (await add(text.trim(), null)) setText(""); }}>{busy === "new" ? "Adding…" : "Add comment"}</button>
      </div>
      {done.length > 0 && (
        <details className="rv-done"><summary>Done ({done.length})</summary>{done.map(one)}</details>
      )}
      {log.length > 0 && (
        <>
          <h3 className="rv-h">History</h3>
          <ul className="rv-log">{log.slice(0, 30).map((l, i) => <li key={i}><strong>{l.who}</strong> {l.what} · {when(l.at)}</li>)}</ul>
        </>
      )}
    </aside>
  );
}
