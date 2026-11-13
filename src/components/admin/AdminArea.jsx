// IBVU v6.06 — what changed in this file: herb photos are framed as a square, the
// shape they now have on the herb page and in the Herbarium list.
//
// IBVU v6.04 — what changed in this file since v6.03:
// - Every picture can be framed: after choosing a picture the framing window
//   opens (move, zoom bigger or smaller, fill or show the whole picture, turn,
//   reset), and "Frame picture" reopens it. This covers event pictures,
//   article and blog covers, every page picture (also the built-in photos)
//   and herb photos ("Frame photo" in Herb photos). Each one is shown in the
//   shape it has on the site. Framing means move and zoom in (crop); a picture
//   always fills its box.
// - Fix: if an editor was opened before saved draft changes had finished
//   loading, it showed the live version and "Publish changes" could throw the
//   draft away. The draft changes are now filled in as soon as they arrive
//   (unless something has already been typed).
//
// IBVU v6.03 — what changed in this file since v6.02:
// - New section for Owners and Editors: Newsletters (ibvu.org/admin/newsletters,
//   in NewslettersAdmin.jsx): write, preview, test, send or schedule, the sent
//   record, and (Owners) the Reminders list and settings.
// - Draft changes to live items. A published article, blog post or event,
//   and any page, can now be changed without the change going live at once:
//   "Save as draft changes" keeps the changes aside, "Publish changes" puts
//   them live, "Discard draft changes" throws them away. Lists show
//   "Changes waiting" where there are draft changes. Writers can now open
//   live articles, posts and events and suggest changes this way; an Editor
//   or Owner publishes them. Pages has "Preview on the page", which opens the
//   page with the draft wording shown (only to signed-in admin people).
// - Mailing lists: each person shows the newsletters they received.
// - The delete button and image picker moved to bits.jsx (unchanged).
//
// IBVU v6.02 — what changed in this file since v6.0:
// - Two new sections for Owners only:
//   Messages (ibvu.org/admin/messages): what people sent through the contact form.
//   Mailing lists (ibvu.org/admin/lists): who is on which list, who is still
//   to confirm, search, remove, and "Download as spreadsheet" for one list at
//   a time, including each person's own unsubscribe link to put in emails.
//
// IBVU v6.0 — what changed in this file since v5.92:
// - Connected to the database: what is saved here is saved for everyone
//   (the saving itself happens in src/lib/content.js).
// - Sign-in: while a saved sign-in is being checked the screen says so; a
//   person who signs in but is not on the People list is told they have no
//   access and can sign out.
// - If a save fails, a message appears at the top and the last saved version
//   is reloaded.
// - Pictures (event and article images, page images, herb photos, pictures
//   inside articles) are uploaded to the picture store as they are chosen.
// - People: adding someone sets them up to receive sign-in codes.
// - Herb photos waiting for review are shown from the private store.
//
// IBVU v5.92 — what changed in this file: Herb photos uses the same herb list and addresses as the Herbarium (src/lib/herbs.js), and marks herbs that are published twice.
//
// IBVU v5.9 — what changed in this file since v5.8:
// - Sign-in first: every admin address shows the sign-in screen until the
//   person has signed in (AdminSignIn.jsx). After that they see only the
//   sections their role allows. The bar has a Sign out button.
// - The "Try the screens as" switch is removed. To see another role in the
//   preview, add a person on the People page, sign out and sign in as them.
// - Herb review no longer has a second sign-in of its own.
// - Pages: every page of the site now has a form here (Home, About, Regulate,
//   Herbarium, Media and Blog, Innovate, Shop, Contact, Newsletter and
//   footer). ibvu.org/admin/pages?page=home opens a form directly; that is
//   where the "Edit this page" button on the site leads.
//
// IBVU v5.8 — what changed in this file since v5.7:
// - New admin section, Blog (ibvu.org/admin/blog). It is the Articles screen
//   and editor used a second time: drafts, preview, publish, unpublish, share.
//   Blog posts are published to ibvu.org/educate/blog; Articles still go to
//   ibvu.org/media. Writers can draft in both; Editors and Owners publish.
//
// IBVU v5.7 — what changed in this file since v5.6 (it was ContentAdmin.jsx):
// - This is now the whole admin area at ibvu.org/admin. Each section has its
//   own address: /admin/herbreview, /admin/herbphotos, /admin/events,
//   /admin/articles, /admin/pages, /admin/people, /admin/history.
//   ibvu.org/admin itself is a front page listing the sections a person may use.
// - Herb review is a separate permission: a tick per person on the People
//   screen. Owners always have it. It covers Herb review and Herb photos.
// - New section, Herb photos: approve or reject photos sent in with herb
//   submissions, and add, change or remove the photo of any published herb.
// - Events, Articles, Pages, People and History work as in v5.6.
//
// PREVIEW MODE: everything here saves in this browser only (see
// src/lib/content.js). There is no sign-in for these screens yet; the "Try the
// screens as" switch shows what each role can and cannot do. Real sign-in and
// the database are connected when the build is approved. Herb review itself
// still uses the existing email-code sign-in and the live database.
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, NavLink, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  PREVIEW_MODE, ROLES, can, canReviewHerbs, useContent, useSession, useSessionStatus, useSignedInEmail, signOut, resetPreview,
  uploadSiteImage, clearSyncError, removeSignup, deleteMessage,
  draftFor, useDraft, saveDraftChanges, discardDraftChanges, setShowDraftChanges,
  herbKey, approveHerbPhoto, rejectHerbPhoto, setHerbPhoto, removeHerbPhoto,
  saveEvent, setEventStatus, deleteEvent,
  saveArticle, setArticleStatus, deleteArticle,
  savePage, resetPage, savePerson, removePerson,
  formatDate, todayISO, excerpt, pageUrl, WRITING, sectionOf, articlePath,
} from '../../lib/content.js';
import { DEFAULT_PAGES, PAGE_FORMS } from '../../content/defaults.js';
import { isEmail, ENQUIRY_TYPES } from '../../lib/messages.js';
import { MAILING_LISTS, listName } from '../../lib/lists.js';
import { ArticleView } from '../Media.jsx';
import { shareLinks, copyText } from '../Share.jsx';
import { usePageTitle } from '../../lib/site.js';
import { mergeHerbs } from '../../lib/herbs.js';
import { HERBS_FALLBACK } from '../../constants/herbs.js';
import { SUPABASE_READY, sbFetchApproved, sbFetchStaticHerbs } from '../../lib/supabase.js';

const RichEditor = lazy(() => import('./RichEditor.jsx'));
const AdminPanel = lazy(() => import('../AdminPanel.jsx'));
const NewslettersAdmin = lazy(() => import('./NewslettersAdmin.jsx'));
import { DeleteButton, ImageField, SHAPES } from './bits.jsx';
import FrameEditor, { FramePreview } from './FrameEditor.jsx';
import { BUILTIN_IMAGES, IMAGE_SHAPES } from '../../content/builtinImages.js';
import { parseImage, buildImage } from '../../lib/frame.js';
import AdminSignIn from './AdminSignIn.jsx';
import { DEMO_SIGN_IN } from '../../lib/auth.js';

/* ── small shared pieces ─────────────────────────────────────────────── */

function WaitingBadge() { return <span className="cadmin-badge sched">Changes waiting</span>; }

// Shown above an editor when the live item has draft changes.
function DraftNote({ draft, live = true }) {
  if (!draft) return null;
  return (
    <p className="cadmin-note">
      You are looking at <strong>draft changes</strong> saved by {draft.savedBy || "someone"} on {formatDate((draft.updatedAt || "").slice(0, 10), false)}.
      {live ? " The site still shows the published version until the changes are published." : ""}
    </p>
  );
}

function StatusBadge({ status }) {
  return <span className={"cadmin-badge " + (status === "published" ? "live" : "draft")}>{status === "published" ? "Published" : "Draft"}</span>;
}

// Shown after publishing: ready-made text and links for social media.
function SharePanel({ title, text, path, onClose }) {
  const links = shareLinks(path, title);
  const [post, setPost] = useState((title + (text ? "\n\n" + text : "") + "\n\n" + links.url).trim());
  const [copied, setCopied] = useState("");
  async function copy(what, value) { if (await copyText(value)) { setCopied(what); setTimeout(() => setCopied(""), 2000); } }
  return (
    <div className="cadmin-share" role="status">
      <div className="cadmin-share-head">
        <strong>Published.</strong> Share it:
        <button type="button" className="cadmin-btn" onClick={onClose}>Close</button>
      </div>
      <label htmlFor="share-post">Post text (edit it here before copying)</label>
      <textarea id="share-post" rows="5" value={post} onChange={e => setPost(e.target.value)} />
      <div className="cadmin-row">
        <button type="button" className="cadmin-btn solid" onClick={() => copy("text", post)}>{copied === "text" ? "Copied" : "Copy post text"}</button>
        <button type="button" className="cadmin-btn" onClick={() => copy("link", links.url)}>{copied === "link" ? "Copied" : "Copy link"}</button>
        <a className="cadmin-btn" href={links.linkedin} target="_blank" rel="noreferrer">Open LinkedIn</a>
        <a className="cadmin-btn" href={links.whatsapp} target="_blank" rel="noreferrer">Open WhatsApp</a>
      </div>
      <p className="cadmin-hint">Instagram posts cannot carry a clickable link: copy the text, add the image in Instagram, and put the link in your bio.</p>
    </div>
  );
}

/* ── Events ──────────────────────────────────────────────────────────── */

const NEW_EVENT = { title: "", date: "", time: "", location: "", description: "", bookingUrl: "", image: "", status: "draft" };

const EVENT_FIELDS = ["title", "date", "time", "location", "description", "bookingUrl", "image"];
const fieldsOf = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj[k] == null ? "" : obj[k]]));

function EventForm({ initial, role, onDone, onError, onPublished }) {
  const isLive = initial.status === "published";
  const waiting = useDraft("event", initial.id);
  const [ev, setEv] = useState(() => {
    const d = initial.id && draftFor("event", initial.id);
    return d ? { ...initial, ...d.data } : initial;
  });
  const [problem, setProblem] = useState("");
  const touched = useRef(false);
  const set = key => e => { touched.current = true; setEv(v => ({ ...v, [key]: e.target.value })); };
  // Draft changes that arrive after the form opened are filled in.
  const waitingAt = waiting && waiting.updatedAt;
  useEffect(() => { if (waiting && isLive && !touched.current) setEv(v => ({ ...v, ...waiting.data })); }, [waitingAt]); // eslint-disable-line react-hooks/exhaustive-deps

  function save(publish) {
    if (!ev.title.trim()) { setProblem("Give the event a title."); return; }
    if (publish && !ev.date) { setProblem("Set a date before publishing."); return; }
    const status = publish ? "published" : (ev.status === "published" ? "published" : "draft");
    const result = saveEvent({ ...ev, title: ev.title.trim(), status: ev.id ? ev.status : "draft" });
    if (!result.ok) { onError(result.error); return; }
    if (status === "published" && ev.status !== "published") {
      setEventStatus(result.id, "published");
      onPublished({ title: ev.title.trim(), text: [formatDate(ev.date), ev.time, ev.location].filter(Boolean).join(" · "), path: "/shop/events" });
    }
    onDone();
  }

  function saveAsDraft() {
    if (!ev.title.trim()) { setProblem("Give the event a title."); return; }
    saveDraftChanges("event", ev.id, fieldsOf({ ...ev, title: ev.title.trim() }, EVENT_FIELDS), ev.title.trim());
    onDone();
  }
  function publishChanges() {
    if (!ev.title.trim()) { setProblem("Give the event a title."); return; }
    if (!ev.date) { setProblem("A published event needs a date."); return; }
    const result = saveEvent({ ...ev, title: ev.title.trim() });
    if (!result.ok) { onError(result.error); return; }
    if (waiting) discardDraftChanges("event", ev.id, ev.title, { quiet: true });
    onDone();
  }

  return (
    <div className="cadmin-card">
      <h3>{ev.id ? "Edit event" : "New event"}{isLive && " (published)"}</h3>
      <DraftNote draft={waiting} />
      {isLive && !waiting && <p className="cadmin-hint">This event is live. Change it and press {can(role, "publish") ? "“Publish changes” to update the site, or “Save as draft changes” to keep the changes aside for now" : "“Save as draft changes”: an Editor or Owner then publishes them"}.</p>}
      <div className="cadmin-grid2">
        <div className="cadmin-field wide"><label htmlFor="ev-title">Title</label><input id="ev-title" value={ev.title} onChange={set("title")} /></div>
        <div className="cadmin-field"><label htmlFor="ev-date">Date</label><input id="ev-date" type="date" value={ev.date} onChange={set("date")} /></div>
        <div className="cadmin-field"><label htmlFor="ev-time">Start time (optional)</label><input id="ev-time" type="time" value={ev.time} onChange={set("time")} /></div>
        <div className="cadmin-field wide"><label htmlFor="ev-place">Place</label><input id="ev-place" value={ev.location} onChange={set("location")} placeholder="Venue and city, or Online" /></div>
        <div className="cadmin-field wide"><label htmlFor="ev-desc">Description</label><textarea id="ev-desc" rows="4" value={ev.description} onChange={set("description")} /></div>
        <div className="cadmin-field wide"><label htmlFor="ev-book">Booking link (optional)</label><input id="ev-book" type="url" value={ev.bookingUrl} onChange={set("bookingUrl")} placeholder="https://…" /></div>
        <div className="cadmin-field wide"><label>Image (optional)</label><ImageField value={ev.image} folder="events" shapes={[SHAPES.event]} onChange={image => { touched.current = true; setEv(v => ({ ...v, image })); }} onError={onError} /></div>
      </div>
      {problem && <p className="cadmin-problem" role="alert">{problem}</p>}
      {ev.date && ev.date < todayISO() && <p className="cadmin-hint">This date has passed, so the event will not show on the site.</p>}
      {isLive ? (
        <div className="cadmin-row">
          {can(role, "publish") && <button type="button" className="cadmin-btn go" onClick={publishChanges}>Publish changes</button>}
          <button type="button" className="cadmin-btn solid" onClick={saveAsDraft}>Save as draft changes</button>
          {waiting && <DeleteButton label="Discard draft changes" question="Throw away the draft changes?" confirmLabel="Yes, discard" onDelete={() => { discardDraftChanges("event", ev.id, ev.title); onDone(); }} />}
          <button type="button" className="cadmin-btn" onClick={onDone}>Cancel</button>
        </div>
      ) : (
        <div className="cadmin-row">
          <button type="button" className="cadmin-btn solid" onClick={() => save(false)}>Save draft</button>
          {can(role, "publish") && <button type="button" className="cadmin-btn go" onClick={() => save(true)}>Publish</button>}
          <button type="button" className="cadmin-btn" onClick={onDone}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function EventsAdmin({ role, onError }) {
  const { events, drafts } = useContent();
  const [editing, setEditing] = useState(null); // an event, NEW_EVENT, or null
  const [shared, setShared] = useState(null);
  const today = todayISO();
  const sorted = [...events].sort((a, b) => (b.date || "9999").localeCompare(a.date || "9999"));

  return (
    <section>
      <div className="cadmin-section-head">
        <h2>Events</h2>
        {!editing && <button type="button" className="cadmin-btn solid" onClick={() => { setShared(null); setEditing(NEW_EVENT); }}>New event</button>}
      </div>
      <p className="cadmin-hint">Published events with a date from today onwards appear as tiles on the <Link to="/shop/events">Events page</Link>, soonest first. Past events drop off by themselves.</p>

      {shared && <SharePanel {...shared} onClose={() => setShared(null)} />}
      {editing && <EventForm key={editing.id || "new"} initial={editing} role={role} onError={onError} onDone={() => setEditing(null)} onPublished={setShared} />}

      {!editing && (
        <div className="cadmin-list">
          {sorted.length === 0 && <p className="cadmin-empty">No events yet.</p>}
          {sorted.map(ev => {
            return (
              <div className="cadmin-item" key={ev.id}>
                <div className="cadmin-item-main">
                  <p className="cadmin-item-title">{ev.title || "(untitled)"} <StatusBadge status={ev.status} />{drafts["event:" + ev.id] && <WaitingBadge />}{ev.date && ev.date < today && <span className="cadmin-badge past">Past</span>}</p>
                  <p className="cadmin-item-meta">{ev.date ? formatDate(ev.date) : "No date yet"}{ev.time ? " · " + ev.time : ""}{ev.location ? " · " + ev.location : ""}</p>
                </div>
                <div className="cadmin-item-actions">
                  <button type="button" className="cadmin-btn" onClick={() => { setShared(null); setEditing(ev); }}>{ev.status === "published" && !can(role, "publish") ? "Suggest changes" : "Edit"}</button>
                  {can(role, "publish") && (ev.status === "published"
                    ? <button type="button" className="cadmin-btn" onClick={() => setEventStatus(ev.id, "draft")}>Unpublish</button>
                    : <button type="button" className="cadmin-btn go" disabled={!ev.date} title={ev.date ? "" : "Set a date first"} onClick={() => { setEventStatus(ev.id, "published"); setShared({ title: ev.title, text: [formatDate(ev.date), ev.time, ev.location].filter(Boolean).join(" · "), path: "/shop/events" }); }}>Publish</button>)}
                  {can(role, "delete") && <DeleteButton onDelete={() => deleteEvent(ev.id)} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── Articles ────────────────────────────────────────────────────────── */

const NEW_ARTICLE = { title: "", summary: "", author: "", cover: "", body: "", status: "draft" };

// The words that differ between Articles (Media) and the Blog.
const WORDS = {
  media: { heading: "Articles", add: "New article", all: "← All articles", none: "No articles yet.", needTitle: "Give the article a title before publishing." },
  blog:  { heading: "Blog",     add: "New post",    all: "← All posts",    none: "No blog posts yet.", needTitle: "Give the post a title before publishing." },
};

const ARTICLE_FIELDS = ["section", "title", "summary", "author", "cover", "body"];

function ArticleEditor({ initial, role, onBack, onError, onPublished }) {
  const section = sectionOf(initial);
  const words = WORDS[section];
  const waiting = useDraft("article", initial.id);
  const store = useContent();
  const [a, setA] = useState(() => {
    const d = initial.id && initial.status === "published" && draftFor("article", initial.id);
    return d ? { ...initial, ...d.data } : initial;
  });
  const [saveState, setSaveState] = useState(initial.id ? "saved" : "new"); // new | unsaved | saving | saved
  const [preview, setPreview] = useState(false);
  const [problem, setProblem] = useState("");
  const latest = useRef(a); latest.current = a;
  const isLive = a.status === "published";
  const mayPublish = can(role, "publish");
  // Draft changes that arrive after the editor opened are filled in.
  const waitingAt = waiting && waiting.updatedAt;
  const [bodyKey, setBodyKey] = useState(0);
  useEffect(() => {
    if (!waiting || !isLive || saveState === "unsaved") return;
    if (waiting.data.body !== latest.current.body) setBodyKey(k => k + 1);
    setA(v => ({ ...v, ...waiting.data }));
  }, [waitingAt]); // eslint-disable-line react-hooks/exhaustive-deps

  function change(patch) { setA(v => ({ ...v, ...patch })); setSaveState("unsaved"); }

  function persist(quiet) {
    const current = latest.current;
    if (!current.title.trim() && !current.body) return null;
    const result = saveArticle({ ...current, title: current.title.trim() || "Untitled" }, { quiet });
    if (!result.ok) { onError(result.error); setSaveState("unsaved"); return null; }
    if (!current.id) setA(v => ({ ...v, id: result.id }));
    setA(v => ({ ...v, slug: result.slug }));
    setSaveState("saved");
    return result;
  }

  // Drafts save by themselves shortly after you stop typing. A published
  // article only changes on the site when "Save changes" is pressed.
  useEffect(() => {
    if (saveState !== "unsaved" || isLive) return;
    const timer = setTimeout(() => { setSaveState("saving"); persist(true); }, 1200);
    return () => clearTimeout(timer);
  }, [a, saveState, isLive]); // eslint-disable-line react-hooks/exhaustive-deps

  function publish() {
    if (!a.title.trim()) { setProblem(words.needTitle); return; }
    setProblem("");
    const result = persist(false); if (!result) return;
    setArticleStatus(result.id, "published");
    setA(v => ({ ...v, id: result.id, slug: result.slug, status: "published", publishedAt: v.publishedAt || new Date().toISOString() }));
    onPublished({ title: a.title.trim(), text: excerpt({ ...a, summary: a.summary }), path: WRITING[section].path + "/" + result.slug });
  }
  function unpublish() { setArticleStatus(a.id, "draft"); setA(v => ({ ...v, status: "draft" })); }

  // Live items: changes can be kept aside as draft changes, or published.
  function saveAsDraft() {
    const current = latest.current;
    saveDraftChanges("article", current.id, fieldsOf({ ...current, title: current.title.trim() || "Untitled" }, ARTICLE_FIELDS), current.title.trim() || "Untitled");
    setSaveState("drafted");
  }
  function publishChanges() {
    if (!a.title.trim()) { setProblem(words.needTitle); return; }
    setProblem("");
    const result = persist(false); if (!result) return;
    if (waiting) discardDraftChanges("article", a.id, a.title, { quiet: true });
    setSaveState("saved");
  }
  function discard() {
    discardDraftChanges("article", a.id, a.title);
    const live = store.articles.find(x => x.id === a.id);
    if (live) setA(live);
    setSaveState("saved");
  }

  const saveLabel = isLive
    ? { unsaved: "Changes not saved", drafted: "Draft changes saved", saved: waiting ? "Draft changes saved" : "Same as the live version", saving: "Saving…", new: "" }[saveState]
    : { new: "Not saved yet", unsaved: "Saving soon…", saving: "Saving…", saved: "Draft saved" }[saveState];

  return (
    <div className="cadmin-editor">
      <div className="cadmin-editor-bar">
        <button type="button" className="cadmin-btn" onClick={() => { if (saveState === "unsaved") { if (isLive) saveAsDraft(); else persist(true); } onBack(); }}>{words.all}</button>
        <StatusBadge status={a.status} />{waiting && <WaitingBadge />}
        <span className="cadmin-save-state" aria-live="polite">{saveLabel}</span>
        <span className="cadmin-spacer" />
        <button type="button" className="cadmin-btn" onClick={() => setPreview(p => !p)}>{preview ? "Back to editing" : "Preview"}</button>
        {isLive && <button type="button" className="cadmin-btn solid" disabled={saveState !== "unsaved"} onClick={saveAsDraft}>Save as draft changes</button>}
        {isLive && mayPublish && <button type="button" className="cadmin-btn go" disabled={saveState !== "unsaved" && !waiting} onClick={publishChanges}>Publish changes</button>}
        {isLive && waiting && <DeleteButton label="Discard draft changes" question="Throw away the draft changes?" confirmLabel="Yes, discard" onDelete={discard} />}
        {mayPublish && (isLive
          ? <button type="button" className="cadmin-btn" onClick={unpublish}>Unpublish</button>
          : <button type="button" className="cadmin-btn go" onClick={publish}>Publish</button>)}
        {a.id && can(role, "delete") && <DeleteButton onDelete={() => { deleteArticle(a.id); onBack(); }} />}
      </div>
      {problem && <p className="cadmin-problem" role="alert">{problem}</p>}
      {isLive && a.slug && <p className="cadmin-hint">Live at <Link to={articlePath(a)}>{pageUrl(articlePath(a))}</Link></p>}
      {isLive && <DraftNote draft={waiting} />}
      {!mayPublish && <p className="cadmin-hint">{isLive ? "This is live. Writers can suggest changes with “Save as draft changes”; an Editor or Owner publishes them." : "Writers can save drafts. An Editor or Owner publishes them."}</p>}
      {isLive && mayPublish && !waiting && <p className="cadmin-hint">This is live. “Publish changes” updates the site; “Save as draft changes” keeps your changes aside until you are ready.</p>}

      {preview ? (
        <div className="cadmin-preview"><ArticleView article={a} share={false} /></div>
      ) : (
        <div className="cadmin-writing">
          <label className="visually-hidden" htmlFor="ar-title">Title</label>
          <textarea id="ar-title" className="cadmin-title-input" rows="1" placeholder="Title" value={a.title}
            onChange={e => change({ title: e.target.value.replace(/\n/g, " ") })}
            onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }} />
          <div className="cadmin-grid2">
            <div className="cadmin-field wide"><label htmlFor="ar-summary">Short summary for the tile (optional; the opening lines are used if empty)</label><textarea id="ar-summary" rows="2" value={a.summary} onChange={e => change({ summary: e.target.value })} /></div>
            <div className="cadmin-field"><label htmlFor="ar-author">Author (optional)</label><input id="ar-author" value={a.author} onChange={e => change({ author: e.target.value })} /></div>
            <div className="cadmin-field"><label>Cover image</label><ImageField value={a.cover} label="Cover image" folder="articles" shapes={[SHAPES.tile]} hint="Framing sets the tile. The open article shows the whole picture. Best at least 1200 pixels wide." onChange={cover => change({ cover })} onError={onError} /></div>
          </div>
          <Suspense fallback={<p className="cadmin-hint">Loading the editor…</p>}>
            <RichEditor key={bodyKey} value={a.body} onChange={body => change({ body })} onError={onError} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

// section is "media" (Admin → Articles) or "blog" (Admin → Blog).
function ArticlesAdmin({ role, onError, section = "media" }) {
  const words = WORDS[section];
  const place = WRITING[section];
  const { drafts } = useContent();
  const articles = useContent().articles.filter(a => sectionOf(a) === section);
  const [editing, setEditing] = useState(null);
  const [shared, setShared] = useState(null);
  const sorted = [...articles].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  if (editing) {
    return (
      <section>
        {shared && <SharePanel {...shared} onClose={() => setShared(null)} />}
        <ArticleEditor key={editing.id || "new"} initial={editing} role={role} onError={onError} onBack={() => { setEditing(null); setShared(null); }} onPublished={setShared} />
      </section>
    );
  }
  return (
    <section>
      <div className="cadmin-section-head">
        <h2>{words.heading}</h2>
        <button type="button" className="cadmin-btn solid" onClick={() => setEditing({ ...NEW_ARTICLE, section })}>{words.add}</button>
      </div>
      <p className="cadmin-hint">Published {place.many} appear as tiles on the <Link to={place.path}>{place.name} page</Link>, newest first. Drafts are only visible here.</p>
      <div className="cadmin-list">
        {sorted.length === 0 && <p className="cadmin-empty">{words.none}</p>}
        {sorted.map(ar => {
          return (
            <div className="cadmin-item" key={ar.id}>
              <div className="cadmin-item-main">
                <p className="cadmin-item-title">{ar.title || "(untitled)"} <StatusBadge status={ar.status} />{drafts["article:" + ar.id] && <WaitingBadge />}</p>
                <p className="cadmin-item-meta">{ar.status === "published" ? "Published " + formatDate(ar.publishedAt, false) : "Draft"}{ar.author ? " · " + ar.author : ""}</p>
              </div>
              <div className="cadmin-item-actions">
                <button type="button" className="cadmin-btn" onClick={() => setEditing(ar)}>{ar.status === "published" && !can(role, "publish") ? "Suggest changes" : "Edit"}</button>
                {ar.status === "published" && <Link className="cadmin-btn" to={articlePath(ar)}>View</Link>}
                {can(role, "publish") && ar.status === "published" && <button type="button" className="cadmin-btn" onClick={() => setArticleStatus(ar.id, "draft")}>Unpublish</button>}
                {can(role, "delete") && <DeleteButton onDelete={() => deleteArticle(ar.id)} />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Pages (tiles and wording) ───────────────────────────────────────── */

function FormField({ field, value, onChange, onError, id, imageKey }) {
  if (field.type === "text") return <input id={id} value={value || ""} onChange={e => onChange(e.target.value)} />;
  if (field.type === "long") return <textarea id={id} rows="3" value={value || ""} onChange={e => onChange(e.target.value)} />;
  if (field.type === "switch") return (
    <label className="cadmin-switch"><input id={id} type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} /> <span>{value ? "On" : "Off"}</span></label>
  );
  if (field.type === "image") {
    const key = imageKey || "";
    const shapes = IMAGE_SHAPES[key] || IMAGE_SHAPES[key.replace(/\.\d+$/, "")] || [SHAPES.wide];
    return <ImageField value={value || ""} onChange={onChange} onError={onError} shapes={shapes} fallback={BUILTIN_IMAGES[key] || ""} />;
  }
  if (field.type === "lines") {
    const list = value || [];
    const update = (i, v) => onChange(list.map((x, j) => j === i ? v : x));
    return (
      <div className="cadmin-lines">
        {list.map((line, i) => (
          <div className="cadmin-line" key={i}>
            <input value={line} onChange={e => update(i, e.target.value)} aria-label={"Item " + (i + 1)} />
            <button type="button" className="cadmin-btn" disabled={i === 0} onClick={() => onChange(swap(list, i, i - 1))} aria-label="Move up">↑</button>
            <button type="button" className="cadmin-btn" disabled={i === list.length - 1} onClick={() => onChange(swap(list, i, i + 1))} aria-label="Move down">↓</button>
            <button type="button" className="cadmin-btn danger" onClick={() => onChange(list.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" className="cadmin-btn" onClick={() => onChange([...list, ""])}>Add an item</button>
      </div>
    );
  }
  if (field.type === "items") {
    const list = value || [];
    const update = (i, key, v) => onChange(list.map((x, j) => j === i ? { ...x, [key]: v } : x));
    const blank = Object.fromEntries(field.fields.map(f => [f.key, f.type === "switch" ? false : ""]));
    return (
      <div className="cadmin-items">
        {list.map((item, i) => (
          <div className="cadmin-subcard" key={i}>
            <div className="cadmin-subcard-head">
              <strong>{item.title || item.name || (field.itemName + " " + (i + 1))}</strong>
              {!field.fixed && (
                <span>
                  <button type="button" className="cadmin-btn" disabled={i === 0} onClick={() => onChange(swap(list, i, i - 1))} aria-label="Move up">↑</button>
                  <button type="button" className="cadmin-btn" disabled={i === list.length - 1} onClick={() => onChange(swap(list, i, i + 1))} aria-label="Move down">↓</button>
                  <button type="button" className="cadmin-btn danger" onClick={() => onChange(list.filter((_, j) => j !== i))}>Remove</button>
                </span>
              )}
            </div>
            {field.fields.map(f => (
              <div className="cadmin-field" key={f.key}>
                <label htmlFor={id + "-" + i + "-" + f.key}>{f.label}</label>
                <FormField field={f} id={id + "-" + i + "-" + f.key} value={item[f.key]} onChange={v => update(i, f.key, v)} onError={onError} imageKey={imageKey && f.type === "image" ? imageKey + "." + i : undefined} />
              </div>
            ))}
          </div>
        ))}
        {!field.fixed && <button type="button" className="cadmin-btn" onClick={() => onChange([...list, blank])}>Add a {field.itemName}</button>}
      </div>
    );
  }
  return null;
}
function swap(list, i, j) { const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; return next; }

function PageEditor({ pageKey, onError }) {
  const form = PAGE_FORMS[pageKey];
  const navigate = useNavigate();
  const { pages } = useContent();
  const waiting = useDraft("page", pageKey);
  const saved = { ...DEFAULT_PAGES[pageKey], ...(pages[pageKey] || {}) };
  const [draft, setDraft] = useState(() => {
    const d = draftFor("page", pageKey);
    return d ? { ...saved, ...d.data } : saved;
  });
  const [state, setState] = useState("clean"); // clean | dirty | saved | drafted
  // Draft changes that arrive after the form opened are filled in.
  const waitingAt = waiting && waiting.updatedAt;
  useEffect(() => { if (waiting && state !== "dirty") setDraft(d => ({ ...d, ...waiting.data })); }, [waitingAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const edited = !!pages[pageKey];

  function save() {
    const result = savePage(pageKey, draft, form.name);
    if (!result.ok) { onError(result.error); return; }
    if (waiting) discardDraftChanges("page", pageKey, form.name, { quiet: true });
    setState("saved");
  }
  function saveAsDraft() { saveDraftChanges("page", pageKey, draft, form.name); setState("drafted"); }
  function discard() { discardDraftChanges("page", pageKey, form.name); setDraft(saved); setState("clean"); }
  function previewOnPage() {
    if (state === "dirty") saveDraftChanges("page", pageKey, draft, form.name);
    setShowDraftChanges(true);
    navigate(form.address);
  }
  function reset() { resetPage(pageKey, form.name); setDraft({ ...DEFAULT_PAGES[pageKey] }); setState("clean"); }

  return (
    <div>
      <div className="cadmin-editor-bar sticky">
        <span className="cadmin-save-state" aria-live="polite">{state === "dirty" ? "Changes not saved" : state === "saved" ? "Published. The page now shows this." : state === "drafted" || waiting ? "Draft changes saved. The page still shows the published wording." : edited ? "Edited from the original wording" : "Original wording"}</span>
        {waiting && <WaitingBadge />}
        <span className="cadmin-spacer" />
        <Link className="cadmin-btn" to={form.address}>View page</Link>
        {(waiting || state === "dirty") && <button type="button" className="cadmin-btn" onClick={previewOnPage}>Preview on the page</button>}
        {edited && !waiting && <DeleteButton label="Reset to original" question="Go back to the original wording?" confirmLabel="Yes, reset" onDelete={reset} />}
        {waiting && <DeleteButton label="Discard draft changes" question="Throw away the draft changes?" confirmLabel="Yes, discard" onDelete={discard} />}
        <button type="button" className="cadmin-btn" disabled={state !== "dirty"} onClick={saveAsDraft}>Save as draft changes</button>
        <button type="button" className="cadmin-btn solid" disabled={state !== "dirty" && !waiting} onClick={save}>Publish changes</button>
      </div>
      <DraftNote draft={waiting} />
      {form.note && <p className="cadmin-hint">{form.note}</p>}
      {form.sections.map(section => (
        <div className="cadmin-card" key={section.title}>
          <h3>{section.title}</h3>
          {section.fields.map(f => (
            <div className="cadmin-field" key={f.key}>
              <label htmlFor={"pg-" + f.key}>{f.label}</label>
              <FormField field={f} id={"pg-" + f.key} value={draft[f.key]} onError={onError} imageKey={pageKey + "." + f.key}
                onChange={v => { setDraft(d => ({ ...d, [f.key]: v })); setState("dirty"); }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PagesAdmin({ onError }) {
  // ibvu.org/admin/pages?page=home opens that page's form.
  const [params, setParams] = useSearchParams();
  const asked = params.get("page");
  const pageKey = PAGE_FORMS[asked] ? asked : Object.keys(PAGE_FORMS)[0];
  const setPageKey = key => setParams({ page: key }, { replace: true });
  const { drafts } = useContent();
  return (
    <section>
      <div className="cadmin-section-head"><h2>Pages</h2></div>
      <p className="cadmin-hint">Change the words, images, links and “Coming soon” labels on any page. The layout stays as designed, and “Reset to original” brings back the built-in wording. “Save as draft changes” keeps changes aside without changing the page (pages with draft changes have a • by their name); “Publish changes” puts them live.</p>
      <div className="cadmin-subtabs" role="tablist">
        {Object.entries(PAGE_FORMS).map(([key, f]) => (
          <button type="button" role="tab" aria-selected={pageKey === key} className={pageKey === key ? "on" : ""} onClick={() => setPageKey(key)} key={key}>{f.name}{drafts["page:" + key] ? " •" : ""}</button>
        ))}
      </div>
      <PageEditor key={pageKey} pageKey={pageKey} onError={onError} />
    </section>
  );
}

/* ── People ──────────────────────────────────────────────────────────── */

function PeopleAdmin({ onError }) {
  const { people } = useContent();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("writer");
  const [herbReview, setHerbReview] = useState(false);
  const [problem, setProblem] = useState("");
  const owners = people.filter(p => p.role === "owner").length;

  function add(e) {
    e.preventDefault();
    if (!isEmail(email)) { setProblem("Enter the person's email address."); return; }
    if (people.some(p => p.email === email.trim().toLowerCase())) { setProblem("That person is already on the list."); return; }
    setProblem("");
    const result = savePerson({ email, role, herbReview: role === "owner" || herbReview });
    if (!result.ok) { onError(result.error); return; }
    setEmail(""); setHerbReview(false);
  }

  return (
    <section>
      <div className="cadmin-section-head"><h2>People</h2></div>
      <div className="cadmin-roles">
        {Object.entries(ROLES).map(([key, r]) => <p key={key}><strong>{r.name}</strong> {r.can}.</p>)}
        <p><strong>Herb review</strong> A separate tick for each person: review herb submissions and herb photos. Owners always have it.</p>
      </div>
      <div className="cadmin-list">
        {people.map(p => {
          const lastOwner = p.role === "owner" && owners === 1;
          return (
            <div className="cadmin-item" key={p.id}>
              <div className="cadmin-item-main"><p className="cadmin-item-title">{p.email}</p></div>
              <div className="cadmin-item-actions">
                <label className="visually-hidden" htmlFor={"role-" + p.id}>Role for {p.email}</label>
                <select id={"role-" + p.id} value={p.role} disabled={lastOwner} onChange={e => savePerson({ ...p, role: e.target.value })}>
                  {Object.entries(ROLES).map(([key, r]) => <option value={key} key={key}>{r.name}</option>)}
                </select>
                <label className="cadmin-switch small">
                  <input type="checkbox" checked={p.role === "owner" || !!p.herbReview} disabled={p.role === "owner"}
                    onChange={e => savePerson({ ...p, herbReview: e.target.checked })} />
                  Herb review
                </label>
                {lastOwner ? <span className="cadmin-hint">The only Owner cannot be removed.</span> : <DeleteButton label="Remove" question="Remove this person's access?" confirmLabel="Yes, remove" onDelete={() => removePerson(p.id)} />}
              </div>
            </div>
          );
        })}
      </div>
      <form className="cadmin-card" onSubmit={add} noValidate>
        <h3>Add a person</h3>
        <div className="cadmin-grid2">
          <div className="cadmin-field"><label htmlFor="pe-email">Email</label><input id="pe-email" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="cadmin-field"><label htmlFor="pe-role">Role</label>
            <select id="pe-role" value={role} onChange={e => setRole(e.target.value)}>
              {Object.entries(ROLES).map(([key, r]) => <option value={key} key={key}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="cadmin-field">
          <label className="cadmin-switch">
            <input type="checkbox" checked={role === "owner" || herbReview} disabled={role === "owner"} onChange={e => setHerbReview(e.target.checked)} />
            Can also review herb submissions and herb photos
          </label>
        </div>
        {problem && <p className="cadmin-problem" role="alert">{problem}</p>}
        <button type="submit" className="cadmin-btn solid">Add person</button>
      </form>
      {PREVIEW_MODE && (DEMO_SIGN_IN
        ? <p className="cadmin-hint">In this preview, anyone on this list can sign in with any 6-digit code and gets the role shown here. On the real site they will receive their code by email.</p>
        : <p className="cadmin-hint">For now this list is saved in this browser only and does not yet decide who can sign in.</p>)}
      {!PREVIEW_MODE && <p className="cadmin-hint">People on this list sign in at ibvu.org/admin with a code sent to their email address. Removing someone takes away their access straight away.</p>}
    </section>
  );
}

/* ── History ─────────────────────────────────────────────────────────── */

/* ── Messages (contact form) ─────────────────────────────────────────── */

function whenText(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return formatDate(iso.slice(0, 10), false) + ", " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function MessagesAdmin() {
  const { messages } = useContent();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const typeLabel = id => (ENQUIRY_TYPES.find(t => t.id === id) || {}).label || id || "No type";
  const shown = messages.filter(m => !q || [m.name, m.email, m.organisation, m.message, typeLabel(m.type)].join(" ").toLowerCase().includes(q));
  return (
    <section>
      <div className="cadmin-section-head"><h2>Messages</h2></div>
      <p className="cadmin-hint">What people sent through the contact form, newest first. Each message was also emailed to hello@ibvu.org. Press the email address to reply.</p>
      {messages.length > 0 && (
        <div className="cadmin-filter">
          <label className="visually-hidden" htmlFor="ms-search">Search messages</label>
          <input id="ms-search" type="text" placeholder="Search messages…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      )}
      {messages.length === 0 && <p className="cadmin-empty">No messages yet.</p>}
      {messages.length > 0 && shown.length === 0 && <p className="cadmin-empty">No messages match.</p>}
      <div className="cadmin-list">
        {shown.map(m => (
          <article className="cadmin-item tall cadmin-message" key={m.id}>
            <div className="cadmin-item-main">
              <p className="cadmin-item-title">{m.name}{m.organisation ? ", " + m.organisation : ""}</p>
              <p className="cadmin-item-meta">
                <a href={"mailto:" + m.email}>{m.email}</a> · {typeLabel(m.type)} · {whenText(m.createdAt)}
                {m.wantsUpdates && <> · <span className="cadmin-badge live">Asked for updates</span></>}
              </p>
              <p className="cadmin-message-text">{m.message}</p>
            </div>
            <div className="cadmin-item-actions">
              <a className="cadmin-btn" href={"mailto:" + m.email + "?subject=" + encodeURIComponent("Re: your message to IBVU")}>Reply</a>
              <DeleteButton question="Delete this message?" onDelete={() => deleteMessage(m.id)} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── Mailing lists ───────────────────────────────────────────────────── */

function statusOf(s) {
  if (s.lists.length) return "confirmed";
  if (s.pendingLists.length) return "waiting";
  return "left";
}

function csvCell(v) { const t = String(v == null ? "" : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }

function downloadList(rows, listKey) {
  const head = ["email", "first_name", "last_name", "lists", "joined", "confirmed", "signed_up_from", "unsubscribe_link"];
  const lines = [head.join(",")].concat(rows.map(s => [
    s.email, s.firstName, s.lastName, s.lists.map(listName).join("; "),
    (s.createdAt || "").slice(0, 10), (s.confirmedAt || "").slice(0, 10), s.source,
    s.unsubscribeToken ? pageUrl("/unsubscribe?t=" + s.unsubscribeToken) : "",
  ].map(csvCell).join(",")));
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ibvu-" + (listKey || "all-lists") + "-" + todayISO() + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function ListsAdmin() {
  const { signups, newsletters, newsletterSends } = useContent();
  const received = email => {
    const ids = new Set(newsletterSends.filter(x => x.email === email && x.status === "sent").map(x => x.issueId));
    return newsletters.filter(n => ids.has(n.id));
  };
  const [list, setList] = useState("");          // "" = all lists
  const [status, setStatus] = useState("confirmed"); // confirmed | waiting | left | all
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const onList = (s, key) => !key || s.lists.includes(key) || s.pendingLists.includes(key);
  const shown = signups.filter(s =>
    onList(s, list) &&
    (status === "all" || statusOf(s) === status) &&
    (!q || [s.email, s.firstName, s.lastName].join(" ").toLowerCase().includes(q)));
  const ready = signups.filter(s => list ? s.lists.includes(list) : s.lists.length > 0);

  return (
    <section>
      <div className="cadmin-section-head"><h2>Mailing lists</h2></div>
      <p className="cadmin-hint">People join from the newsletter box at the bottom of every page, or by ticking “send me occasional updates” on the contact form. They are only on a list once they have pressed Confirm in the email we send. Shopify keeps its own, separate list of buyers.</p>

      <div className="cadmin-list-cards">
        {MAILING_LISTS.map(l => {
          const confirmed = signups.filter(s => s.lists.includes(l.key)).length;
          const waiting = signups.filter(s => s.pendingLists.includes(l.key)).length;
          return (
            <button type="button" className={"cadmin-list-card" + (list === l.key ? " on" : "")} key={l.key} onClick={() => setList(list === l.key ? "" : l.key)} aria-pressed={list === l.key}>
              <strong>{l.name}</strong>
              <span className="cadmin-list-count">{confirmed}</span>
              <span className="cadmin-list-sub">{waiting ? waiting + " waiting to confirm" : l.about}</span>
            </button>
          );
        })}
      </div>

      <div className="cadmin-filter">
        <label className="visually-hidden" htmlFor="ls-list">List</label>
        <select id="ls-list" value={list} onChange={e => setList(e.target.value)}>
          <option value="">All lists</option>
          {MAILING_LISTS.map(l => <option value={l.key} key={l.key}>{l.name}</option>)}
        </select>
        <label className="visually-hidden" htmlFor="ls-status">Show</label>
        <select id="ls-status" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="confirmed">Confirmed</option>
          <option value="waiting">Waiting to confirm</option>
          <option value="left">Unsubscribed</option>
          <option value="all">Everyone</option>
        </select>
        <label className="visually-hidden" htmlFor="ls-search">Search</label>
        <input id="ls-search" type="text" placeholder="Search names and emails…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="cadmin-row">
        <button type="button" className="cadmin-btn solid" disabled={!ready.length} onClick={() => downloadList(ready, list)}>
          Download {list ? listName(list) : "all lists"} as spreadsheet ({ready.length})
        </button>
      </div>
      <p className="cadmin-hint">The spreadsheet has the confirmed people only. Its last column is each person's own unsubscribe link: put it in every email you send them.</p>

      {shown.length === 0 && <p className="cadmin-empty">{signups.length ? "Nobody matches." : "Nobody has signed up yet."}</p>}
      <div className="cadmin-list">
        {shown.map(s => (
          <div className="cadmin-item" key={s.id}>
            <div className="cadmin-item-main">
              <p className="cadmin-item-title">{s.email}</p>
              <p className="cadmin-item-meta">
                {[s.firstName, s.lastName].filter(Boolean).join(" ") || "No name"} · joined {formatDate((s.createdAt || "").slice(0, 10), false)}{s.source ? " from the " + s.source : ""}
              </p>
              <p className="cadmin-item-meta">
                {s.lists.map(k => <span className="cadmin-badge live" key={k}>{listName(k)}</span>)}
                {s.pendingLists.map(k => <span className="cadmin-badge draft" key={k}>{listName(k)}: waiting to confirm</span>)}
                {statusOf(s) === "left" && <span className="cadmin-badge draft">Unsubscribed</span>}
              </p>
              {(() => { const got = received(s.email); return got.length > 0 && (
                <details className="cadmin-received"><summary>Newsletters received: {got.length}</summary>
                  <ul>{got.map(n => <li key={n.id}>{n.title} <span className="cadmin-item-meta">({formatDate((n.sentAt || "").slice(0, 10), false)})</span></li>)}</ul>
                </details>); })()}
            </div>
            <div className="cadmin-item-actions">
              <DeleteButton label="Remove" question="Remove this person from all lists for good?" confirmLabel="Yes, remove" onDelete={() => removeSignup(s.id)} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryAdmin() {
  const { history } = useContent();
  return (
    <section>
      <div className="cadmin-section-head"><h2>History</h2></div>
      {history.length === 0 && <p className="cadmin-empty">Nothing has been changed yet.</p>}
      <ul className="cadmin-history">
        {history.map(h => {
          const d = new Date(h.at);
          const when = formatDate(h.at.slice(0, 10), false) + ", " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
          return <li key={h.id}><span className="cadmin-history-when">{when}</span> <strong>{h.who}</strong> {h.action} {h.kind === "person" ? "" : h.kind + " "}“{h.title}”</li>;
        })}
      </ul>
    </section>
  );
}

/* ── Herb photos ─────────────────────────────────────────────────────── */

// The same list of herbs the Herbarium shows.
function useHerbList() {
  const [approved, setApproved] = useState([]);
  const [statics, setStatics] = useState(HERBS_FALLBACK);
  useEffect(() => {
    sbFetchApproved().then(setApproved);
    sbFetchStaticHerbs().then(rows => { if (rows.length > 0) setStatics(rows); });
  }, []);
  return mergeHerbs(statics, approved)
    .slice().sort((a, b) => a.name.localeCompare(b.name));
}

function HerbPhotoRow({ herb, photo, onError }) {
  const ref = useRef(null);
  const [framing, setFraming] = useState(false);
  const [saving, setSaving] = useState(false);
  const parsed = photo ? parseImage(photo.image) : null;
  async function saveFrame({ frame, rotatedFile }) {
    setSaving(true);
    try {
      const src = rotatedFile ? await uploadSiteImage(rotatedFile, { maxSide: 1200, quality: 0.8, folder: "herbs" }) : parsed.src;
      const result = setHerbPhoto(herb.name, buildImage(src, frame));
      if (!result.ok) onError(result.error); else setFraming(false);
    } catch (err) { onError(err.message); }
    setSaving(false);
  }
  async function pick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = setHerbPhoto(herb.name, await uploadSiteImage(file, { maxSide: 1200, quality: 0.8, folder: "herbs" }));
      if (!result.ok) onError(result.error); else setFraming(true);
    } catch (err) { onError(err.message); }
  }
  return (
    <div className="cadmin-item">
      <div className="cadmin-thumb">{photo ? <FramePreview src={parsed.src} frame={parsed.frame} ratio={SHAPES.herb.ratio} /> : <span>No photo</span>}</div>
      <div className="cadmin-item-main">
        <p className="cadmin-item-title">{herb.name}</p>
        {herb.latinName && <p className="cadmin-item-meta"><em>{herb.latinName}</em></p>}
        {herb.duplicate && <p className="cadmin-item-meta">Published more than once. Unpublish the extra copy in Herb review; both copies share this photo.</p>}
      </div>
      <div className="cadmin-item-actions">
        <Link className="cadmin-btn" to={"/educate/hs/" + herb.slug}>View page</Link>
        <button type="button" className="cadmin-btn" onClick={() => ref.current.click()}>{photo ? "Change photo" : "Add photo"}</button>
        {photo && <button type="button" className="cadmin-btn" onClick={() => setFraming(true)}>Frame photo</button>}
        {photo && <DeleteButton label="Remove" question="Remove this photo?" confirmLabel="Yes, remove" onDelete={() => removeHerbPhoto(herb.name)} />}
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} aria-label={"Photo for " + herb.name} />
      </div>
      {framing && photo && (
        <FrameEditor src={parsed.src} frame={parsed.frame} shapes={[SHAPES.herb]} busy={saving} title={"Frame the photo of " + herb.name}
          onCancel={() => setFraming(false)} onSave={saveFrame} />
      )}
    </div>
  );
}

function HerbPhotosAdmin({ onError }) {
  const { herbPhotos, pendingHerbPhotos } = useContent();
  const herbs = useHerbList();
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState("all"); // all | with | without
  const pending = Object.entries(pendingHerbPhotos);
  const published = new Set(herbs.map(h => herbKey(h.name)));
  const q = query.trim().toLowerCase();
  const shown = herbs.filter(h => {
    const has = !!herbPhotos[herbKey(h.name)];
    if (only === "with" && !has) return false;
    if (only === "without" && has) return false;
    return !q || h.name.toLowerCase().includes(q) || (h.latinName || "").toLowerCase().includes(q);
  });
  const withPhoto = herbs.filter(h => herbPhotos[herbKey(h.name)]).length;

  return (
    <section>
      <div className="cadmin-section-head"><h2>Herb photos</h2></div>
      <p className="cadmin-hint">Every photo is shown on the herb's page with the line “Image for educational purposes only.” Only publish a photo that IBVU took, or that the person who sent it confirmed is their own.</p>

      <h3 className="cadmin-h3">Waiting for review {pending.length > 0 && <span className="cadmin-count">{pending.length}</span>}</h3>
      {pending.length === 0 && <p className="cadmin-empty">No photos are waiting. Photos sent in with a herb submission appear here.</p>}
      <div className="cadmin-list">
        {pending.map(([key, p]) => (
          <div className="cadmin-item tall" key={key}>
            <div className="cadmin-thumb large"><img src={p.image} alt={"Photo sent in for " + p.name} /></div>
            <div className="cadmin-item-main">
              <p className="cadmin-item-title">{p.name}</p>
              <p className="cadmin-item-meta">Sent {formatDate(p.at.slice(0, 10), false)} · The sender ticked “This is my own photo and I give IBVU permission to publish it.”</p>
              {!published.has(p.herbKey || key) && <p className="cadmin-item-meta">This herb is not published yet. If you approve the photo it will show as soon as a herb with this name is published.</p>}
            </div>
            <div className="cadmin-item-actions">
              <button type="button" className="cadmin-btn solid" onClick={() => { const r = approveHerbPhoto(key); if (!r.ok && r.error) onError(r.error); }}>Approve</button>
              <DeleteButton label="Reject" question="Reject and delete this photo?" confirmLabel="Yes, reject" onDelete={() => rejectHerbPhoto(key)} />
            </div>
          </div>
        ))}
      </div>

      <h3 className="cadmin-h3">Published herbs <span className="cadmin-count plain">{withPhoto} of {herbs.length} have a photo</span></h3>
      <div className="cadmin-filter">
        <label className="visually-hidden" htmlFor="hp-search">Find a herb</label>
        <input id="hp-search" type="text" placeholder="Find a herb…" value={query} onChange={e => setQuery(e.target.value)} />
        <label className="visually-hidden" htmlFor="hp-only">Show</label>
        <select id="hp-only" value={only} onChange={e => setOnly(e.target.value)}>
          <option value="all">All herbs</option>
          <option value="with">With a photo</option>
          <option value="without">Without a photo</option>
        </select>
      </div>
      {shown.length === 0 && <p className="cadmin-empty">No herbs match.</p>}
      <div className="cadmin-list">
        {shown.map(h => <HerbPhotoRow herb={h} photo={herbPhotos[herbKey(h.name)]} onError={onError} key={h.slug} />)}
      </div>
    </section>
  );
}

/* ── Herb review (the existing submission review screens) ────────────── */

function HerbReviewSection({ session }) {
  const navigate = useNavigate();
  return (
    <div className="cadmin-herbreview">
      {!SUPABASE_READY && (
        <p className="cadmin-note">Herb review works on the live database. This preview is not connected to it, so the list below only shows herbs submitted in this browser, and publishing from here will not work. Photos sent in with herbs are reviewed under <Link to="/admin/herbphotos">Herb photos</Link>.</p>
      )}
      <Suspense fallback={<div className="admin-login-wrap" />}>
        <AdminPanel onBack={() => navigate("/admin")} adminLabel={ROLES[session.role].name} />
      </Suspense>
    </div>
  );
}

/* ── Shell ───────────────────────────────────────────────────────────── */

// Every admin section: its address (ibvu.org/admin/<id>), and who may use it.
const SECTIONS = [
  { id: "herbreview", label: "Herb review", about: "Review herb submissions, publish and edit herbs, export the list.", allowed: s => canReviewHerbs(s) },
  { id: "herbphotos", label: "Herb photos", about: "Approve photos sent in with herbs, and add photos to published herbs.", allowed: s => canReviewHerbs(s) },
  { id: "events",     label: "Events",      about: "Add, edit, publish and remove events.", allowed: s => can(s.role, "draft") },
  { id: "articles",   label: "Articles",    about: "Write drafts, preview and publish to Media.", allowed: s => can(s.role, "draft") },
  { id: "blog",       label: "Blog",        about: "Write drafts, preview and publish to the Blog.", allowed: s => can(s.role, "draft") },
  { id: "pages",      label: "Pages",       about: "Edit the tiles and wording on Regulate, Shop and Innovate.", allowed: s => can(s.role, "pages") },
  { id: "people",     label: "People",      about: "Who has access, with which role, and who reviews herbs.", allowed: s => can(s.role, "people") },
  { id: "history",    label: "History",     about: "Who changed what, and when.", allowed: s => can(s.role, "history") },
  { id: "messages",   label: "Messages",    about: "What people sent through the contact form.", allowed: s => can(s.role, "messages") },
  { id: "newsletters", label: "Newsletters", about: "Write newsletters, preview and test them; Owners send or schedule them.", allowed: s => can(s.role, "newsletters") },
  { id: "lists",      label: "Mailing lists", about: "Who is on which list; download a list as a spreadsheet.", allowed: s => can(s.role, "lists") },
];

function AdminHome({ sections, session, waiting }) {
  return (
    <>
      <h1 className="cadmin-h1">Admin</h1>
      <p className="cadmin-hint">Signed in as {session.email} ({ROLES[session.role].name}{canReviewHerbs(session) && session.role !== "owner" ? ", with herb review" : ""}). These are the sections you can use.</p>
      <div className="cadmin-home">
        {sections.map(s => (
          <Link className="cadmin-home-card" to={"/admin/" + s.id} key={s.id}>
            <h2>{s.label} {s.id === "herbphotos" && waiting > 0 && <span className="cadmin-count">{waiting} waiting</span>}</h2>
            <p>{s.about}</p>
            <span className="cadmin-home-address">ibvu.org/admin/{s.id}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function AdminArea() {
  const { section } = useParams();
  const navigate = useNavigate();
  const { pendingHerbPhotos, syncError } = useContent();
  const session = useSession(); // null until the person has signed in
  const status = useSessionStatus();
  const signedInEmail = useSignedInEmail();
  const [error, setError] = useState("");
  const current = SECTIONS.find(s => s.id === section);
  usePageTitle(!session ? "Sign in · Admin" : current ? current.label + " · Admin" : "Admin");
  useEffect(() => { setError(""); }, [section]);

  // Nothing in admin is shown before sign-in, whichever address was opened.
  if (status === "loading") {
    return <div className="admin-login-wrap"><div className="admin-login-box"><h1>IBVU Admin</h1><p>Checking your sign-in…</p></div></div>;
  }
  if (status === "noaccess") {
    return (
      <div className="admin-login-wrap"><div className="admin-login-box">
        <h1>IBVU Admin</h1>
        <p className="signin-sent">{signedInEmail ? signedInEmail + " is" : "This address is"} not on the People list, so it has no access to admin. Ask an Owner to add you.</p>
        {syncError && <div className="error-msg" role="alert">{syncError}</div>}
        <button type="button" className="admin-login-btn" onClick={() => { clearSyncError(); signOut(); navigate("/admin"); }}>Sign out</button>
        <Link className="admin-back-link signin-site" to="/">← Back to the site</Link>
      </div></div>
    );
  }
  if (!session) return <AdminSignIn />;

  const role = session.role;
  const allowed = SECTIONS.filter(s => s.allowed(session));
  const permitted = current && current.allowed(session);
  const waiting = Object.keys(pendingHerbPhotos).length;

  return (
    <div className="admin-area">
      <nav className="admin-switch" aria-label="Admin sections">
        <Link className="admin-switch-brand" to="/admin">IBVU admin</Link>
        {allowed.map(s => (
          <NavLink className={({ isActive }) => isActive ? "current" : ""} to={"/admin/" + s.id} key={s.id}>
            {s.label}{s.id === "herbphotos" && waiting > 0 ? " (" + waiting + ")" : ""}
          </NavLink>
        ))}
        <Link className="admin-switch-site" to="/">View site →</Link>
        <button type="button" className="admin-switch-out" onClick={() => { signOut(); navigate("/admin"); }}>Sign out</button>
      </nav>

      {PREVIEW_MODE && (
        <div className="cadmin-shell cadmin-top">
        <div className="cadmin-preview-bar">
          <p><strong>Preview.</strong> Changes are saved in this browser only. Nothing here reaches the live site or other people.</p>
          <div className="cadmin-preview-controls">
            <DeleteButton label="Start the preview again" question="Clear everything tried in this preview?" confirmLabel="Yes, start again" onDelete={() => { resetPreview(); navigate("/admin"); }} />
          </div>
        </div>
        </div>
      )}

      {syncError && (
        <div className="cadmin-shell cadmin-top cadmin-sync-wrap">
          <p className="cadmin-sync-error" role="alert">{syncError} <button type="button" className="cadmin-btn" onClick={clearSyncError}>Dismiss</button></p>
        </div>
      )}

      {/* Herb review keeps its own look, so it sits outside the content-admin styles. */}
      {section === "herbreview" && permitted ? <HerbReviewSection session={session} /> : (
        <div className="cadmin-shell"><div className="cadmin-wrap">
          {error && <p className="cadmin-problem" role="alert">{error} <button type="button" className="cadmin-btn" onClick={() => setError("")}>Dismiss</button></p>}

          {!section && <AdminHome sections={allowed} session={session} waiting={waiting} />}
          {section && !current && (
            <div className="cadmin-card">
              <h2>There is no admin section at this address</h2>
              <p><Link className="cadmin-btn" to="/admin">Go to the admin front page</Link></p>
            </div>
          )}
          {current && !permitted && (
            <div className="cadmin-card">
              <h2>{current.label} is not part of your access</h2>
              <p>{current.id === "herbreview" || current.id === "herbphotos"
                ? "This section needs the herb review tick. An Owner can switch it on for you under People."
                : "Your role (" + ROLES[role].name + ") does not include this section. An Owner can change your role under People."}</p>
              <p><Link className="cadmin-btn" to="/admin">Go to the admin front page</Link></p>
            </div>
          )}
          {permitted && section === "herbphotos" && <HerbPhotosAdmin onError={setError} />}
          {permitted && section === "events" && <EventsAdmin role={role} onError={setError} />}
          {permitted && section === "articles" && <ArticlesAdmin key="media" section="media" role={role} onError={setError} />}
          {permitted && section === "blog" && <ArticlesAdmin key="blog" section="blog" role={role} onError={setError} />}
          {permitted && section === "pages" && <PagesAdmin onError={setError} />}
          {permitted && section === "people" && <PeopleAdmin onError={setError} />}
          {permitted && section === "history" && <HistoryAdmin />}
          {permitted && section === "messages" && <MessagesAdmin />}
          {permitted && section === "lists" && <ListsAdmin />}
          {permitted && section === "newsletters" && <Suspense fallback={<p className="cadmin-hint">Loading…</p>}><NewslettersAdmin role={role} onError={setError} /></Suspense>}
        </div></div>
      )}
    </div>
  );
}
