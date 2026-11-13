// IBVU: article-review (new with website v6.11, 13 Nov 2026).
// A copy of the function to deploy in Supabase (Edge Functions → article-review).
// Changing this file does not change the live function; it has to be deployed.
//
// Every step of sending an article or blog post for review goes through here, so the
// role and the article's state are always checked on the server and nobody can email
// anyone else from the browser. Actions (all need a signed-in person on the People list):
//   send       Anyone: send it for review. Emails every Editor and Owner (not the sender).
//   takeback   The person who sent it (or an Editor/Owner): take it back before it is
//              reviewed. Emails the Editors and Owners it was sent to.
//   sendback   Editors and Owners: send it back for changes, with a note. Emails the
//              person who sent it, with the open comments.
//   comment    Anyone: a comment on the whole article or on some words (quote, markId),
//              or a reply (parentId). While it is sent back, a new comment from an Editor
//              or Owner is emailed to the person who sent it.
//   resolve    Anyone: mark a comment done.
//   published  Editors and Owners, after publishing: closes the review and the comments
//              and tells the person who sent it.
// It answers with the article's review and comments, without email addresses.
//
// Secrets it uses (set in Supabase, never written here): RESEND_API_KEY.

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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE: Record<string, string> = { owner: "Owner", editor: "Editor", writer: "Writer" };

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function db(path: string, init: RequestInit & { prefer?: string } = {}) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json", Prefer: init.prefer ?? "return=minimal" },
  });
}
async function rows(path: string) {
  const res = await db(path, { method: "GET" });
  if (!res.ok) throw new Error("read failed: " + path.split("?")[0]);
  return await res.json();
}
async function write(path: string, method: string, body: unknown, prefer?: string) {
  const res = await db(path, { method, body: JSON.stringify(body), prefer });
  if (!res.ok) throw new Error("write failed: " + path.split("?")[0] + " " + (await res.text()).slice(0, 200));
}

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

async function resend(to: string, subject: string, lines: string[], link: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  const html = "<div style='font-family:Georgia,serif;max-width:560px;color:#2c1810;font-size:16px;line-height:1.6'>" +
    lines.map((l) => "<p style='margin:0 0 14px'>" + l + "</p>").join("") +
    "<p style='margin:20px 0'><a href='" + esc(link) + "' style='background:#3d2c1e;color:#f5f0e8;padding:10px 16px;text-decoration:none;font-family:Arial,sans-serif;font-size:13px'>Open it in admin</a></p>" +
    "<p style='font-size:12px;color:#8a7f70;margin-top:24px'>An IBVU admin email, sent because you are on the People list at ibvu.org/admin.</p></div>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: "IBVU admin: " + subject, html }),
    });
    return res.ok;
  } catch { return false; }
}
// Emails several people one by one (nobody sees the others' addresses).
async function emailAll(to: string[], subject: string, lines: string[], link: string) {
  let sent = 0;
  for (const t of [...new Set(to)]) if (await resend(t, subject, lines, link)) sent++;
  return sent;
}

// What the browser may see.
function publicReview(r: any, me: string) {
  if (!r) return null;
  return { article_id: r.article_id, state: r.state, note: r.note, sent_at: r.sent_at, back_note: r.back_note, back_by: r.back_by, log: r.log || [], updated_at: r.updated_at, sent_by_me: r.writer_email === me };
}
function publicComments(list: any[], me: string) {
  return list.map((c) => ({ id: c.id, article_id: c.article_id, parent_id: c.parent_id, author_role: c.author_role, quote: c.quote, mark_id: c.mark_id, body: c.body, resolved: c.resolved, created_at: c.created_at, mine: c.author_email === me }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Not allowed." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return json({ ok: false, error: "Server misconfiguration." }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    const who = await caller(req);
    if (!who) return json({ ok: false, error: "Please sign in again." }, 401);
    const reviewer = who.role === "owner" || who.role === "editor";
    const label = ROLE[who.role] || "Admin";
    const articleId = typeof body.articleId === "string" && UUID.test(body.articleId) ? body.articleId : "";
    const [article] = articleId ? await rows("site_articles?select=id,title,section,status&id=eq." + articleId) : [];
    if (!article) return json({ ok: false, error: "This article was not found. It may not have saved yet: wait a moment and try again." }, 404);

    const title = article.title || "(untitled)";
    const link = SITE + (article.section === "blog" ? "/admin/blog" : "/admin/articles");
    const kind = article.section === "blog" ? "blog post" : "article";
    const [found] = await rows("article_reviews?select=*&article_id=eq." + articleId);
    const review: any = found || { article_id: articleId, state: "draft", writer_email: "", note: "", sent_at: null, back_note: "", back_by: "", log: [] };
    const at = new Date().toISOString();
    const logged = (what: string) => [...(review.log || []), { at, who: label, what }].slice(-100);
    const comments = await rows("article_comments?select=*&article_id=eq." + articleId + "&order=created_at");
    const open = comments.filter((c: any) => !c.resolved && !c.parent_id);
    const reviewers = async () => (await rows("site_people?select=email&role=in.(owner,editor)")).map((p: any) => p.email).filter((e: string) => e !== who.email);
    let emailed = 0;
    let next: any = null;

    if (action === "send") {
      if (review.state === "review") return json({ ok: false, error: "This is already waiting for review." }, 409);
      const note = text(body.note, 1000);
      next = { ...review, state: "review", writer_email: who.email, note, sent_at: at, log: logged("sent it for review" + (note ? ": “" + note + "”" : "")) };
      emailed = await emailAll(await reviewers(), "Ready for review: " + title, [
        "A " + esc(label) + " sent the " + kind + " <strong>" + esc(title) + "</strong> for review.",
        ...(note ? ["Their note: <em>“" + esc(note) + "”</em>"] : []),
        "Open it under “Waiting for your review”, read it, add comments, then publish it or send it back.",
      ], link);
    } else if (action === "takeback") {
      if (review.state !== "review") return json({ ok: false, error: "This is not waiting for review." }, 409);
      if (!reviewer && review.writer_email !== who.email) return json({ ok: false, error: "Only the person who sent it can take it back." }, 403);
      next = { ...review, state: open.length || review.back_note ? "changes" : "draft", log: logged("took it back from review") };
      emailed = await emailAll(await reviewers(), "Taken back: " + title, [
        "The " + kind + " <strong>" + esc(title) + "</strong> was taken back to be changed. Nothing for you to do for now.",
      ], link);
    } else if (action === "sendback") {
      if (!reviewer) return json({ ok: false, error: "Only Editors and Owners can send it back." }, 403);
      if (review.state !== "review" || !review.writer_email) return json({ ok: false, error: "Only something sent for review can be sent back." }, 409);
      const note = text(body.note, 1000);
      if (!note && !open.length) return json({ ok: false, error: "Add a note or a comment so the writer knows what to change." }, 400);
      next = { ...review, state: "changes", back_note: note, back_by: label, log: logged("sent it back" + (open.length ? " with " + open.length + " comment" + (open.length === 1 ? "" : "s") : "")) };
      if (review.writer_email !== who.email) {
        emailed = await emailAll([review.writer_email], "Changes asked for: " + title, [
          "The " + esc(label) + " sent your " + kind + " <strong>" + esc(title) + "</strong> back for changes.",
          ...(note ? ["Their note: <em>“" + esc(note) + "”</em>"] : []),
          ...(open.length ? ["Comments to look at:<br>" + open.map((c: any) => "• " + (c.quote ? "<em>“" + esc(c.quote) + "”</em>: " : "") + esc(c.body)).join("<br>")] : []),
          "Make the changes, mark each comment done, then send it for review again.",
        ], link);
      }
    } else if (action === "comment") {
      const words = text(body.body, 2000);
      if (!words) return json({ ok: false, error: "Write the comment first." }, 400);
      const parentId = typeof body.parentId === "string" && UUID.test(body.parentId) ? body.parentId : null;
      if (parentId && !comments.some((c: any) => c.id === parentId)) return json({ ok: false, error: "That comment was not found." }, 404);
      const markId = typeof body.markId === "string" && /^[a-z0-9-]{4,40}$/i.test(body.markId) ? body.markId : "";
      await write("article_comments", "POST", {
        article_id: articleId, parent_id: parentId, author_email: who.email, author_role: who.role,
        quote: parentId ? "" : text(body.quote, 300), mark_id: parentId ? "" : markId, body: words,
      });
      if (!parentId) next = { ...review, log: logged("added a comment") };
      if (!parentId && reviewer && review.state === "changes" && review.writer_email && review.writer_email !== who.email) {
        emailed = await emailAll([review.writer_email], "New comment: " + title, [
          "The " + esc(label) + " added a comment to <strong>" + esc(title) + "</strong>:",
          "<em>“" + esc(words) + "”</em>",
        ], link);
      }
    } else if (action === "resolve") {
      const commentId = typeof body.commentId === "string" && UUID.test(body.commentId) ? body.commentId : "";
      if (!comments.some((c: any) => c.id === commentId)) return json({ ok: false, error: "That comment was not found." }, 404);
      await write("article_comments?id=eq." + commentId, "PATCH", { resolved: true });
      next = { ...review, log: logged("marked a comment done") };
    } else if (action === "published") {
      if (!reviewer) return json({ ok: false, error: "Only Editors and Owners publish." }, 403);
      if (open.length) await write("article_comments?article_id=eq." + articleId + "&resolved=eq.false", "PATCH", { resolved: true });
      const writer = review.writer_email;
      next = { ...review, state: "draft", note: "", back_note: "", back_by: "", log: logged("published it") };
      if (writer && writer !== who.email && (review.state === "review" || review.state === "changes")) {
        emailed = await emailAll([writer], "Published: " + title, [
          "Your " + kind + " <strong>" + esc(title) + "</strong> has been published by the " + esc(label) + ". Thank you!",
        ], SITE + (article.section === "blog" ? "/blog" : "/media"));
      }
    } else {
      return json({ ok: false, error: "Unknown request." }, 400);
    }

    if (next) {
      next.updated_at = at;
      await write("article_reviews?on_conflict=article_id", "POST", next, "resolution=merge-duplicates,return=minimal");
    }
    const after = await rows("article_comments?select=*&article_id=eq." + articleId + "&order=created_at");
    return json({ ok: true, emailed, review: publicReview(next || found || null, who.email), comments: publicComments(after, who.email) });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Something went wrong on the server. Please try again." }, 500);
  }
});
