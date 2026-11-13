// IBVU v6.10 — what changed in this file (as in the approved trial,
// ibvu-newsletter-pictures-trial-v2.html):
// - Every picture, the cover too, starts at tile size: it fits inside a 340 × 227 px
//   tile in its own shape. Sizes are pixels of the 544 px email column.
// - Any picture can be made smaller or larger by dragging a corner in Write (pictures
//   in the text, and the cover shown under "Cover image"), in Preview as email and in
//   Preview as web page. A bar gives − Smaller, Larger +, Tile size and Full width.
//   The size is shared by the email, the web page and Write.
// - On a phone every picture shows smaller in proportion.
//
// IBVU v6.09 — what changed in this file:
// - The title is a clearly labelled box ("Newsletter title"), not grey heading text.
// - When something is missing before a test, schedule or send, the message says what,
//   the Write view opens and that box is highlighted and selected.
// - Fix: the "Write" view button went dark text on a dark background while the mouse was over it (it looked blank). Fixed for every pressed button in admin (index.css).
// - Preview as email: click a picture to make it smaller or larger (or Small, Medium,
//   Large, Full width) while looking at the email. The same size shows in Write.
// - Pictures in the email are centred, at the size set, with their caption underneath;
//   the cover's caption shows under the cover.
// - New "Sending history" tab (Owners): every email address and every newsletter sent
//   to it, when, and whether it was delivered to the email service; search, "only
//   problems", and a spreadsheet download. Uses the record kept since v6.03.
//
// IBVU v6.04 — what changed in this file: the cover picture can be framed for
// its tile on ibvu.org/newsletter. The email and the open issue show the whole
// picture, as an article does.
//
// IBVU v6.03 — new file. Admin → Newsletters (ibvu.org/admin/newsletters).
//
// Newsletters are written here like blog posts and then emailed to one or
// more mailing lists.
// - Owners and Editors write drafts, preview them as an email or as the web
//   page, and send a test to themselves. Writers do not have this section.
// - Only Owners send now, schedule (UK time) or cancel a schedule.
// - "Add from the site" puts a ready-made block (blog post, article, event,
//   herb, upcoming events, new herbs) where the cursor is.
// - Once sent, an issue is locked. Its record shows when it went, the subject,
//   the lists, how many people it reached, any failures and who sent it.
// - "Show on the website" (ticked by default) puts the sent issue on
//   ibvu.org/newsletter. Owners can hide or show it again later.
// - "Copy to Blog" makes a blog post draft from the issue.
// - Owners also have a Reminders tab: the addresses that get admin reminder
//   emails, and which reminders are switched on.
// No open or click tracking is used.
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  PREVIEW_MODE, can, useContent, useListCounts, recipientsFor, reloadStaff,
  saveIssue, deleteIssue, scheduleIssue, unscheduleIssue, previewRunTimer,
  sendIssueNow, sendTestIssue, setIssueVisible, copyIssueToBlog,
  addReminderRecipient, removeReminderRecipient, saveReminderSettings,
  issueAsArticle, useUpcomingEvents, usePublishedArticles, articlePath, excerpt, formatDate, plainText,
} from '../../lib/content.js';
import { MAILING_LISTS, listNames } from '../../lib/lists.js';
import { isEmail } from '../../lib/messages.js';
import { buildNewsletterEmail, SITE_URL } from '../../lib/newsletterEmail.js';
import { mergeHerbs } from '../../lib/herbs.js';
import { HERBS_FALLBACK } from '../../constants/herbs.js';
import { sbFetchApproved, sbFetchStaticHerbs } from '../../lib/supabase.js';
import { ArticleView } from '../Media.jsx';
import { DeleteButton, ImageField, SHAPES } from './bits.jsx';
import emailLogo from '../../assets/email-logo.png';
import { widthOf, withWidth, wholeSrc, tileWidth, shownWidth, loadImage, TILE_W, EMAIL_COLUMN } from '../../lib/frame.js';
import { attachPictureResize, innerWidth } from './pictureResize.js';

const RichEditor = lazy(() => import('./RichEditor.jsx'));

/* ── UK time ─────────────────────────────────────────────────────────── */

const UK = "Europe/London";
function ukParts(date) {
  const out = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: UK, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).forEach(p => { out[p.type] = p.value; });
  return out;
}
// "2026-11-25T09:00" read as UK time → an exact moment (ISO).
export function ukInputToISO(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
  if (!m) return null;
  const want = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let guess = want;
  for (let i = 0; i < 2; i++) {
    const p = ukParts(new Date(guess));
    guess += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return new Date(guess).toISOString();
}
function isoToUKInput(iso) { const p = ukParts(new Date(iso)); return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute; }
export function ukText(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { timeZone: UK, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " UK time";
}
function tomorrowNine() {
  const p = ukParts(new Date(Date.now() + 24 * 3600 * 1000));
  return p.year + "-" + p.month + "-" + p.day + "T09:00";
}

/* ── small pieces ────────────────────────────────────────────────────── */

const NEW_ISSUE = { title: "", subject: "", previewText: "", cover: "", body: "", lists: ["monthly"], showOnSite: true, status: "draft" };
const EDITABLE = ["id", "title", "subject", "previewText", "cover", "body", "lists", "showOnSite"];
const pick = n => Object.fromEntries(EDITABLE.filter(k => k in n).map(k => [k, n[k]]));

function IssueBadge({ status }) {
  const words = { draft: "Draft", scheduled: "Scheduled", sending: "Sending…", sent: "Sent" };
  const look = { draft: "draft", scheduled: "sched", sending: "sched", sent: "live" };
  return <span className={"cadmin-badge " + (look[status] || "draft")}>{words[status] || "Draft"}</span>;
}

function esc(s) { return String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
const onSite = path => SITE_URL + path;
const webImage = src => (src && /^https:\/\//.test(src) ? src : "");

function cardHTML({ title, text, href, image, more = "Read more →" }) {
  const img = webImage(image);
  return (img ? `<p><img src="${esc(img)}" alt=""></p>` : "") +
    `<h3>${esc(title)}</h3>` + (text ? `<p>${esc(text)}</p>` : "") + `<p><a href="${esc(href)}">${esc(more)}</a></p>`;
}

function useHerbs() {
  const [approved, setApproved] = useState([]);
  const [statics, setStatics] = useState(HERBS_FALLBACK);
  useEffect(() => {
    sbFetchApproved().then(setApproved);
    sbFetchStaticHerbs().then(rows => { if (rows.length > 0) setStatics(rows); });
  }, []);
  const all = mergeHerbs(statics, approved);
  // Approved herbs come last, in the order they were published.
  const newest = all.slice(all.length - approved.length).reverse().slice(0, 5);
  return { all: all.slice().sort((a, b) => a.name.localeCompare(b.name)), newest };
}

function eventLine(ev) { return [formatDate(ev.date), ev.time, ev.location].filter(Boolean).join(" · "); }

// "Add from the site": ready-made blocks put where the cursor is.
function AddFromSite({ editorRef }) {
  const blog = usePublishedArticles("blog");
  const media = usePublishedArticles("media");
  const events = useUpcomingEvents();
  const herbs = useHerbs();
  const [kind, setKind] = useState("blog");
  const [choice, setChoice] = useState("");
  const [added, setAdded] = useState("");
  const options = {
    blog: blog.map(a => ({ id: a.id, label: a.title })),
    media: media.map(a => ({ id: a.id, label: a.title })),
    event: events.map(e => ({ id: e.id, label: e.title + " (" + formatDate(e.date, false) + ")" })),
    herb: herbs.all.map(h => ({ id: h.slug, label: h.name })),
  }[kind];

  function insert(html, what) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.chain().focus().insertContent(html).run();
    setAdded(what + " added to the newsletter.");
    setTimeout(() => setAdded(""), 2500);
  }
  function addOne() {
    const id = choice || (options[0] && options[0].id);
    if (!id) return;
    if (kind === "blog" || kind === "media") {
      const a = (kind === "blog" ? blog : media).find(x => x.id === id);
      insert(cardHTML({ title: a.title, text: excerpt(a, 220), href: onSite(articlePath(a)), image: a.cover }), "“" + a.title + "”");
    } else if (kind === "event") {
      const ev = events.find(x => x.id === id);
      insert(cardHTML({ title: ev.title, text: eventLine(ev) + (ev.description ? ". " + plainText(ev.description).slice(0, 200) : ""), href: ev.bookingUrl || onSite("/shop/events"), image: ev.image, more: ev.bookingUrl ? "Book →" : "See the event →" }), "“" + ev.title + "”");
    } else {
      const h = herbs.all.find(x => x.slug === id);
      insert(cardHTML({ title: h.name + (h.latinName ? " (" + h.latinName + ")" : ""), text: plainText(h.description || "").slice(0, 220), href: onSite("/educate/hs/" + h.slug), more: "Read about it in the Herbarium →" }), "“" + h.name + "”");
    }
  }
  function addEvents() {
    const items = events.slice(0, 6).map(ev => `<li><p><a href="${esc(onSite("/shop/events"))}">${esc(ev.title)}</a>, ${esc(eventLine(ev))}</p></li>`).join("");
    insert(`<h2>Upcoming events</h2><ul>${items}</ul>`, "Upcoming events");
  }
  function addHerbs() {
    const items = herbs.newest.map(h => `<li><p><a href="${esc(onSite("/educate/hs/" + h.slug))}">${esc(h.name)}</a>${h.latinName ? " (" + esc(h.latinName) + ")" : ""}</p></li>`).join("");
    insert(`<h2>New in the Herbarium</h2><ul>${items}</ul>`, "New in the Herbarium");
  }

  return (
    <div className="cadmin-card nl-add">
      <h3>Add from the site</h3>
      <p className="cadmin-hint">Puts a short block with a link where the cursor is in the text below. You can change the wording after.</p>
      <div className="cadmin-filter">
        <label className="visually-hidden" htmlFor="nl-add-kind">Kind</label>
        <select id="nl-add-kind" value={kind} onChange={e => { setKind(e.target.value); setChoice(""); }}>
          <option value="blog">Blog post</option>
          <option value="media">Article</option>
          <option value="event">Event</option>
          <option value="herb">Herb</option>
        </select>
        <label className="visually-hidden" htmlFor="nl-add-item">Which one</label>
        <select id="nl-add-item" value={choice} onChange={e => setChoice(e.target.value)} disabled={!options.length}>
          {options.length === 0 && <option value="">Nothing published yet</option>}
          {options.map(o => <option value={o.id} key={o.id}>{o.label}</option>)}
        </select>
        <button type="button" className="cadmin-btn solid" disabled={!options.length} onClick={addOne}>Add</button>
      </div>
      <div className="cadmin-row">
        <button type="button" className="cadmin-btn" disabled={!events.length} onClick={addEvents} title={events.length ? "" : "No upcoming events are published"}>Add “Upcoming events” ({events.length})</button>
        <button type="button" className="cadmin-btn" disabled={!herbs.newest.length} onClick={addHerbs} title={herbs.newest.length ? "" : "No newly approved herbs"}>Add “New in the Herbarium” ({herbs.newest.length})</button>
      </div>
      {added && <p className="cadmin-hint" role="status">{added}</p>}
    </div>
  );
}

// v6.10: picture sizes are pixels of the 544 px email column (data-px), shown as
// min(px, share of the column) so a phone shows them smaller in proportion.
function numberPictures(html) { let k = 0; return String(html || "").replace(/<img\b/g, () => '<img data-i="' + (k++) + '"'); }
function parseBody(html) { return new DOMParser().parseFromString("<div id='r'>" + (html || "") + "</div>", "text/html"); }
function bodyPictureWidth(html, index) {
  const img = parseBody(html).querySelectorAll("#r img")[index];
  if (!img) return EMAIL_COLUMN;
  return Number(img.getAttribute("data-px")) || Number(img.getAttribute("width")) || EMAIL_COLUMN;
}
// Sets the width (px) of the index-th picture in the newsletter's text.
export function resizePicture(html, index, px) {
  const doc = parseBody(html);
  const img = doc.querySelectorAll("#r img")[index];
  if (!img) return html;
  const w = Math.round(Math.max(100, Math.min(EMAIL_COLUMN, px)));
  img.setAttribute("data-px", String(w));
  img.setAttribute("data-w", String(Math.round(w / EMAIL_COLUMN * 10000) / 100));
  img.setAttribute("width", String(w));
  img.setAttribute("style", "width:" + shownWidth(w));
  img.removeAttribute("data-size"); img.removeAttribute("data-align");
  return doc.getElementById("r").innerHTML;
}

// The bar for the chosen picture: the cover, or a picture in the text.
function PictureSizeBar({ picked, px, onSize, onDone }) {
  const tile = tileWidth(picked.ratio);
  const name = picked.key === "cover" ? "Cover" : "Picture " + (Number(picked.key) + 1);
  return (
    <div className="nl-picbar" role="toolbar" aria-label="Picture size">
      <span className="nl-picbar-label">{name}: {px} px wide{px === tile ? " · tile size" : px >= EMAIL_COLUMN ? " · full width" : ""}</span>
      <button type="button" className="cadmin-btn" disabled={px <= 100} onClick={() => onSize(px - 20)}>− Smaller</button>
      <button type="button" className="cadmin-btn" disabled={px >= EMAIL_COLUMN} onClick={() => onSize(px + 20)}>Larger +</button>
      <button type="button" className={"cadmin-btn" + (px === tile ? " on" : "")} aria-pressed={px === tile} onClick={() => onSize(tile)}>Tile size</button>
      <button type="button" className={"cadmin-btn" + (px >= EMAIL_COLUMN ? " on" : "")} aria-pressed={px >= EMAIL_COLUMN} onClick={() => onSize(EMAIL_COLUMN)}>Full width</button>
      <button type="button" className="cadmin-btn" onClick={onDone}>Done</button>
    </div>
  );
}

// sizing (admin, while writing): { picked, pick(key, ratio), widthOf(key), resize(key, px) }
function useResizable(root, sizing, columnOf, deps) {
  useEffect(() => {
    if (!sizing || !root) return undefined;
    return attachPictureResize(root, {
      picked: sizing.picked ? sizing.picked.key : null,
      columnWidth: columnOf, widthOf: sizing.widthOf, onPick: sizing.pick, onResize: sizing.resize,
    });
  }, [root, sizing && sizing.picked && sizing.picked.key, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

function EmailPreview({ issue, sizing = null }) {
  const viewUrl = issue.showOnSite && issue.slug ? SITE_URL + "/newsletter/" + issue.slug : "";
  const [doc, setDoc] = useState(null);
  const html = buildNewsletterEmail({ ...issue, body: sizing ? numberPictures(issue.body) : issue.body },
    { viewUrl, unsubscribeUrl: "#", logoUrl: emailLogo, markPictures: !!sizing });
  useResizable(doc, sizing, img => innerWidth(img.closest("td")), []);

  function onLoad(e) {
    try {
      const d = e.target.contentDocument;
      e.target.style.height = Math.max(400, d.documentElement.scrollHeight + 4) + "px";
      setDoc(d);
    } catch { /* keep the set height */ }
  }
  return (
    <div className="nl-email">
      <div className="nl-inbox">
        <span className="nl-inbox-from">IBVU</span>
        <span className="nl-inbox-subject">{issue.subject || <em>No subject line yet</em>}</span>
        {issue.previewText && <span className="nl-inbox-preview"> – {issue.previewText}</span>}
      </div>
      {/* No scripts can run in the preview; admin only adds the picture handles. */}
      <iframe className="nl-email-frame" title="How the email will look" sandbox="allow-same-origin" srcDoc={html} onLoad={onLoad} />
      <p className="cadmin-hint">Email programs differ a little: this is close to how Gmail and Apple Mail show it. Send a test to see it in your own inbox.</p>
    </div>
  );
}

function WebPreview({ issue, sizing = null }) {
  const [root, setRoot] = useState(null);
  const article = issueAsArticle({ ...issue, body: sizing ? numberPictures(issue.body) : issue.body, sentAt: issue.sentAt || new Date().toISOString() });
  useResizable(root, sizing, img => innerWidth(img.closest(".article")), [issue.body, issue.cover]);
  return <div className="cadmin-preview nl-web" ref={setRoot}><ArticleView article={article} share={false} markPictures={!!sizing} /></div>;
}

// Write: the cover as it will appear in the email, to resize it there too.
function CoverSize({ cover, sizing }) {
  const [root, setRoot] = useState(null);
  useResizable(root, sizing, () => innerWidth(root), [cover]);
  const px = widthOf(cover) || TILE_W;
  return (
    <div className="nl-cover-size" ref={setRoot}>
      <p className="cadmin-hint">The cover in the email: {px} px wide{px === TILE_W ? " (tile size)" : ""}. Click it to make it smaller or larger.</p>
      <div className="nl-cover-size-col"><img data-i="cover" src={wholeSrc(cover)} alt="Cover" style={{ width: shownWidth(px) }} /></div>
    </div>
  );
}

function audience(lists, counts) {
  if (PREVIEW_MODE) { const n = recipientsFor(lists).length; return { n, text: n + (n === 1 ? " person" : " people") }; }
  const sum = lists.reduce((a, k) => a + (counts[k] || 0), 0);
  return { n: sum, text: (lists.length > 1 ? "up to " : "") + sum + (sum === 1 ? " person" : " people") + (lists.length > 1 ? " (someone on more than one of these lists gets it once)" : "") };
}

/* ── writing an issue ────────────────────────────────────────────────── */

function IssueEditor({ initial, role, onBack, onError }) {
  const { newsletters } = useContent();
  const counts = useListCounts();
  const [n, setN] = useState(initial);
  const live = newsletters.find(x => x.id === n.id);
  const status = live ? live.status : "draft";
  const locked = status !== "draft";
  const owner = can(role, "send");
  const [saveState, setSaveState] = useState(initial.id ? "saved" : "new");
  const [view, setView] = useState("write"); // write | email | page
  const [problem, setProblem] = useState("");
  const [badField, setBadField] = useState(""); // the box that needs filling in
  const [picked, setPicked] = useState(null); // v6.10: { key: "cover" | "0" | "1"…, ratio } the picture being resized
  const [notice, setNotice] = useState("");
  const [asking, setAsking] = useState(""); // "" | "send" | "schedule"
  const [when, setWhen] = useState(live && live.sendAt ? isoToUKInput(live.sendAt) : tomorrowNine());
  const [busy, setBusy] = useState("");
  const editorRef = useRef(null);
  const latest = useRef(n); latest.current = n;
  const shown = locked && live ? live : n;
  const who = audience(shown.lists || [], counts);

  function change(patch) { if (locked) return; setN(v => ({ ...v, ...patch })); setSaveState("unsaved"); setProblem(""); setBadField(""); }

  // v6.10: picture sizes (px of the 544 px email column)
  const pxOfKey = key => key === "cover" ? (widthOf(latest.current.cover) || TILE_W) : bodyPictureWidth(latest.current.body, Number(key));
  function resize(key, px) {
    const c = latest.current, w = Math.round(Math.max(100, Math.min(EMAIL_COLUMN, px)));
    if (key === "cover") change({ cover: withWidth(c.cover, w) });
    else change({ body: resizePicture(c.body, Number(key), w) });
  }
  const sizing = locked ? null : { picked, pick: (key, ratio) => setPicked({ key, ratio }), widthOf: pxOfKey, resize };
  const show = v => { setPicked(null); setView(v); };
  // A new cover starts at tile size (in its own shape).
  useEffect(() => {
    if (locked || !n.cover || widthOf(n.cover)) return;
    let gone = false;
    loadImage(wholeSrc(n.cover)).then(img => { if (!gone && latest.current.cover === n.cover) change({ cover: withWidth(n.cover, tileWidth(img.naturalWidth / img.naturalHeight)) }); }).catch(() => {});
    return () => { gone = true; };
  }, [n.cover]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(quiet) {
    const c = latest.current;
    if (!c.title.trim() && !c.body) return null;
    const result = saveIssue(pick({ ...c, title: c.title.trim() || "Untitled" }), { quiet });
    if (!result.ok) { onError(result.error); setSaveState("unsaved"); return null; }
    setN(v => ({ ...v, id: result.id, slug: result.slug }));
    setSaveState("saved");
    return result;
  }
  // Drafts save by themselves shortly after you stop typing.
  useEffect(() => {
    if (saveState !== "unsaved" || locked) return;
    const timer = setTimeout(() => { setSaveState("saving"); persist(true); }, 1200);
    return () => clearTimeout(timer);
  }, [n, saveState, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  function missing() {
    if (!n.title.trim()) return { text: "Add the newsletter title: the box marked “Newsletter title” at the top of Write.", field: "title" };
    if (!n.subject.trim()) return { text: "Add the email subject line (what people see in their inbox).", field: "subject" };
    if (!plainText(n.body).trim() && !/<img/.test(n.body || "")) return { text: "Write something in the newsletter first.", field: "body" };
    if (!n.lists.length) return { text: "Choose at least one list to send it to (under “Send to”).", field: "lists" };
    return null;
  }
  // Shows what is missing and takes you to it.
  function check() {
    const m = missing();
    setProblem(m ? m.text : ""); setBadField(m ? m.field : "");
    if (m) {
      setView("write");
      setTimeout(() => {
        const el = m.field === "title" ? document.getElementById("nl-title")
          : m.field === "subject" ? document.getElementById("nl-subject")
          : m.field === "lists" ? document.querySelector(".nl-lists input")
          : document.querySelector(".nl-body .ProseMirror");
        if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus({ preventScroll: true }); }
      }, 60);
    }
    return !m;
  }

  async function test() {
    if (!check()) return;
    const r = persist(true); if (!r) return;
    setBusy("test"); setNotice("");
    const res = await sendTestIssue(r.id);
    setBusy("");
    if (!res.ok) { onError(res.error); return; }
    setNotice(res.preview ? "In the preview no email is sent. On the real site the test goes to your own address only, with [Test] in front of the subject." : "A test was sent to " + (res.to || "your address") + ", with [Test] in front of the subject.");
  }
  async function sendNow() {
    const r = persist(false); if (!r) return;
    setBusy("send"); setNotice("");
    const res = await sendIssueNow(r.id);
    setBusy(""); setAsking("");
    if (!res.ok) { onError(res.error); return; }
    setNotice(res.inProgress
      ? "Sending has started. It carries on by itself; this page shows the result when it is done."
      : "Sent to " + res.recipients + (res.recipients === 1 ? " person" : " people") + (res.failures ? ". " + res.failures + " could not be sent: see the list below." : "."));
  }
  function schedule() {
    const iso = ukInputToISO(when);
    if (!iso || Date.parse(iso) < Date.now() + 5 * 60 * 1000) { setProblem("Choose a time at least 5 minutes from now."); return; }
    if (!locked) { const r = persist(false); if (!r) return; scheduleIssue(r.id, iso); }
    else scheduleIssue(live.id, iso);
    setAsking(""); setProblem("");
    setNotice("Scheduled for " + ukText(iso) + ". It goes out within 5 minutes of that time.");
  }
  function unschedule() { unscheduleIssue(live.id); setNotice("The schedule is cancelled. It is a draft again and can be changed."); }
  function toBlog() {
    const r = locked ? null : persist(true);
    const id = (r && r.id) || n.id;
    if (!id) return;
    const res = copyIssueToBlog(id);
    if (res && res.ok) setNotice("A blog post draft was made from this newsletter. Find it under Blog.");
  }

  const saveLabel = { new: "Not saved yet", unsaved: "Saving soon…", saving: "Saving…", saved: "Draft saved" }[saveState];

  if (live && (status === "sending" || status === "sent")) return <SentRecord id={live.id} role={role} onBack={onBack} onError={onError} notice={notice} />;

  return (
    <div className="cadmin-editor">
      <div className="cadmin-editor-bar">
        <button type="button" className="cadmin-btn" onClick={() => { if (saveState === "unsaved") persist(true); onBack(); }}>← All newsletters</button>
        <IssueBadge status={status} />
        {!locked && <span className="cadmin-save-state" aria-live="polite">{saveLabel}</span>}
        <span className="cadmin-spacer" />
        <div className="cadmin-tabs" role="group" aria-label="View">
          <button type="button" className={"cadmin-btn" + (view === "write" ? " on" : "")} aria-pressed={view === "write"} disabled={locked} onClick={() => show("write")}>Write</button>
          <button type="button" className={"cadmin-btn" + (view === "email" ? " on" : "")} aria-pressed={view === "email"} onClick={() => show("email")}>Preview as email</button>
          <button type="button" className={"cadmin-btn" + (view === "page" ? " on" : "")} aria-pressed={view === "page"} onClick={() => show("page")}>Preview as web page</button>
        </div>
      </div>

      <div className="cadmin-editor-bar nl-actions">
        <button type="button" className="cadmin-btn" disabled={!!busy} onClick={test}>{busy === "test" ? "Sending the test…" : "Send a test to me"}</button>
        {owner && !locked && <button type="button" className="cadmin-btn" onClick={() => { if (check()) setAsking(asking === "schedule" ? "" : "schedule"); }}>Schedule…</button>}
        {owner && !locked && <button type="button" className="cadmin-btn go" disabled={!!busy} onClick={() => { if (check()) setAsking(asking === "send" ? "" : "send"); }}>Send now…</button>}
        {owner && status === "scheduled" && <button type="button" className="cadmin-btn" onClick={() => setAsking(asking === "schedule" ? "" : "schedule")}>Change the time</button>}
        {owner && status === "scheduled" && <button type="button" className="cadmin-btn" onClick={unschedule}>Cancel the schedule</button>}
        <span className="cadmin-spacer" />
        {(n.title || n.body) && <button type="button" className="cadmin-btn" onClick={toBlog}>Copy to Blog</button>}
        {n.id && !locked && can(role, "delete") && <DeleteButton question="Delete this draft for good?" onDelete={() => { deleteIssue(n.id); onBack(); }} />}
      </div>

      {problem && <p className="cadmin-problem" role="alert">{problem}</p>}
      {notice && <p className="cadmin-note" role="status">{notice}</p>}
      {!owner && <p className="cadmin-hint">Editors write and test newsletters. An Owner sends or schedules them.</p>}
      {status === "scheduled" && live && (
        <p className="cadmin-note">Scheduled for <strong>{ukText(live.sendAt)}</strong> to {listNames(live.lists)} ({who.text}). It cannot be changed while it is scheduled{owner ? ": cancel the schedule first." : ". An Owner can cancel the schedule."}</p>
      )}

      {asking === "send" && (
        <div className="cadmin-card nl-confirm" role="alertdialog" aria-label="Send now">
          <p>Send “<strong>{n.subject}</strong>” now to {listNames(n.lists)}: {who.text}?</p>
          {who.n === 0
            ? <p className="cadmin-problem">Nobody on {n.lists.length > 1 ? "these lists" : "this list"} has confirmed yet, so there is no one to send it to.</p>
            : <p className="cadmin-hint">This cannot be undone. Once sent, the newsletter is locked{n.showOnSite ? " and appears on ibvu.org/newsletter" : ""}.</p>}
          <div className="cadmin-row">
            <button type="button" className="cadmin-btn go" disabled={!!busy || who.n === 0} onClick={sendNow}>{busy === "send" ? "Sending…" : "Yes, send it now"}</button>
            <button type="button" className="cadmin-btn" disabled={!!busy} onClick={() => setAsking("")}>Cancel</button>
          </div>
        </div>
      )}
      {asking === "schedule" && (
        <div className="cadmin-card nl-confirm" aria-label="Schedule">
          <label htmlFor="nl-when">Send on (UK time)</label>
          <div className="cadmin-row">
            <input id="nl-when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
            <button type="button" className="cadmin-btn solid" onClick={schedule}>{status === "scheduled" ? "Change the time" : "Schedule"}</button>
            <button type="button" className="cadmin-btn" onClick={() => setAsking("")}>Cancel</button>
          </div>
          <p className="cadmin-hint">To {listNames(shown.lists)}: {who.text}. The site checks every 5 minutes, so it goes out within 5 minutes of this time. You can cancel or change it until then.</p>
        </div>
      )}

      {sizing && picked && (view !== "write" || picked.key === "cover") && (
        <PictureSizeBar picked={picked} px={pxOfKey(picked.key)} onSize={px => resize(picked.key, px)} onDone={() => setPicked(null)} />
      )}
      {sizing && !picked && view !== "write" && (shown.cover || /<img/.test(shown.body || "")) && <p className="cadmin-hint nl-pic-hint">Click any picture to make it smaller or larger, or drag its corners.</p>}
      {view === "email" ? <EmailPreview issue={shown} sizing={sizing} /> :
       view === "page" ? <WebPreview issue={shown} sizing={sizing} /> :
       locked ? <EmailPreview issue={shown} /> : (
        <div className="cadmin-writing">
          <label className="nl-title-label" htmlFor="nl-title">Newsletter title <span>(shown at the top of the email and on the website)</span></label>
          <textarea id="nl-title" className={"cadmin-title-input nl-title-box" + (badField === "title" ? " nl-missing" : "")} rows="1" placeholder="For example: IBVU News, December 2026" value={n.title}
            onChange={e => change({ title: e.target.value.replace(/\n/g, " ") })}
            onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }} />
          <div className="cadmin-grid2">
            <div className="cadmin-field wide"><label htmlFor="nl-subject">Email subject line (what people see in their inbox)</label><input id="nl-subject" className={badField === "subject" ? "nl-missing" : ""} value={n.subject} maxLength={150} onChange={e => change({ subject: e.target.value })} /></div>
            <div className="cadmin-field wide"><label htmlFor="nl-preview">Preview line (the grey text shown after the subject in most inboxes; also the summary on the website)</label><input id="nl-preview" value={n.previewText} maxLength={200} onChange={e => change({ previewText: e.target.value })} /></div>
            <fieldset className={"cadmin-field nl-lists" + (badField === "lists" ? " nl-missing" : "")}>
              <legend>Send to</legend>
              {MAILING_LISTS.map(l => (
                <label className="cadmin-check" key={l.key}>
                  <input type="checkbox" checked={n.lists.includes(l.key)} onChange={e => change({ lists: e.target.checked ? [...n.lists, l.key] : n.lists.filter(k => k !== l.key) })} />
                  {l.name} <span className="cadmin-item-meta">({(PREVIEW_MODE ? recipientsFor([l.key]).length : counts[l.key] || 0)} confirmed)</span>
                </label>
              ))}
              <label className="cadmin-check nl-onsite">
                <input type="checkbox" checked={n.showOnSite} onChange={e => change({ showOnSite: e.target.checked })} />
                Show on the website once sent (ibvu.org/newsletter)
              </label>
            </fieldset>
            <div className="cadmin-field"><label>Cover image (optional)</label><ImageField value={n.cover} label="Cover image" folder="newsletters" shapes={[SHAPES.tile]} withCaption hint="Framing sets the tile on ibvu.org/newsletter. The email and the open issue show the whole picture." onChange={cover => change({ cover })} onError={onError} /></div>
          </div>
          {n.cover && <CoverSize cover={n.cover} sizing={sizing} />}
          <AddFromSite editorRef={editorRef} />
          <div className={"nl-body" + (badField === "body" ? " nl-missing" : "")}>
            <Suspense fallback={<p className="cadmin-hint">Loading the editor…</p>}>
              <RichEditor tileMode value={n.body} placeholder="Write the newsletter…" onChange={body => change({ body })} onError={onError} onReady={ed => { editorRef.current = ed; }} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── what was sent ───────────────────────────────────────────────────── */

function SentRecord({ id, role, onBack, onError, notice }) {
  const { newsletters, newsletterSends } = useContent();
  const n = newsletters.find(x => x.id === id);
  const [query, setQuery] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [done, setDone] = useState("");
  const owner = can(role, "send");
  if (!n) return <p className="cadmin-empty">This newsletter was not found. <button type="button" className="cadmin-btn" onClick={onBack}>← All newsletters</button></p>;
  const sends = newsletterSends.filter(s => s.issueId === id);
  const q = query.trim().toLowerCase();
  const shown = sends.filter(s => (!onlyFailed || s.status === "failed") && (!q || s.email.includes(q)));

  return (
    <div className="cadmin-editor">
      <div className="cadmin-editor-bar">
        <button type="button" className="cadmin-btn" onClick={onBack}>← All newsletters</button>
        <IssueBadge status={n.status} />
        <span className="cadmin-spacer" />
        <button type="button" className="cadmin-btn" onClick={() => setPreview(p => !p)}>{preview ? "Hide the email" : "See the email"}</button>
        <button type="button" className="cadmin-btn" onClick={() => { const r = copyIssueToBlog(n.id); if (r && r.ok) setDone("A blog post draft was made from this newsletter. Find it under Blog."); }}>Copy to Blog</button>
      </div>
      {notice && <p className="cadmin-note" role="status">{notice}</p>}
      {done && <p className="cadmin-note" role="status">{done}</p>}

      <div className="cadmin-card">
        <h3>{n.title}</h3>
        {n.status === "sending" ? (
          <p className="cadmin-note">Sending… It carries on by itself, even if this page is closed. <button type="button" className="cadmin-btn" onClick={() => reloadStaff()}>Check again</button></p>
        ) : (
          <dl className="nl-record">
            <dt>Sent</dt><dd>{ukText(n.sentAt)}</dd>
            <dt>Subject line</dt><dd>{n.subject}</dd>
            <dt>Lists</dt><dd>{listNames(n.lists)}</dd>
            <dt>Sent to</dt><dd>{n.recipients} {n.recipients === 1 ? "person" : "people"}</dd>
            <dt>Could not be sent</dt><dd>{n.failures || 0}</dd>
            <dt>Sent by</dt><dd>{n.sentBy || "—"}</dd>
            <dt>On the website</dt>
            <dd>
              {n.showOnSite ? <Link to={"/newsletter/" + n.slug}>ibvu.org/newsletter/{n.slug}</Link> : "Hidden"}
              {owner && <> <button type="button" className="cadmin-btn" onClick={() => { const r = setIssueVisible(n.id, !n.showOnSite); if (r && r.ok === false) onError("That could not be changed."); }}>{n.showOnSite ? "Hide from the website" : "Show on the website"}</button></>}
            </dd>
          </dl>
        )}
      </div>

      {preview && <EmailPreview issue={n} />}

      {owner && sends.length > 0 && (
        <div className="cadmin-card">
          <h3>Who it went to</h3>
          <div className="cadmin-filter">
            <label className="visually-hidden" htmlFor="nl-sent-search">Search</label>
            <input id="nl-sent-search" type="text" placeholder="Search email addresses…" value={query} onChange={e => setQuery(e.target.value)} />
            <label className="cadmin-check"><input type="checkbox" checked={onlyFailed} onChange={e => setOnlyFailed(e.target.checked)} /> Only those that could not be sent</label>
          </div>
          <ul className="nl-sends">
            {shown.slice(0, 500).map(s => (
              <li key={s.email}>
                <span>{s.email}</span>
                {s.status === "failed" ? <span className="cadmin-badge draft" title={s.error}>Not sent{s.error ? ": " + s.error : ""}</span> : <span className="cadmin-badge live">Sent</span>}
              </li>
            ))}
          </ul>
          {shown.length > 500 && <p className="cadmin-hint">Showing the first 500. Search to find someone.</p>}
          {shown.length === 0 && <p className="cadmin-empty">Nobody matches.</p>}
        </div>
      )}
    </div>
  );
}

/* ── reminders (Owners) ──────────────────────────────────────────────── */

function RemindersAdmin({ onError }) {
  const { reminderRecipients, reminderSettings } = useContent();
  const [email, setEmail] = useState("");
  const [s, setS] = useState(reminderSettings);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!dirty) setS(reminderSettings); }, [reminderSettings]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = patch => { setS(v => ({ ...v, ...patch })); setDirty(true); setSaved(false); };

  function add(e) {
    e.preventDefault();
    if (!isEmail(email.trim())) { onError("Enter an email address."); return; }
    const r = addReminderRecipient(email);
    if (!r.ok) { onError(r.error || "That address could not be added."); return; }
    setEmail("");
  }
  function save() { saveReminderSettings(s); setDirty(false); setSaved(true); }

  return (
    <div>
      <div className="cadmin-card">
        <h3>Who gets the reminders</h3>
        <p className="cadmin-hint">Reminder emails come from hello@ibvu.org. This list is only for reminders; it is not a mailing list and is never shown on the site.</p>
        {reminderRecipients.length === 0 && <p className="cadmin-empty">Nobody yet. Add an address below; until then no reminders are sent.</p>}
        <ul className="nl-sends">
          {reminderRecipients.map(r => (
            <li key={r.id}><span>{r.email}</span><DeleteButton label="Remove" question="Stop sending reminders here?" confirmLabel="Yes, remove" onDelete={() => removeReminderRecipient(r.id)} /></li>
          ))}
        </ul>
        <form className="cadmin-row" onSubmit={add}>
          <label className="visually-hidden" htmlFor="rm-email">Email address</label>
          <input id="rm-email" type="email" placeholder="name@ibvu.org" value={email} onChange={e => setEmail(e.target.value)} />
          <button type="submit" className="cadmin-btn solid">Add</button>
        </form>
      </div>

      <div className="cadmin-card">
        <h3>Which reminders</h3>
        <label className="cadmin-check nl-reminder">
          <input type="checkbox" checked={s.dueEnabled} onChange={e => set({ dueEnabled: e.target.checked })} />
          <span><strong>A newsletter is due.</strong> On day{" "}
            <select aria-label="Day of the month" value={s.dueDay} onChange={e => set({ dueDay: Number(e.target.value) })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option value={d} key={d}>{d}</option>)}
            </select>{" "}
            of each month (from 08:00 UK time), if nothing has been sent or scheduled that month to{" "}
            <select aria-label="List" value={s.dueList} onChange={e => set({ dueList: e.target.value })}>
              {MAILING_LISTS.map(l => <option value={l.key} key={l.key}>{l.name}</option>)}
            </select>.
          </span>
        </label>
        <label className="cadmin-check nl-reminder">
          <input type="checkbox" checked={s.beforeEnabled} onChange={e => set({ beforeEnabled: e.target.checked })} />
          <span><strong>A scheduled newsletter goes out soon.</strong>{" "}
            <select aria-label="How long before" value={s.beforeHours} onChange={e => set({ beforeHours: Number(e.target.value) })}>
              {[1, 2, 3, 6, 12, 24, 48].map(h => <option value={h} key={h}>{h} {h === 1 ? "hour" : "hours"}</option>)}
            </select>{" "}
            before it is sent, with a reminder to check it.
          </span>
        </label>
        <label className="cadmin-check nl-reminder">
          <input type="checkbox" checked={s.afterEnabled} onChange={e => set({ afterEnabled: e.target.checked })} />
          <span><strong>A newsletter has been sent.</strong> How many people it reached, and any that could not be sent.</span>
        </label>
        <div className="cadmin-row">
          <button type="button" className="cadmin-btn solid" disabled={!dirty} onClick={save}>Save</button>
          {saved && <span className="cadmin-save-state" role="status">Saved</span>}
        </div>
      </div>
    </div>
  );
}

/* ── the section ─────────────────────────────────────────────────────── */

/* ── v6.09: sending history (what was sent to each address) ─────────── */

const cell = v => { const s = String(v == null ? "" : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function downloadHistory(rows) {
  const head = ["email", "newsletter", "subject", "sent_uk_time", "result", "problem"];
  const lines = [head.join(",")].concat(rows.map(r => [r.email, r.title, r.subject, ukText(r.sentAt), r.status === "sent" ? "sent" : "not sent", r.error].map(cell).join(",")));
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ibvu-sending-history-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function SendingHistory() {
  const { newsletters, newsletterSends } = useContent();
  const [query, setQuery] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const byId = Object.fromEntries(newsletters.map(n => [n.id, n]));
  const rows = newsletterSends
    .map(s => ({ ...s, title: (byId[s.issueId] && byId[s.issueId].title) || "(deleted newsletter)", subject: (byId[s.issueId] && byId[s.issueId].subject) || "" }))
    .sort((a, b) => a.email.localeCompare(b.email) || (b.sentAt || "").localeCompare(a.sentAt || ""));
  const q = query.trim().toLowerCase();
  const shown = rows.filter(r => (!onlyProblems || r.status !== "sent") && (!q || r.email.includes(q) || r.title.toLowerCase().includes(q)));
  const people = [];
  for (const r of shown) {
    const last = people[people.length - 1];
    if (last && last.email === r.email) last.rows.push(r); else people.push({ email: r.email, rows: [r] });
  }
  const addresses = new Set(rows.map(r => r.email)).size;
  return (
    <div className="nl-history">
      <p className="cadmin-hint">Every newsletter sent from here, to every address: when it went and whether the email service accepted it. Tests sent to yourself are not included. {rows.length ? rows.length + " emails to " + addresses + (addresses === 1 ? " address" : " addresses") + "." : ""}</p>
      <div className="cadmin-filter">
        <label className="visually-hidden" htmlFor="nh-search">Search</label>
        <input id="nh-search" type="text" placeholder="Search by email address or newsletter…" value={query} onChange={e => setQuery(e.target.value)} />
        <label className="cadmin-check"><input type="checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} /> Only emails that were not sent</label>
      </div>
      <div className="cadmin-row">
        <button type="button" className="cadmin-btn solid" disabled={!shown.length} onClick={() => downloadHistory(shown)}>Download as spreadsheet ({shown.length})</button>
      </div>
      {rows.length === 0 && <p className="cadmin-empty">No newsletters have been sent yet. Once one is sent, every address it went to is listed here.</p>}
      {rows.length > 0 && shown.length === 0 && <p className="cadmin-empty">Nothing matches.</p>}
      <div className="cadmin-list">
        {people.map(p => (
          <div className="cadmin-item nl-history-person" key={p.email}>
            <div className="cadmin-item-main">
              <p className="cadmin-item-title">{p.email} <span className="cadmin-item-meta">({p.rows.length} {p.rows.length === 1 ? "newsletter" : "newsletters"})</span></p>
              <table className="nl-history-table">
                <thead><tr><th>Newsletter</th><th>Sent (UK time)</th><th>Result</th></tr></thead>
                <tbody>
                  {p.rows.map(r => (
                    <tr key={r.issueId}>
                      <td>{r.title}</td>
                      <td>{ukText(r.sentAt)}</td>
                      <td>{r.status === "sent" ? <span className="cadmin-badge live">Sent</span> : <span className="cadmin-badge draft" title={r.error}>Not sent{r.error ? ": " + r.error : ""}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NewslettersAdmin({ role, onError }) {
  const { newsletters, newsletterReady } = useContent();
  const [tab, setTab] = useState("issues");
  const [editing, setEditing] = useState(null);
  const [ran, setRan] = useState("");
  const owner = can(role, "send");
  const sorted = [...newsletters].sort((a, b) => ((b.sentAt || b.updatedAt || "")).localeCompare(a.sentAt || a.updatedAt || ""));
  const scheduled = newsletters.filter(n => n.status === "scheduled");

  if (editing) {
    return <section><IssueEditor key={editing.id || "new"} initial={{ ...NEW_ISSUE, ...editing }} role={role} onError={onError} onBack={() => setEditing(null)} /></section>;
  }

  return (
    <section>
      <div className="cadmin-section-head">
        <h2>Newsletters</h2>
        {tab === "issues" && <button type="button" className="cadmin-btn solid" disabled={newsletterReady === false} onClick={() => setEditing({ ...NEW_ISSUE })}>New newsletter</button>}
      </div>
      {owner && (
        <div className="cadmin-tabs nl-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "issues"} className={"cadmin-btn" + (tab === "issues" ? " on" : "")} onClick={() => setTab("issues")}>Newsletters</button>
          <button type="button" role="tab" aria-selected={tab === "history"} className={"cadmin-btn" + (tab === "history" ? " on" : "")} onClick={() => setTab("history")}>Sending history</button>
          <button type="button" role="tab" aria-selected={tab === "reminders"} className={"cadmin-btn" + (tab === "reminders" ? " on" : "")} onClick={() => setTab("reminders")}>Reminders</button>
        </div>
      )}
      {newsletterReady === false && (
        <p className="cadmin-note">The newsletter part of the database is not set up yet (database step 2). Until it is, newsletters cannot be saved or sent here.</p>
      )}

      {tab === "history" && owner ? <SendingHistory /> : tab === "reminders" && owner ? <RemindersAdmin onError={onError} /> : (
        <>
          <p className="cadmin-hint">Write a newsletter here, preview it and send a test to yourself. {owner ? "Then send it now or schedule it" : "An Owner then sends or schedules it"}. Sent newsletters with “Show on the website” ticked appear on <Link to="/newsletter">ibvu.org/newsletter</Link>.</p>
          {PREVIEW_MODE && scheduled.length > 0 && (
            <p className="cadmin-note">Preview: on the real site a timer sends scheduled newsletters when their time comes. <button type="button" className="cadmin-btn" onClick={() => { const k = previewRunTimer(); setRan(k ? k + " sent." : "Nothing is due yet."); }}>Run the timer now</button> {ran}</p>
          )}
          <div className="cadmin-list">
            {sorted.length === 0 && <p className="cadmin-empty">No newsletters yet.</p>}
            {sorted.map(n => (
              <div className="cadmin-item" key={n.id}>
                <div className="cadmin-item-main">
                  <p className="cadmin-item-title">{n.title || "(untitled)"} <IssueBadge status={n.status} />{n.status === "sent" && !n.showOnSite && <span className="cadmin-badge past">Not on the website</span>}</p>
                  <p className="cadmin-item-meta">
                    {n.status === "sent" ? "Sent " + ukText(n.sentAt) + " to " + n.recipients + (n.recipients === 1 ? " person" : " people") + (n.failures ? " (" + n.failures + " not sent)" : "")
                      : n.status === "scheduled" ? "Goes out " + ukText(n.sendAt)
                      : n.status === "sending" ? "Sending now"
                      : "Last changed " + (n.updatedAt ? formatDate(n.updatedAt.slice(0, 10), false) : "—")}
                    {" · "}{listNames(n.lists) || "No list chosen"}
                  </p>
                </div>
                <div className="cadmin-item-actions">
                  <button type="button" className="cadmin-btn" onClick={() => setEditing(n)}>{n.status === "draft" ? "Edit" : "Open"}</button>
                  {n.status === "sent" && n.showOnSite && <Link className="cadmin-btn" to={"/newsletter/" + n.slug}>View</Link>}
                  {n.status === "draft" && can(role, "delete") && <DeleteButton onDelete={() => deleteIssue(n.id)} />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
