// IBVU v6.03 — what changed in this file: the newsletter page and published issues are listed.
// IBVU v6.0 — what changed in this file: published articles and blog posts are listed too.
// IBVU v5.92 — what changed in this file: herb addresses come from the same rule the site uses
// (src/lib/herbs.js), so herbs published twice are listed correctly; the Privacy page is added.
// IBVU v5.8 — what changed in this file: the Blog page (ibvu.org/educate/blog) is added to the list.
// IBVU v5.7 — new file.
// Writes public/sitemap.xml, the list of page addresses search engines read.
// It runs by itself every time the site is built ("npm run build"), so the
// list is refreshed on every deploy:
//   - the fixed pages (home, Regulate, Innovate, Shop and so on)
//   - one address per herb, ibvu.org/educate/hs/herb-name
// Herb names are read from the database when the build has the Supabase
// settings (it only reads, it never writes). Without them it uses the
// built-in herb list. If anything goes wrong it still writes the fixed pages,
// so it can never stop a build.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeHerbs } from '../src/lib/herbs.js';

const SITE = "https://ibvu.org";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAGES = [
  "/", "/regulate", "/educate/hs", "/educate/hs/submit", "/educate/blog", "/innovate", "/media", "/newsletter", "/contact", "/privacy",
  "/shop", "/shop/mail", "/shop/events", "/shop/products", "/shop/resources", "/shop/membership",
];

// Settings come from the host (Vercel) or from a local .env file.
function setting(name) {
  if (process.env[name]) return process.env[name];
  for (const file of [".env.local", ".env"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const line = readFileSync(path, "utf8").split(/\r?\n/).find(l => l.trim().startsWith(name + "="));
    if (line) return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

async function namesFromDatabase() {
  const url = setting("VITE_SUPABASE_URL"), key = setting("VITE_SUPABASE_ANON_KEY");
  if (!url || url.startsWith("https://YOUR_") || !key) return null;
  const names = { builtIn: [], approved: [] };
  for (const [table, order, into] of [["static_herbs", "id.asc", "builtIn"], ["approved_herbs", "created_at.asc", "approved"]]) {
    const res = await fetch(url + "/rest/v1/" + table + "?select=name&order=" + order + "&limit=2000", {
      headers: { apikey: key, Authorization: "Bearer " + key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(table + " " + res.status);
    for (const row of await res.json()) if (row.name) names[into].push({ name: row.name });
  }
  return names;
}

async function namesBuiltIn() {
  const { HERBS_FALLBACK } = await import("../src/constants/herbs.js");
  return { builtIn: HERBS_FALLBACK.map(h => ({ name: h.name })), approved: [] };
}

// Published articles (/media/...) and blog posts (/educate/blog/...).
async function writingFromDatabase() {
  const url = setting("VITE_SUPABASE_URL"), key = setting("VITE_SUPABASE_ANON_KEY");
  if (!url || url.startsWith("https://YOUR_") || !key) return [];
  try {
    const res = await fetch(url + "/rest/v1/site_articles?select=section,slug&status=eq.published&limit=2000", {
      headers: { apikey: key, Authorization: "Bearer " + key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const writing = (await res.json()).map(a => (a.section === "blog" ? "/educate/blog/" : "/media/") + a.slug);
    // Newsletter issues shown on the website (once database step 2 has been run).
    const issues = await fetch(url + "/rest/v1/newsletter_issues?select=slug&status=eq.sent&show_on_site=eq.true&limit=2000", {
      headers: { apikey: key, Authorization: "Bearer " + key }, signal: AbortSignal.timeout(8000),
    }).then(r => (r.ok ? r.json() : [])).catch(() => []);
    return [...writing, ...issues.map(n => "/newsletter/" + n.slug)];
  } catch { return []; }
}

let names = { builtIn: [], approved: [] }, source = "fixed pages only";
try {
  const fromDb = await namesFromDatabase();
  if (fromDb && fromDb.builtIn.length + fromDb.approved.length) { names = fromDb; source = "database"; }
  else { names = await namesBuiltIn(); source = "built-in herb list"; }
} catch (err) {
  try { names = await namesBuiltIn(); source = "built-in herb list (database not reachable: " + err.message + ")"; }
  catch { /* fixed pages only */ }
}

const herbPages = mergeHerbs(names.builtIn, names.approved).map(h => h.slug).sort().map(s => "/educate/hs/" + s);
const writingPages = (await writingFromDatabase()).sort();
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + [...PAGES, ...herbPages, ...writingPages].map(p => "  <url><loc>" + SITE + p + "</loc></url>").join("\n")
  + "\n</urlset>\n";

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "sitemap.xml"), xml);
console.log("sitemap.xml: " + PAGES.length + " pages + " + herbPages.length + " herbs (" + source + ") + " + writingPages.length + " articles and posts");
