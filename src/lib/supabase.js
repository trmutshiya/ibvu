// IBVU v6.16 — what changed in this file: new sbSendSubmission sends a herb submission (and
// its photo) to the site-forms function, which checks the security token and saves it.
// sbInsert (the browser saving straight into the database) is now only a fallback; after
// database step 6 the database refuses it.
//
// IBVU v6.15 — what changed in this file (duplicates and merging; needs database step 5 for
// the new parts, works without it):
// - Herbs carry a "ref" that names them for merging: "approved:<id>" or "builtin:<id>".
// - New: sbFetchHerbMerges, sbAddMerge, sbRemoveMerge (merge and undo), sbFetchNotDuplicates,
//   sbAddNotDuplicate, sbRemoveNotDuplicate, sbMoveHerbPhoto (a merged herb's photo moves to
//   the kept herb).
// - A submission can be "additions to an existing herb": target_herb, target_name and
//   match_note are sent with it (if the database does not have those columns yet, it is
//   sent without them, as before).
// - Fix: making a built-in herb editable (sbInsertStaticHerb) now keeps its other names.
// - Fix: Unpublish now writes its edit-log entry before removing the herb. Written after,
//   the database refused it (the log entry pointed at a herb that no longer existed), so
//   unpublishes were never logged.
//
// IBVU v6.14 — what changed in this file (Other names shown on herb pages, no database change):
// - sbFetchApproved now passes each approved herb's other names to the Herbarium and herb
//   pages (altNames, split at commas). Before, the names were fetched but dropped, so every
//   approved herb showed "Other names: Not recorded".
//
// IBVU v6.13 — what changed in this file (Other names fix, no database change):
// - Editing a herb in Herb review now saves "Other names". sbUpdateHerb used to strip
//   other_names before saving (left over from when approved_herbs had no such column),
//   so the edit log recorded the names but the live herb page never showed them.
// - Approving a submission now copies its other names onto the published herb (sbPublish
//   left the field out).
//
// IBVU v6.12 — what changed in this file (security fix, with database step 4):
// - Herb review now writes and reads as the signed-in person, not with the site's public
//   key: submissions, approving and publishing herbs, editing, unpublishing and the edit
//   log (staffFetch). The database only lets herb reviewers (Owners, or people with the
//   herb review tick) do these, so the public key can no longer change herbs or read
//   submitters' email addresses.
// - The public Herbarium asks only for the columns it shows (PUBLIC_HERB_COLUMNS), never
//   the submitter's email or who edited it.
// - The edit log never stores a submitter's email address.
//
// ── Supabase config ───────────────────────────────────────────────────────
export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const SUPABASE_READY    = SUPABASE_URL && !SUPABASE_URL.startsWith("https://YOUR_");

export const SUBMISSIONS_KEY = "ibvu_submissions"; // localStorage fallback key

// v6.12: the signed-in person's own key (herb reviewers), for everything private.
async function staffHeaders(extra = {}) {
  const { getClient } = await import('./remote.js');
  const client = await getClient();
  const { data } = await client.auth.getSession();
  const token = data && data.session && data.session.access_token;
  if (!token) throw new Error("Please sign in again (your admin sign-in has ended).");
  return { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + token, ...extra };
}
function staffFetch(path, init = {}) {
  return staffHeaders(init.headers || {}).then(headers => fetch(SUPABASE_URL + "/rest/v1/" + path, { ...init, headers }));
}
// What the public Herbarium may read about a published herb.
export const PUBLIC_HERB_COLUMNS = "id,created_at,name,latin,category,origin,description,uses,conditions,color,pubmed_count,other_names";

// ── Paginated fetch — retrieves ALL rows regardless of table size ──────────
// asStaff: read as the signed-in herb reviewer (private columns and tables).
export async function sbFetchAll(table, query, asStaff = false) {
  const PAGE = 100;
  let offset = 0;
  let all = [];
  while (true) {
    const url = SUPABASE_URL + "/rest/v1/" + table + "?" + query +
                "&limit=" + PAGE + "&offset=" + offset;
    const res = await fetch(url, {
      headers: asStaff ? await staffHeaders() : { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
    });
    if (!res.ok) throw new Error("Supabase fetch failed: " + res.status);
    const rows = await res.json();
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// v6.16: Returns { ok } or { ok: false, status, error, oldServer }. oldServer is true when
// the server's site-forms function does not know herb submissions yet.
export async function sbSendSubmission(entry, turnstileToken, photo) {
  const body = {
    kind: "herb", turnstileToken,
    name: entry.name, otherNames: entry.otherNames, uses: entry.uses, country: entry.country,
    email: entry.email, consent: !!entry.consent, pubmedStatus: entry.status, pubmedCount: entry.paperCount,
    ...(entry.targetHerb ? { targetHerb: entry.targetHerb, targetName: entry.targetName || "", matchNote: entry.matchNote || "" } : {}),
    ...(photo ? { image: photo, permission: true } : {}),
  };
  try {
    const res = await fetch(SUPABASE_URL + "/functions/v1/site-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, status: res.status, error: data.error || "", oldServer: res.status === 400 && data.error === "Unknown request." };
  } catch {
    return { ok: false, status: 0, error: "Could not reach the website's server. Check your connection and try again." };
  }
}

export async function sbInsert(entry) {
  const row = {
    common_name:       entry.name,
    other_names:       entry.otherNames,
    traditional_uses:  entry.uses,
    country:           entry.country,
    email:             entry.email,
    consent:           entry.consent,
    pubmed_status:     entry.status,
    pubmed_count:      entry.paperCount,
  };
  // v6.15: additions to an existing herb (columns added by database step 5)
  const extra = entry.targetHerb ? {
    target_herb: entry.targetHerb.slice(0, 80),
    target_name: (entry.targetName || "").slice(0, 200),
    match_note:  (entry.matchNote || "").slice(0, 500),
  } : null;
  const post = body => fetch(SUPABASE_URL + "/rest/v1/submissions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(body),
  });
  let res = await post(extra ? { ...row, ...extra } : row);
  if (!res.ok && extra && res.status >= 400 && res.status < 500) {
    // Database step 5 not run yet: keep the herb it was meant for in the other names
    // column's note instead, so the reviewer still sees it.
    res = await post({ ...row, other_names: [row.other_names, "(additions to " + extra.target_name + ")"].filter(Boolean).join(" ") });
  }
  if (!res.ok) throw new Error("Supabase insert failed: " + res.status);
}

export async function sbFetch() {
  const rows = await sbFetchAll("submissions", "order=created_at.desc", true);
  return rows.map(function(r) {
    return {
      id:            r.id,
      timestamp:     r.created_at,
      name:          r.common_name,
      otherNames:    r.other_names || "",
      uses:          r.traditional_uses,
      country:       r.country,
      email:         r.email,
      consent:       r.consent,
      status:        r.pubmed_status,
      paperCount:    r.pubmed_count,
      review_status: r.review_status || "pending",
      targetHerb:    r.target_herb || "",
      targetName:    r.target_name || "",
      matchNote:     r.match_note || "",
    };
  });
}

export async function sbPublish(herbData) {
  const res = await staffFetch("approved_herbs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({
      submission_id:      herbData.submission_id,
      name:               herbData.name,
      latin:              herbData.latin,
      category:           herbData.category,
      origin:             herbData.origin,
      description:        herbData.description,
      other_names:        herbData.other_names || null,
      uses:               herbData.uses,
      conditions:         herbData.conditions,
      color:              herbData.color,
      pubmed_count:       herbData.pubmed_count,
      submitter_email:    herbData.submitter_email   || null,
      submitter_consent:  herbData.submitter_consent || false,
      emailed:            false,
    }),
  });
  if (!res.ok) throw new Error("Publish failed: " + res.status);
}

export async function sbFetchApprovedFull() {
  if (!SUPABASE_READY) return [];
  try {
    return await sbFetchAll("approved_herbs", "order=created_at.desc", true);
  } catch { return []; }
}

export async function sbUpdateHerb(id, updates, changedBy) {
  const payload = { ...updates, updated_at: new Date().toISOString(), updated_by: changedBy || null };
  const res = await staffFetch("approved_herbs?id=eq." + id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Update failed: " + res.status);
  sbLogHerbEdit(id, updates.name, "edit", changedBy, updates);
}

export async function sbUpdateReviewStatus(submissionId, status) {
  const res = await staffFetch("submissions?id=eq." + submissionId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({ review_status: status }),
  });
  if (!res.ok) throw new Error("Status update failed: " + res.status);
}

export async function sbMarkEmailed(id) {
  const res = await staffFetch("approved_herbs?id=eq." + id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({ emailed: true }),
  });
  if (!res.ok) throw new Error("sbMarkEmailed failed " + res.status);
}

// ── Audit trail ─────────────────────────────────────────────────────────────
export async function sbLogHerbEdit(herbId, herbName, action, changedBy, newValues) {
  if (!SUPABASE_READY) return;
  try {
    // never keep a submitter's email address in the log
    const { submitter_email, ...values } = newValues || {}; // eslint-disable-line no-unused-vars
    await staffFetch("herb_edits", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({
        herb_id:    herbId    || null,
        herb_name:  herbName  || "unknown",
        action:     action    || "edit",
        changed_by: changedBy || null,
        new_values: newValues ? values : null,
      }),
    });
  } catch (e) { console.warn("Audit log failed (non-fatal):", e); }
}

export async function sbUnpublishHerb(id, herbName, changedBy, record) {
  // Log first: once the herb is gone the log entry can no longer point at it.
  await sbLogHerbEdit(id, herbName || "unknown", "unpublish", changedBy, record ? { deleted_record: record } : null);
  const res = await staffFetch("approved_herbs?id=eq." + id, {
    method: "DELETE",
    headers: { "Prefer": "return=minimal" },
  });
  if (!res.ok) throw new Error("Unpublish failed: " + res.status);
}

export async function sbInsertStaticHerb(herbData, changedBy) {
  const res = await staffFetch("approved_herbs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify({
      name:        herbData.name,
      latin:       herbData.latin,
      category:    herbData.category,
      origin:      herbData.origin,
      description: herbData.description,
      other_names: herbData.other_names || null,
      uses:        herbData.uses,
      conditions:  herbData.conditions,
      color:       herbData.color,
      pubmed_count: herbData.pubmed_count || null,
      updated_at:  new Date().toISOString(),
      updated_by:  changedBy || null,
    }),
  });
  if (!res.ok) throw new Error("Insert failed: " + res.status);
  const rows = await res.json();
  const newRow = rows[0];
  sbLogHerbEdit(newRow.id, herbData.name, "promote", changedBy, herbData);
  return newRow;
}

export async function sbFetchApproved() {
  if (!SUPABASE_READY) return [];
  try {
    const rows = await sbFetchAll("approved_herbs", "select=" + PUBLIC_HERB_COLUMNS + "&order=created_at.asc");
    return rows.map(function(r, i) {
      return {
        id:          2000 + i,
        name:        r.name,
        latinName:   r.latin,
        category:    r.category || "Herbal Medicine",
        origin:      r.origin,
        description: r.description,
        uses:        Array.isArray(r.uses) ? r.uses : (r.uses || "").split(",").map(u => u.trim()).filter(Boolean),
        conditions:  Array.isArray(r.conditions) ? r.conditions : [],
        color:       r.color || "#a8c5a0",
        altNames:    (r.other_names || "").split(",").map(n => n.trim()).filter(Boolean),
        uuid:        r.id,
        ref:         "approved:" + r.id,
        pubmedCount: r.pubmed_count || 0,
      };
    });
  } catch { return []; }
}

export async function sbFetchStaticHerbs() {
  if (!SUPABASE_READY) return [];
  try {
    const rows = await sbFetchAll("static_herbs", "order=id.asc");
    return rows.map(function(r) {
      return {
        id:          r.id,
        name:        r.name,
        latinName:   r.latin_name || "",
        emoji:       r.emoji || "",
        family:      r.family || "",
        origin:      r.origin || "",
        partUsed:    r.part_used || "",
        category:    r.category || "",
        altNames:    Array.isArray(r.alt_names) ? r.alt_names : [],
        description: r.description || "",
        uses:        Array.isArray(r.uses) ? r.uses : [],
        conditions:  Array.isArray(r.conditions) ? r.conditions : [],
        papers:      [],
        ref:         "builtin:" + r.id,
      };
    });
  } catch (e) { console.warn("sbFetchStaticHerbs failed:", e); return []; }
}

// ── v6.15: merged herbs and "not a duplicate" pairs ─────────────────────────
// Which herbs have been merged into another. Everyone reads from_ref and into_ref; herb
// reviewers read the whole row (with the values kept for Undo). Before database step 5 is
// run there is no such table and this returns an empty list.
export async function sbFetchHerbMerges(asStaff = false) {
  if (!SUPABASE_READY) return [];
  try {
    return await sbFetchAll("herb_merges", asStaff ? "select=*&order=merged_at.desc" : "select=from_ref,into_ref", asStaff);
  } catch { return []; }
}
export async function sbAddMerge(row) {
  const res = await staffFetch("herb_merges", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(res.status === 404 ? "Merging needs database step 5 (see the build notes)." : "Merge failed: " + res.status);
}
export async function sbRemoveMerge(fromRef) {
  const res = await staffFetch("herb_merges?from_ref=eq." + encodeURIComponent(fromRef), { method: "DELETE", headers: { "Prefer": "return=minimal" } });
  if (!res.ok) throw new Error("Undo failed: " + res.status);
}
export async function sbFetchNotDuplicates() {
  if (!SUPABASE_READY) return [];
  try { return (await sbFetchAll("herb_not_duplicates", "select=pair", true)).map(r => r.pair); }
  catch { return []; }
}
export async function sbAddNotDuplicate(pair, changedBy) {
  const res = await staffFetch("herb_not_duplicates", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({ pair, created_by: changedBy || null }),
  });
  if (!res.ok) throw new Error(res.status === 404 ? "This needs database step 5 (see the build notes)." : "Could not save: " + res.status);
}
export async function sbRemoveNotDuplicate(pair) {
  const res = await staffFetch("herb_not_duplicates?pair=eq." + encodeURIComponent(pair), { method: "DELETE", headers: { "Prefer": "return=minimal" } });
  if (!res.ok) throw new Error("Could not save: " + res.status);
}
// Photos are kept by the herb's address (herb_key). When a herb is merged away, its approved
// photo moves to the kept herb if that herb has none.
export async function sbMoveHerbPhoto(fromKey, toKey, toName) {
  const res = await staffFetch("herb_photos?herb_key=eq." + encodeURIComponent(fromKey) + "&status=eq.approved", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({ herb_key: toKey, herb_name: toName }),
  });
  if (!res.ok) throw new Error("Moving the photo failed: " + res.status);
}
