// IBVU: send-approval-email v5 (website v6.12, security fix, 13 Nov 2026).
// A copy of the function to deploy in Supabase (Edge Functions → send-approval-email).
//
// What changed from v4:
// - The email key is no longer written in the code: it uses the RESEND_API_KEY secret
//   (the one the newsletter uses).
// - Only a signed-in herb reviewer (an Owner, or someone with the herb review tick) can
//   use it. Before, anyone could send an email from hello@ibvu.org to any address.
// - The browser sends only the herb's id. The server reads the submitter's address,
//   checks they agreed to be contacted and that no email was sent yet, sends it, and
//   marks the herb "emailed". The herb's name is escaped in the email.

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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function db(path: string, init: RequestInit = {}) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
  });
}

// A signed-in Owner, or someone on the People list with the herb review tick.
async function reviewer(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token === ANON_KEY) return false;
  const who = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: ANON_KEY, Authorization: "Bearer " + token } });
  if (!who.ok) return false;
  const user = await who.json();
  const email = typeof user?.email === "string" ? user.email.toLowerCase() : "";
  if (!email || !(user.email_confirmed_at || user.confirmed_at)) return false;
  const res = await db("site_people?select=role,herb_review&email=eq." + encodeURIComponent(email), { method: "GET" });
  if (!res.ok) return false;
  const [p] = await res.json();
  return !!p && (p.role === "owner" || p.herb_review === true);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Not allowed." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return json({ error: "Server misconfiguration." }, 500);
  try {
    if (!(await reviewer(req))) return json({ error: "Only signed-in herb reviewers can send this email." }, 403);
    const body = await req.json().catch(() => ({}));
    const herbId = typeof body.herbId === "string" && UUID.test(body.herbId) ? body.herbId : "";
    if (!herbId) return json({ error: "Herb not found." }, 404);
    const read = await db("approved_herbs?select=id,name,submitter_email,submitter_consent,emailed&id=eq." + herbId, { method: "GET" });
    const [herb] = read.ok ? await read.json() : [];
    if (!herb) return json({ error: "Herb not found." }, 404);
    if (!herb.submitter_consent || !herb.submitter_email) return json({ error: "The submitter did not agree to be contacted." }, 400);
    if (herb.emailed) return json({ error: "The email was already sent." }, 409);
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "The email service is not set up (RESEND_API_KEY)." }, 500);

    const name = esc(herb.name);
    const html =
      "<div style='font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px;color:#2c1810'>" +
      "<h2 style='color:#5a3e2b;margin-bottom:4px'>IBVU Herbarium Scientifica</h2>" +
      "<p style='color:#888;font-size:12px;margin-top:0'>ivhu (Shona: soil)</p>" +
      "<p>Dear Submitter,</p>" +
      "<p>We are delighted to inform you that your submission of <strong>" + name + "</strong> has been reviewed and <strong>approved</strong> for inclusion in the IBVU Herbarium Scientifica.</p>" +
      "<p>Your contribution helps build a community-sourced catalogue of medicinal plants for researchers and practitioners worldwide. We are grateful for your knowledge.</p>" +
      "<p>You can explore the full Herbarium at <a href='https://ibvu.org' style='color:#5a3e2b'>ibvu.org</a>.</p>" +
      "<p>With gratitude,<br/>The IBVU Team</p>" +
      "<hr style='border:none;border-top:1px solid #d4c5b0;margin:24px 0'/>" +
      "<p style='font-size:11px;color:#aaa'>IBVU &middot; ibvu.org &middot; You received this because you consented to be contacted when submitting.</p>" +
      "</div>";
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "IBVU Herbarium <hello@ibvu.org>",
        to: [herb.submitter_email],
        subject: "Your herb submission has been approved — IBVU Herbarium Scientifica",
        html,
      }),
    });
    if (!sent.ok) return json({ error: "The email could not be sent (" + sent.status + ")." }, 502);
    await db("approved_herbs?id=eq." + herbId, { method: "PATCH", body: JSON.stringify({ emailed: true }) });
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
