// IBVU v5.92 — new file. Turns a name into the last part of a page address,
// for example "St John's wort" becomes "st-john-s-wort". Kept in its own small
// file so the site and the sitemap script use exactly the same rule.
export function slugify(text) {
  return (text || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "untitled";
}
