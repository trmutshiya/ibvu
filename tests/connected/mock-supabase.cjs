// IBVU v6.12 — what changed in this file: the old herb tables follow the new rules
// (database step 4): only herb reviewers read submissions and the edit log and change
// published herbs; visitors may only send a submission and read the public columns of
// published herbs. Stand-ins for send-approval-email and generate-description that only
// herb reviewers may use.
// IBVU v6.11 — what changed in this file: the review tables (article_reviews,
// article_comments), their two read functions, a stand-in article-review function (same
// rules and emails as the real one) and the rule that a Writer cannot change an article
// while it is waiting for review.
// IBVU v6.03 — what changed in this file: newsletter tables (issues, who received them,
// reminder addresses and settings), draft changes, the list-count and show/hide functions,
// and a stand-in send-newsletter function (test, send, tick). Emails it would send are kept
// in a list the checks can read (/__emails); nothing is emailed.
// IBVU v6.02 — what changed in this file: the stand-in site-forms function handles mailing
// lists (choose lists, Confirm link, unsubscribe link) like the real one.
// IBVU v6.0 — new file. A stand-in for Supabase (sign-in, tables, picture store and the two
// server functions), used only by "npm run test:connected". It keeps everything in memory.
// Its rules are a simplified copy of the real database rules; the real rules were tested
// separately in Supabase (see supabase/step1_rules_test.sql).
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4400);
const log = [];
const users = {};      // email -> { id, email }
const tokens = {};     // access token -> email
const db = {
  site_people: [], site_events: [], site_articles: [], site_pages: [], site_history: [],
  herb_photos: [], contact_messages: [], newsletter_signups: [],
  approved_herbs: [], static_herbs: [], submissions: [], herb_edits: [],
  newsletter_issues: [], newsletter_sends: [], admin_reminder_recipients: [], content_drafts: [],
  article_reviews: [], article_comments: [],
  newsletter_reminder_settings: [{ id: 1, due_enabled: true, due_day: 25, due_list: 'monthly', before_enabled: true, before_hours: 24, after_enabled: true }],
};
const emails = []; // what send-newsletter would have emailed
const store = {};      // "bucket/path" -> { type, data }
const failTitles = new Set(['FAIL-ME']);

function addUser(email) { if (!users[email]) users[email] = { id: crypto.randomUUID(), email }; return users[email]; }
function addPerson(email, role, herb_review = false) {
  addUser(email);
  db.site_people.push({ id: crypto.randomUUID(), email, role, herb_review: role === 'owner' || herb_review, created_at: new Date().toISOString() });
}
addPerson('owner@example.org', 'owner');
addUser('stranger@example.org');

const b64u = s => Buffer.from(s).toString('base64url');
function makeSession(email) {
  const u = users[email];
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ sub: u.id, email, role: 'authenticated', aud: 'authenticated', exp, iat: exp - 3600 })) + '.sig' + crypto.randomBytes(6).toString('hex');
  tokens[access] = email;
  const refresh = 'r-' + crypto.randomBytes(8).toString('hex');
  tokens[refresh] = email;
  const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: new Date().toISOString(), last_sign_in_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: refresh, user };
}

function caller(req) {
  const h = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const email = tokens[h];
  if (!email) return { anon: true };
  const person = db.site_people.find(p => p.email === email);
  return { email, role: person ? person.role : null, review: !!(person && (person.role === 'owner' || person.herb_review)) };
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('Access-Control-Expose-Headers', 'content-range, x-supabase-api-version');
}
function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body === undefined ? '' : (type === 'application/json' ? JSON.stringify(body) : body));
}

// Which rows a caller may see.
function visible(table, rows, who) {
  const staff = !!who.role;
  switch (table) {
    case 'site_events': case 'site_articles': return staff ? rows : rows.filter(r => r.status === 'published');
    case 'herb_photos': return who.review ? rows : rows.filter(r => r.status === 'approved');
    case 'site_people': return who.role === 'owner' ? rows : rows.filter(r => r.email === who.email);
    case 'site_history': return (who.role === 'owner' || who.role === 'editor') ? rows : null;
    case 'contact_messages': case 'newsletter_signups': return who.role === 'owner' ? rows : null;
    case 'newsletter_issues': return (who.role === 'owner' || who.role === 'editor') ? rows : rows.filter(r => r.status === 'sent' && r.show_on_site);
    case 'newsletter_sends': case 'admin_reminder_recipients': case 'newsletter_reminder_settings': return who.role === 'owner' ? rows : null;
    case 'content_drafts': return staff ? rows : null;
    case 'article_reviews': case 'article_comments': return null;   // only through the functions
    case 'submissions': case 'herb_edits': return who.review ? rows : null;   // v6.12
    default: return rows;
  }
}
function filterRows(rows, params) {
  let out = rows.slice();
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const m = /^(eq|neq|in)\.(.*)$/.exec(v);
    if (!m) continue;
    if (m[1] === 'eq') out = out.filter(r => String(r[k]) === decodeURIComponent(m[2]));
    if (m[1] === 'neq') out = out.filter(r => String(r[k]) !== decodeURIComponent(m[2]));
    if (m[1] === 'in') { const set = m[2].replace(/^\(|\)$/g, '').split(','); out = out.filter(r => set.includes(String(r[k]))); }
  }
  const order = params.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    out.sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (dir === 'desc' ? -1 : 1));
  }
  const limit = params.get('limit'); if (limit) out = out.slice(0, Number(limit));
  return out;
}
const KEYS = { site_pages: 'key', newsletter_signups: 'email' };
function defaults(table, row) {
  const nowIso = new Date().toISOString();
  const r = { ...row };
  if (!KEYS[table] && !r.id) r.id = crypto.randomUUID();
  if (table !== 'site_pages' && !r.created_at) r.created_at = nowIso;
  if (table === 'newsletter_issues') { if (!r.status) r.status = 'draft'; if (r.recipients == null) r.recipients = 0; if (r.failures == null) r.failures = 0; }
  if (table === 'site_history' && !r.at) r.at = nowIso;
  return r;
}

function body(req) {
  return new Promise(resolve => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); });
}

http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const raw = await body(req);
  let json = null; try { json = raw.length ? JSON.parse(raw.toString()) : null; } catch { /* binary */ }
  const who = caller(req);
  log.push({ method: req.method, path: p + url.search, who: who.email || 'anon', body: raw.length < 2000 ? raw.toString() : '[' + raw.length + ' bytes]' });

  // test helpers
  if (p === '/__log') return send(res, 200, log);
  if (p === '/__db') return send(res, 200, { db, store: Object.keys(store), users: Object.keys(users) });
  if (p === '/__emails') return send(res, 200, emails);

  // ── database functions
  if (p === '/rest/v1/rpc/newsletter_list_counts') {
    if (!['owner', 'editor'].includes(who.role)) return send(res, 200, {});
    const counts = {};
    db.newsletter_signups.filter(s => !s.unsubscribed_at).forEach(s => s.lists.forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
    return send(res, 200, counts);
  }
  if (p === '/rest/v1/rpc/article_reviews_list') {
    if (!who.role) return send(res, 200, []);
    return send(res, 200, db.article_reviews.map(r => ({ article_id: r.article_id, state: r.state, note: r.note, sent_at: r.sent_at, back_note: r.back_note, back_by: r.back_by, log: r.log, updated_at: r.updated_at, sent_by_me: r.writer_email === who.email })));
  }
  if (p === '/rest/v1/rpc/article_comments_list') {
    if (!who.role) return send(res, 200, []);
    return send(res, 200, db.article_comments.map(c => ({ id: c.id, article_id: c.article_id, parent_id: c.parent_id, author_role: c.author_role, quote: c.quote, mark_id: c.mark_id, body: c.body, resolved: c.resolved, created_at: c.created_at, mine: c.author_email === who.email })));
  }
  if (p === '/rest/v1/rpc/newsletter_set_visible') {
    if (who.role !== 'owner') return send(res, 403, { code: '42501', message: 'Only Owners can do this.' });
    const n = db.newsletter_issues.find(x => x.id === json.issue && x.status === 'sent');
    if (n) n.show_on_site = !!json.visible;
    return send(res, 200, null);
  }

  // ── auth
  if (p === '/auth/v1/otp') {
    if (!users[(json.email || '').toLowerCase()]) return send(res, 422, { code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' });
    return send(res, 200, {});
  }
  if (p === '/auth/v1/verify') {
    const email = (json.email || '').toLowerCase();
    if (!users[email] || json.token !== '654321') return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    return send(res, 200, makeSession(email));
  }
  if (p === '/auth/v1/token') {
    const email = tokens[json && json.refresh_token];
    if (!email) return send(res, 400, { error: 'invalid_grant' });
    return send(res, 200, makeSession(email));
  }
  if (p === '/auth/v1/user') {
    if (!who.email) return send(res, 401, { msg: 'not signed in' });
    return send(res, 200, makeSession(who.email).user);
  }
  if (p === '/auth/v1/logout') { res.writeHead(204); return res.end(); }

  // ── functions
  if (p === '/functions/v1/verify-turnstile') return send(res, 200, { success: json && json.token === 'test-token' });
  if (p === '/functions/v1/pubmed-proxy') return send(res, 200, { esearchresult: { count: '3', idlist: [] } });
  if (p.startsWith('/functions/v1/gbif-proxy') || p.startsWith('/functions/v1/pubmed-screen')) return send(res, 200, {});
  if (p === '/functions/v1/site-forms') {
    const LISTS = ['monthly', 'mailclub', 'business', 'research'];
    const FOR = { general: 'monthly', advisory: 'business', research: 'research', partnerships: 'research', shop: 'mailclub', events: 'mailclub', media: 'monthly' };
    const addTo = (email, first, last, wanted, source) => {
      email = email.toLowerCase();
      let r = db.newsletter_signups.find(x => x.email === email);
      const lists = wanted.filter(k => LISTS.includes(k));
      if (!r) { r = defaults('newsletter_signups', { email, first_name: first || '', last_name: last || '', lists: [], pending_lists: [], source, confirmed_at: null, unsubscribed_at: null, confirm_token: crypto.randomUUID(), unsubscribe_token: crypto.randomUUID() }); db.newsletter_signups.push(r); }
      const add = lists.filter(k => !r.lists.includes(k));
      r.pending_lists = [...new Set([...r.pending_lists, ...add])];
      return add.length > 0;
    };
    const byToken = (col, tok) => db.newsletter_signups.find(x => x[col] === tok);
    if (json && json.kind === 'confirm') {
      const r = byToken('confirm_token', json.token); if (!r) return send(res, 404, { ok: false, error: 'This confirm link is not valid.' });
      r.lists = [...new Set([...r.lists, ...r.pending_lists])]; r.pending_lists = []; r.confirmed_at = new Date().toISOString(); r.unsubscribed_at = null;
      return send(res, 200, { ok: true, lists: r.lists });
    }
    if (json && json.kind === 'unsubscribe-info') {
      const r = byToken('unsubscribe_token', json.token); if (!r) return send(res, 404, { ok: false, error: 'This unsubscribe link is not valid.' });
      return send(res, 200, { ok: true, email: r.email.slice(0, 2) + '***@' + r.email.split('@')[1], lists: r.lists });
    }
    if (json && json.kind === 'unsubscribe') {
      const r = byToken('unsubscribe_token', json.token); if (!r) return send(res, 404, { ok: false, error: 'This unsubscribe link is not valid.' });
      r.lists = r.lists.filter(k => (json.keep || []).includes(k)); r.pending_lists = []; r.unsubscribed_at = r.lists.length ? null : new Date().toISOString();
      return send(res, 200, { ok: true, lists: r.lists });
    }
    if (!json || json.turnstileToken !== 'test-token') return send(res, 403, { ok: false, error: 'The security check did not pass. Please try again.' });
    if (json.kind === 'contact') {
      const wants = json.wantsUpdates === true && !!FOR[json.type];
      db.contact_messages.push(defaults('contact_messages', { name: json.name, email: json.email, organisation: json.organisation || '', enquiry_type: json.type || '', message: json.message, wants_updates: wants }));
      const confirmSent = wants ? addTo(json.email, json.name, '', [FOR[json.type]], 'contact form') : false;
      return send(res, 200, { ok: true, emailed: false, confirmSent });
    }
    if (json.kind === 'newsletter') {
      const confirmSent = addTo(json.email, json.firstName, json.lastName, json.lists || ['monthly'], json.source || 'newsletter box');
      return send(res, 200, { ok: true, confirmSent });
    }
    if (json.kind === 'herb-photo') {
      const m = /^data:(image\/\w+);base64,(.+)$/.exec(json.image || '');
      if (!m || json.permission !== true) return send(res, 400, { ok: false, error: 'bad photo' });
      const path = crypto.randomUUID() + '.jpg';
      store['herb-photo-submissions/' + path] = { type: m[1], data: Buffer.from(m[2], 'base64') };
      db.herb_photos.push(defaults('herb_photos', { herb_key: json.herbName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), herb_name: json.herbName, image_path: path, status: 'pending', source: 'submission', permission: true }));
      return send(res, 200, { ok: true });
    }
    return send(res, 400, { ok: false, error: 'Unknown request.' });
  }
  if (p === '/functions/v1/send-newsletter') {
    const SITE = 'https://ibvu.org';
    const sendIssue = (n, by) => {
      const people = db.newsletter_signups.filter(s => !s.unsubscribed_at && s.lists.some(k => n.lists.includes(k)));
      const at = new Date().toISOString();
      for (const s of people) {
        emails.push({ to: s.email, subject: n.subject, unsubscribe: SITE + '/unsubscribe?t=' + s.unsubscribe_token });
        db.newsletter_sends.push(defaults('newsletter_sends', { issue_id: n.id, email: s.email, status: 'sent', error: null, sent_at: at }));
      }
      Object.assign(n, { status: 'sent', sent_at: at, sent_by: by, recipients: people.length, failures: 0, updated_at: at });
      const to = db.admin_reminder_recipients.map(r => r.email);
      if (to.length) emails.push({ to: to.join(','), subject: 'IBVU admin: Newsletter sent: ' + n.subject });
      return people.length;
    };
    if (json && json.action === 'tick') {
      let sent = 0;
      for (const n of db.newsletter_issues.filter(x => x.status === 'scheduled' && x.send_at <= new Date().toISOString())) { sendIssue(n, 'Owner (scheduled)'); sent++; }
      return send(res, 200, { ok: true, sent });
    }
    if (!who.role) return send(res, 401, { ok: false, error: 'Please sign in.' });
    const n = db.newsletter_issues.find(x => x.id === (json && json.issueId));
    if (!n) return send(res, 404, { ok: false, error: 'Newsletter not found.' });
    if (json.action === 'test') {
      if (!['owner', 'editor'].includes(who.role)) return send(res, 403, { ok: false, error: 'Only Owners and Editors can send tests.' });
      emails.push({ to: who.email, subject: '[Test] ' + (n.subject || n.title) });
      return send(res, 200, { ok: true, to: who.email });
    }
    if (json.action === 'send') {
      if (who.role !== 'owner') return send(res, 403, { ok: false, error: 'Only an Owner can send newsletters.' });
      if (!['draft', 'scheduled'].includes(n.status)) return send(res, 409, { ok: false, error: 'This newsletter has already been sent or is being sent.' });
      const count = sendIssue(n, 'Owner');
      return send(res, 200, { ok: true, inProgress: false, recipients: count, failures: 0 });
    }
    return send(res, 400, { ok: false, error: 'Unknown request.' });
  }
  if (p === '/functions/v1/article-review') {
    if (!who.role) return send(res, 401, { ok: false, error: 'Please sign in again.' });
    const ROLE = { owner: 'Owner', editor: 'Editor', writer: 'Writer' };
    const reviewer = who.role === 'owner' || who.role === 'editor', label = ROLE[who.role];
    const article = db.site_articles.find(a => a.id === (json && json.articleId));
    if (!article) return send(res, 404, { ok: false, error: 'This article was not found. It may not have saved yet: wait a moment and try again.' });
    const title = article.title || '(untitled)';
    const found = db.article_reviews.find(r => r.article_id === article.id);
    const review = found || { article_id: article.id, state: 'draft', writer_email: '', note: '', sent_at: null, back_note: '', back_by: '', log: [] };
    const at = new Date().toISOString();
    const logged = what => [...review.log, { at, who: label, what }];
    const comments = db.article_comments.filter(c => c.article_id === article.id);
    const open = comments.filter(c => !c.resolved && !c.parent_id);
    const reviewers = () => db.site_people.filter(x => ['owner', 'editor'].includes(x.role) && x.email !== who.email).map(x => x.email);
    const mail = (to, subject) => { to.forEach(e => emails.push({ to: e, subject: 'IBVU admin: ' + subject })); return to.length; };
    const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    let next = null, emailed = 0;
    const a = json.action;
    if (a === 'send') {
      if (review.state === 'review') return send(res, 409, { ok: false, error: 'This is already waiting for review.' });
      const note = text(json.note, 1000);
      next = { ...review, state: 'review', writer_email: who.email, note, sent_at: at, log: logged('sent it for review') };
      emailed = mail(reviewers(), 'Ready for review: ' + title);
    } else if (a === 'takeback') {
      if (review.state !== 'review') return send(res, 409, { ok: false, error: 'This is not waiting for review.' });
      if (!reviewer && review.writer_email !== who.email) return send(res, 403, { ok: false, error: 'Only the person who sent it can take it back.' });
      next = { ...review, state: open.length || review.back_note ? 'changes' : 'draft', log: logged('took it back from review') };
      emailed = mail(reviewers(), 'Taken back: ' + title);
    } else if (a === 'sendback') {
      if (!reviewer) return send(res, 403, { ok: false, error: 'Only Editors and Owners can send it back.' });
      if (review.state !== 'review') return send(res, 409, { ok: false, error: 'Only something sent for review can be sent back.' });
      const note = text(json.note, 1000);
      if (!note && !open.length) return send(res, 400, { ok: false, error: 'Add a note or a comment so the writer knows what to change.' });
      next = { ...review, state: 'changes', back_note: note, back_by: label, log: logged('sent it back') };
      if (review.writer_email !== who.email) emailed = mail([review.writer_email], 'Changes asked for: ' + title);
    } else if (a === 'comment') {
      const words = text(json.body, 2000);
      if (!words) return send(res, 400, { ok: false, error: 'Write the comment first.' });
      const parentId = json.parentId || null;
      db.article_comments.push({ id: crypto.randomUUID(), article_id: article.id, parent_id: parentId, author_email: who.email, author_role: who.role, quote: parentId ? '' : text(json.quote, 300), mark_id: parentId ? '' : (json.markId || ''), body: words, resolved: false, created_at: at });
      if (!parentId) next = { ...review, log: logged('added a comment') };
      if (!parentId && reviewer && review.state === 'changes' && review.writer_email && review.writer_email !== who.email) emailed = mail([review.writer_email], 'New comment: ' + title);
    } else if (a === 'resolve') {
      const c = comments.find(x => x.id === json.commentId);
      if (!c) return send(res, 404, { ok: false, error: 'That comment was not found.' });
      c.resolved = true; next = { ...review, log: logged('marked a comment done') };
    } else if (a === 'published') {
      if (!reviewer) return send(res, 403, { ok: false, error: 'Only Editors and Owners publish.' });
      comments.forEach(c => { c.resolved = true; });
      if (review.writer_email && review.writer_email !== who.email && ['review', 'changes'].includes(review.state)) emailed = mail([review.writer_email], 'Published: ' + title);
      next = { ...review, state: 'draft', note: '', back_note: '', back_by: '', log: logged('published it') };
    } else return send(res, 400, { ok: false, error: 'Unknown request.' });
    if (next) { next.updated_at = at; if (found) Object.assign(found, next); else db.article_reviews.push(next); }
    const r = next || found || null;
    return send(res, 200, {
      ok: true, emailed,
      review: r && { article_id: r.article_id, state: r.state, note: r.note, sent_at: r.sent_at, back_note: r.back_note, back_by: r.back_by, log: r.log, updated_at: r.updated_at, sent_by_me: r.writer_email === who.email },
      comments: db.article_comments.filter(c => c.article_id === article.id).map(c => ({ id: c.id, article_id: c.article_id, parent_id: c.parent_id, author_role: c.author_role, quote: c.quote, mark_id: c.mark_id, body: c.body, resolved: c.resolved, created_at: c.created_at, mine: c.author_email === who.email })),
    });
  }
  if (p === '/functions/v1/send-approval-email' || p === '/functions/v1/generate-description') {
    if (!who.review) return send(res, 403, { error: 'Only signed-in herb reviewers can use this.' });
    if (p.endsWith('generate-description')) return send(res, 200, { description: 'A test description.' });
    const h = db.approved_herbs.find(x => x.id === (json && json.herbId));
    if (!h) return send(res, 404, { error: 'Herb not found.' });
    if (!h.submitter_consent || !h.submitter_email) return send(res, 400, { error: 'The submitter did not agree to be contacted.' });
    if (h.emailed) return send(res, 409, { error: 'The email was already sent.' });
    emails.push({ to: h.submitter_email, subject: 'Your herb submission has been approved — IBVU Herbarium Scientifica' });
    h.emailed = true;
    return send(res, 200, { ok: true });
  }
  if (p === '/functions/v1/admin-add-person') {
    if (who.role !== 'owner') return send(res, 403, { ok: false, error: 'Only an Owner can add people.' });
    const email = (json.email || '').toLowerCase();
    addUser(email);
    const existing = db.site_people.find(x => x.email === email);
    if (existing) Object.assign(existing, { role: json.role, herb_review: json.role === 'owner' || !!json.herbReview });
    else db.site_people.push(defaults('site_people', { email, role: json.role, herb_review: json.role === 'owner' || !!json.herbReview }));
    return send(res, 200, { ok: true });
  }

  // ── storage
  let m;
  if ((m = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(p)) && req.method === 'GET') {
    const o = store[m[1] + '/' + decodeURIComponent(m[2])];
    if (!o || m[1] !== 'site-images') return send(res, 404, { error: 'not found' });
    return send(res, 200, o.data, o.type);
  }
  if ((m = /^\/storage\/v1\/object\/sign\/([^/]+)$/.exec(p)) && req.method === 'POST') {
    if (!who.review) return send(res, 400, { statusCode: '403', error: 'Unauthorized' });
    return send(res, 200, (json.paths || []).map(path => ({ path, error: null, signedURL: '/object/sign/' + m[1] + '/' + path + '?token=t' })));
  }
  if ((m = /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(p)) && req.method === 'GET') {
    const o = store[m[1] + '/' + decodeURIComponent(m[2])];
    if (!o) return send(res, 404, { error: 'not found' });
    return send(res, 200, o.data, o.type);
  }
  if ((m = /^\/storage\/v1\/object\/([^/]+)$/.exec(p)) && req.method === 'DELETE') {
    for (const prefix of (json && json.prefixes) || []) delete store[m[1] + '/' + prefix];
    return send(res, 200, []);
  }
  if ((m = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(p)) && (req.method === 'POST' || req.method === 'PUT')) {
    if (!who.role) return send(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
    let type = req.headers['content-type'] || 'application/octet-stream', data = raw;
    const bm = /multipart\/form-data;\s*boundary=(.+)$/.exec(type);
    if (bm) {
      // storage-js sends pictures as a form with one file part
      const parts = raw.toString('latin1').split('--' + bm[1]);
      const part = parts.find(x => /content-type:\s*image\//i.test(x));
      const cut = part.indexOf('\r\n\r\n');
      const head = part.slice(0, cut);
      type = /content-type:\s*([^\r\n]+)/i.exec(head)[1].trim();
      data = Buffer.from(part.slice(cut + 4).replace(/\r\n$/, ''), 'latin1');
    }
    store[m[1] + '/' + decodeURIComponent(m[2])] = { type, data };
    return send(res, 200, { Key: m[1] + '/' + m[2], Id: crypto.randomUUID() });
  }

  // ── tables
  if ((m = /^\/rest\/v1\/([a-z_]+)$/.exec(p))) {
    const table = m[1];
    if (!db[table]) return send(res, 404, { message: 'no table' });
    const all = db[table];
    const seen = visible(table, all, who);
    if (seen === null && !(table === 'submissions' && req.method === 'POST')) return send(res, 401, { code: '42501', message: 'permission denied for table ' + table });
    const prefer = req.headers.prefer || '';
    const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object');
    const returnRows = rows => {
      if (wantsObject) { if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }); return send(res, 200, rows[0]); }
      return prefer.includes('return=representation') || req.method === 'GET' ? send(res, req.method === 'POST' ? 201 : 200, rows) : (res.writeHead(req.method === 'POST' ? 201 : 204), res.end());
    };
    // v6.12: visitors may only read these columns of published herbs
    const PUBLIC_HERB = ['id', 'created_at', 'name', 'latin', 'category', 'origin', 'description', 'uses', 'conditions', 'color', 'pubmed_count', 'other_names'];
    if (table === 'approved_herbs' && !who.review && (req.method === 'GET' || req.method === 'HEAD')) {
      const cols = (url.searchParams.get('select') || '*').split(',');
      if (cols.some(c => !PUBLIC_HERB.includes(c))) return send(res, 401, { code: '42501', message: 'permission denied for table approved_herbs' });
      return returnRows(filterRows(seen, url.searchParams).map(r => Object.fromEntries(cols.map(c => [c, r[c]]))));
    }
    if (req.method === 'GET' || req.method === 'HEAD') return returnRows(filterRows(seen, url.searchParams));
    if (['approved_herbs', 'herb_edits'].includes(table) && !who.review) return send(res, 401, { code: '42501', message: 'new row violates row-level security policy for table "' + table + '"' });
    if (table === 'submissions' && req.method !== 'POST' && !who.review) return send(res, 401, { code: '42501', message: 'permission denied for table submissions' });
    if (table === 'submissions' && req.method === 'POST' && (Array.isArray(json) ? json : [json]).some(r => r && r.review_status && r.review_status !== 'pending')) return send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "submissions"' });
    const isStaffTable = ['site_events', 'site_articles', 'site_pages', 'site_history', 'herb_photos', 'site_people', 'content_drafts'].includes(table);
    if (isStaffTable && !who.role) return send(res, 401, { code: '42501', message: 'new row violates row-level security policy for table "' + table + '"' });
    if (table === 'site_people' && who.role !== 'owner') return send(res, 403, { code: '42501', message: 'new row violates row-level security policy' });
    if (['site_pages'].includes(table) && !['owner', 'editor'].includes(who.role)) return send(res, 403, { code: '42501', message: 'new row violates row-level security policy' });
    const denied = () => send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "' + table + '"' });
    if (['newsletter_sends'].includes(table)) return denied();
    if (['admin_reminder_recipients', 'newsletter_reminder_settings'].includes(table) && who.role !== 'owner') return denied();
    if (table === 'newsletter_issues') {
      if (!['owner', 'editor'].includes(who.role)) return denied();
      const incoming = Array.isArray(json) ? json : [json];
      const touched = req.method === 'POST' ? incoming.map(r => all.find(x => x.id === r.id)).filter(Boolean) : filterRows(seen, url.searchParams);
      if (touched.some(x => x.status === 'sent' || x.status === 'sending')) return denied();
      if (who.role === 'editor' && (touched.some(x => x.status !== 'draft') || incoming.some(r => r && r.status && r.status !== 'draft'))) return denied();
    }
    if (table === 'site_articles' && who.role === 'writer') {
      const ids = req.method === 'POST' ? (Array.isArray(json) ? json : [json]).map(r => r && r.id) : filterRows(seen, url.searchParams).map(r => r.id);
      if (ids.some(id => db.article_reviews.some(r => r.article_id === id && r.state === 'review'))) return denied();
    }
    if (table === 'content_drafts' && who.role === 'writer' && (Array.isArray(json) ? json : [json]).some(r => r && r.kind === 'page')) return denied();
    if (req.method === 'POST') {
      const rows = (Array.isArray(json) ? json : [json]).map(r => defaults(table, r));
      if (rows.some(r => failTitles.has(r.title))) return send(res, 500, { message: 'simulated failure' });
      const key = url.searchParams.get('on_conflict') || KEYS[table] || 'id';
      const out = [];
      for (const r of rows) {
        const cols = key.split(',');
        const existing = prefer.includes('merge-duplicates') && all.find(x => cols.every(c => x[c] === r[c]));
        if (existing) { Object.assign(existing, r); out.push(existing); } else { all.push(r); out.push(r); }
      }
      return returnRows(out);
    }
    if (req.method === 'PATCH') {
      const rows = filterRows(seen, url.searchParams);
      rows.forEach(r => Object.assign(r, json));
      return returnRows(rows);
    }
    if (req.method === 'DELETE') {
      const rows = filterRows(seen, url.searchParams);
      db[table] = all.filter(r => !rows.includes(r));
      return returnRows(rows);
    }
  }
  send(res, 404, { message: 'mock: unknown ' + req.method + ' ' + p });
}).listen(PORT, () => console.log('mock supabase on ' + PORT));
