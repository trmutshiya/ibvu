// IBVU v6.03 — what changed in this file since v6.02: newsletters (issues, the
// sending record, list counts, sending through the send-newsletter function),
// admin reminder settings and draft changes are read and written here too.
//
// IBVU v6.02 — what changed in this file since v6.0: Owners also load the
// mailing lists and contact messages; sendForm can be used without the spam
// check for the confirm and unsubscribe links.
//
// IBVU v6.0 — new file. Everything that talks to the database for the
// editable parts of the site (events, articles and blog posts, page wording,
// people, history, herb photos) and for signing in to admin.
//
// Used by src/lib/content.js, which keeps a copy of the content in the page
// so screens stay fast; this file reads and writes the database behind it.
// When the site has no database settings (the double-click preview and the
// automatic tests) nothing in this file is used.
//
// Visitors only ever read here, with the site's public key, and the database
// rules decide what they may see (published content only). The full sign-in
// library is only downloaded for people who are signed in to admin, so the
// public site stays light.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';

/* ── the sign-in library, loaded only when needed ───────────────────── */

const AUTH_STORAGE_KEY = (() => {
  try { return "sb-" + new URL(SUPABASE_URL).hostname.split(".")[0] + "-auth-token"; } catch { return ""; }
})();

// True when this browser has (or recently had) an admin sign-in.
export function hasStoredSignIn() {
  try { return !!(AUTH_STORAGE_KEY && window.localStorage.getItem(AUTH_STORAGE_KEY)); } catch { return false; }
}

let clientPromise = null;
export function getClient() {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      }));
  }
  return clientPromise;
}

/* ── turning database rows into what the screens use, and back ──────── */

export const fromEvent = r => ({
  id: r.id, title: r.title || "", date: r.event_date || "", time: r.event_time || "",
  location: r.location || "", description: r.description || "", image: r.image || "",
  bookingUrl: r.booking_url || "", status: r.status, updatedAt: r.updated_at,
});
export const toEvent = e => ({
  id: e.id, title: e.title || "", event_date: e.date || null, event_time: e.time || "",
  location: e.location || "", description: e.description || "", image: e.image || "",
  booking_url: e.bookingUrl || "", status: e.status === "published" ? "published" : "draft",
  updated_at: new Date().toISOString(),
});
export const fromArticle = r => ({
  id: r.id, section: r.section === "blog" ? "blog" : "media", title: r.title || "", slug: r.slug,
  summary: r.summary || "", cover: r.cover || "", author: r.author || "", body: r.body || "",
  status: r.status, publishedAt: r.published_at, updatedAt: r.updated_at,
});
export const toArticle = a => ({
  id: a.id, section: a.section === "blog" ? "blog" : "media", title: a.title || "", slug: a.slug,
  summary: a.summary || "", cover: a.cover || "", author: a.author || "", body: a.body || "",
  status: a.status === "published" ? "published" : "draft", published_at: a.publishedAt || null,
  updated_at: new Date().toISOString(),
});
export const fromPerson = r => ({ id: r.id, email: r.email, role: r.role, herbReview: !!r.herb_review });
export const fromSignup = r => ({
  id: r.id, email: r.email, firstName: r.first_name || "", lastName: r.last_name || "",
  lists: r.lists || [], pendingLists: r.pending_lists || [], source: r.source || "",
  createdAt: r.created_at, confirmedAt: r.confirmed_at, unsubscribedAt: r.unsubscribed_at,
  unsubscribeToken: r.unsubscribe_token,
});
export const fromIssue = r => ({
  id: r.id, title: r.title || "", slug: r.slug, subject: r.subject || "", previewText: r.preview_text || "",
  cover: r.cover || "", body: r.body || "", lists: r.lists || [], showOnSite: r.show_on_site !== false,
  status: r.status, sendAt: r.send_at, sentAt: r.sent_at, sentBy: r.sent_by || "",
  recipients: r.recipients || 0, failures: r.failures || 0, createdAt: r.created_at, updatedAt: r.updated_at,
});
// Only what admin may write; sending and the record are set by the server.
export const toIssue = n => ({
  id: n.id, title: n.title || "", slug: n.slug, subject: n.subject || "", preview_text: n.previewText || "",
  cover: n.cover || "", body: n.body || "", lists: n.lists || [], show_on_site: n.showOnSite !== false,
  status: n.status === "scheduled" ? "scheduled" : "draft", send_at: n.status === "scheduled" ? n.sendAt : null,
  updated_at: new Date().toISOString(),
});
export const fromReminderSettings = r => ({
  dueEnabled: r.due_enabled, dueDay: r.due_day, dueList: r.due_list,
  beforeEnabled: r.before_enabled, beforeHours: r.before_hours, afterEnabled: r.after_enabled,
});
export const toReminderSettings = s => ({
  due_enabled: !!s.dueEnabled, due_day: Number(s.dueDay) || 25, due_list: s.dueList || "monthly",
  before_enabled: !!s.beforeEnabled, before_hours: Number(s.beforeHours) || 24, after_enabled: !!s.afterEnabled,
  updated_at: new Date().toISOString(),
});
export const fromMessage = r => ({
  id: r.id, name: r.name, email: r.email, organisation: r.organisation || "", type: r.enquiry_type || "",
  message: r.message, wantsUpdates: !!r.wants_updates, createdAt: r.created_at,
});

/* ── reading what everyone may see (no sign-in) ─────────────────────── */

async function publicRead(table, query) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + query, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error(table + " " + res.status);
  return res.json();
}

// Published content, page wording and approved herb photos.
export async function loadPublic() {
  const [pages, events, articles, photos, issues] = await Promise.all([
    publicRead("site_pages", "select=key,data"),
    publicRead("site_events", "select=*&status=eq.published"),
    publicRead("site_articles", "select=*&status=eq.published"),
    publicRead("herb_photos", "select=herb_key,herb_name,image_path&status=eq.approved"),
    // Until database step 2 has been run this table does not exist yet: show no issues.
    publicRead("newsletter_issues", "select=*&status=eq.sent&show_on_site=eq.true").catch(() => []),
  ]);
  return {
    pages: Object.fromEntries(pages.map(p => [p.key, p.data])),
    events: events.map(fromEvent),
    articles: articles.map(fromArticle),
    herbPhotos: Object.fromEntries(photos.map(p => [p.herb_key, { name: p.herb_name, image: p.image_path }])),
    newsletters: issues.map(fromIssue),
  };
}

/* ── reading for someone signed in ───────────────────────────────────── */

// Everything this person may see in admin. The database rules decide: drafts
// for everyone on the People list, history for Editors and Owners, the whole
// People list for Owners, waiting herb photos for herb reviewers.
export async function loadForStaff(client, session) {
  const check = r => { if (r.error) throw r.error; return r.data || []; };
  const owner = session.role === "owner";
  const [events, articles, pages, people, history, photos, signups, messages] = await Promise.all([
    client.from("site_events").select("*").then(check),
    client.from("site_articles").select("*").then(check),
    client.from("site_pages").select("key,data").then(check),
    client.from("site_people").select("*").order("created_at").then(check),
    session.role === "owner" || session.role === "editor"
      ? client.from("site_history").select("*").order("at", { ascending: false }).limit(300).then(check)
      : Promise.resolve([]),
    client.from("herb_photos").select("*").order("created_at").then(check),
    owner ? client.from("newsletter_signups").select("*").order("created_at", { ascending: false }).then(check) : Promise.resolve([]),
    owner ? client.from("contact_messages").select("*").order("created_at", { ascending: false }).then(check) : Promise.resolve([]),
  ]);
  // Newsletters, reminders and draft changes (database step 2). If step 2 has
  // not been run yet these are simply empty, and the rest of admin still works.
  const optional = p => p.then(r => (r.error ? null : r.data)).catch(() => null);
  const editorPlus = owner || session.role === "editor";
  const [issues, sends, counts, drafts, reminderPeople, reminderSettings] = await Promise.all([
    editorPlus ? optional(client.from("newsletter_issues").select("*").order("created_at", { ascending: false })) : Promise.resolve([]),
    owner ? optional(client.from("newsletter_sends").select("issue_id,email,status,error,sent_at").order("sent_at", { ascending: false }).limit(10000)) : Promise.resolve([]),
    editorPlus ? optional(client.rpc("newsletter_list_counts")) : Promise.resolve({}),
    optional(client.from("content_drafts").select("*")),
    owner ? optional(client.from("admin_reminder_recipients").select("*").order("created_at")) : Promise.resolve([]),
    owner ? optional(client.from("newsletter_reminder_settings").select("*").eq("id", 1).maybeSingle()) : Promise.resolve(null),
  ]);

  const herbPhotos = {};
  const waiting = [];
  for (const p of photos) {
    if (p.status === "approved") herbPhotos[p.herb_key] = { name: p.herb_name, image: p.image_path, id: p.id };
    else waiting.push(p);
  }
  // Photos waiting for review are private: make short-lived links to look at them.
  const pendingHerbPhotos = {};
  if (waiting.length) {
    const signed = await client.storage.from("herb-photo-submissions").createSignedUrls(waiting.map(p => p.image_path), 3600);
    const links = Object.fromEntries((signed.data || []).map(s => [s.path, s.signedUrl]));
    for (const p of waiting) {
      pendingHerbPhotos[p.id] = {
        id: p.id, herbKey: p.herb_key, name: p.herb_name, path: p.image_path,
        image: links[p.image_path] || "", at: p.created_at, permission: !!p.permission,
      };
    }
  }

  return {
    events: events.map(fromEvent),
    articles: articles.map(fromArticle),
    pages: Object.fromEntries(pages.map(p => [p.key, p.data])),
    people: people.map(fromPerson),
    history: history.map(h => ({ id: h.id, at: h.at, who: h.who, action: h.action, kind: h.kind, title: h.title })),
    herbPhotos,
    pendingHerbPhotos,
    signups: signups.map(fromSignup),
    messages: messages.map(fromMessage),
    newsletters: (issues || []).map(fromIssue),
    newsletterSends: (sends || []).map(s => ({ issueId: s.issue_id, email: s.email, status: s.status, error: s.error || "", sentAt: s.sent_at })),
    listCounts: counts || {},
    drafts: Object.fromEntries((drafts || []).map(d => [d.kind + ":" + d.item_key, { data: d.data, savedBy: d.saved_by || "", updatedAt: d.updated_at }])),
    reminderRecipients: (reminderPeople || []).map(r => ({ id: r.id, email: r.email })),
    ...(reminderSettings ? { reminderSettings: fromReminderSettings(reminderSettings) } : {}),
    newsletterReady: issues !== null,
  };
}

// The send-newsletter function, as the signed-in person: { action: "send" | "test", issueId }.
export async function callNewsletter(body) {
  try {
    const client = await getClient();
    const r = await client.functions.invoke("send-newsletter", { body });
    if (r.error) {
      let message = r.error.message;
      try { const b = await r.error.context.json(); if (b && b.error) message = b.error; } catch { /* keep the general message */ }
      return { ok: false, error: message };
    }
    return { ok: true, ...(r.data || {}) };
  } catch {
    return { ok: false, error: "Could not reach the website's server. Check your connection and try again." };
  }
}

// The signed-in person's own entry on the People list, or null if they are not on it.
export async function lookUpMyself(client, email) {
  const r = await client.from("site_people").select("*").eq("email", (email || "").toLowerCase()).maybeSingle();
  if (r.error) throw r.error;
  return r.data ? fromPerson(r.data) : null;
}

/* ── images ──────────────────────────────────────────────────────────── */

function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(",");
  const mime = (/data:([^;]+)/.exec(head) || [])[1] || "image/jpeg";
  const bytes = atob(body);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Puts a picture in the public picture store and returns its web address.
export async function uploadPicture(client, picture, folder) {
  const blob = typeof picture === "string" ? dataUrlToBlob(picture) : picture;
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = folder + "/" + newId() + "." + ext;
  const up = await client.storage.from("site-images").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (up.error) throw up.error;
  return client.storage.from("site-images").getPublicUrl(path).data.publicUrl;
}

/* ── visitors sending things (through the site-forms function) ──────── */

// kind: "contact" | "newsletter" | "herb-photo" (these need the spam check's
// turnstileToken), or "confirm" | "unsubscribe-info" | "unsubscribe" (these
// use the private token from the person's email link instead).
// Returns { ok, error? } plus whatever the server sends back.
export async function sendForm(kind, fields, turnstileToken) {
  try {
    const res = await fetch(SUPABASE_URL + "/functions/v1/site-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
      body: JSON.stringify({ kind, turnstileToken, ...fields }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return { ok: false, error: data.error || "Sorry, that did not work. Please try again." };
    return { ...data, ok: true };
  } catch {
    return { ok: false, error: "Could not reach the website's server. Check your connection and try again." };
  }
}

/* ── ids ─────────────────────────────────────────────────────────────── */

// A random id in the format the database uses.
export function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  const b = window.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
}
