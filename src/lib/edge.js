import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';
import { CONDITION_GROUPS, CONDITION_SEARCH_TERMS } from '../constants/conditions.js';

// ── Edge Function URLs ────────────────────────────────────────────────────
export const EDGE_DESCRIBE_URL        = SUPABASE_URL + "/functions/v1/generate-description";
export const EDGE_VERIFY_TURNSTILE_URL = SUPABASE_URL + "/functions/v1/verify-turnstile";
export const EDGE_GBIF_URL            = SUPABASE_URL + "/functions/v1/gbif-proxy";
export const EDGE_PUBMED_URL          = SUPABASE_URL + "/functions/v1/pubmed-proxy";
export const EDGE_PUBMED_SCREEN_URL   = SUPABASE_URL + "/functions/v1/pubmed-screen";
export const EDGE_EMAIL_URL           = SUPABASE_URL + "/functions/v1/send-approval-email";

// ── Turnstile site key (safe to expose — widget only) ─────────────────────
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

// ── Generic proxy helpers ─────────────────────────────────────────────────
export async function proxyGbif(path, params) {
  const res = await fetch(EDGE_GBIF_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ path, params }),
  });
  if (!res.ok) throw new Error("gbif-proxy returned " + res.status);
  return res.json();
}

// action: "esearch" | "esummary" | "efetch"
export async function proxyPubMed(action, params) {
  const res = await fetch(EDGE_PUBMED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) throw new Error("pubmed-proxy returned " + res.status);
  if (action === "efetch") return res.text();
  return res.json();
}

// ── Literature search (full pipeline via pubmed-screen Edge Function) ─────
export async function fetchLiterature(herbName, latinName, onStep, narrowTerms) {
  onStep && onStep("Searching PubMed…");
  const res = await fetch(EDGE_PUBMED_SCREEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ herbName, latinName, narrowTerms: narrowTerms || [] }),
  });
  if (!res.ok) throw new Error("pubmed-screen returned " + res.status);
  onStep && onStep("Assembling results…");
  return res.json();
}

// ── GBIF helpers ──────────────────────────────────────────────────────────
export async function gbifLookup(commonName) {
  try {
    const data = await proxyGbif("/v1/species/suggest", { q: commonName, limit: 8 });
    const plant = data.find(r => r.kingdom === "Plantae" && r.rank === "SPECIES");
    if (plant) return { latin: plant.canonicalName || plant.scientificName, usageKey: plant.key };
    const any = data.find(r => r.kingdom === "Plantae");
    if (any) return { latin: any.canonicalName || any.scientificName, usageKey: any.key };
    return null;
  } catch { return null; }
}

export async function gbifNativeRange(usageKey) {
  try {
    const data = await proxyGbif("/v1/species/" + usageKey + "/distributions", { limit: 50 });
    return (data.results || []).map(r => r.locality || "").filter(Boolean);
  } catch { return []; }
}

export async function gbifVernacularNames(usageKey) {
  try {
    const data = await proxyGbif("/v1/species/" + usageKey + "/vernacularNames", { limit: 20 });
    const eng  = (data.results || []).filter(r => r.language === "eng").map(r => r.vernacularName);
    const all  = (data.results || []).map(r => r.vernacularName);
    return [...new Set(eng.length ? eng : all)].slice(0, 5);
  } catch { return []; }
}

export async function gbifEnrich(commonName) {
  try {
    const result = await gbifLookup(commonName);
    if (!result) return { latin: null, otherNames: [], loading: false };
    const otherNames = await gbifVernacularNames(result.usageKey);
    return { latin: result.latin, otherNames, loading: false };
  } catch { return { latin: null, otherNames: [], loading: false }; }
}

// ── Claude description generator ──────────────────────────────────────────
export async function generateDescription(herbName, latinName, uses, origin, paperCount) {
  try {
    const res = await fetch(EDGE_DESCRIBE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ herbName, latinName, uses, origin, paperCount }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.description || "";
  } catch { return ""; }
}

// ── PubMed condition screens ──────────────────────────────────────────────
export async function runConditionScreens(herbName, otherNames) {
  const names    = [herbName, ...(otherNames || "").split(",").map(s => s.trim()).filter(Boolean)];
  const herbTerm = names.map(n => '"' + n + '"[Title/Abstract]').join(" OR ");
  const delay    = ms => new Promise(r => setTimeout(r, ms));
  const results  = [];
  for (let i = 0; i < CONDITION_GROUPS.length; i++) {
    const group     = CONDITION_GROUPS[i];
    const condTerms = CONDITION_SEARCH_TERMS[group.id] || [];
    const condTerm  = condTerms.map(t => '"' + t + '"[Title/Abstract]').join(" OR ");
    const term      = "(" + herbTerm + ") AND (" + condTerm + ")";
    if (i > 0) await delay(340);
    try {
      const data  = await proxyPubMed("esearch", { db: "pubmed", term: term, retmax: 1, retmode: "json" });
      const count = parseInt(data.esearchresult?.count || "0", 10);
      results.push({ ...group, count });
    } catch { results.push({ ...group, count: 0 }); }
  }
  return results.sort((a, b) => b.count - a.count);
}

// ── Approval email ────────────────────────────────────────────────────────
export async function sendApprovalEmail(toEmail, herbName) {
  const res = await fetch(EDGE_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
    body: JSON.stringify({ to: toEmail, herbName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error("Email failed: " + (err.error || err.message || res.status));
  }
  return res.json();
}
