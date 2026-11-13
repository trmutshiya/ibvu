// IBVU v5.7 — what changed in this file since v5.3:
// - usePageTitle can also set the page description (the short text search
//   engines show under the title). Pages that give none get the general one.
// (v5.3: shared site actions and the per-page browser tab title.)
import { createContext, useContext, useEffect } from 'react';

export const SiteContext = createContext(null);
export function useSite() { return useContext(SiteContext); }

export const SITE_DESCRIPTION = "IBVU is an organisation dedicated to bringing greater scientific rigour, transparency and innovation to the global herbal remedies industry.";

export function usePageTitle(title, description) {
  useEffect(() => {
    document.title = title ? title + " — IBVU" : "IBVU — From the Earth";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", (description || SITE_DESCRIPTION).replace(/\s+/g, " ").trim().slice(0, 300));
  }, [title, description]);
}

export function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
