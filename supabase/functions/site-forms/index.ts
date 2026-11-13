// IBVU: site-forms. Version 2 (13 Nov 2026, website v6.02): mailing lists.
// - A newsletter sign-up carries the lists the person chose. They are not
//   added straight away: they get an email with a Confirm button, and only
//   then are the lists added (kind "confirm"). Their own unsubscribe link
//   lets them leave one list or all (kinds "unsubscribe-info", "unsubscribe").
// - The contact form can carry "wantsUpdates": the person is then sent the
//   same Confirm email for the list that matches their enquiry.
// - hello@ibvu.org gets an email for each contact message (as before) and
//   for each confirmed newsletter sign-up.
// Version 1 (12 Nov 2026): contact form, newsletter, herb photos.
// A copy of the function running in Supabase (Edge Functions), kept here so the
// website's code and the server's code live together. Changing this file does
// not change the live function; it has to be deployed in Supabase.
//
// Receives what a visitor can send from ibvu.org:
//   kind "contact"     the contact form   -> saved, and emailed to hello@ibvu.org
//   kind "newsletter"  a newsletter sign-up -> saved; a Confirm email is sent
//   kind "herb-photo"  a photo sent with a herb submission -> kept privately
//                      until someone with herb review approves it
//   kind "confirm", "unsubscribe-info", "unsubscribe": the links in emails
// The first three must pass the Cloudflare spam check. The links carry a
// private token instead. Visitors cannot write to the database themselves;
// only this function can, after checking what was sent.
//
// Secrets it uses (set in Supabase, never written here):
//   TURNSTILE_SECRET_KEY  the spam check (already set)
//   RESEND_API_KEY        sends the emails. If it is missing, messages are
//                         still saved but no email is sent.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const NOTIFY_TO = "hello@ibvu.org";
const FROM = "IBVU Website <hello@ibvu.org>";
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

// The mailing lists (same keys as src/lib/lists.js and the database rule).
const LISTS: Record<string, string> = {
  monthly: "IBVU Monthly",
  mailclub: "Herb Mail Club & shop",
  business: "Services for businesses",
  research: "Research & collaboration",
};
const LIST_FOR_ENQUIRY: Record<string, string> = {
  general: "monthly", advisory: "business", research: "research", partnerships: "research",
  shop: "mailclub", events: "mailclub", media: "monthly",
};
const listNames = (keys: string[]) => keys.map((k) => LISTS[k] || k).join(", ");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Links in emails point back to the site the person used: ibvu.org, or the
// Vercel test address. Anything else gets ibvu.org, so the emails can never
// be made to link somewhere else.
function siteOrigin(req: Request) {
  const o = req.headers.get("origin") || "";
  if (/^https:\/\/(www\.)?ibvu\.org$/.test(o)) return o;
  if (/^https:\/\/ibvu(-[a-z0-9-]+)?-trmutshiyas-projects\.vercel\.app$/.test(o)) return o;
  if (o === "https://ibvu.vercel.app") return o;
  return "https://ibvu.org";
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isEmail = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

// Same rule as the website (src/lib/slug.js).
function slugify(text: string) {
  return (text || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "untitled";
}

async function passedSpamCheck(token: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret || !token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

function db(path: string, init: RequestInit & { prefer?: string } = {}) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: init.prefer ?? "return=minimal",
    },
  });
}

// Returns true if the email was accepted for sending. Goes to hello@ibvu.org
// unless another address is given.
async function sendEmail(subject: string, html: string, replyTo?: string, to: string = NOTIFY_TO) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: oneLine(subject).slice(0, 200), html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const row = (label: string, value: string) =>
  "<tr><td style='padding:4px 14px 4px 0;color:#6c6354;vertical-align:top'>" + esc(label) + "</td><td style='padding:4px 0'>" + esc(value).replace(/\n/g, "<br/>") + "</td></tr>";
const wrap = (title: string, rows: string) =>
  "<div style='font-family:Georgia,serif;max-width:600px;color:#2c1810'><h2 style='color:#3d2c1e;margin:0 0 12px'>" + esc(title) + "</h2><table style='border-collapse:collapse;font-size:15px'>" + rows + "</table></div>";

/* ── mailing lists ───────────────────────────────────────────────────── */

async function findSignup(column: string, value: string) {
  const res = await db("newsletter_signups?select=*&" + column + "=eq." + encodeURIComponent(value), { method: "GET" });
  if (!res.ok) throw new Error("lookup failed");
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// Adds the lists as "waiting to confirm" and emails the Confirm link.
// Returns { confirmSent } (false when the person is already on every list asked for).
async function addToLists(email: string, firstName: string, lastName: string, wanted: string[], source: string, origin: string) {
  const lists = [...new Set(wanted.filter((k) => k in LISTS))];
  if (!lists.length) return { confirmSent: false };
  const existing = await findSignup("email", email);
  let rec;
  if (existing) {
    const add = lists.filter((k) => !(existing.lists || []).includes(k));
    if (!add.length) return { confirmSent: false };
    const pending = [...new Set([...(existing.pending_lists || []), ...add])];
    const res = await db("newsletter_signups?id=eq." + existing.id, {
      method: "PATCH", prefer: "return=representation",
      body: JSON.stringify({ pending_lists: pending, first_name: firstName || existing.first_name, last_name: lastName || existing.last_name }),
    });
    if (!res.ok) throw new Error("save failed");
    rec = (await res.json())[0];
  } else {
    const res = await db("newsletter_signups", {
      method: "POST", prefer: "return=representation",
      body: JSON.stringify({ email, first_name: firstName, last_name: lastName, lists: [], pending_lists: lists, source, consent_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error("save failed");
    rec = (await res.json())[0];
  }
  const link = origin + "/newsletter/confirm?t=" + rec.confirm_token;
  const html =
    "<div style='font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:28px;color:#2c1810'>" +
    "<h2 style='color:#3d2c1e;margin:0 0 14px'>Please confirm your subscription</h2>" +
    "<p>You asked to receive: <strong>" + esc(listNames(rec.pending_lists || lists)) + "</strong> from IBVU.</p>" +
    "<p style='margin:26px 0'><a href='" + esc(link) + "' style='background:#3d2c1e;color:#f5f0e8;padding:12px 22px;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase'>Confirm</a></p>" +
    "<p style='font-size:13px;color:#6c6354'>If the button does not work, copy this address into your browser:<br/>" + esc(link) + "</p>" +
    "<p style='font-size:13px;color:#6c6354'>If you did not ask for this, ignore this email and you will not hear from us.</p>" +
    "<hr style='border:none;border-top:1px solid #d4c5b0;margin:22px 0'/><p style='font-size:12px;color:#8a7f70'>IBVU &middot; ibvu.org</p></div>";
  const sent = await sendEmail("Please confirm your subscription to IBVU", html, undefined, email);
  return { confirmSent: sent };
}

async function newsletter(body: Record<string, unknown>, origin: string) {
  const email = clean(body.email, 254).toLowerCase();
  const firstName = clean(body.firstName, 100);
  const lastName = clean(body.lastName, 100);
  const source = clean(body.source, 80) || "newsletter box";
  const wanted = Array.isArray(body.lists) ? body.lists.filter((k): k is string => typeof k === "string") : ["monthly"];
  if (!isEmail(email)) return json({ ok: false, error: "Please enter your email address." }, 400);
  if (!wanted.some((k) => k in LISTS)) return json({ ok: false, error: "Please choose at least one thing to hear about." }, 400);
  const r = await addToLists(email, firstName, lastName, wanted, source, origin);
  return json({ ok: true, ...r });
}

async function confirm(body: Record<string, unknown>) {
  const token = clean(body.token, 60);
  const bad = json({ ok: false, error: "This confirm link is not valid." }, 404);
  if (!UUID.test(token)) return bad;
  const rec = await findSignup("confirm_token", token);
  if (!rec) return bad;
  const pending = rec.pending_lists || [];
  const lists = [...new Set([...(rec.lists || []), ...pending])];
  const res = await db("newsletter_signups?id=eq." + rec.id, {
    method: "PATCH",
    body: JSON.stringify({ lists, pending_lists: [], confirmed_at: new Date().toISOString(), unsubscribed_at: null }),
  });
  if (!res.ok) return json({ ok: false, error: "That did not work. Please try the link again." }, 500);
  if (pending.length) {
    await sendEmail(
      "Newsletter sign-up: " + rec.email,
      wrap("New confirmed subscriber", row("Email", rec.email) + row("Name", [rec.first_name, rec.last_name].filter(Boolean).join(" ") || "-") + row("Lists", listNames(lists)) + row("Signed up from", rec.source || "-")),
    );
  }
  return json({ ok: true, lists });
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return (user.length <= 2 ? user[0] + "*" : user.slice(0, 2) + "***") + "@" + domain;
}

async function unsubscribeInfo(body: Record<string, unknown>) {
  const token = clean(body.token, 60);
  if (!UUID.test(token)) return json({ ok: false, error: "This unsubscribe link is not valid." }, 404);
  const rec = await findSignup("unsubscribe_token", token);
  if (!rec) return json({ ok: false, error: "This unsubscribe link is not valid." }, 404);
  return json({ ok: true, email: maskEmail(rec.email), lists: rec.lists || [] });
}

async function unsubscribe(body: Record<string, unknown>) {
  const token = clean(body.token, 60);
  if (!UUID.test(token)) return json({ ok: false, error: "This unsubscribe link is not valid." }, 404);
  const rec = await findSignup("unsubscribe_token", token);
  if (!rec) return json({ ok: false, error: "This unsubscribe link is not valid." }, 404);
  const keep = Array.isArray(body.keep) ? body.keep : [];
  const lists = (rec.lists || []).filter((k: string) => keep.includes(k));
  const res = await db("newsletter_signups?id=eq." + rec.id, {
    method: "PATCH",
    body: JSON.stringify({ lists, pending_lists: [], unsubscribed_at: lists.length ? null : new Date().toISOString() }),
  });
  if (!res.ok) return json({ ok: false, error: "That did not work. Please try again." }, 500);
  return json({ ok: true, lists });
}

/* ── contact form ────────────────────────────────────────────────────── */

async function contact(body: Record<string, unknown>, origin: string) {
  const name = clean(body.name, 200);
  const email = clean(body.email, 254).toLowerCase();
  const organisation = clean(body.organisation, 200);
  const type = clean(body.type, 60);
  const message = clean(body.message, 5000);
  if (!name || !isEmail(email) || !message) return json({ ok: false, error: "Please fill in your name, email address and message." }, 400);

  const wantsUpdates = body.wantsUpdates === true && type in LIST_FOR_ENQUIRY;
  const saved = await db("contact_messages", {
    method: "POST",
    body: JSON.stringify({ name, email, organisation, enquiry_type: type, message, wants_updates: wantsUpdates }),
  });
  if (!saved.ok) return json({ ok: false, error: "The message could not be saved." }, 500);

  const emailed = await sendEmail(
    "Website enquiry" + (type ? " (" + type + ")" : "") + " from " + name,
    wrap("New enquiry from ibvu.org", row("Name", name) + row("Email", email) + row("Organisation", organisation || "-") + row("Enquiry type", type || "-") + row("Wants updates", wantsUpdates ? "Yes: " + LISTS[LIST_FOR_ENQUIRY[type]] + " (after confirming)" : "No") + row("Message", message)),
    email,
  );
  let confirmSent = false;
  if (wantsUpdates) {
    try { confirmSent = (await addToLists(email, name, "", [LIST_FOR_ENQUIRY[type]], "contact form", origin)).confirmSent; }
    catch { /* the message itself was saved and sent; the subscription can be done again */ }
  }
  return json({ ok: true, emailed, confirmSent });
}

// What kind of picture the bytes really are, whatever the sender claimed.
function imageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { mime: "image/webp", ext: "webp" };
  return null;
}

async function herbPhoto(body: Record<string, unknown>) {
  const herbName = clean(body.herbName, 200);
  const image = typeof body.image === "string" ? body.image : "";
  if (!herbName) return json({ ok: false, error: "The herb's name is missing." }, 400);
  if (body.permission !== true) return json({ ok: false, error: "Please confirm the photo is your own." }, 400);

  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) return json({ ok: false, error: "That photo could not be read." }, 400);
  if (match[2].length > MAX_PHOTO_BYTES * 1.4) return json({ ok: false, error: "That photo is too large." }, 400);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  } catch {
    return json({ ok: false, error: "That photo could not be read." }, 400);
  }
  if (bytes.length > MAX_PHOTO_BYTES) return json({ ok: false, error: "That photo is too large." }, 400);
  const type = imageType(bytes);
  if (!type) return json({ ok: false, error: "That file is not a photo we can accept." }, 400);

  const path = crypto.randomUUID() + "." + type.ext;
  const objectUrl = SUPABASE_URL + "/storage/v1/object/herb-photo-submissions/" + path;
  const auth = { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY };
  const uploaded = await fetch(objectUrl, { method: "POST", headers: { ...auth, "Content-Type": type.mime }, body: bytes });
  if (!uploaded.ok) return json({ ok: false, error: "The photo could not be saved." }, 500);

  const saved = await db("herb_photos", {
    method: "POST",
    body: JSON.stringify({ herb_key: slugify(herbName), herb_name: herbName, image_path: path, status: "pending", source: "submission", permission: true }),
  });
  if (!saved.ok) {
    await fetch(objectUrl, { method: "DELETE", headers: auth }).catch(() => {});
    return json({ ok: false, error: "The photo could not be saved." }, 500);
  }
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Not allowed." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ ok: false, error: "Server misconfiguration." }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== "object") throw new Error("bad");
  } catch {
    return json({ ok: false, error: "The request could not be read." }, 400);
  }

  const kind = clean(body.kind, 20);
  const origin = siteOrigin(req);
  try {
    // The links in emails carry their own private token instead of the spam check.
    if (kind === "confirm") return await confirm(body);
    if (kind === "unsubscribe-info") return await unsubscribeInfo(body);
    if (kind === "unsubscribe") return await unsubscribe(body);
  } catch {
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }

  if (!["contact", "newsletter", "herb-photo"].includes(kind)) return json({ ok: false, error: "Unknown request." }, 400);

  if (!(await passedSpamCheck(clean(body.turnstileToken, 4096)))) {
    return json({ ok: false, error: "The security check did not pass. Please try again." }, 403);
  }

  try {
    if (kind === "contact") return await contact(body, origin);
    if (kind === "newsletter") return await newsletter(body, origin);
    return await herbPhoto(body);
  } catch {
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
});
