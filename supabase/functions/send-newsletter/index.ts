// v2 (website v6.10): every picture and the cover are shown at their own width in pixels
// of the 544 px column (a cover with no width yet: tile size, 340 px) and shrink in
// proportion on a phone (width="340" style="width:62.5%;max-width:340px").
// (website v6.09): pictures in the email are centred at the size set in the editor,
// with their caption underneath; the cover shows the whole picture (not its tile
// framing) and its caption. Same layout as admin's "Preview as email".
//
// IBVU: send-newsletter (new with website v6.03, 13 Nov 2026).
// A copy of the function to deploy in Supabase (Edge Functions). Changing this
// file does not change the live function; it has to be deployed in Supabase.
//
// What it does:
//   action "test"  Owners and Editors: sends the issue to their own address only.
//   action "send"  Owners: sends the issue now to everyone confirmed on its lists.
//   action "tick"  The 5-minute timer (database step 2): sends scheduled issues
//                  whose time has come, finishes any send that was interrupted,
//                  and sends the admin reminder emails that are due.
//
// Safety:
// - Only confirmed people who have not unsubscribed receive an issue, and a
//   person on two of the chosen lists receives one copy.
// - Every email has that person's own unsubscribe link.
// - An issue is "claimed" before sending (draft or scheduled → sending), so
//   two runs can never send it twice. Each email is recorded in
//   newsletter_sends; an interrupted send carries on where it stopped.
// - "tick" can be called by anyone, but it only ever sends what is due.
//
// Secrets it uses (set in Supabase, never written here): RESEND_API_KEY.
// The email layout matches src/lib/newsletterEmail.js on the website.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE = "https://ibvu.org";
const FROM = "IBVU <hello@ibvu.org>";
const BATCH = 100;               // emails per call to Resend
const RUN_SECONDS = 90;          // stop and carry on next time after this long
const LISTS: Record<string, string> = {
  monthly: "IBVU Monthly", mailclub: "Herb Mail Club & shop",
  business: "Services for businesses", research: "Research & collaboration",
};
const listNames = (keys: string[]) => (keys || []).map((k) => LISTS[k] || k).join(", ");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function db(path: string, init: RequestInit & { prefer?: string; extra?: Record<string, string> } = {}) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: init.prefer ?? "return=minimal",
      ...(init.extra || {}),
    },
  });
}
async function rows(path: string) {
  const res = await db(path, { method: "GET" });
  if (!res.ok) throw new Error("read failed: " + path.split("?")[0]);
  return await res.json();
}
// Reads every row, 1000 at a time.
async function allRows(path: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await db(path, { method: "GET", extra: { Range: from + "-" + (from + 999) } });
    if (!res.ok) throw new Error("read failed: " + path.split("?")[0]);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
}
async function count(path: string) {
  const res = await db(path, { method: "HEAD", prefer: "count=exact", extra: { Range: "0-0" } });
  const range = res.headers.get("content-range") || "*/0";
  return Number(range.split("/")[1]) || 0;
}

/* ── who is asking ──────────────────────────────────────────────────── */

async function caller(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token === ANON_KEY) return null;
  const who = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: ANON_KEY, Authorization: "Bearer " + token } });
  if (!who.ok) return null;
  const user = await who.json();
  const email = typeof user?.email === "string" ? user.email.toLowerCase() : "";
  if (!email || !(user.email_confirmed_at || user.confirmed_at)) return null;
  const people = await rows("site_people?select=role&email=eq." + encodeURIComponent(email));
  return people.length === 1 ? { email, role: people[0].role as string } : null;
}

/* ── the email ──────────────────────────────────────────────────────── */

const C = { bark: "#3d2c1e", text: "#2c1810", muted: "#6c6354", sage: "#4d6b4d", cream: "#f5f0e8", line: "#e3d9c6" };
function styleForEmail(html: string) {
  return String(html || "")
    .replace(/<p>/g, `<p style="margin:0 0 16px;font-size:17px;line-height:1.65;color:${C.text}">`)
    .replace(/<h2>/g, `<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;line-height:1.3;color:${C.bark};margin:28px 0 12px">`)
    .replace(/<h3>/g, `<h3 style="font-family:Georgia,serif;font-weight:normal;font-size:20px;line-height:1.3;color:${C.bark};margin:24px 0 10px">`)
    .replace(/<blockquote>/g, `<blockquote style="margin:18px 0;padding:4px 0 4px 16px;border-left:3px solid ${C.sage};color:${C.muted};font-style:italic">`)
    .replace(/<ul>/g, `<ul style="margin:0 0 16px 22px;padding:0;font-size:17px;line-height:1.65;color:${C.text}">`)
    .replace(/<ol>/g, `<ol style="margin:0 0 16px 22px;padding:0;font-size:17px;line-height:1.65;color:${C.text}">`)
    .replace(/<img\b[^>]*>/g, emailPicture)
    .replace(/<a /g, `<a style="color:${C.sage};text-decoration:underline" `)
    .replace(/<script[\s\S]*?<\/script>/gi, "");
}
function attr(tag: string, name: string) {
  const m = tag.match(new RegExp("\\s" + name + "=\"([^\"]*)\"", "i"));
  return m ? m[1] : "";
}
function sized(px: number) {
  const w = Math.max(60, Math.min(544, Math.round(px)));
  return { attr: ` width="${w}"`, style: `width:${(w / 544 * 100).toFixed(2)}%;max-width:${w}px` };
}
function emailPicture(tag: string) {
  const src = attr(tag, "src"), alt = attr(tag, "alt"), caption = attr(tag, "data-caption");
  const px = Number(attr(tag, "data-px")) || Number(attr(tag, "width")) || 544;
  const s = sized(px);
  return `<div style="text-align:center;margin:8px 0 18px"><img src="${src}" alt="${alt}"${s.attr} style="display:inline-block;${s.style};height:auto;border:0">`
    + (caption ? `<p style="margin:8px auto 0;font-size:14px;line-height:1.5;color:${C.muted};text-align:center">${caption}</p>` : "")
    + `</div>`;
}
// The cover as uploaded (its "#frame=…" framing is only for the website tile) and its caption.
function coverParts(value: string) {
  const text = String(value || "");
  const at = text.lastIndexOf("#frame=");
  if (at < 0) return { src: text, caption: "", width: 0 };
  const rest = text.slice(at + 7).split("&").slice(1);
  const get = (k: string) => { const p = rest.find(x => x.startsWith(k + "=")); try { return p ? decodeURIComponent(p.slice(k.length + 1)) : ""; } catch { return ""; } };
  return { src: get("orig") || text.slice(0, at), caption: get("cap"), width: Math.round(Number(get("cw"))) || 0 };
}
function coverHtml(value: string) {
  if (!value) return "";
  const { src, caption, width } = coverParts(value);
  const s = sized(width || 340);
  return `<div style="text-align:center;margin:0 0 ${caption ? "8px" : "22px"}"><img src="${esc(src)}" alt=""${s.attr} style="display:inline-block;${s.style};height:auto;border:0"></div>`
    + (caption ? `<p style="margin:0 0 22px;font-size:14px;line-height:1.5;color:${C.muted};text-align:center">${esc(caption)}</p>` : "");
}
function buildEmail(issue: any, viewUrl: string, unsubscribeUrl: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(issue.title)}</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(issue.preview_text)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line}">
${viewUrl ? `<tr><td style="padding:10px 28px;font-family:Arial,sans-serif;font-size:12px;color:${C.muted};text-align:right;border-bottom:1px solid ${C.line}"><a href="${esc(viewUrl)}" style="color:${C.muted}">View in your browser</a></td></tr>` : ""}
<tr><td align="center" style="padding:28px 28px 8px"><img src="${SITE}/email-logo.png" width="96" height="96" alt="IBVU" style="display:block;border:0"></td></tr>
<tr><td style="padding:8px 28px 0;font-family:Georgia,serif">
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:30px;line-height:1.25;color:${C.bark};margin:12px 0 18px;text-align:center">${esc(issue.title)}</h1>
${coverHtml(issue.cover)}
${styleForEmail(issue.body)}
</td></tr>
<tr><td style="padding:22px 28px 28px;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:${C.muted};border-top:1px solid ${C.line}">
IBVU &middot; Regulate &middot; Educate &middot; Innovate &middot; <a href="${SITE}" style="color:${C.muted}">ibvu.org</a><br>
You are receiving this because you subscribed at ibvu.org. <a href="${esc(unsubscribeUrl)}" style="color:${C.muted}">Unsubscribe or change what you receive</a>.
</td></tr>
</table></td></tr></table></body></html>`;
}

async function resend(path: string, payload: unknown) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  try {
    const res = await fetch("https://api.resend.com" + path, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true, error: "" };
    return { ok: false, error: ("Resend " + res.status + " " + (await res.text())).slice(0, 300) };
  } catch (e) {
    return { ok: false, error: "Resend unreachable" };
  }
}

/* ── admin reminders ────────────────────────────────────────────────── */

async function reminderSetup() {
  const [settings] = await rows("newsletter_reminder_settings?select=*&id=eq.1");
  const people = await rows("admin_reminder_recipients?select=email");
  return { settings: settings || null, to: people.map((p: any) => p.email) as string[] };
}
// Records the reminder; returns false if it was already sent.
async function claimReminder(key: string) {
  const res = await db("admin_reminders_sent?on_conflict=key", {
    method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: JSON.stringify({ key }),
  });
  if (!res.ok) return false;
  return (await res.json()).length === 1;
}
async function sendReminder(to: string[], subject: string, lines: string[]) {
  if (!to.length) return;
  const html = "<div style='font-family:Georgia,serif;max-width:560px;color:#2c1810'>" +
    "<h2 style='color:#3d2c1e;margin:0 0 14px'>" + esc(subject) + "</h2>" +
    lines.map((l) => "<p style='margin:0 0 12px;line-height:1.6'>" + l + "</p>").join("") +
    "<p style='margin:20px 0 0'><a href='" + SITE + "/admin/newsletters' style='color:#4d6b4d'>Open Admin → Newsletters</a></p>" +
    "<p style='font-size:12px;color:#8a7f70;margin-top:24px'>An IBVU admin reminder. Owners can change these under Admin → Newsletters → Reminders.</p></div>";
  await resend("/emails", { from: FROM, to, subject: "IBVU admin: " + subject, html });
}
const ukDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/* ── sending an issue ───────────────────────────────────────────────── */

async function claim(issueId: string, from: string[]) {
  const res = await db("newsletter_issues?id=eq." + issueId + "&status=in.(" + from.join(",") + ")", {
    method: "PATCH", prefer: "return=representation", body: JSON.stringify({ status: "sending", updated_at: new Date().toISOString() }),
  });
  if (!res.ok) return null;
  const r = await res.json();
  return r.length ? r[0] : null;
}

async function runSend(issue: any, sentBy: string, deadline: number) {
  const lists = (issue.lists || []).filter((k: string) => k in LISTS);
  const people = lists.length
    ? await allRows("newsletter_signups?select=email,unsubscribe_token&unsubscribed_at=is.null&lists=ov.{" + lists.join(",") + "}&order=email")
    : [];
  const done = new Set((await allRows("newsletter_sends?select=email&issue_id=eq." + issue.id)).map((s: any) => s.email));
  const todo = people.filter((p: any) => !done.has(p.email));
  const viewUrl = issue.show_on_site ? SITE + "/newsletter/" + issue.slug : "";

  for (let i = 0; i < todo.length; i += BATCH) {
    if (Date.now() > deadline) return { done: false };
    const chunk = todo.slice(i, i + BATCH);
    const result = await resend("/emails/batch", chunk.map((p: any) => {
      const unsub = SITE + "/unsubscribe?t=" + p.unsubscribe_token;
      return {
        from: FROM, to: [p.email], subject: issue.subject || issue.title,
        html: buildEmail(issue, viewUrl, unsub),
        headers: { "List-Unsubscribe": "<" + unsub + ">" },
      };
    }));
    const at = new Date().toISOString();
    await db("newsletter_sends?on_conflict=issue_id,email", {
      method: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
      body: JSON.stringify(chunk.map((p: any) => ({ issue_id: issue.id, email: p.email, status: result.ok ? "sent" : "failed", error: result.error, sent_at: at }))),
    });
    // keep the claim fresh, so the timer knows this send is still running
    await db("newsletter_issues?id=eq." + issue.id, { method: "PATCH", body: JSON.stringify({ updated_at: new Date().toISOString() }) });
  }

  const sent = await count("newsletter_sends?select=id&issue_id=eq." + issue.id + "&status=eq.sent");
  const failed = await count("newsletter_sends?select=id&issue_id=eq." + issue.id + "&status=eq.failed");
  const sentAt = new Date().toISOString();
  await db("newsletter_issues?id=eq." + issue.id, {
    method: "PATCH",
    body: JSON.stringify({ status: "sent", sent_at: sentAt, sent_by: sentBy, recipients: sent, failures: failed, updated_at: sentAt }),
  });

  const { settings, to } = await reminderSetup();
  if (settings?.after_enabled && (await claimReminder("after:" + issue.id))) {
    await sendReminder(to, "Newsletter sent: " + (issue.subject || issue.title), [
      "<strong>" + esc(issue.title) + "</strong> was sent on " + esc(ukDate(sentAt)) + " (UK time).",
      "Lists: " + esc(listNames(lists)) + ".",
      "Sent to " + sent + (sent === 1 ? " person" : " people") + (failed ? ". <strong>" + failed + " could not be sent</strong>: see the record in admin." : ", none failed."),
    ]);
  }
  return { done: true, recipients: sent, failures: failed };
}

/* ── the 5-minute timer ─────────────────────────────────────────────── */

async function tick() {
  const nowIso = new Date().toISOString();
  const deadline = Date.now() + RUN_SECONDS * 1000;
  const summary: Record<string, number> = { sent: 0, resumed: 0, reminders: 0 };

  // Scheduled issues whose time has come.
  for (const due of await rows("newsletter_issues?select=id&status=eq.scheduled&send_at=lte." + encodeURIComponent(nowIso))) {
    const issue = await claim(due.id, ["scheduled"]);
    if (issue) { await runSend(issue, "Owner (scheduled)", deadline); summary.sent++; }
  }
  // Sends that were interrupted (no progress for 3 minutes).
  const stale = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  for (const s of await rows("newsletter_issues?select=*&status=eq.sending&updated_at=lt." + encodeURIComponent(stale))) {
    const res = await db("newsletter_issues?id=eq." + s.id + "&status=eq.sending&updated_at=eq." + encodeURIComponent(s.updated_at), {
      method: "PATCH", prefer: "return=representation", body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });
    const claimed = res.ok ? await res.json() : [];
    if (claimed.length) { await runSend(claimed[0], s.sent_by || "Owner", deadline); summary.resumed++; }
  }

  // Admin reminders.
  const { settings, to } = await reminderSetup();
  if (settings && to.length) {
    // A scheduled issue going out soon.
    if (settings.before_enabled) {
      const until = new Date(Date.now() + settings.before_hours * 3600 * 1000).toISOString();
      const soon = await rows("newsletter_issues?select=*&status=eq.scheduled&send_at=gt." + encodeURIComponent(nowIso) + "&send_at=lte." + encodeURIComponent(until));
      for (const n of soon) {
        if (!(await claimReminder("before:" + n.id + ":" + n.send_at))) continue;
        const people = await count("newsletter_signups?select=id&unsubscribed_at=is.null&lists=ov.{" + (n.lists || []).join(",") + "}");
        await sendReminder(to, "Newsletter going out soon: " + (n.subject || n.title), [
          "<strong>" + esc(n.title) + "</strong> is scheduled for " + esc(ukDate(n.send_at)) + " (UK time).",
          "Lists: " + esc(listNames(n.lists)) + ", about " + people + (people === 1 ? " person" : " people") + ".",
          "To check it, change the time or cancel, open it in admin before then.",
        ]);
        summary.reminders++;
      }
    }
    // Time to write the next issue.
    if (settings.due_enabled) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date()).map((p) => [p.type, p.value]));
      const day = Number(parts.day), month = parts.year + "-" + parts.month;
      if (day >= settings.due_day && Number(parts.hour) >= 8) { // from 08:00 UK time on that day
        const monthStart = parts.year + "-" + parts.month + "-01T00:00:00Z";
        const handled = await count("newsletter_issues?select=id&lists=cs.{" + settings.due_list + "}&or=" + encodeURIComponent('(status.eq.scheduled,status.eq.sending,sent_at.gte."' + monthStart + '")'));
        if (!handled && (await claimReminder("due:" + month + ":" + settings.due_list))) {
          const last = await rows("newsletter_issues?select=title,sent_at&status=eq.sent&lists=cs.{" + settings.due_list + "}&order=sent_at.desc&limit=1");
          await sendReminder(to, LISTS[settings.due_list] + " is due", [
            "It is time to write this month's " + esc(LISTS[settings.due_list]) + ".",
            last.length ? "The last issue, <strong>" + esc(last[0].title) + "</strong>, was sent on " + esc(ukDate(last[0].sent_at)) + "." : "No issue has been sent to this list yet.",
          ]);
          summary.reminders++;
        }
      }
    }
  }
  return summary;
}

/* ── requests ───────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Not allowed." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return json({ ok: false, error: "Server misconfiguration." }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "tick") return json({ ok: true, ...(await tick()) });

    const who = await caller(req);
    if (!who) return json({ ok: false, error: "Please sign in." }, 401);
    const issueId = typeof body.issueId === "string" && UUID.test(body.issueId) ? body.issueId : "";
    if (!issueId) return json({ ok: false, error: "Newsletter not found." }, 404);
    const [issue] = await rows("newsletter_issues?select=*&id=eq." + issueId);
    if (!issue) return json({ ok: false, error: "Newsletter not found." }, 404);

    if (action === "test") {
      if (!["owner", "editor"].includes(who.role)) return json({ ok: false, error: "Only Owners and Editors can send tests." }, 403);
      const viewUrl = issue.show_on_site ? SITE + "/newsletter/" + issue.slug : "";
      const r = await resend("/emails", { from: FROM, to: [who.email], subject: "[Test] " + (issue.subject || issue.title), html: buildEmail(issue, viewUrl, SITE + "/unsubscribe") });
      return r.ok ? json({ ok: true, to: who.email }) : json({ ok: false, error: "The test could not be sent. " + r.error }, 502);
    }

    if (action === "send") {
      if (who.role !== "owner") return json({ ok: false, error: "Only an Owner can send newsletters." }, 403);
      if (!(issue.subject || "").trim()) return json({ ok: false, error: "Add a subject line first." }, 400);
      if (!(issue.lists || []).length) return json({ ok: false, error: "Choose at least one list first." }, 400);
      const claimed = await claim(issueId, ["draft", "scheduled"]);
      if (!claimed) return json({ ok: false, error: "This newsletter has already been sent or is being sent." }, 409);
      const r = await runSend(claimed, "Owner", Date.now() + RUN_SECONDS * 1000);
      return json({ ok: true, inProgress: !r.done, recipients: r.recipients ?? 0, failures: r.failures ?? 0 });
    }

    return json({ ok: false, error: "Unknown request." }, 400);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
});
