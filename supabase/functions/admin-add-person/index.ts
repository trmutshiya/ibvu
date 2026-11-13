// IBVU: admin-add-person (step 1 of the database work, 12 Nov 2026).
// A copy of the function running in Supabase (Edge Functions), kept here so the
// website's code and the server's code live together. Changing this file does
// not change the live function; it has to be deployed in Supabase.
//
// Lets an Owner add someone to the People list so that the person can
// receive a sign-in code for ibvu.org/admin.
//
// It does two things, and only for a signed-in Owner:
//   1. makes sure the address can receive sign-in codes
//   2. puts the address on the People list with the chosen role
// Changing a role or removing someone does not need this function; the
// database rules let Owners do that directly.

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
const ROLES = ["owner", "editor", "writer"];

const isEmail = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const service = { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Not allowed." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return json({ ok: false, error: "Server misconfiguration." }, 500);

  try {
    // Who is asking? Their sign-in is checked with the sign-in service itself.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Please sign in." }, 401);
    const who = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: ANON_KEY, Authorization: "Bearer " + token } });
    if (!who.ok) return json({ ok: false, error: "Please sign in." }, 401);
    const user = await who.json();
    const callerEmail = typeof user?.email === "string" ? user.email.toLowerCase() : "";
    if (!user?.id || !callerEmail || !(user.email_confirmed_at || user.confirmed_at)) return json({ ok: false, error: "Please sign in." }, 401);

    // Only an Owner may add people.
    const look = await fetch(SUPABASE_URL + "/rest/v1/site_people?select=role&email=eq." + encodeURIComponent(callerEmail), { headers: service });
    const rows = look.ok ? await look.json() : [];
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].role !== "owner") return json({ ok: false, error: "Only an Owner can add people." }, 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "The request could not be read." }, 400);
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role : "";
    const herbReview = role === "owner" || body.herbReview === true;
    if (!isEmail(email)) return json({ ok: false, error: "Enter the person's email address." }, 400);
    if (!ROLES.includes(role)) return json({ ok: false, error: "Choose a role." }, 400);

    // 1. Make sure the address can receive sign-in codes. If it already can, that is fine.
    const made = await fetch(SUPABASE_URL + "/auth/v1/admin/users", {
      method: "POST",
      headers: service,
      body: JSON.stringify({ email, email_confirm: true }),
    });
    if (!made.ok && made.status !== 422) return json({ ok: false, error: "The person could not be set up for sign-in." }, 500);

    // 2. Put them on the People list (or update their entry if they are already on it).
    const saved = await fetch(SUPABASE_URL + "/rest/v1/site_people?on_conflict=email", {
      method: "POST",
      headers: { ...service, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ email, role, herb_review: herbReview }),
    });
    if (!saved.ok) return json({ ok: false, error: "The person could not be added to the People list." }, 500);
    const people = await saved.json();
    return json({ ok: true, person: Array.isArray(people) ? people[0] : null });
  } catch {
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
});
