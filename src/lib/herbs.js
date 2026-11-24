// IBVU v6.15 — what changed in this file: merged herbs.
// - mergeHerbs takes the list of merges (Admin → Duplicates). A herb merged into another
//   is left out, so it no longer shows in the Herbarium, admin lists or the sitemap.
// - herbForwards gives, for each merged-away herb, the address it used to have and the
//   address of the herb it was merged into, so old links and shared links still work.
// - Every herb carries a "ref" ("approved:<id>" or "builtin:<id>") used to name it in merges.
//
// IBVU v5.92 — new file. One place that decides which herbs are shown and what
// address each one gets, used by the Herbarium, admin and the sitemap.
//
// Why: three herbs were found published twice in the database (Chamomile and
// Moringa twice each, and St John's wort once as a built-in herb and once as
// an approved one spelled slightly differently). With one address per herb
// they would have shared an address and one copy could not be opened.
//
// The rules:
// - A built-in herb is replaced by an approved herb with the same address
//   (so "St. John's Wort" and "St John's wort" count as the same herb).
// - If two herbs still share a name, the first keeps the plain address
//   (…/chamomile) and the next gets a number (…/chamomile-2), so every card
//   opens its own page. The real fix for those is to merge them (v6.15).
import { slugify } from './slug.js';

function withRef(h, kind) {
  if (h.ref) return h;
  const id = kind === "approved" ? (h.uuid || h.id) : h.id;
  return { ...h, ref: kind + ":" + id };
}

// shadow: approved herbs that replace a built-in herb of the same address. A merged-away
// approved herb still counts, so hiding it does not bring the old built-in copy back.
function addresses(builtIn, approved, shadow = approved) {
  const approvedSlugs = new Set(shadow.map(h => slugify(h.name)));
  const list = [...builtIn.filter(h => !approvedSlugs.has(slugify(h.name))), ...approved];
  const seen = {};
  return list.map(h => {
    const base = slugify(h.name);
    seen[base] = (seen[base] || 0) + 1;
    return { ...h, slug: seen[base] === 1 ? base : base + "-" + seen[base], duplicate: seen[base] > 1 };
  });
}

export function mergeHerbs(builtIn, approved, merges = []) {
  const b = builtIn.map(h => withRef(h, "builtin"));
  const a = approved.map(h => withRef(h, "approved"));
  const gone = new Set((merges || []).map(m => m.from_ref));
  if (!gone.size) return addresses(b, a);
  return addresses(b.filter(h => !gone.has(h.ref)), a.filter(h => !gone.has(h.ref)), a);
}

// { "neem-2": "neem", … }: old address of each merged-away herb → address of the herb it
// was merged into (following a chain of merges).
export function herbForwards(builtIn, approved, merges = []) {
  if (!merges || !merges.length) return {};
  const into = Object.fromEntries(merges.map(m => [m.from_ref, m.into_ref]));
  const before = mergeHerbs(builtIn, approved);
  const after = mergeHerbs(builtIn, approved, merges);
  const slugOf = Object.fromEntries(after.map(h => [h.ref, h.slug]));
  const out = {};
  for (const h of before) {
    if (!into[h.ref]) continue;
    let target = into[h.ref];
    for (let i = 0; i < 10 && into[target]; i++) target = into[target];
    if (slugOf[target] && slugOf[target] !== h.slug) out[h.slug] = slugOf[target];
  }
  // Built-in herbs hidden by a merge keep their plain address too.
  for (const h of builtIn.map(x => withRef(x, "builtin"))) {
    const s = slugify(h.name);
    if (into[h.ref] && !out[s] && !after.some(x => x.slug === s)) {
      let target = into[h.ref];
      for (let i = 0; i < 10 && into[target]; i++) target = into[target];
      if (slugOf[target]) out[s] = slugOf[target];
    }
  }
  return out;
}
