// IBVU: generate-description v8 (website v6.12, security fix, 13 Nov 2026).
// A copy of the function to deploy in Supabase (Edge Functions → generate-description).
//
// What changed from v7: only a signed-in herb reviewer (an Owner, or someone with the
// herb review tick) can use it. Before, anyone with the site's public key could call it
// and run up the AI bill. The description itself is written exactly as before.
// Secrets it uses: ANTHROPIC_API_KEY (unchanged).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

async function reviewer(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token === ANON_KEY) return false;
  const who = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: ANON_KEY, Authorization: "Bearer " + token } });
  if (!who.ok) return false;
  const user = await who.json();
  const email = typeof user?.email === "string" ? user.email.toLowerCase() : "";
  if (!email || !(user.email_confirmed_at || user.confirmed_at)) return false;
  const res = await fetch(SUPABASE_URL + "/rest/v1/site_people?select=role,herb_review&email=eq." + encodeURIComponent(email), {
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY },
  });
  if (!res.ok) return false;
  const [p] = await res.json();
  return !!p && (p.role === "owner" || p.herb_review === true);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!(await reviewer(req))) return reply({ error: "Only signed-in herb reviewers can use this." }, 403);
    const { herbName, latinName, uses, origin, paperCount } = await req.json();

    if (!herbName) return reply({ error: "herbName is required" }, 400);

    const prompt =
      "Write a 2-3 sentence botanical description for the medicinal herb " + String(herbName).slice(0, 200) +
      (latinName ? " (" + String(latinName).slice(0, 200) + ")" : "") +
      ", native to " + String(origin || "various regions").slice(0, 300) + ". " +
      "Traditional uses include: " + String(uses ?? "").slice(0, 1000) + ". " +
      "There are " + Number(paperCount || 0) + " PubMed papers supporting its use. " +
      "Match this exact style — scientific but accessible, no hype: " +
      "\"Ashwagandha (Withania somnifera) is a revered adaptogenic root from the Solanaceae family, " +
      "native to the dry regions of India and the Mediterranean. Used for over 3,000 years in Ayurvedic " +
      "medicine, it is prized for its ability to reduce cortisol and support the stress response. " +
      "Modern clinical trials increasingly validate its traditional role as a nervine tonic and endurance enhancer.\" " +
      "Write only the description, no preamble or labels.";

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return reply({ error: "ANTHROPIC_API_KEY secret not configured" }, 500);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    if (!res.ok) return reply({ error: data.error?.message || "Anthropic error" }, res.status);
    const description = data.content?.[0]?.text?.trim() || "";
    return reply({ description });
  } catch (err) {
    return reply({ error: (err as Error).message }, 500);
  }
});
