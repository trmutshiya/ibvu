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
//   opens its own page. The real fix for those is to unpublish the duplicate.
import { slugify } from './slug.js';

export function mergeHerbs(builtIn, approved) {
  const approvedSlugs = new Set(approved.map(h => slugify(h.name)));
  const list = [...builtIn.filter(h => !approvedSlugs.has(slugify(h.name))), ...approved];
  const seen = {};
  return list.map(h => {
    const base = slugify(h.name);
    seen[base] = (seen[base] || 0) + 1;
    return { ...h, slug: seen[base] === 1 ? base : base + "-" + seen[base], duplicate: seen[base] > 1 };
  });
}
