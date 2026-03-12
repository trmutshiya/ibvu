import { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { HERBS_FALLBACK } from '../constants/herbs.js';
import {
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_READY, SUBMISSIONS_KEY,
  sbFetch, sbFetchApprovedFull, sbFetchStaticHerbs,
  sbUpdateReviewStatus, sbMarkEmailed, sbUnpublishHerb,
} from '../lib/supabase.js';
import { gbifEnrich, sendApprovalEmail } from '../lib/edge.js';
import CompletionPanel from './CompletionPanel.jsx';
import EditPanel from './EditPanel.jsx';

export default function AdminPanel({ onBack }) {
  const [auth, setAuth]               = useState(false);
  const [adminEmail, setAdminEmail]   = useState("");
  const [otpStep, setOtpStep]         = useState("email");
  const [otpEmail, setOtpEmail]       = useState("");
  const [otpCode, setOtpCode]         = useState("");
  const [otpSending, setOtpSending]   = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMsg, setOtpMsg]           = useState("");
  const [subs, setSubs]               = useState([]);
  const [tab, setTab]                 = useState("pending");
  const [completing, setCompleting]   = useState(null);
  const [editing, setEditing]         = useState(null);
  const [editingIsStatic, setEditingIsStatic] = useState(false);
  const [approvedHerbsList, setApprovedHerbsList] = useState([]);
  const [staticHerbsList, setStaticHerbsList] = useState(HERBS_FALLBACK);
  const [enrichments, setEnrichments] = useState({});
  const [sendingEmailIds, setSendingEmailIds] = useState(new Set());

  async function enrichAll(submissions) {
    const pending = submissions.filter(s => !s.review_status || s.review_status === "pending");
    pending.forEach(function(s) {
      setEnrichments(prev => ({ ...prev, [s.id]: { loading: true } }));
      gbifEnrich(s.name).then(function(result) {
        setEnrichments(prev => ({ ...prev, [s.id]: result }));
      });
    });
  }

  async function loadSubs() {
    let rows = [];
    if (SUPABASE_READY) {
      try { rows = await sbFetch(); }
      catch (err) { console.error(err); rows = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || "[]"); }
    } else {
      rows = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || "[]");
    }
    setSubs(rows);
    enrichAll(rows);
  }

  async function sendOtp() {
    if (!otpEmail) { setOtpMsg("Please enter your email address."); return; }
    setOtpSending(true); setOtpMsg("");
    try {
      const res = await fetch(SUPABASE_URL + "/auth/v1/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: otpEmail, options: { shouldCreateUser: false } }),
      });
      if (!res.ok) {
        const d = await res.json();
        setOtpMsg(d.msg || d.error_description || "Failed to send code. Check the email address.");
      } else {
        setOtpStep("code");
      }
    } catch { setOtpMsg("Network error. Try again."); }
    setOtpSending(false);
  }

  async function verifyOtp() {
    if (!otpCode || otpCode.length < 4) { setOtpMsg("Enter the login code from your email."); return; }
    setOtpVerifying(true); setOtpMsg("");
    try {
      const res = await fetch(SUPABASE_URL + "/auth/v1/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ type: "email", token: otpCode, email: otpEmail }),
      });
      if (!res.ok) {
        const d = await res.json();
        setOtpMsg(d.msg || d.error_description || "Invalid or expired code. Try again.");
      } else {
        setAuth(true);
        setAdminEmail(otpEmail);
        await loadSubs();
        sbFetchApprovedFull().then(rows => setApprovedHerbsList(rows)).catch(() => {});
        sbFetchStaticHerbs().then(rows => { if (rows.length > 0) setStaticHerbsList(rows); }).catch(() => {});
      }
    } catch { setOtpMsg("Network error. Try again."); }
    setOtpVerifying(false);
  }

  async function handleReject(sub) {
    if (!window.confirm("Reject submission for " + sub.name + "?")) return;
    try {
      await sbUpdateReviewStatus(sub.id, "rejected");
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, review_status: "rejected" } : s));
    } catch (err) { alert("Reject failed: " + err.message); }
  }

  function handleApprove(sub) { setCompleting(sub); }

  async function handlePublished() {
    setCompleting(null);
    setSubs(prev => prev.map(s => s.id === completing?.id ? { ...s, review_status: "approved" } : s));
    sbFetchApprovedFull().then(rows => setApprovedHerbsList(rows)).catch(() => {});
  }

  function handleEdit(herb, isStatic) {
    setEditing(herb);
    setEditingIsStatic(isStatic || false);
  }

  function handleSaved(updatedHerb) {
    setEditing(null);
    setEditingIsStatic(false);
    if (updatedHerb._promoted) {
      sbFetchApprovedFull().then(rows => setApprovedHerbsList(rows)).catch(() => {});
    } else {
      setApprovedHerbsList(prev => prev.map(h => h.id === updatedHerb.id ? updatedHerb : h));
    }
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const headers = ["Date", "Herb Name", "Other Names", "Traditional Uses", "Country", "Email", "Consent to Contact", "Evidence Status", "PubMed Papers"];
    const rows = subs.map(s => [
      new Date(s.timestamp).toLocaleDateString("en-GB"),
      s.name, s.otherNames || "—", s.uses, s.country, s.email,
      s.consent ? "Yes" : "No",
      s.status === "pending" ? "Evidence Found" : "Insufficient Evidence",
      s.paperCount,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    headers.forEach((_, ci) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (!ws[ref]) ws[ref] = { v: headers[ci], t: "s" };
      ws[ref].s = {
        font:  { bold: true, color: { rgb: "F5F0E8" } },
        fill:  { patternType: "solid", fgColor: { rgb: "3C2C1E" } },
        alignment: { horizontal: "center" },
      };
    });
    subs.forEach((s, ri) => {
      const row = ri + 1;
      const cRef = XLSX.utils.encode_cell({ r: row, c: 6 });
      if (ws[cRef]) ws[cRef].s = {
        fill: { patternType: "solid", fgColor: { rgb: s.consent ? "C8E6C9" : "FFCDD2" } },
        font: { color: { rgb: s.consent ? "1B5E20" : "B71C1C" } },
        alignment: { horizontal: "center" },
      };
      const eRef = XLSX.utils.encode_cell({ r: row, c: 7 });
      if (ws[eRef]) ws[eRef].s = {
        fill: { patternType: "solid", fgColor: { rgb: s.status === "pending" ? "C8E6C9" : "FFF9C4" } },
        font: { color: { rgb: s.status === "pending" ? "1B5E20" : "E65100" } },
      };
      const pRef = XLSX.utils.encode_cell({ r: row, c: 8 });
      if (ws[pRef]) ws[pRef].s = { alignment: { horizontal: "center" } };
    });
    ws["!cols"] = [
      { wch: 12 }, { wch: 22 }, { wch: 24 }, { wch: 36 },
      { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Herb Submissions");
    XLSX.writeFile(wb, "ibvu-herb-submissions.xlsx");
  }

  const total     = subs.length;
  const withEvid  = subs.filter(s => s.status === "pending").length;
  const consented = subs.filter(s => s.consent).length;
  const countries = new Set(subs.map(s => s.country)).size;
  const pendingCount  = subs.filter(s => !s.review_status || s.review_status === "pending").length;
  const approvedCount = subs.filter(s => s.review_status === "approved").length;
  const rejectedCount = subs.filter(s => s.review_status === "rejected").length;
  const tabSubs = subs.filter(s => {
    if (tab === "pending")  return !s.review_status || s.review_status === "pending";
    if (tab === "approved") return s.review_status === "approved";
    if (tab === "rejected") return s.review_status === "rejected";
    return true;
  });
  const dupNameCount = {};
  subs.filter(s => !s.review_status || s.review_status === "pending").forEach(s => {
    const key = (s.name || "").toLowerCase().trim();
    dupNameCount[key] = (dupNameCount[key] || 0) + 1;
  });

  if (!auth) {
    return (
      <div className="admin-login-wrap">
        <div className="admin-login-box">
          <h2>Admin Access</h2>
          <p>Herbarium Scientifica — Submission Review</p>
          {otpStep === "email" ? (
            <>
              <input
                type="email"
                value={otpEmail}
                onChange={e => setOtpEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendOtp()}
                placeholder="Admin email address"
                autoComplete="email"
              />
              {otpMsg && <div className="error-msg">{otpMsg}</div>}
              <button className="admin-login-btn" onClick={sendOtp} disabled={otpSending}>
                {otpSending ? "Sending…" : "Send Login Code →"}
              </button>
            </>
          ) : (
            <>
              <p style={{fontSize:"0.8rem",color:"var(--sage)",marginBottom:"16px"}}>
                Code sent to {otpEmail}
              </p>
              <input
                type="text"
                maxLength={10}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.trim())}
                onKeyDown={e => e.key === "Enter" && verifyOtp()}
                placeholder="Login code"
                style={{letterSpacing:"6px", textAlign:"center", fontSize:"1.2rem"}}
                autoFocus
              />
              {otpMsg && <div className="error-msg">{otpMsg}</div>}
              <button className="admin-login-btn" onClick={verifyOtp} disabled={otpVerifying}>
                {otpVerifying ? "Verifying…" : "Verify Code →"}
              </button>
              <button className="admin-back-link" style={{marginBottom:"8px"}}
                onClick={() => { setOtpStep("email"); setOtpMsg(""); setOtpCode(""); }}>
                ← Different email
              </button>
            </>
          )}
          <button className="admin-back-link" onClick={onBack}>← Back to Herbarium</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-wrap">
        <div className="admin-topbar">
          <div className="admin-topbar-left">
            <div>
              <div className="admin-eyebrow">Herbarium Scientifica</div>
              <h2>Submission Review</h2>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {SUPABASE_READY
              ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1, color: "#388e3c" }}>● Supabase connected</span>
              : <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1, color: "#e65100" }}>● localStorage mode</span>
            }
            {SUPABASE_READY && (
              <button className="admin-btn outline" onClick={async () => {
                try { const rows = await sbFetch(); setSubs(rows); } catch (e) { console.error(e); }
              }}>↻ Refresh</button>
            )}
            <button className="admin-btn solid" onClick={exportExcel}>↓ Export to Excel</button>
            <button className="admin-btn outline" onClick={onBack}>← Exit Admin</button>
          </div>
        </div>

        <div className="admin-stats">
          <div className="stat-card"><div className="stat-num">{total}</div><div className="stat-label">Total Submissions</div></div>
          <div className="stat-card"><div className="stat-num">{withEvid}</div><div className="stat-label">Evidence Found</div></div>
          <div className="stat-card"><div className="stat-num">{consented}</div><div className="stat-label">Consent to Contact</div></div>
          <div className="stat-card"><div className="stat-num">{countries}</div><div className="stat-label">Countries</div></div>
        </div>

        <div className="admin-tab-bar">
          <button className={"admin-tab" + (tab === "pending"  ? " active" : "")} onClick={() => setTab("pending")}>Pending · {pendingCount}</button>
          <button className={"admin-tab" + (tab === "approved" ? " active" : "")} onClick={() => setTab("approved")}>Approved · {approvedCount}</button>
          <button className={"admin-tab" + (tab === "rejected" ? " active" : "")} onClick={() => setTab("rejected")}>Rejected · {rejectedCount}</button>
          <button className={"admin-tab" + (tab === "contacts" ? " active" : "")} onClick={() => setTab("contacts")} style={{ borderLeft: "2px solid var(--sage)" }}>✉ Contacts · {subs.filter(s => s.consent).length}</button>
          <button className={"admin-tab" + (tab === "library" ? " active" : "")} onClick={() => setTab("library")} style={{ borderLeft: "2px solid var(--sage)", marginLeft: "auto" }}>📚 Library · {staticHerbsList.length + approvedHerbsList.length}</button>
        </div>

        <div className="admin-table-wrap">
          {tab === "library" ? (
            <table className="admin-table">
              <thead><tr><th>#</th><th>Common Name</th><th>Latin Name</th><th>Category</th><th>Origin</th><th>Source</th><th>Actions</th></tr></thead>
              <tbody>
                {[...staticHerbsList, ...approvedHerbsList].map((h, idx) => {
                  const isStatic = typeof h.id === "number" && h.id < 2000;
                  return (
                    <tr key={h.id}>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.78rem", color: "var(--muted)", width: 40 }}>{idx + 1}</td>
                      <td style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>{h.name}</td>
                      <td style={{ fontStyle: "italic", color: "var(--muted)", fontSize: "0.85rem" }}>{h.latin || h.latinName || "—"}</td>
                      <td style={{ fontSize: "0.85rem" }}>{h.category || "—"}</td>
                      <td style={{ fontSize: "0.85rem", color: "var(--muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.origin || "—"}</td>
                      <td>{isStatic ? <span className="badge amber">Built-in</span> : <span className="badge green">Supabase</span>}</td>
                      <td><button className="approve-btn" onClick={() => handleEdit(h, isStatic)}>✎ Edit</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : tab === "approved" ? (
            approvedHerbsList.length === 0 ? (
              <div className="admin-empty">No approved herbs yet.</div>
            ) : (
              <table className="admin-table">
                <thead><tr><th>Common Name</th><th>Latin Name</th><th>Category</th><th>Origin</th><th>Conditions</th><th>Email Submitter</th><th>Actions</th></tr></thead>
                <tbody>
                  {approvedHerbsList.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>{h.name}</td>
                      <td style={{ fontStyle: "italic", color: "var(--muted)", fontSize: "0.85rem" }}>{h.latin || "—"}</td>
                      <td style={{ fontSize: "0.85rem" }}>{h.category || "—"}</td>
                      <td style={{ fontSize: "0.85rem" }}>{h.origin || "—"}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                        {(h.conditions || []).slice(0, 3).join(", ")}{(h.conditions || []).length > 3 ? "…" : ""}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {h.submitter_consent && h.submitter_email
                          ? h.emailed
                            ? <span className="badge green">✉ Sent</span>
                            : <button
                                className="approve-btn"
                                disabled={sendingEmailIds.has(h.id)}
                                onClick={async () => {
                                  if (h.emailed || sendingEmailIds.has(h.id)) return;
                                  if (!window.confirm("Send approval email to " + h.submitter_email + "?")) return;
                                  setSendingEmailIds(prev => { const s = new Set(prev); s.add(h.id); return s; });
                                  try {
                                    await sbMarkEmailed(h.id);
                                    setApprovedHerbsList(prev => prev.map(x => x.id === h.id ? { ...x, emailed: true } : x));
                                    await sendApprovalEmail(h.submitter_email, h.name);
                                  } catch (err) {
                                    alert("Email failed: " + err.message);
                                  } finally {
                                    setSendingEmailIds(prev => { const s = new Set(prev); s.delete(h.id); return s; });
                                  }
                                }}>
                                {sendingEmailIds.has(h.id) ? "Sending…" : "✉ Send Email"}
                              </button>
                          : <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>No consent</span>
                        }
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="approve-btn" onClick={() => handleEdit(h)} style={{ marginRight: 6 }}>✎ Edit</button>
                        <button className="reject-btn" onClick={async () => {
                          if (!window.confirm("Unpublish " + h.name + "?")) return;
                          try {
                            await sbUnpublishHerb(h.id, h.name, adminEmail);
                            setApprovedHerbsList(prev => prev.filter(x => x.id !== h.id));
                          } catch (err) { alert("Unpublish failed: " + err.message); }
                        }}>✕ Unpublish</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === "contacts" ? (
            subs.filter(s => s.consent).length === 0 ? (
              <div className="admin-empty">No submissions with consent to contact yet.</div>
            ) : (
              <table className="admin-table">
                <thead><tr><th>Date</th><th>Herb</th><th>Uses</th><th>Country</th><th>Email</th><th>Status</th></tr></thead>
                <tbody>
                  {subs.filter(s => s.consent).map(s => {
                    const rs = s.review_status;
                    return (
                      <tr key={s.id}>
                        <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: "0.82rem" }}>{new Date(s.timestamp).toLocaleDateString("en-GB")}</td>
                        <td style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>{s.name}</td>
                        <td style={{ fontSize: "0.85rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{s.uses}</td>
                        <td>{s.country}</td>
                        <td style={{ fontSize: "0.85rem" }}><a href={"mailto:" + s.email} style={{ color: "var(--bark)" }}>{s.email}</a></td>
                        <td><span className={"badge " + (rs === "approved" ? "green" : rs === "rejected" ? "red" : "amber")}>{rs === "approved" ? "✓ Approved" : rs === "rejected" ? "✕ Rejected" : "⏳ Pending"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            tabSubs.length === 0 ? (
              <div className="admin-empty">{tab === "pending" ? "No pending submissions." : "No rejected submissions."}</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Herb Name</th><th>Other Names</th>
                    {tab === "pending" && <th>Latin Name · Synonyms (GBIF)</th>}
                    <th>Uses</th><th>Country</th><th>Email</th><th>Contact</th><th>Evidence</th><th>Papers</th>
                    {tab === "pending" && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {tabSubs.map(s => {
                    const enr = enrichments[s.id] || {};
                    return (
                      <tr key={s.id}>
                        <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: "0.82rem" }}>{new Date(s.timestamp).toLocaleDateString("en-GB")}</td>
                        <td style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
                          {s.name}
                          {dupNameCount[(s.name || "").toLowerCase().trim()] > 1 && (
                            <span style={{ marginLeft: 7, fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: 1, background: "#e65100", color: "#fff", borderRadius: 3, padding: "1px 5px", verticalAlign: "middle" }}>⚠ DUPE</span>
                          )}
                        </td>
                        <td style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "0.85rem" }}>{s.otherNames || "—"}</td>
                        {tab === "pending" && (
                          <td style={{ minWidth: 160 }}>
                            {enr.loading
                              ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", letterSpacing: 1 }}>looking up…</span>
                              : enr.latin
                              ? <div>
                                  <div style={{ fontStyle: "italic", fontFamily: "'Playfair Display', serif", fontSize: "0.85rem", color: "var(--bark)" }}>{enr.latin}</div>
                                  {(enr.otherNames || []).length > 0 && (
                                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>{enr.otherNames.join(" · ")}</div>
                                  )}
                                </div>
                              : <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted)", letterSpacing: 1 }}>no match</span>
                            }
                          </td>
                        )}
                        <td style={{ fontSize: "0.85rem", maxWidth: 200 }}>{s.uses}</td>
                        <td>{s.country}</td>
                        <td style={{ fontSize: "0.85rem" }}>{s.email}</td>
                        <td><span className={"badge " + (s.consent ? "green" : "red")}>{s.consent ? "✓ Yes" : "✗ No"}</span></td>
                        <td><span className={"badge " + (s.status === "pending" ? "green" : "amber")}>{s.status === "pending" ? "✓ Evidence" : "⚠ Flagged"}</span></td>
                        <td style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: "0.85rem" }}>{s.paperCount}</td>
                        {tab === "pending" && (
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button className="approve-btn" onClick={() => handleApprove(s)} style={{ marginRight: 6 }}>Approve</button>
                            <button className="reject-btn" onClick={() => handleReject(s)}>Reject</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>

        {completing && (
          <CompletionPanel
            submission={completing}
            onPublish={handlePublished}
            onCancel={() => setCompleting(null)}
            adminEmail={adminEmail}
          />
        )}

        {editing && (
          <EditPanel
            herb={editing}
            isStatic={editingIsStatic}
            adminEmail={adminEmail}
            onSave={handleSaved}
            onCancel={() => { setEditing(null); setEditingIsStatic(false); }}
          />
        )}
      </div>
    </div>
  );
}
