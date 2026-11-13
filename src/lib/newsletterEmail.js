// IBVU v6.03 — new file. How a newsletter looks as an email.
//
// Used by admin's "Preview as email". The server's send-newsletter function
// has its own copy of this layout (supabase/functions/send-newsletter), so if
// one is changed the other should be changed to match.
//
// Email programs (Gmail, Outlook, phones) ignore most page styling, so the
// layout is one simple column with the styles written onto each element.
export const SITE_URL = "https://ibvu.org";

const C = { bark: "#3d2c1e", text: "#2c1810", muted: "#6c6354", sage: "#4d6b4d", cream: "#f5f0e8", line: "#e3d9c6" };

function esc(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// Puts email-safe styles on the article's own HTML.
export function styleForEmail(html) {
  return String(html || "")
    .replace(/<p>/g, `<p style="margin:0 0 16px;font-size:17px;line-height:1.65;color:${C.text}">`)
    .replace(/<h2>/g, `<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;line-height:1.3;color:${C.bark};margin:28px 0 12px">`)
    .replace(/<h3>/g, `<h3 style="font-family:Georgia,serif;font-weight:normal;font-size:20px;line-height:1.3;color:${C.bark};margin:24px 0 10px">`)
    .replace(/<blockquote>/g, `<blockquote style="margin:18px 0;padding:4px 0 4px 16px;border-left:3px solid ${C.sage};color:${C.muted};font-style:italic">`)
    .replace(/<ul>/g, `<ul style="margin:0 0 16px 22px;padding:0;font-size:17px;line-height:1.65;color:${C.text}">`)
    .replace(/<ol>/g, `<ol style="margin:0 0 16px 22px;padding:0;font-size:17px;line-height:1.65;color:${C.text}">`)
    .replace(/<img /g, `<img style="display:block;max-width:100%;height:auto;border:0;margin:8px 0 14px" `)
    .replace(/<a /g, `<a style="color:${C.sage};text-decoration:underline" `);
}

// issue: { title, previewText, cover, body }; links: { viewUrl, unsubscribeUrl }
// logoUrl: admin's preview passes its own copy of the logo, so the preview shows it
// before the site with /email-logo.png is live.
export function buildNewsletterEmail(issue, { viewUrl = "", unsubscribeUrl = "#", logoUrl = SITE_URL + "/email-logo.png" } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(issue.title)}</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(issue.previewText)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line}">
${viewUrl ? `<tr><td style="padding:10px 28px;font-family:Arial,sans-serif;font-size:12px;color:${C.muted};text-align:right;border-bottom:1px solid ${C.line}"><a href="${esc(viewUrl)}" style="color:${C.muted}">View in your browser</a></td></tr>` : ""}
<tr><td align="center" style="padding:28px 28px 8px"><img src="${esc(logoUrl)}" width="96" height="96" alt="IBVU" style="display:block;border:0"></td></tr>
<tr><td style="padding:8px 28px 0;font-family:Georgia,serif">
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:30px;line-height:1.25;color:${C.bark};margin:12px 0 18px;text-align:center">${esc(issue.title)}</h1>
${issue.cover ? `<img src="${esc(issue.cover)}" alt="" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;margin:0 0 22px">` : ""}
${styleForEmail(issue.body)}
</td></tr>
<tr><td style="padding:22px 28px 28px;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:${C.muted};border-top:1px solid ${C.line}">
IBVU &middot; Regulate &middot; Educate &middot; Innovate &middot; <a href="${SITE_URL}" style="color:${C.muted}">ibvu.org</a><br>
You are receiving this because you subscribed at ibvu.org. <a href="${esc(unsubscribeUrl)}" style="color:${C.muted}">Unsubscribe or change what you receive</a>.
</td></tr>
</table></td></tr></table></body></html>`;
}
