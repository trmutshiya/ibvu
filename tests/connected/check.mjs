// IBVU v6.05 — what changed in this file: the framing window is used with its buttons.
// IBVU v6.04 — what changed in this file: the event picture is framed (zoom in) in
// the framing window, and the framing is saved with it and shown to visitors.
// IBVU v6.03 — what changed in this file: also checks newsletters (draft saves itself, test
// email, send now, the sent record, scheduling in UK time and cancelling, the archive on the
// site), the Reminders list and settings, and draft changes to a live blog post (by the Owner
// and suggested by a Writer).
// IBVU v6.02 — what changed in this file: also checks the mailing lists (choose lists,
// Confirm link, the contact form's updates tick, admin Messages and Mailing lists,
// the unsubscribe link).
// IBVU v6.0 — new file. End-to-end check of the CONNECTED site (the one that
// saves to the database) against a stand-in database (mock-supabase.cjs), so
// nothing real is touched and no emails are sent. Run with:
//   npm run test:connected
// It signs in as an Owner, a Writer and someone not on the People list,
// publishes an event and a blog post, edits page wording, approves a herb
// photo, adds a person, makes a save fail on purpose, and checks what a
// visitor then sees. The Cloudflare spam check is replaced by a stand-in.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const B = 'http://127.0.0.1:4320', M = 'http://127.0.0.1:4400';
const OUT = process.argv[2] || join(root, 'test-results');
const results = [];
const ok = (name, cond, extra = '') => results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
const dbNow = async () => (await (await fetch(M + '/__db')).json()).db;

const TURNSTILE_STUB = () => {
  let n = 0; const ws = {};
  window.turnstile = {
    render(el, opts) { const id = 'w' + (++n); ws[id] = opts; if (opts.execution !== 'execute') setTimeout(() => opts.callback && opts.callback('test-token'), 50); return id; },
    execute(id) { const o = ws[id]; setTimeout(() => o && o.callback && o.callback('test-token'), 50); },
    reset() {}, remove(id) { delete ws[id]; },
  };
  try { sessionStorage.setItem('ibvu_intro_played', '1'); } catch {}
};

async function newPage(browser, w = 1280, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route('**/challenges.cloudflare.com/**', r => r.abort());
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  await ctx.addInitScript(TURNSTILE_STUB);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  return { ctx, page };
}
async function signIn(page, email, path = '/admin') {
  await page.goto(B + path);
  await page.waitForSelector('#signin-email');
  await page.fill('#signin-email', email);
  await page.click('button:has-text("Send sign-in code")');
  await page.waitForSelector('#signin-code');
  await page.fill('#signin-code', '654321');
  await page.click('button:has-text("Sign in")');
}

export async function check() {
  const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

  // 1. A visitor
  const v = await newPage(browser);
  await v.page.goto(B + '/');
  await v.page.waitForSelector('.pillars-lead');
  const jsFiles = await v.page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => n.startsWith(location.origin) && n.endsWith('.js')));
  ok('visitor does not download the sign-in library', jsFiles.length === 1, jsFiles.map(f => f.split('/').pop()).join(', '));
  await v.page.goto(B + '/admin');
  await v.page.waitForSelector('#signin-email');
  ok('admin asks a visitor to sign in', await v.page.locator('h1:has-text("IBVU Admin")').count() === 1);
  ok('no preview note on the real sign-in', await v.page.locator('.signin-note').count() === 0);

  // contact form
  await v.page.goto(B + '/contact');
  await v.page.fill('#contact-name', 'Ada Visitor');
  await v.page.fill('#contact-email', 'ada@example.org');
  await v.page.selectOption('#contact-type', 'research');
  await v.page.fill('#contact-message', 'Hello from the test.');
  await v.page.check('.contact-updates input');
  await v.page.click('button:has-text("Send message")');
  await v.page.waitForSelector('text=We have your message', { timeout: 10000 });
  let d = await dbNow();
  ok('contact form saved through the server', d.contact_messages.some(m => m.email === 'ada@example.org' && m.enquiry_type === 'research' && m.wants_updates === true));
  ok('updates tick: waiting to confirm for Research & collaboration only', (() => { const s = d.newsletter_signups.find(x => x.email === 'ada@example.org'); return s && s.lists.length === 0 && JSON.stringify(s.pending_lists) === '["research"]'; })());
  ok('thank-you mentions the confirm email', await v.page.locator('text=confirm your subscription to Research & collaboration').count() === 1);
  ok('no "preview" note after sending', await v.page.locator('.preview-note').count() === 0);

  // newsletter
  await v.page.fill('#nl-email', 'news@example.org');
  await v.page.locator('#newsletter').getByLabel(/Herb Mail Club & shop/).check();
  await v.page.click('button.newsletter-submit');
  await v.page.waitForSelector('.newsletter-thanks', { timeout: 10000 });
  d = await dbNow();
  const news = d.newsletter_signups.find(s => s.email === 'news@example.org');
  ok('newsletter sign-up waits for Confirm', news && news.lists.length === 0 && news.pending_lists.sort().join() === 'mailclub,monthly');
  await v.page.goto(B + '/newsletter/confirm?t=' + news.confirm_token);
  await v.page.waitForSelector('text=You\'ll receive: IBVU Monthly, Herb Mail Club & shop.', { timeout: 10000 });
  d = await dbNow();
  ok('Confirm link adds the lists', d.newsletter_signups.find(s => s.email === 'news@example.org').lists.sort().join() === 'mailclub,monthly');
  await v.page.goto(B + '/newsletter/confirm?t=00000000-0000-4000-8000-000000000000');
  await v.page.waitForSelector('text=This link did not work', { timeout: 10000 });
  ok('a wrong Confirm link is refused', true);

  // herb submission with a photo
  await v.page.goto(B + '/educate/hs/submit');
  await v.page.fill('input[name="name"]', 'Ginger');
  await v.page.fill('input[name="uses"]', 'Digestion');
  await v.page.fill('input[name="country"]', 'Zimbabwe');
  await v.page.fill('input[name="email"]', 'sub@example.org');
  await v.page.locator('#herb-photo').setInputFiles(join(root, 'src/assets/', 'pillar-educate.jpg'));
  await v.page.waitForSelector('.photo-chosen img');
  await v.page.check('#photo-mine');
  await v.page.waitForTimeout(300);
  await v.page.click('button.submit-btn');
  await v.page.waitForSelector('.result-card', { timeout: 15000 });
  d = await dbNow();
  const pendingRow = d.herb_photos.find(p => p.herb_key === 'ginger' && p.status === 'pending');
  ok('herb photo sent and waiting privately', !!pendingRow);
  ok('herb submission saved', d.submissions.some(s => s.common_name === 'Ginger'));

  // 2. Someone who can sign in but is not on the People list
  const s = await newPage(browser);
  await signIn(s.page, 'stranger@example.org');
  await s.page.waitForSelector('text=not on the People list', { timeout: 10000 });
  ok('signed in but not on the People list: no access', await s.page.locator('.admin-switch').count() === 0);
  await s.page.click('button:has-text("Sign out")');
  await s.page.waitForSelector('#signin-email');
  ok('…and can sign out', true);

  // wrong code
  await s.page.fill('#signin-email', 'owner@example.org');
  await s.page.click('button:has-text("Send sign-in code")');
  await s.page.fill('#signin-code', '111111');
  await s.page.click('button:has-text("Sign in")');
  await s.page.waitForSelector('text=That code is not right');
  ok('a wrong code is refused', await s.page.locator('.admin-switch').count() === 0);
  await s.ctx.close();

  // 3. The Owner
  const o = await newPage(browser);
  await signIn(o.page, 'owner@example.org', '/admin/events');
  await o.page.waitForSelector('.admin-switch', { timeout: 10000 });
  ok('Owner signs in and lands on the section asked for', await o.page.locator('h2:has-text("Events")').count() > 0);
  ok('Owner sees every section', (await o.page.locator('.admin-switch a').count()) >= 10, String(await o.page.locator('.admin-switch a').count()));
  ok('no preview bar', await o.page.locator('.cadmin-preview-bar').count() === 0);

  // event with an image
  await o.page.click('button:has-text("New event")');
  await o.page.fill('#ev-title', 'Plant Science Evening');
  await o.page.fill('#ev-date', '2027-03-04');
  await o.page.fill('#ev-time', '18:30');
  await o.page.fill('#ev-place', 'London');
  await o.page.locator('.cadmin-image input[type=file]').setInputFiles(join(root, 'src/assets/', 'shop-events.jpg'));
  await o.page.waitForSelector('.frame-dialog', { timeout: 10000 });
  const evImg = await o.page.locator('.cadmin-image-preview img').getAttribute('src');
  ok('event image uploaded to the picture store', /\/storage\/v1\/object\/public\/site-images\/events\//.test(evImg), evImg.slice(0, 90));
  await o.page.waitForSelector('.frame-dialog .frame-clip', { timeout: 10000 });
  ok('the framing window opens after choosing a picture', await o.page.locator('.frame-dialog .frame-clip').count() === 1);
  await o.page.click('.frame-dialog button:has-text("Larger +")');
  await o.page.click('.frame-foot button:has-text("Save")');
  await o.page.waitForSelector('.frame-dialog', { state: 'detached' });
  await o.page.click('.cadmin-card button:has-text("Publish")');
  await o.page.waitForTimeout(1200);
  d = await dbNow();
  const ev = d.site_events.find(e => e.title === 'Plant Science Evening');
  ok('event saved as published, with its framing', ev && ev.status === 'published' && ev.event_date === '2027-03-04' && ev.image === evImg + '#frame=50,50,1.1', ev && ev.image);
  ok('history saved with the role, not an email', d.site_history.some(h => h.who === 'Owner' && h.title === 'Plant Science Evening') && !JSON.stringify(d.site_history).includes('@'));

  // blog post
  await o.page.goto(B + '/admin/blog');
  await o.page.click('button:has-text("New post")');
  await o.page.waitForSelector('.ProseMirror', { timeout: 15000 });
  await o.page.fill('#ar-title', 'Why ginger warms you up');
  await o.page.click('.ProseMirror');
  await o.page.keyboard.type('Ginger contains gingerols.');
  await o.page.waitForTimeout(1800);
  d = await dbNow();
  ok('draft saves itself to the database', d.site_articles.some(a => a.title === 'Why ginger warms you up' && a.status === 'draft' && a.section === 'blog'));
  await o.page.click('.cadmin-editor-bar button:has-text("Publish")');
  await o.page.waitForTimeout(1200);
  d = await dbNow();
  const post = d.site_articles.find(a => a.title === 'Why ginger warms you up');
  ok('blog post published', post && post.status === 'published' && post.published_at && post.slug === 'why-ginger-warms-you-up');

  // page wording
  await o.page.goto(B + '/admin/pages?page=contact');
  await o.page.waitForSelector('#pg-lead');
  await o.page.fill('#pg-lead', 'Written in admin and saved for everyone.');
  await o.page.click('button:has-text("Publish changes")');
  await o.page.waitForTimeout(1000);
  d = await dbNow();
  ok('page wording saved', d.site_pages.some(p => p.key === 'contact' && p.data.lead === 'Written in admin and saved for everyone.'));

  // herb photo approval
  await o.page.goto(B + '/admin/herbphotos');
  await o.page.waitForSelector('.cadmin-thumb.large img', { timeout: 10000 });
  const pendingSrc = await o.page.locator('.cadmin-thumb.large img').getAttribute('src');
  const imgOk = await o.page.locator('.cadmin-thumb.large img').evaluate(i => i.complete && i.naturalWidth > 0);
  ok('waiting photo shown from the private store', /object\/sign\/herb-photo-submissions/.test(pendingSrc) && imgOk);
  await o.page.click('button:has-text("Approve")');
  await o.page.waitForTimeout(2000);
  d = await dbNow();
  const approved = d.herb_photos.find(p => p.herb_key === 'ginger' && p.status === 'approved');
  ok('photo approved and moved to the public store', approved && /site-images\/herbs\//.test(approved.image_path));
  ok('private copy removed', !(await (await fetch(M + '/__db')).json()).store.some(k => k.startsWith('herb-photo-submissions/')));

  // add a Writer
  await o.page.goto(B + '/admin/people');
  await o.page.fill('#pe-email', 'writer@example.org');
  await o.page.selectOption('#pe-role', 'writer');
  await o.page.click('button:has-text("Add person")');
  await o.page.waitForTimeout(1500);
  d = await dbNow();
  ok('new person added on the server (can now receive codes)', d.site_people.some(p => p.email === 'writer@example.org' && p.role === 'writer'));
  await o.page.waitForSelector('.cadmin-item-title:has-text("writer@example.org")');
  ok('People list reloaded from the database', true);

  // a failed save is reported
  await o.page.goto(B + '/admin/events');
  await o.page.click('button:has-text("New event")');
  await o.page.fill('#ev-title', 'FAIL-ME');
  await o.page.click('.cadmin-card button:has-text("Save draft")');
  await o.page.waitForSelector('.cadmin-sync-error', { timeout: 10000 });
  ok('a failed save shows a message', (await o.page.locator('.cadmin-sync-error').innerText()).includes('Could not save'));
  await o.page.waitForTimeout(1000);
  ok('…and the unsaved item disappears after reloading', await o.page.locator('.cadmin-item-title:has-text("FAIL-ME")').count() === 0);
  await o.page.screenshot({ path: OUT + '/conn-sync-error.png' });

  // messages and mailing lists (Owners)
  await o.page.goto(B + '/admin/messages');
  await o.page.waitForSelector('text=Hello from the test.', { timeout: 10000 });
  ok('Owner sees the contact message in admin', await o.page.locator('text=Asked for updates').count() >= 1);
  await o.page.goto(B + '/admin/lists');
  await o.page.waitForSelector('.cadmin-item-title:has-text("news@example.org")', { timeout: 10000 });
  ok('Owner sees the confirmed subscriber in Mailing lists', true);
  await o.page.selectOption('#ls-list', 'mailclub');
  const [dl] = await Promise.all([o.page.waitForEvent('download'), o.page.click('button:has-text("Download Herb Mail Club & shop as spreadsheet")')]);
  const { readFileSync } = await import('node:fs');
  const csv = readFileSync(await dl.path(), 'utf8');
  ok('spreadsheet has the subscriber and their unsubscribe link', csv.includes('news@example.org') && /\/unsubscribe\?t=[0-9a-f-]{36}/.test(csv) && !csv.includes('ada@example.org'));

  // newsletters
  const emailsNow = async () => (await (await fetch(M + '/__emails')).json());
  await o.page.goto(B + '/admin/newsletters');
  await o.page.click('button:has-text("New newsletter")');
  await o.page.waitForSelector('.ProseMirror', { timeout: 15000 });
  ok('newsletter list counts come from the database', await o.page.locator('label:has-text("IBVU Monthly") >> text=(1 confirmed)').count() === 1);
  await o.page.fill('#nl-title', 'First issue');
  await o.page.fill('#nl-subject', 'IBVU: the first issue');
  await o.page.fill('#nl-preview', 'What we have been up to.');
  await o.page.click('.ProseMirror');
  await o.page.keyboard.type('Welcome to the newsletter.');
  await o.page.waitForTimeout(1800);
  d = await dbNow();
  ok('newsletter draft saves itself', d.newsletter_issues.some(n => n.title === 'First issue' && n.status === 'draft' && n.lists.join() === 'monthly' && n.show_on_site === true && n.slug === 'first-issue'));
  await o.page.click('button:has-text("Send a test to me")');
  await o.page.waitForSelector('text=A test was sent to owner@example.org', { timeout: 10000 });
  ok('test goes to the Owner only', (await emailsNow()).some(e => e.to === 'owner@example.org' && e.subject === '[Test] IBVU: the first issue'));
  await o.page.click('button:has-text("Send now…")');
  await o.page.waitForSelector('text=now to IBVU Monthly: 1 person?');
  await o.page.click('button:has-text("Yes, send it now")');
  await o.page.waitForSelector('text=Sent to 1 person.', { timeout: 10000 });
  d = await dbNow();
  const sentIssue = d.newsletter_issues.find(n => n.title === 'First issue');
  ok('newsletter sent and recorded', sentIssue.status === 'sent' && sentIssue.recipients === 1 && sentIssue.sent_by === 'Owner' && d.newsletter_sends.some(s => s.issue_id === sentIssue.id && s.email === 'news@example.org'));
  ok('each email carries the person\'s own unsubscribe link', (await emailsNow()).some(e => e.to === 'news@example.org' && /\/unsubscribe\?t=[0-9a-f-]{36}/.test(e.unsubscribe)));
  await o.page.waitForSelector('.nl-sends li:has-text("news@example.org")', { timeout: 10000 });
  ok('sent record lists who it went to', await o.page.locator('.nl-record').innerText().then(x => x.includes('IBVU: the first issue') && x.includes('1 person')));
  ok('a sent newsletter can no longer be edited', await o.page.locator('#nl-title').count() === 0);

  // schedule in UK time (June is summer time: 09:00 in the UK is 08:00 UTC), then cancel
  await o.page.click('button:has-text("← All newsletters")');
  await o.page.click('button:has-text("New newsletter")');
  await o.page.waitForSelector('.ProseMirror', { timeout: 15000 });
  await o.page.fill('#nl-title', 'Summer issue');
  await o.page.fill('#nl-subject', 'IBVU in summer');
  await o.page.click('.ProseMirror');
  await o.page.keyboard.type('Sunshine and herbs.');
  await o.page.click('button:has-text("Schedule…")');
  await o.page.fill('#nl-when', '2099-06-01T09:00');
  await o.page.click('.nl-confirm button:has-text("Schedule")');
  await o.page.waitForTimeout(1200);
  d = await dbNow();
  const summer = d.newsletter_issues.find(n => n.title === 'Summer issue');
  ok('scheduled for 09:00 UK time', summer && summer.status === 'scheduled' && new Date(summer.send_at).toISOString() === '2099-06-01T08:00:00.000Z', summer && summer.send_at);
  await o.page.click('button:has-text("Cancel the schedule")');
  await o.page.waitForTimeout(1000);
  d = await dbNow();
  ok('schedule cancelled', (() => { const n = d.newsletter_issues.find(x => x.title === 'Summer issue'); return n.status === 'draft' && !n.send_at; })());

  // reminders (Owners)
  await o.page.click('button:has-text("← All newsletters")');
  await o.page.click('[role=tab]:has-text("Reminders")');
  await o.page.fill('#rm-email', 'team@example.org');
  await o.page.click('form button:has-text("Add")');
  await o.page.waitForSelector('.nl-sends li:has-text("team@example.org")', { timeout: 10000 });
  await o.page.selectOption('select[aria-label="Day of the month"]', '20');
  await o.page.click('.cadmin-card button:has-text("Save")');
  await o.page.waitForTimeout(1000);
  d = await dbNow();
  ok('reminder address and settings saved', d.admin_reminder_recipients.some(r => r.email === 'team@example.org') && d.newsletter_reminder_settings[0].due_day === 20);

  // draft changes to the live blog post
  await o.page.goto(B + '/admin/blog');
  await o.page.click('.cadmin-item:has-text("Why ginger warms you up") button:has-text("Edit")');
  await o.page.waitForSelector('#ar-title');
  await o.page.fill('#ar-title', 'Why ginger warms you (new title)');
  await o.page.click('button:has-text("Save as draft changes")');
  await o.page.waitForTimeout(1000);
  d = await dbNow();
  ok('draft changes saved aside', d.content_drafts.some(x => x.kind === 'article' && x.data.title === 'Why ginger warms you (new title)') && d.site_articles.some(a => a.title === 'Why ginger warms you up'));
  await o.page.click('button:has-text("← All posts")');
  await o.page.waitForSelector('.cadmin-item:has-text("Why ginger warms you up") >> text=Changes waiting');
  ok('"Changes waiting" shows in the list', true);

  // stays signed in after reload
  await o.page.reload();
  await o.page.waitForSelector('.admin-switch', { timeout: 10000 });
  ok('stays signed in after reloading the page', true);

  // edit button on public pages
  await o.page.goto(B + '/contact');
  await o.page.waitForSelector('.edit-page', { timeout: 10000 });
  ok('"Edit this page" shows for the signed-in Owner', true);
  ok('Owner errors on pages', o.page.errors.length === 0, o.page.errors.join(' | '));

  // 4. A new visitor sees everything that was published
  const v2 = await newPage(browser);
  await v2.page.goto(B + '/shop/events');
  await v2.page.waitForSelector('text=Plant Science Evening', { timeout: 10000 });
  ok('visitor sees the published event', true);
  ok('…with its picture framed (zoomed in)', /scale\(1\.1\)/.test(await v2.page.locator('.event-tile .framed-move').getAttribute('style') || ''));
  await v2.page.waitForFunction(() => { const i = document.querySelector('.event-tile .framed-move img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
  ok('…and the picture loads from the picture store', true);
  await v2.page.goto(B + '/educate/blog');
  await v2.page.waitForSelector('.media-tile-title:has-text("Why ginger warms you up")', { timeout: 10000 });
  ok('visitor sees the published blog post', true);
  await v2.page.goto(B + '/educate/blog/why-ginger-warms-you-up');
  await v2.page.waitForSelector('h1:has-text("Why ginger warms you up")', { timeout: 10000 });
  ok('blog post opens directly by its address', true);
  await v2.page.goto(B + '/contact');
  await v2.page.waitForSelector('text=Written in admin and saved for everyone.', { timeout: 10000 });
  ok('visitor sees the edited page wording', true);
  await v2.page.goto(B + '/educate/blog');
  await v2.page.waitForSelector('.media-tile-title:has-text("Why ginger warms you up")', { timeout: 10000 });
  ok('visitor does not see draft changes', !(await v2.page.content()).includes('new title'));
  await v2.page.goto(B + '/newsletter');
  await v2.page.waitForSelector('.media-tile-title:has-text("First issue")', { timeout: 10000 });
  ok('visitor sees the sent newsletter on ibvu.org/newsletter', !(await v2.page.content()).includes('Summer issue'));
  await v2.page.goto(B + '/newsletter/first-issue');
  await v2.page.waitForSelector('text=Welcome to the newsletter.', { timeout: 10000 });
  ok('newsletter issue opens by its address', true);
  await v2.page.goto(B + '/educate/hs/ginger');
  await v2.page.waitForSelector('.herb-photo img', { timeout: 10000 });
  await v2.page.waitForFunction(() => { const i = document.querySelector('.herb-photo img'); return i && i.complete; }, null, { timeout: 10000 });
  ok('visitor sees the approved herb photo', await v2.page.locator('.herb-photo img').evaluate(i => i.naturalWidth > 0), await v2.page.locator('.herb-photo img').getAttribute('src'));
  ok('no "Edit this page" for visitors', await v2.page.locator('.edit-page').count() === 0);
  ok('visitor drafts hidden', !(await v2.page.content()).includes('FAIL-ME'));
  await v2.page.goto(B + '/media/does-not-exist');
  await v2.page.waitForSelector('text=Page not found', { timeout: 10000 });
  ok('unknown article address: not found after loading', true);
  ok('visitor errors on pages', v2.page.errors.length === 0, v2.page.errors.join(' | '));

  // the subscriber's own unsubscribe link
  d = await dbNow();
  const unsubToken = d.newsletter_signups.find(s => s.email === 'news@example.org').unsubscribe_token;
  await v2.page.goto(B + '/unsubscribe?t=' + unsubToken);
  await v2.page.waitForSelector('.subscription-panel input[type=checkbox]', { timeout: 10000 });
  await v2.page.locator('.subscription-panel').getByLabel(/Herb Mail Club & shop/).uncheck();
  await v2.page.click('button:has-text("Save my choices")');
  await v2.page.waitForSelector("text=You'll now receive: IBVU Monthly.", { timeout: 10000 });
  d = await dbNow();
  ok('unsubscribe link leaves one list', d.newsletter_signups.find(s => s.email === 'news@example.org').lists.join() === 'monthly');
  await v2.page.goto(B + '/unsubscribe?t=' + unsubToken);
  await v2.page.waitForSelector('.subscription-panel input[type=checkbox]', { timeout: 10000 });
  await v2.page.click('button:has-text("Unsubscribe from everything")');
  await v2.page.waitForSelector("text=You've been unsubscribed", { timeout: 10000 });
  d = await dbNow();
  ok('…and can leave everything', (() => { const s = d.newsletter_signups.find(x => x.email === 'news@example.org'); return s.lists.length === 0 && !!s.unsubscribed_at; })());

  // the Owner publishes the draft changes
  await o.page.goto(B + '/admin/blog');
  await o.page.click('.cadmin-item:has-text("Why ginger warms you up") button:has-text("Edit")');
  await o.page.waitForSelector('text=You are looking at draft changes');
  await o.page.click('button:has-text("Publish changes")');
  for (let i = 0; i < 20; i++) { // wait for the save, up to 10 seconds
    d = await dbNow();
    if (d.site_articles.some(a => a.title === 'Why ginger warms you (new title)') && !d.content_drafts.some(x => x.kind === 'article')) break;
    await o.page.waitForTimeout(500);
  }
  ok('publishing draft changes updates the live post', d.site_articles.some(a => a.title === 'Why ginger warms you (new title)' && a.status === 'published') && !d.content_drafts.some(x => x.kind === 'article'),
    JSON.stringify({ titles: d.site_articles.map(a => a.title + ':' + a.status), drafts: d.content_drafts.map(x => x.kind + ':' + x.data.title), err: await o.page.locator('.cadmin-sync-error, .cadmin-problem').allInnerTexts() }));

  // 5. The Writer signs in
  const w = await newPage(browser);
  await signIn(w.page, 'writer@example.org');
  await w.page.waitForSelector('.cadmin-home-card', { timeout: 10000 });
  const cards = await w.page.locator('.cadmin-home-card h2').allInnerTexts();
  ok('Writer sees only Events, Articles and Blog', JSON.stringify(cards.map(c => c.trim())) === JSON.stringify(['Events', 'Articles', 'Blog']), cards.join(','));
  await w.page.goto(B + '/admin/blog');
  await w.page.waitForSelector('.cadmin-item-title:has-text("Why ginger")');
  ok('Writer sees published posts in admin', true);
  await w.page.click('.cadmin-item:has-text("Why ginger") button:has-text("Suggest changes")');
  await w.page.waitForSelector('#ar-title');
  ok('Writer cannot publish changes to a live post', await w.page.locator('button:has-text("Publish changes")').count() === 0);
  await w.page.fill('#ar-title', 'A Writer suggests a title');
  await w.page.click('button:has-text("Save as draft changes")');
  await w.page.waitForTimeout(1000);
  d = await dbNow();
  ok('Writer\'s suggested changes saved aside', d.content_drafts.some(x => x.kind === 'article' && x.data.title === 'A Writer suggests a title' && x.saved_by === 'Writer') && !d.site_articles.some(a => a.title === 'A Writer suggests a title'));
  await w.page.goto(B + '/admin/newsletters');
  await w.page.waitForSelector('text=Newsletters is not part of your access', { timeout: 10000 });
  ok('Writer has no Newsletters section', true);
  ok('Writer errors on pages', w.page.errors.length === 0, w.page.errors.join(' | '));

  // 6. Signing out
  await o.page.goto(B + '/admin');
  await o.page.click('.admin-switch-out');
  await o.page.waitForSelector('#signin-email', { timeout: 10000 });
  await o.page.goto(B + '/contact');
  await o.page.waitForTimeout(800);
  ok('after signing out there is no "Edit this page"', await o.page.locator('.edit-page').count() === 0);

  // phone width
  const ph = await newPage(browser, 390, 844);
  await signIn(ph.page, 'owner@example.org');
  await ph.page.waitForSelector('.cadmin-home-card', { timeout: 10000 });
  await ph.page.screenshot({ path: OUT + '/conn-phone-admin.png' });
  ok('phone: admin fits the screen', await ph.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1);

  await browser.close();
  return results;
}
