// IBVU v6.15 — new file. Finds herbs that may be the same plant, so duplicates are caught
// when someone submits a herb, in herb review, and in Admin → Duplicates.
//
// A match has a strength:
// - "certain":  the same species (same Latin name, genus and species, ignoring authors
//               such as "L." and spacing).
// - "likely":   a name matches exactly after tidying (case, accents, "St." / "St",
//               punctuation): the herb's name or one of its other names against the
//               other herb's name, e.g. someone submits "Grains of Selim" and African
//               pepper lists it as an other name.
// - "possible": the two only share an other name (one local name can belong to two
//               plants, e.g. "Guinea pepper" is used for African pepper AND Grains of
//               paradise), or the names are spelt almost the same ("Ashwaganda").
// Only "certain" and "likely" are shown to the person submitting; "possible" is for the
// reviewer.

const STRENGTH_ORDER = { certain: 3, likely: 2, possible: 1 };

export function normName(s) {
  return (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/\(botanical name\)/g, " ").replace(/['’‘`]/g, "")
    .replace(/\bst\.\s*/g, "st ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

// "Salvia rosmarinus Spenn" -> "salvia rosmarinus"; "Mentha × piperita" -> "mentha piperita".
// Returns "" unless there are at least two words (a genus alone is not a species).
export function normLatin(s) {
  const words = (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/×/g, " ").replace(/[^a-z\s-]/g, " ").trim().split(/\s+/).filter(w => w && w !== "x");
  if (words.length < 2) return "";
  return words[0] + " " + words[1];
}

export function splitNames(text) {
  if (Array.isArray(text)) return text.map(s => String(s).trim()).filter(Boolean);
  return (text || "").split(",").map(s => s.trim()).filter(Boolean);
}

// A herb in the shape the Herbarium uses: { name, latinName|latin, altNames|other_names }.
export function namesOf(h) {
  const alt = h.altNames && h.altNames.length ? h.altNames : splitNames(h.other_names || h.otherNames);
  return { primary: h.name || "", others: alt, latin: h.latinName || h.latin || "" };
}

function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function closeSpelling(a, b) {
  if (!a || !b || a === b) return false;
  const n = Math.min(a.length, b.length);
  if (n < 5) return false;
  return distance(a, b, n >= 9 ? 2 : 1) <= (n >= 9 ? 2 : 1);
}

// Compare a candidate (a submission, or a herb) with one herb. Returns null or
// { strength, reasons: [text] }.
export function compare(candidate, herb) {
  const c = namesOf(candidate), h = namesOf(herb);
  const reasons = [];
  let strength = null;
  const up = s => { if (!strength || STRENGTH_ORDER[s] > STRENGTH_ORDER[strength]) strength = s; };

  const cl = normLatin(c.latin), hl = normLatin(h.latin);
  if (cl && hl && cl === hl) { up("certain"); reasons.push("same species (" + h.latin.trim() + ")"); }

  const cP = normName(c.primary), hP = normName(h.primary);
  const cO = c.others.map(normName).filter(Boolean), hO = h.others.map(normName).filter(Boolean);
  const label = (list, n) => list.find(x => normName(x) === n) || n;

  if (cP && cP === hP) { up("likely"); reasons.push("same name"); }
  if (cP && hO.includes(cP)) { up("likely"); reasons.push("“" + c.primary.trim() + "” is one of " + h.primary + "’s other names"); }
  if (hP && cO.includes(hP)) { up("likely"); reasons.push("“" + h.primary.trim() + "” is given as an other name"); }
  const shared = cO.filter(n => n && hO.includes(n) && n !== cP && n !== hP);
  if (shared.length) { up("possible"); reasons.push("share the other name" + (shared.length > 1 ? "s " : " ") + shared.slice(0, 3).map(n => "“" + label(h.others, n) + "”").join(", ")); }
  if (!strength) {
    const near = [hP, ...hO].find(n => closeSpelling(cP, n));
    if (near) { up("possible"); reasons.push("almost the same spelling (“" + c.primary.trim() + "” and “" + (near === hP ? h.primary : label(h.others, near)) + "”)"); }
  }
  return strength ? { strength, reasons } : null;
}

// All herbs that may be the candidate, strongest first.
// minimum: "possible" (everything) or "likely" (what the submitter sees).
export function findMatches(candidate, herbs, minimum = "possible") {
  const min = STRENGTH_ORDER[minimum];
  const out = [];
  for (const herb of herbs) {
    if (candidate.ref && herb.ref && candidate.ref === herb.ref) continue;
    const m = compare(candidate, herb);
    if (m && STRENGTH_ORDER[m.strength] >= min) out.push({ herb, ...m });
  }
  return out.sort((a, b) => STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength] || a.herb.name.localeCompare(b.herb.name));
}

export function pairKey(refA, refB) { return [refA, refB].sort().join("|"); }

// Pairs of published herbs that may be the same plant, strongest first, leaving out
// pairs an admin has marked "not a duplicate".
export function findDuplicatePairs(herbs, dismissed = new Set()) {
  const out = [];
  for (let i = 0; i < herbs.length; i++) {
    for (let j = i + 1; j < herbs.length; j++) {
      const a = herbs[i], b = herbs[j];
      if (!a.ref || !b.ref || dismissed.has(pairKey(a.ref, b.ref))) continue;
      const m1 = compare(a, b), m2 = compare(b, a);
      const m = !m1 ? m2 : !m2 ? m1 : (STRENGTH_ORDER[m2.strength] > STRENGTH_ORDER[m1.strength] ? m2 : m1);
      if (m) out.push({ a, b, key: pairKey(a.ref, b.ref), ...m });
    }
  }
  return out.sort((x, y) => STRENGTH_ORDER[y.strength] - STRENGTH_ORDER[x.strength] || x.a.name.localeCompare(y.a.name));
}

// Items in "incoming" that the herb does not already have (compared after tidying).
// "Coughs (traditional use in Ghana)" counts as the same use as "Coughs".
const untag = s => s.replace(/\s*\(traditional use in [^)]*\)\s*$/i, "");
export function newItems(incoming, existing) {
  const have = new Set(splitNames(existing).map(x => normName(untag(x))));
  const out = [];
  for (const item of splitNames(incoming)) {
    const n = normName(untag(item));
    if (n && !have.has(n)) { have.add(n); out.push(item); }
  }
  return out;
}

// Join two lists, keeping the first spelling of anything that appears in both.
export function combineLists(a, b) {
  return [...splitNames(a), ...newItems(b, a)];
}

export const STRENGTH_LABEL = { certain: "Same species", likely: "Likely duplicate", possible: "Possible duplicate" };
