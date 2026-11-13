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

export async function sbInsert(entry) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/submissions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify({
      common_name:       entry.name,
      other_names:       entry.otherNames,
      traditional_uses:  entry.uses,
      country:           entry.country,
      email:             entry.email,
      consent:           entry.consent,
      pubmed_status:     entry.status,
      pubmed_count:      entry.paperCount,
    }),
  });
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
  // approved_herbs has no other_names column — strip it before patching
  const { other_names, ...rest } = updates;
  const payload = { ...rest, updated_at: new Date().toISOString(), updated_by: changedBy || null };
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

export async function sbUnpublishHerb(id, herbName, changedBy) {
  const res = await staffFetch("approved_herbs?id=eq." + id, {
    method: "DELETE",
    headers: { "Prefer": "return=minimal" },
  });
  if (!res.ok) throw new Error("Unpublish failed: " + res.status);
  sbLogHerbEdit(id, herbName || "unknown", "unpublish", changedBy, null);
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
      uses:        herbData.uses,
      conditions:  herbData.conditions,
      color:       herbData.color,
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
      };
    });
  } catch (e) { console.warn("sbFetchStaticHerbs failed:", e); return []; }
}
