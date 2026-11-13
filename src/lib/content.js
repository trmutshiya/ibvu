// IBVU v6.03 — what changed in this file since v6.02:
// - Newsletters: issues (newsletters), the record of who received each one
//   (newsletterSends), how many confirmed people are on each list
//   (listCounts), and saveIssue, deleteIssue, scheduleIssue, unscheduleIssue,
//   sendIssueNow, sendTestIssue, setIssueVisible, copyIssueToBlog.
// - Admin reminder emails: reminderRecipients, reminderSettings and the
//   functions to change them (Owners only).
// - Draft changes to live content: drafts (one per article, event or page),
//   saveDraftChanges, discardDraftChanges and publishDraftChanges. The live
//   version stays as it is until the changes are published. Signed-in staff
//   can switch on "Show draft changes" to see draft page wording on the site.
// - Preview (no database): all of the above works in this browser; sending a
//   newsletter only records who would have received it.
//
// IBVU v6.02 — what changed in this file since v6.0:
// - Mailing lists and contact messages for Owners: loaded in admin
//   (signups, messages), with removeSignup and deleteMessage. In preview they
//   are kept in this browser so the screens and the confirm / unsubscribe
//   pages can be tried (previewSignUp, previewConfirm, previewUnsubscribe…).
// - New permissions "lists" and "messages": Owners only.
//
// IBVU v6.0 — what changed in this file since v5.92:
// - CONNECTED TO THE DATABASE. When the site has its database settings (on
//   Vercel, and on a computer with the .env file), everything admin changes
//   is saved in Supabase and seen by every visitor: events, articles and blog
//   posts, page wording, people, history and herb photos. The screens did not
//   need to change; the saving happens here and in src/lib/remote.js.
// - Admin sign-in is real: an emailed code, and the person's role comes from
//   the People list in the database. Someone who signs in but is not on the
//   People list gets no access.
// - Pictures chosen in admin are uploaded to the database's picture store
//   (uploadSiteImage) instead of being kept inside the page.
// - If saving fails (for example the connection drops), admin shows a message
//   and reloads the last saved version, so nothing looks saved when it isn't.
// - Visitors see the page wording from their last visit straight away while
//   the latest is fetched, so edited wording does not flicker.
// - PREVIEW MODE is unchanged and is used automatically when there are no
//   database settings: the double-click preview file and the automatic tests.
//   Everything then stays in the browser, as before.
//
// (v5.6 to v5.92: see the earlier version folders for their notes.)
import { useSyncExternalStore } from 'react';
import { DEFAULT_PAGES } from '../content/defaults.js';
import { slugify } from './slug.js';
import { SUPABASE_READY } from './supabase.js';
import * as remote from './remote.js';

// True when there are no database settings: everything stays in this browser.
export const PREVIEW_MODE = !SUPABASE_READY;
const CONNECTED = !PREVIEW_MODE;

const KEY = "ibvu_content_preview_v1";       // preview: all content, in this browser
const CACHE_KEY = "ibvu_content_cache_v1";   // connected: published content from the last visit

const SEED = {
  // Who is signed in to admin on this browser. Nobody, until they sign in.
  session: { signedIn: false, email: "", role: "owner", herbReview: false, demo: false, expiresAt: 0 },
  events: [
    { id: "ev-example", title: "Example event (draft)", date: "", time: "", location: "", description: "This is an example. Edit it, publish it or delete it.", image: "", bookingUrl: "", status: "draft", updatedAt: null },
  ],
  articles: [
    { id: "ar-example", section: "media", title: "Example article (draft)", slug: "example-article", summary: "", cover: "", author: "", body: "<p>This is an example. Edit it, publish it or delete it.</p>", status: "draft", publishedAt: null, updatedAt: null },
    { id: "bl-example", section: "blog", title: "Example blog post (draft)", slug: "example-blog-post", summary: "", cover: "", author: "", body: "<p>This is an example. Edit it, publish it or delete it.</p>", status: "draft", publishedAt: null, updatedAt: null },
  ],
  pages: {},
  herbPhotos: {},        // approved: { "herb-name": { image, name } }
  pendingHerbPhotos: {}, // sent in with a submission, waiting for review
  people: [
    { id: "pe-1", email: "hello@ibvu.org", role: "owner", herbReview: true },
  ],
  history: [],
  signups: [],   // mailing lists (Owners only)
  newsletters: [],       // newsletter issues
  newsletterSends: [],   // who received each sent issue (Owners only)
  listCounts: null,      // connected: confirmed people per list (Owners and Editors)
  drafts: {},            // "article:<id>", "event:<id>", "page:<key>" → { data, savedBy, updatedAt }
  reminderRecipients: [],
  reminderSettings: { dueEnabled: true, dueDay: 25, dueList: "monthly", beforeEnabled: true, beforeHours: 24, afterEnabled: true },
  showDraftChanges: false,
  messages: [],  // contact form messages (Owners only)
  loaded: true,
  syncError: "",
};

// Connected: start empty (plus whatever was published at the last visit).
function connectedStart() {
  const empty = {
    session: { status: remote.hasStoredSignIn() ? "loading" : "out" },
    events: [], articles: [], pages: {}, herbPhotos: {}, pendingHerbPhotos: {},
    people: [], history: [], signups: [], messages: [], loaded: false, syncError: "",
    newsletters: [], newsletterSends: [], listCounts: null, drafts: {}, reminderRecipients: [],
    reminderSettings: { ...SEED.reminderSettings }, showDraftChanges: false,
  };
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
    if (cached) return { ...empty, pages: cached.pages || {}, events: cached.events || [], articles: cached.articles || [], herbPhotos: cached.herbPhotos || {}, newsletters: cached.newsletters || [] };
  } catch { /* no cache: start empty */ }
  return empty;
}

let memory = null; // used if the browser will not let us store anything
function load() {
  if (CONNECTED) return connectedStart();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) { const saved = JSON.parse(raw); return { ...SEED, ...saved, loaded: true, syncError: "", showDraftChanges: false, session: { ...SEED.session, ...(saved.session || {}) } }; }
  } catch { /* fall through to the starting content */ }
  return memory || SEED;
}

let state = load();
const listeners = new Set();

function commit(next) {
  if (CONNECTED) {
    state = next;
    listeners.forEach(l => l());
    return { ok: true };
  }
  const previous = state;
  state = next;
  memory = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    // Usually: too many large images for this browser's preview storage.
    state = previous; memory = previous;
    return { ok: false, error: "This browser has run out of preview storage. Remove an image or two and try again." };
  }
  listeners.forEach(l => l());
  return { ok: true };
}

function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function getState() { return state; }

/* ── reading ─────────────────────────────────────────────────────────── */

export function useContent() { return useSyncExternalStore(subscribe, getState); }

// A page's editable content: what was saved in admin, or the built-in wording.
// With "Show draft changes" switched on (signed-in staff only), draft wording is shown instead.
export function usePage(key) {
  const s = useContent();
  const draft = s.showDraftChanges && readSession(s) && s.drafts["page:" + key];
  return { ...DEFAULT_PAGES[key], ...(s.pages[key] || {}), ...(draft ? draft.data : {}) };
}

export function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Published events from today onwards, soonest first.
export function useUpcomingEvents() {
  const s = useContent();
  const today = todayISO();
  return s.events
    .filter(e => e.status === "published" && e.date && e.date >= today)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
}

// The two places writing is published. Articles go to Media, posts go to the Blog.
export const WRITING = {
  media: { key: "media", name: "Media", adminName: "Articles", one: "article",   many: "articles",   path: "/media" },
  blog:  { key: "blog",  name: "Blog",  adminName: "Blog",     one: "blog post", many: "blog posts", path: "/educate/blog" },
  newsletter: { key: "newsletter", name: "Newsletter", adminName: "Newsletters", one: "newsletter", many: "newsletters", path: "/newsletter" },
};
// Writing saved before v5.8 has no section and counts as Media.
export function sectionOf(article) { return article && (article.section === "blog" || article.section === "newsletter") ? article.section : "media"; }
export function articlePath(article) { return WRITING[sectionOf(article)].path + "/" + article.slug; }

// Published articles (or blog posts), newest first.
export function usePublishedArticles(section = "media") {
  const s = useContent();
  return s.articles
    .filter(a => a.status === "published" && sectionOf(a) === section)
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
}

/* ── roles ───────────────────────────────────────────────────────────── */

export const ROLES = {
  owner:  { name: "Owner",  can: "Everything, including people, contact messages and mailing lists" },
  editor: { name: "Editor", can: "Write, edit, publish, unpublish and delete content, and edit page tiles" },
  writer: { name: "Writer", can: "Write and edit drafts, but not publish" },
};

export function can(role, action) {
  if (role === "owner") return true;
  if (role === "editor") return !["people", "messages", "lists", "send", "reminders"].includes(action);
  // writer
  return action === "draft";
}

// Herb review (and herb photos) is a separate permission. Owners always have it.
export function canReviewHerbs(session) { return !!session && (session.role === "owner" || !!session.herbReview); }

/* ── admin sign-in ───────────────────────────────────────────────────── */

export const SIGN_IN_DAYS = 7; // how long a browser stays signed in

// Preview only: the person on the People list with this email address, if any.
export function findPerson(email) {
  const wanted = (email || "").trim().toLowerCase();
  return state.people.find(p => p.email === wanted) || null;
}

// Preview only: called once the demonstration code has been accepted.
export function signIn(email, { role = "owner", herbReview = false, demo = false } = {}) {
  return commit({ ...state, session: {
    signedIn: true, email: (email || "").trim().toLowerCase(), role, herbReview, demo,
    expiresAt: Date.now() + SIGN_IN_DAYS * 24 * 60 * 60 * 1000,
  } });
}

export function signOut() {
  if (CONNECTED) {
    remote.getClient().then(c => c.auth.signOut()).catch(() => {});
    forgetStaffData({ status: "out" });
    refreshPublic();
    return { ok: true };
  }
  return commit({ ...state, session: { ...SEED.session } });
}

// Who is signed in: { email, role, herbReview }, or null when nobody is.
function readSession(s) {
  const se = s.session;
  if (CONNECTED) {
    if (!se || se.status !== "in") return null;
    return { email: se.email, role: se.role, herbReview: se.role === "owner" || !!se.herbReview };
  }
  if (!se || !se.signedIn || !se.expiresAt || se.expiresAt < Date.now()) return null;
  if (se.demo) {
    // Preview: follow the People list, so a changed role or a removed person takes effect at once.
    const person = s.people.find(p => p.email === se.email);
    if (!person) return null;
    return { email: se.email, role: person.role, herbReview: person.role === "owner" || !!person.herbReview };
  }
  return { email: se.email, role: se.role, herbReview: se.role === "owner" || !!se.herbReview };
}
export function useSession() { return readSession(useContent()); }

// "loading" (checking a saved sign-in), "out", "in", or "noaccess" (signed in
// but not on the People list).
export function useSessionStatus() {
  const s = useContent();
  if (CONNECTED) return (s.session && s.session.status) || "out";
  return readSession(s) ? "in" : "out";
}
export function useSignedInEmail() { const s = useContent(); return (s.session && s.session.email) || ""; }

/* ── connected: loading from the database and keeping in step ─────────── */

function setSession(session) { commit({ ...state, session }); }

// Forget drafts, people, history and waiting photos (on sign-out).
function forgetStaffData(session) {
  commit({
    ...state, session,
    events: state.events.filter(e => e.status === "published"),
    articles: state.articles.filter(a => a.status === "published"),
    people: [], history: [], pendingHerbPhotos: {}, signups: [], messages: [],
    newsletters: state.newsletters.filter(n => n.status === "sent" && n.showOnSite),
    newsletterSends: [], listCounts: null, drafts: {}, reminderRecipients: [], showDraftChanges: false,
  });
}

let publicLoad = null;
function refreshPublic() {
  if (!CONNECTED) return Promise.resolve();
  if (publicLoad) return publicLoad;
  publicLoad = remote.loadPublic()
    .then(data => {
      try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* fine without */ }
      // Someone signed in already has everything (including drafts): keep that.
      if (state.session.status === "in") { commit({ ...state, loaded: true }); return; }
      commit({ ...state, ...data, loaded: true });
    })
    .catch(err => { console.warn("Could not load the latest content", err); commit({ ...state, loaded: true }); })
    .finally(() => { publicLoad = null; });
  return publicLoad;
}

// Reload everything a signed-in person may see.
let staffLoad = null;
export function reloadStaff() {
  if (!CONNECTED) return Promise.resolve();
  const session = readSession(state);
  if (!session) return Promise.resolve();
  if (staffLoad) return staffLoad;
  staffLoad = remote.getClient()
    .then(client => remote.loadForStaff(client, session))
    .then(data => {
      // A role changed on the People list (perhaps one's own) applies straight away.
      const me = data.people.find(p => p.email === state.session.email);
      const sessionNow = me ? { ...state.session, role: me.role, herbReview: me.herbReview } : state.session;
      commit({ ...state, ...data, session: sessionNow, loaded: true });
    })
    .catch(err => { console.error(err); setSyncError("Could not load the latest content from the database. Check your connection and reload the page."); })
    .finally(() => { staffLoad = null; });
  return staffLoad;
}

let authStarted = false;
// Listens for sign-in and sign-out (also across browser tabs).
export async function startAuth() {
  if (!CONNECTED || authStarted) return;
  authStarted = true;
  const client = await remote.getClient();
  client.auth.onAuthStateChange((event, session) => {
    // Run outside the sign-in library's own callback, as its makers advise.
    setTimeout(() => handleAuth(client, event, session), 0);
  });
}

async function handleAuth(client, event, session) {
  if (!session || !session.user) {
    if (state.session.status !== "out") { forgetStaffData({ status: "out" }); refreshPublic(); }
    return;
  }
  const email = (session.user.email || "").toLowerCase();
  // Signed in more than 7 days ago: sign in again.
  const signedAt = Date.parse(session.user.last_sign_in_at || "");
  if (signedAt && Date.now() - signedAt > SIGN_IN_DAYS * 24 * 60 * 60 * 1000) { signOut(); return; }
  // A routine refresh of the same sign-in: nothing to do.
  if (state.session.status === "in" && state.session.email === email) return;
  try {
    const me = await remote.lookUpMyself(client, email);
    if (!me) { setSession({ status: "noaccess", email }); return; }
    setSession({ status: "in", email, role: me.role, herbReview: me.herbReview });
    await reloadStaff();
  } catch (err) {
    console.error(err);
    setSession({ status: "noaccess", email });
    setSyncError("Could not check your access. Check your connection and try again.");
  }
}

// Shown while the sign-in is being checked, after the code was accepted.
export function markSigningIn() { if (CONNECTED && state.session.status !== "in") setSession({ status: "loading" }); }

if (CONNECTED && typeof window !== "undefined") {
  refreshPublic();
  if (remote.hasStoredSignIn()) startAuth();
}

/* ── connected: saving to the database ─────────────────────────────── */

export function setSyncError(message) { commit({ ...state, syncError: message }); }
export function clearSyncError() { commit({ ...state, syncError: "" }); }

// Saves happen one after another, in the order they were made.
let queue = Promise.resolve();
function save(what, work) {
  if (!CONNECTED) return;
  queue = queue
    .then(() => remote.getClient())
    .then(async client => {
      const result = await work(client);
      if (result && result.error) throw result.error;
    })
    .catch(err => {
      console.error("Save failed:", what, err);
      setSyncError("Could not save " + what + ". The last saved version has been reloaded. (" + ((err && err.message) || "unknown error") + ")");
      reloadStaff();
    });
}

/* ── writing ─────────────────────────────────────────────────────────── */

function uid(prefix) { return CONNECTED ? remote.newId() : prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function now() { return new Date().toISOString(); }

// History records the role, not the email address.
function whoLabel() { const session = readSession(state); return session ? ROLES[session.role].name : "Admin"; }

function withHistory(next, action, kind, title) {
  const entry = { id: uid("h"), at: now(), who: whoLabel(), action, kind, title: title || "(untitled)" };
  save("the history entry", c => c.from("site_history").insert(entry));
  return { ...next, history: [entry, ...next.history].slice(0, 300) };
}

// (the rule itself lives in src/lib/slug.js)
export { slugify };

function uniqueSlug(title, id) {
  const base = slugify(title);
  let slug = base, n = 2;
  while (state.articles.some(a => a.slug === slug && a.id !== id)) slug = base + "-" + n++;
  return slug;
}

// Events
export function saveEvent(event, { quiet = false } = {}) {
  const isNew = !event.id;
  const record = { ...event, id: event.id || uid("ev"), status: event.status || "draft", updatedAt: now() };
  const events = isNew ? [record, ...state.events] : state.events.map(e => e.id === record.id ? record : e);
  const next = quiet ? { ...state, events } : withHistory({ ...state, events }, isNew ? "created" : "edited", "event", record.title);
  const result = commit(next);
  save("the event", c => c.from("site_events").upsert(remote.toEvent(record)));
  return { ...result, id: record.id };
}
export function setEventStatus(id, status) {
  const ev = state.events.find(e => e.id === id); if (!ev) return { ok: false };
  const events = state.events.map(e => e.id === id ? { ...e, status, updatedAt: now() } : e);
  const result = commit(withHistory({ ...state, events }, status === "published" ? "published" : "unpublished", "event", ev.title));
  save("the event", c => c.from("site_events").update({ status, updated_at: now() }).eq("id", id));
  return result;
}
export function deleteEvent(id) {
  const ev = state.events.find(e => e.id === id); if (!ev) return { ok: false };
  const result = commit(withHistory({ ...state, events: state.events.filter(e => e.id !== id) }, "deleted", "event", ev.title));
  save("the deletion", c => c.from("site_events").delete().eq("id", id));
  return result;
}

// Articles
export function saveArticle(article, { quiet = false } = {}) {
  const isNew = !article.id;
  const id = article.id || uid("ar");
  const existing = state.articles.find(a => a.id === id);
  // The address is set from the title and then kept once the article has been published.
  const slug = existing && existing.publishedAt ? existing.slug : uniqueSlug(article.title, id);
  const record = { status: "draft", publishedAt: null, ...existing, ...article, id, slug, updatedAt: now() };
  record.section = sectionOf(record);
  const kind = WRITING[record.section].one;
  const articles = isNew ? [record, ...state.articles] : state.articles.map(a => a.id === id ? record : a);
  const next = quiet ? { ...state, articles } : withHistory({ ...state, articles }, isNew ? "created" : "edited", kind, record.title);
  const result = commit(next);
  save("the " + kind, c => c.from("site_articles").upsert(remote.toArticle(record)));
  return { ...result, id, slug };
}
export function setArticleStatus(id, status) {
  const ar = state.articles.find(a => a.id === id); if (!ar) return { ok: false };
  const publishedAt = status === "published" ? (ar.publishedAt || now()) : ar.publishedAt;
  const articles = state.articles.map(a => a.id === id ? { ...a, status, publishedAt, updatedAt: now() } : a);
  const result = commit(withHistory({ ...state, articles }, status === "published" ? "published" : "unpublished", WRITING[sectionOf(ar)].one, ar.title));
  save("the " + WRITING[sectionOf(ar)].one, c => c.from("site_articles").update({ status, published_at: publishedAt || null, updated_at: now() }).eq("id", id));
  return result;
}
export function deleteArticle(id) {
  const ar = state.articles.find(a => a.id === id); if (!ar) return { ok: false };
  const result = commit(withHistory({ ...state, articles: state.articles.filter(a => a.id !== id) }, "deleted", WRITING[sectionOf(ar)].one, ar.title));
  save("the deletion", c => c.from("site_articles").delete().eq("id", id));
  return result;
}

// Page tiles
export function savePage(key, data, name) {
  const result = commit(withHistory({ ...state, pages: { ...state.pages, [key]: data } }, "edited", "page", name));
  save("the page", c => c.from("site_pages").upsert({ key, data, updated_at: now() }));
  return result;
}
export function resetPage(key, name) {
  const pages = { ...state.pages }; delete pages[key];
  const result = commit(withHistory({ ...state, pages }, "reset to the original wording", "page", name));
  save("the page", c => c.from("site_pages").delete().eq("key", key));
  return result;
}

// People
export function savePerson(person) {
  const isNew = !person.id;
  const record = { herbReview: false, ...person, id: person.id || uid("pe"), email: person.email.trim().toLowerCase() };
  const people = isNew ? [...state.people, record] : state.people.map(p => p.id === record.id ? record : p);
  const result = commit(withHistory({ ...state, people }, isNew ? "added" : "changed the access of", "person", record.email + " (" + ROLES[record.role].name + (record.herbReview || record.role === "owner" ? ", herb review" : "") + ")"));
  if (isNew) {
    // A new person also has to be able to receive sign-in codes, which only the server can arrange.
    save("the new person", async c => {
      const r = await c.functions.invoke("admin-add-person", { body: { email: record.email, role: record.role, herbReview: record.role === "owner" || !!record.herbReview } });
      if (r.error) {
        let message = r.error.message;
        try { const body = await r.error.context.json(); if (body && body.error) message = body.error; } catch { /* keep the general message */ }
        throw new Error(message);
      }
      reloadStaff();
    });
  } else {
    save("the change of access", c => c.from("site_people").update({ role: record.role, herb_review: record.role === "owner" || !!record.herbReview }).eq("id", record.id));
  }
  return result;
}
// Mailing lists and contact messages (Owners only). The history never shows
// the person's email address.
/* ── newsletters ─────────────────────────────────────────────────────── */

// Issues that were sent and are shown on the website, newest first.
export function usePublishedIssues() {
  const s = useContent();
  return s.newsletters.filter(n => n.status === "sent" && n.showOnSite).sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || ""));
}
// What a newsletter page looks like to the shared article layout.
export function issueAsArticle(n) {
  return { ...n, section: "newsletter", summary: n.previewText, author: "", publishedAt: n.sentAt, status: n.status === "sent" ? "published" : "draft" };
}

// Confirmed people per list. Preview: counted here; connected: from the database.
export function useListCounts() {
  const s = useContent();
  if (CONNECTED) return s.listCounts || {};
  const counts = {};
  s.signups.forEach(x => { if (!x.unsubscribedAt) x.lists.forEach(k => { counts[k] = (counts[k] || 0) + 1; }); });
  return counts;
}
// How many different people a send to these lists reaches (preview only; the
// server counts for real when sending).
export function recipientsFor(lists) {
  return state.signups.filter(x => !x.unsubscribedAt && x.lists.some(k => lists.includes(k)));
}

function uniqueIssueSlug(title, id) {
  const base = slugify(title);
  const taken = slug => slug === "confirm" || state.newsletters.some(n => n.slug === slug && n.id !== id);
  let slug = base, n = 2;
  while (taken(slug)) slug = base + "-" + n++;
  return slug;
}

export function saveIssue(issue, { quiet = false } = {}) {
  const isNew = !issue.id;
  const id = issue.id || uid("nl");
  const existing = state.newsletters.find(n => n.id === id);
  if (existing && (existing.status === "sending" || existing.status === "sent")) return { ok: false, error: "A sent newsletter cannot be changed." };
  const record = {
    status: "draft", lists: ["monthly"], showOnSite: true, sendAt: null, sentAt: null, sentBy: "", recipients: 0, failures: 0, subject: "", previewText: "", cover: "", body: "",
    ...existing, ...issue, id, slug: uniqueIssueSlug(issue.title || (existing && existing.title), id), updatedAt: now(),
  };
  const newsletters = isNew ? [record, ...state.newsletters] : state.newsletters.map(n => n.id === id ? record : n);
  const next = quiet ? { ...state, newsletters } : withHistory({ ...state, newsletters }, isNew ? "created" : "edited", "newsletter", record.title);
  const result = commit(next);
  save("the newsletter", c => c.from("newsletter_issues").upsert(remote.toIssue(record)));
  return { ...result, id, slug: record.slug };
}
export function deleteIssue(id) {
  const n = state.newsletters.find(x => x.id === id); if (!n || n.status !== "draft") return { ok: false };
  const result = commit(withHistory({ ...state, newsletters: state.newsletters.filter(x => x.id !== id) }, "deleted", "newsletter", n.title));
  save("the deletion", c => c.from("newsletter_issues").delete().eq("id", id));
  return result;
}
// Owners: send at a set time (the timer checks every 5 minutes).
export function scheduleIssue(id, sendAt) {
  const n = state.newsletters.find(x => x.id === id); if (!n) return { ok: false };
  const newsletters = state.newsletters.map(x => x.id === id ? { ...x, status: "scheduled", sendAt, updatedAt: now() } : x);
  const result = commit(withHistory({ ...state, newsletters }, "scheduled", "newsletter", n.title + " for " + new Date(sendAt).toLocaleString("en-GB")));
  save("the schedule", c => c.from("newsletter_issues").update({ status: "scheduled", send_at: sendAt, updated_at: now() }).eq("id", id));
  return result;
}
export function unscheduleIssue(id) {
  const n = state.newsletters.find(x => x.id === id); if (!n || n.status !== "scheduled") return { ok: false };
  const newsletters = state.newsletters.map(x => x.id === id ? { ...x, status: "draft", sendAt: null, updatedAt: now() } : x);
  const result = commit(withHistory({ ...state, newsletters }, "cancelled the schedule of", "newsletter", n.title));
  save("the change", c => c.from("newsletter_issues").update({ status: "draft", send_at: null, updated_at: now() }).eq("id", id));
  return result;
}

// Preview: "send" by recording who would have received it.
function previewSend(id, by) {
  const n = state.newsletters.find(x => x.id === id);
  const people = recipientsFor(n.lists);
  const at = now();
  const sends = people.map(p => ({ id: uid("sd"), issueId: id, email: p.email, status: "sent", error: "", sentAt: at }));
  const newsletters = state.newsletters.map(x => x.id === id ? { ...x, status: "sent", sentAt: at, sentBy: by, recipients: sends.length, failures: 0 } : x);
  return commit(withHistory({ ...state, newsletters, newsletterSends: [...sends, ...state.newsletterSends] }, "sent", "newsletter", n.title + " to " + sends.length + (sends.length === 1 ? " person" : " people")));
}
// Preview only: what the 5-minute timer does on the real site.
export function previewRunTimer() {
  if (CONNECTED) return 0;
  const due = state.newsletters.filter(n => n.status === "scheduled" && n.sendAt && n.sendAt <= now());
  due.forEach(n => previewSend(n.id, "Owner (scheduled)"));
  return due.length;
}

// Owners: send now. Returns a promise of { ok, recipients, failures, error }.
export async function sendIssueNow(id) {
  const n = state.newsletters.find(x => x.id === id); if (!n) return { ok: false, error: "Not found." };
  if (!CONNECTED) { previewSend(id, whoLabel()); const done = state.newsletters.find(x => x.id === id); return { ok: true, preview: true, recipients: done.recipients, failures: 0 }; }
  commit({ ...state, newsletters: state.newsletters.map(x => x.id === id ? { ...x, status: "sending" } : x) });
  await queue; // anything still being saved goes first
  const r = await remote.callNewsletter({ action: "send", issueId: id });
  await reloadStaff();
  return r;
}
// Owners and Editors: send this issue to themselves only.
export async function sendTestIssue(id) {
  if (!CONNECTED) return { ok: true, preview: true };
  await queue;
  return remote.callNewsletter({ action: "test", issueId: id });
}
// Owners: show or hide a sent issue on the website.
export function setIssueVisible(id, visible) {
  const n = state.newsletters.find(x => x.id === id); if (!n) return { ok: false };
  const newsletters = state.newsletters.map(x => x.id === id ? { ...x, showOnSite: visible } : x);
  const result = commit(withHistory({ ...state, newsletters }, visible ? "showed on the website" : "hid from the website", "newsletter", n.title));
  save("the change", c => c.rpc("newsletter_set_visible", { issue: id, visible }));
  return result;
}
// Turns an issue into a blog post draft.
export function copyIssueToBlog(id) {
  const n = state.newsletters.find(x => x.id === id); if (!n) return { ok: false };
  return saveArticle({ section: "blog", title: n.title, summary: n.previewText, cover: n.cover, body: n.body, author: "", status: "draft" });
}

/* ── admin reminder emails (Owners) ─────────────────────────────────── */

export function addReminderRecipient(email) {
  const e = (email || "").trim().toLowerCase();
  if (state.reminderRecipients.some(r => r.email === e)) return { ok: false, error: "That address is already on the list." };
  const record = { id: uid("rr"), email: e };
  const result = commit(withHistory({ ...state, reminderRecipients: [...state.reminderRecipients, record] }, "added", "reminder recipient", "one address"));
  save("the reminder address", async c => { const r = await c.from("admin_reminder_recipients").insert({ email: e }); if (r.error) throw r.error; reloadStaff(); });
  return result;
}
export function removeReminderRecipient(id) {
  const result = commit(withHistory({ ...state, reminderRecipients: state.reminderRecipients.filter(r => r.id !== id) }, "removed", "reminder recipient", "one address"));
  save("the removal", c => c.from("admin_reminder_recipients").delete().eq("id", id));
  return result;
}
export function saveReminderSettings(settings) {
  const reminderSettings = { ...state.reminderSettings, ...settings };
  const result = commit(withHistory({ ...state, reminderSettings }, "changed", "reminder settings", "newsletter reminders"));
  save("the reminder settings", c => c.from("newsletter_reminder_settings").update(remote.toReminderSettings(reminderSettings)).eq("id", 1));
  return result;
}

/* ── draft changes to live content ──────────────────────────────────── */

export function draftFor(kind, key) { return state.drafts[kind + ":" + key] || null; }
export function useDraft(kind, key) { const s = useContent(); return s.drafts[kind + ":" + key] || null; }
export function setShowDraftChanges(on) { return commit({ ...state, showDraftChanges: !!on }); }

export function saveDraftChanges(kind, key, data, label) {
  const entry = { data, savedBy: whoLabel(), updatedAt: now() };
  const result = commit(withHistory({ ...state, drafts: { ...state.drafts, [kind + ":" + key]: entry } }, "saved draft changes to", kind === "page" ? "page" : kind === "event" ? "event" : WRITING[sectionOf(data)].one, label));
  save("the draft changes", c => c.from("content_drafts").upsert({ kind, item_key: key, data, saved_by: entry.savedBy, updated_at: entry.updatedAt }, { onConflict: "kind,item_key" }));
  return result;
}
export function discardDraftChanges(kind, key, label, { quiet = false } = {}) {
  const drafts = { ...state.drafts }; delete drafts[kind + ":" + key];
  const next = quiet ? { ...state, drafts } : withHistory({ ...state, drafts }, "discarded the draft changes to", kind, label);
  const result = commit(next);
  save("the change", c => c.from("content_drafts").delete().eq("kind", kind).eq("item_key", key));
  return result;
}
// Editors and Owners: the draft changes become the live version.
export function publishDraftChanges(kind, key, label) {
  const d = draftFor(kind, key); if (!d) return { ok: false };
  let result;
  if (kind === "article") result = saveArticle({ ...d.data, id: key });
  else if (kind === "event") result = saveEvent({ ...d.data, id: key });
  else result = savePage(key, d.data, label);
  if (!result.ok) return result;
  discardDraftChanges(kind, key, label, { quiet: true });
  return { ok: true };
}

export function removeSignup(id) {
  const s = state.signups.find(x => x.id === id); if (!s) return { ok: false };
  const result = commit(withHistory({ ...state, signups: state.signups.filter(x => x.id !== id) }, "removed", "mailing list member", "one person"));
  save("the removal", c => c.from("newsletter_signups").delete().eq("id", id));
  return result;
}
export function deleteMessage(id) {
  const m = state.messages.find(x => x.id === id); if (!m) return { ok: false };
  const result = commit(withHistory({ ...state, messages: state.messages.filter(x => x.id !== id) }, "deleted", "contact message", "one message"));
  save("the deletion", c => c.from("contact_messages").delete().eq("id", id));
  return result;
}

/* ── preview only: sign-ups and messages kept in this browser ─────────── */

function previewToken() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
export function previewSignUp({ email, firstName = "", lastName = "", lists = [], source = "" }) {
  const e = (email || "").trim().toLowerCase();
  const existing = state.signups.find(s => s.email === e);
  if (existing) {
    const add = lists.filter(l => !existing.lists.includes(l));
    const updated = { ...existing, firstName: firstName || existing.firstName, lastName: lastName || existing.lastName, pendingLists: [...new Set([...existing.pendingLists, ...add])], unsubscribedAt: null };
    commit({ ...state, signups: state.signups.map(s => s.id === existing.id ? updated : s) });
    return { confirmToken: updated.confirmToken, needsConfirm: updated.pendingLists.length > 0 };
  }
  const s = { id: uid("su"), email: e, firstName, lastName, lists: [], pendingLists: [...new Set(lists)], source, createdAt: now(), confirmedAt: null, unsubscribedAt: null, confirmToken: previewToken(), unsubscribeToken: previewToken() };
  commit({ ...state, signups: [s, ...state.signups] });
  return { confirmToken: s.confirmToken, needsConfirm: true };
}
export function previewConfirm(token) {
  const s = state.signups.find(x => x.confirmToken === token); if (!s) return { ok: false };
  const lists = [...new Set([...s.lists, ...s.pendingLists])];
  commit({ ...state, signups: state.signups.map(x => x.id === s.id ? { ...x, lists, pendingLists: [], confirmedAt: now(), unsubscribedAt: null } : x) });
  return { ok: true, lists };
}
export function previewUnsubscribeInfo(token) {
  const s = state.signups.find(x => x.unsubscribeToken === token); if (!s) return { ok: false };
  return { ok: true, email: s.email, lists: s.lists };
}
export function previewUnsubscribe(token, keep) {
  const s = state.signups.find(x => x.unsubscribeToken === token); if (!s) return { ok: false };
  const lists = s.lists.filter(l => keep.includes(l));
  commit({ ...state, signups: state.signups.map(x => x.id === s.id ? { ...x, lists, pendingLists: [], unsubscribedAt: lists.length ? null : now() } : x) });
  return { ok: true, lists };
}
export function previewAddMessage(m) {
  commit({ ...state, messages: [{ id: uid("ms"), createdAt: now(), ...m }, ...state.messages] });
}

export function removePerson(id) {
  const p = state.people.find(x => x.id === id); if (!p) return { ok: false };
  const result = commit(withHistory({ ...state, people: state.people.filter(x => x.id !== id) }, "removed", "person", p.email));
  save("the removal", c => c.from("site_people").delete().eq("id", id));
  return result;
}

// Herb photos
export function herbKey(name) { return slugify(name); }

// The approved photo for a herb, or "" if it has none.
export function useHerbPhoto(name) {
  const s = useContent();
  const entry = s.herbPhotos[herbKey(name)];
  return entry ? entry.image : "";
}
// Called by the submission form: the photo waits for review. On the real site
// it is sent with the form's security check (turnstileToken) and kept privately
// until someone with herb review approves it. Returns { ok, error? }.
export function submitHerbPhoto(name, image, turnstileToken) {
  if (CONNECTED) return remote.sendForm("herb-photo", { herbName: name.trim(), image, permission: true }, turnstileToken);
  const key = herbKey(name);
  return commit({ ...state, pendingHerbPhotos: { ...state.pendingHerbPhotos, [key]: { name: name.trim(), image, at: now(), permission: true } } });
}
export function approveHerbPhoto(key) {
  const p = state.pendingHerbPhotos[key]; if (!p) return { ok: false };
  const herb = p.herbKey || key;
  const pending = { ...state.pendingHerbPhotos }; delete pending[key];
  const result = commit(withHistory({ ...state, pendingHerbPhotos: pending, herbPhotos: { ...state.herbPhotos, [herb]: { name: p.name, image: p.image } } }, "approved the submitted photo for", "herb", p.name));
  save("the photo approval", async c => {
    // Move the photo from the private store to the public one, then mark it approved.
    const res = await fetch(p.image);
    if (!res.ok) throw new Error("the waiting photo could not be read");
    const url = await remote.uploadPicture(c, await res.blob(), "herbs");
    const old = await c.from("herb_photos").delete().eq("herb_key", herb).eq("status", "approved");
    if (old.error) throw old.error;
    const done = await c.from("herb_photos").update({ status: "approved", image_path: url, reviewed_at: now() }).eq("id", p.id);
    if (done.error) throw done.error;
    await c.storage.from("herb-photo-submissions").remove([p.path]);
    reloadStaff();
  });
  return result;
}
export function rejectHerbPhoto(key) {
  const p = state.pendingHerbPhotos[key]; if (!p) return { ok: false };
  const pending = { ...state.pendingHerbPhotos }; delete pending[key];
  const result = commit(withHistory({ ...state, pendingHerbPhotos: pending }, "rejected the submitted photo for", "herb", p.name));
  save("the rejection", async c => {
    const r = await c.from("herb_photos").delete().eq("id", p.id);
    if (r.error) throw r.error;
    await c.storage.from("herb-photo-submissions").remove([p.path]);
  });
  return result;
}
export function setHerbPhoto(name, image) {
  const key = herbKey(name);
  const had = !!state.herbPhotos[key];
  const result = commit(withHistory({ ...state, herbPhotos: { ...state.herbPhotos, [key]: { name, image } } }, had ? "changed the photo for" : "added a photo for", "herb", name));
  save("the herb photo", async c => {
    const old = await c.from("herb_photos").delete().eq("herb_key", key).eq("status", "approved");
    if (old.error) throw old.error;
    return c.from("herb_photos").insert({ herb_key: key, herb_name: name, image_path: image, status: "approved", source: "admin", permission: true, reviewed_at: now() });
  });
  return result;
}
export function removeHerbPhoto(name) {
  const key = herbKey(name);
  const photos = { ...state.herbPhotos }; delete photos[key];
  const result = commit(withHistory({ ...state, herbPhotos: photos }, "removed the photo for", "herb", name));
  save("the removal", c => c.from("herb_photos").delete().eq("herb_key", key).eq("status", "approved"));
  return result;
}

// Preview only: start the preview again from scratch.
export function resetPreview() { if (CONNECTED) return { ok: false }; return commit({ ...SEED, session: state.session }); }

// A picture chosen in admin, made smaller, and (on the real site) uploaded to
// the picture store. Returns the address to use for it.
export async function uploadSiteImage(file, { maxSide = 1600, quality = 0.82, folder = "pages" } = {}) {
  const picture = await fileToImage(file, maxSide, quality);
  if (!CONNECTED) return picture;
  try {
    const client = await remote.getClient();
    return await remote.uploadPicture(client, picture, folder);
  } catch (err) {
    console.error(err);
    throw new Error("The picture could not be uploaded. Please try again.");
  }
}

/* ── helpers used by pages and admin ─────────────────────────────────── */

// Shrinks an uploaded photo so it loads quickly (longest side 1600px, JPEG).
export function fileToImage(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) { reject(new Error("Please choose an image file.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That image could not be opened."));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function plainText(html) {
  // A space after each paragraph, heading and list item, so sentences do not run together.
  const el = document.createElement("div"); el.innerHTML = (html || "").replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "</$1> ");
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}
export function excerpt(article, length = 170) {
  if (article.summary) return article.summary;
  const text = plainText(article.body);
  return text.length > length ? text.slice(0, length).replace(/\s+\S*$/, "") + "…" : text;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// "2026-12-03" → "Thursday 3 December 2026"
export function formatDate(iso, withDay = true) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (withDay ? DAYS[date.getDay()] + " " : "") + d + " " + MONTHS[m - 1] + " " + y;
}

// The full web address of a page on this site (works in the single-file preview too).
export function pageUrl(path) {
  if (window.location.protocol === "file:") return window.location.href.split("#")[0] + "#" + path;
  return window.location.origin + path;
}
