// IBVU v6.10 — what changed in this file: checks that newsletter pictures and the cover start at tile size, resize by dragging in Write, the email and the web page, and show smaller on a phone.
//
// IBVU v6.09 — what changed in this file: checks for the whole-photo option, GMT/BST and the event preview, "← ibvu" going back, the smaller cookie card, the newsletter title box and missing-field message, picture size and caption in the email preview, the Sending history, and cover captions.
//
// IBVU v6.08 — what changed in this file: the cookie bar check uses the new wording
// (Accept All, Reject All, Cookie Policy).
//
// IBVU v6.07 — what changed in this file since v6.06: every check starts with a cookie
// choice already made (so the cookie bar does not cover the page), and a new check covers
// the cookie bar, "Cookie settings", the Privacy section and that nothing is sent to Google
// away from ibvu.org.
//
// IBVU v6.06 — what changed in this file since v6.05: checks herb photo tiles (square,
// beside the name, about 190 px; on the Herbarium card about 64 px), the full-screen
// photo and Related herbs.
//
// IBVU v6.05 — what changed in this file since v6.04: the framing window is used by
// dragging (move the picture, drag a corner to resize, Larger / Smaller buttons, never
// smaller than the box); pictures in the text are resized by dragging their handles,
// snapping to the standard sizes.
//
// IBVU v6.04 — what changed in this file since v6.03: checks picture framing (event
// picture, a built-in Shop photo, zoom in only), the open article showing the whole
// cover, pictures inside the text (size, position, caption, crop window), the
// full-screen picture view, and Upcoming / Past events.
//
// IBVU v6.03 — what changed in this file since v6.02: checks newsletters (write, add from
// the site, preview as email and web page, test, send, the sent record, the archive at
// /newsletter, hide and Copy to Blog), scheduling in UK time and cancelling, who may send,
// the Reminders list and settings, and draft changes (articles, a Writer's suggested
// changes, page wording with "Show draft changes"). Owners now have 11 admin sections.
//
// IBVU v6.02 — what changed in this file since v5.92: checks the mailing
// lists (newsletter ticks, the contact form's updates tick, the confirm and
// unsubscribe pages, admin Messages and Mailing lists with the spreadsheet
// download) and the "subscribe to our newsletter" link on Events. Owners now
// have 10 admin sections.
//
// IBVU v5.92 — what changed in this file since v5.91: checks the Privacy page
// and its footer link, and that herbs published twice get separate addresses.
//
// IBVU v5.91 — what changed in this file since v5.9: checks the logo in the
// footer and the "Dr" in the About text.
//
// IBVU v5.9 — what changed in this file since v5.8: admin is now behind a
// sign-in, so the admin checks sign in first (using the preview's
// demonstration sign-in) and check that nothing shows before sign-in. New
// checks: the "Edit this page" button, editing a page's wording in admin, and
// ibvu.org/about.
//
// IBVU v5.8 — what changed in this file since v5.7: the Blog page and the Blog
// link in the menu are checked, and the admin checks expect the Blog section.
//
// IBVU v5.7 — new file. Permanent tests for the website.
// Run with "npm test" (see playwright.config.js for first-time setup).
//
// What they check, at laptop and phone size:
//   - every page opens, has a heading and does not scroll sideways
//   - the menu (Home, About, Regulate, Educate, Innovate, Shop, Contact)
//   - short addresses such as ibvu.org/mail forward to the right page
//   - every herb has its own address, and the back button works
//   - the herb submission form asks for the "my own photo" tick
//   - admin: each role sees only its own sections
// They only read pages. They never send a form or write to the database.
//
// NOTE: the admin tests sign in through the preview's demonstration sign-in
// (any 6-digit code). When the tests are run against a build that is connected
// to the database, sign-in needs a real emailed code, so those tests are
// skipped and say so.
import { test, expect } from '@playwright/test';
import { mergeHerbs } from '../src/lib/herbs.js';
import { readFileSync } from 'node:fs';

// The cookie bar is checked on its own ("cookie bar" below); elsewhere a choice is already made.
test.beforeEach(async ({ page }, info) => {
  if (!/cookie bar/.test(info.title)) await page.addInitScript(() => { try { localStorage.setItem("ibvu_cookie_consent_v1", "denied"); } catch {} });
});

test("cookie bar: asks once, Accept and Reject, Cookie settings, nothing sent off ibvu.org", async ({ page }) => {
  const google = [];
  page.on("request", r => { if (/googletagmanager|google-analytics/.test(r.url())) google.push(r.url()); });
  await page.goto("/");
  const bar = page.getByRole("region", { name: "Cookie choice" });
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("button", { name: "Reject All" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Cookie Policy" })).toHaveAttribute("href", "/privacy#analytics-and-cookies");
  await expect(bar).toContainText("You can accept or reject non-essential cookies.");
  await bar.getByRole("button", { name: "Accept All" }).click();
  await expect(bar).toHaveCount(0);
  await page.goto("/educate/hs");
  await expect(page.getByRole("region", { name: "Cookie choice" })).toHaveCount(0);   // asked only once
  expect(google).toEqual([]);                                                          // only ibvu.org sends anything
  // change the choice from the footer
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(page.getByRole("region", { name: "Cookie choice" })).toContainText("You chose: Accept All.");
  await page.getByRole("button", { name: "Reject All" }).click();
  expect(await page.evaluate(() => localStorage.getItem("ibvu_cookie_consent_v1"))).toBe("denied");
  // the Privacy page explains it
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Analytics and cookies" })).toBeVisible();
  // never in admin
  await page.evaluate(() => localStorage.removeItem("ibvu_cookie_consent_v1"));
  await page.goto("/admin");
  await expect(page.getByRole("region", { name: "Cookie choice" })).toHaveCount(0);
});

const PAGES = [
  ["/", "home"], ["/regulate", "Regulate"], ["/educate/hs", "Herbarium"], ["/educate/hs/submit", "Submit"], ["/educate/blog", "Blog"],
  ["/innovate", "Innovate"], ["/media", "Media"], ["/contact", "Contact"], ["/privacy", "Privacy"],
  ["/shop", "Shop"], ["/shop/mail", "Mail Club"], ["/shop/events", "Events"],
  ["/shop/products", "Products"], ["/shop/resources", "Resources"], ["/shop/membership", "Membership"],
];

test.beforeEach(async ({ page }) => {
  // Skip the intro animation so tests do not wait for it.
  await page.addInitScript(() => { try { sessionStorage.setItem("ibvu_intro_played", "1"); } catch {} });
});

const isPhone = (testInfo) => testInfo.project.name === "phone";

async function noSidewaysScroll(page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra, "the page is wider than the screen").toBeLessThanOrEqual(1);
}

for (const [path, name] of PAGES) {
  test("page opens: " + name + " (" + path + ")", async ({ page }) => {
    const crashes = [];
    page.on("pageerror", e => crashes.push(e.message));
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeAttached();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByText("Page not found")).toHaveCount(0);
    await noSidewaysScroll(page);
    expect(crashes, "errors on the page").toEqual([]);
  });
}

test("an unknown address shows the not-found page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("short addresses forward to the shop pages", async ({ page }) => {
  for (const s of ["mail", "events", "products", "resources", "membership"]) {
    await page.goto("/" + s);
    await expect(page).toHaveURL(new RegExp("/shop/" + s + "$"));
  }
  await page.goto("/educate");
  await expect(page).toHaveURL(/\/educate\/hs$/);
});

test("menu: seven items, Home and Shop work", async ({ page }, testInfo) => {
  await page.goto("/regulate");
  if (isPhone(testInfo)) {
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.locator("#site-menu");
    for (const item of ["Home", "About", "Regulate", "Educate", "Innovate", "Shop", "Contact"]) {
      await expect(menu.getByText(item, { exact: true }).first()).toBeVisible();
    }
    await menu.getByRole("link", { name: "Shop", exact: true }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.locator("#site-menu").getByRole("link", { name: "Home", exact: true }).click();
  } else {
    const nav = page.locator("nav.main-nav");
    await expect(nav.locator(".hdr-link")).toHaveText(["Home", "About", "Regulate", "Educate", "Innovate", "Shop", "Contact"]);
    await nav.locator(".hdr-link", { hasText: "Shop" }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await page.locator("nav.main-nav .hdr-link", { hasText: "Home" }).click();
  }
  await expect(page).toHaveURL(/\/$/);
});

test("Blog is reachable from the Educate menu", async ({ page }, testInfo) => {
  await page.goto("/regulate");
  if (isPhone(testInfo)) {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.locator("#site-menu").getByRole("link", { name: "Blog", exact: true }).click();
  } else {
    await page.locator("nav.main-nav .hdr-link", { hasText: "Educate" }).hover();
    await page.locator("nav.main-nav").getByRole("link", { name: "Blog", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/educate\/blog$/);
  await expect(page.getByRole("heading", { name: "Blog", level: 1 })).toBeVisible();
});

test("ibvu.org/about opens the About pop-up on the home page", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog", { name: "About IBVU" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "About IBVU" })).toHaveCount(0);
});

test("the About pop-up closes when you move to another page", async ({ page }) => {
  await page.goto("/regulate");
  await page.goto("/about");
  await expect(page.getByRole("dialog", { name: "About IBVU" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/regulate$/);
  await expect(page.getByRole("dialog", { name: "About IBVU" })).toHaveCount(0);
});

test("the footer links to the Privacy page", async ({ page }) => {
  await page.goto("/shop");
  await page.locator("footer").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
});

test("herbs published twice get their own addresses", () => {
  const herbs = mergeHerbs(
    [{ name: "St. John's Wort" }, { name: "Ginger" }, { name: "Vitex" }],
    [{ name: "St John's wort" }, { name: "Chamomile" }, { name: "Chamomile" }, { name: "Ginger" }],
  );
  // the approved version replaces the built-in one, even when spelled slightly differently
  expect(herbs.map(h => h.name)).toEqual(["Vitex", "St John's wort", "Chamomile", "Chamomile", "Ginger"]);
  // every herb has a different address
  expect(herbs.map(h => h.slug)).toEqual(["vitex", "st-john-s-wort", "chamomile", "chamomile-2", "ginger"]);
});

test("the footer shows the IBVU logo", async ({ page }) => {
  await page.goto("/regulate");
  const logo = page.locator("footer img.footer-logo");
  await logo.scrollIntoViewIfNeeded();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("alt", /IBVU/);
  // the picture has really loaded
  await expect.poll(() => logo.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
});

test("About names the founder as Dr Tatenda Mutshiya", async ({ page }) => {
  await page.goto("/about");
  const about = page.getByRole("dialog", { name: "About IBVU" });
  await expect(about.getByText("Founded by neuroscientist Dr Tatenda Mutshiya and analytical chemist Dara Pierre")).toBeVisible();
  await expect(about.getByRole("link", { name: /Dr Tatenda Mutshiya/ })).toBeVisible();
});

test("Events: 'subscribe to our newsletter' opens the box with Mail Club & shop ticked", async ({ page }) => {
  await page.goto("/shop/events");
  await page.getByRole("button", { name: "subscribe to our newsletter" }).click();
  const box = page.locator("#newsletter");
  await expect(box.getByLabel(/Herb Mail Club & shop/)).toBeChecked();
  await expect(box.getByLabel(/IBVU Monthly/)).not.toBeChecked();
  await expect(page.locator("#nl-email")).toBeFocused();
});

test("v6.09 '← ibvu' goes back to the previous page (home when there is none)", async ({ page }) => {
  await page.goto("/educate/hs");
  await page.locator(".herb-card").first().click();
  await expect(page).toHaveURL(/\/educate\/hs\/.+/);
  await page.getByRole("link", { name: "Back to the previous page" }).click();
  await expect(page).toHaveURL(/\/educate\/hs$/);
});

test("v6.09 cookie bar: a small card with the buttons under the Cookie Policy link", async ({ page }) => {
  await page.evaluate(() => {}).catch(() => {});
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("ibvu_cookie_consent_v1"));
  await page.reload();
  const bar = page.getByRole("region", { name: "Cookie choice" });
  await expect(bar).toBeVisible();
  const box = await bar.boundingBox();
  const vw = page.viewportSize().width;
  expect(box.width).toBeLessThanOrEqual(vw > 640 ? 421 : vw);
  const link = await bar.getByRole("link", { name: "Cookie Policy" }).boundingBox();
  const accept = await bar.getByRole("button", { name: "Accept All" }).boundingBox();
  const reject = await bar.getByRole("button", { name: "Reject All" }).boundingBox();
  expect(accept.y).toBeGreaterThan(link.y + link.height - 1);
  expect(Math.abs(accept.y - reject.y)).toBeLessThan(2);
  expect(Math.abs(accept.width - reject.width)).toBeLessThan(2);
  expect(await bar.evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(61, 44, 30)");
});

test("inner pages have the back button to home", async ({ page }) => {
  await page.goto("/innovate");
  await page.getByRole("link", { name: "Back to the IBVU home page" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the public site does not link to admin", async ({ page }) => {
  for (const path of ["/", "/educate/hs", "/shop"]) {
    await page.goto(path);
    await expect(page.locator('a[href*="/admin"]')).toHaveCount(0);
    await expect(page.locator(".admin-trigger")).toHaveCount(0);
  }
});

test("every herb has its own address", async ({ page }) => {
  await page.goto("/educate/hs");
  const card = page.locator("a.herb-card").first();
  await expect(card).toBeVisible();
  const name = (await card.locator("h3").innerText()).trim();
  await card.click();
  await expect(page).toHaveURL(/\/educate\/hs\/[a-z0-9-]+$/);
  await expect(page.locator("h1")).toHaveText(name);
  await expect(page).toHaveTitle(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await noSidewaysScroll(page);

  // Opening the address directly (a shared link) shows the same herb.
  await page.reload();
  await expect(page.locator("h1")).toHaveText(name);

  // The browser's back button returns to the catalogue.
  await page.goBack();
  await expect(page).toHaveURL(/\/educate\/hs$/);
  await expect(page.locator("a.herb-card").first()).toBeVisible();
});

test("an unknown herb address says so", async ({ page }) => {
  await page.goto("/educate/hs/not-a-real-herb");
  await expect(page.getByText("We could not find that herb.")).toBeVisible();
});

test("submission form: a photo needs the 'my own photo' tick", async ({ page }) => {
  await page.goto("/educate/hs/submit");
  await expect(page.getByText("Only add a photo if it is your own.")).toBeVisible();
  // A tiny 1x1 image, made here so the test needs no file on disk.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await page.locator("#herb-photo").setInputFiles({ name: "leaf.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("The photo you chose")).toBeVisible();
  // Trying to send without the tick is stopped before anything is sent.
  await page.locator("button.submit-btn").click();
  await expect(page.getByText("Please confirm this is your own photo, or remove it.")).toBeVisible();
  await page.getByLabel("This is my own photo and I give IBVU permission to publish it.").check();
  await expect(page.getByText("Please confirm this is your own photo, or remove it.")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByRole("button", { name: "Choose a photo" })).toBeVisible();
});

test.describe("admin (sign-in and roles)", () => {
  const sections = (page) => page.locator(".cadmin-home-card h2");

  // Signs in through the preview's demonstration sign-in. Skips the test when
  // the build is connected to the database (a real emailed code is needed).
  async function signIn(page, email, path = "/admin") {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "IBVU Admin" })).toBeVisible();
    const demo = await page.getByText("Preview only: this file cannot send emails.").count();
    test.skip(!demo, "This build uses real sign-in codes, so the admin checks cannot run by themselves.");
    await page.locator("#signin-email").fill(email);
    await page.getByRole("button", { name: /Send sign-in code/ }).click();
    await page.locator("#signin-code").fill("123456");
    await page.getByRole("button", { name: /^Sign in/ }).click();
  }
  async function signOut(page) {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "IBVU Admin" })).toBeVisible();
  }
  async function addPerson(page, email, role, herbReview = false) {
    await page.goto("/admin/people");
    await page.locator("#pe-email").fill(email);
    await page.locator("#pe-role").selectOption(role);
    if (herbReview) await page.getByLabel("Can also review herb submissions and herb photos").check();
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(page.locator(".cadmin-item-title", { hasText: email })).toBeVisible();
  }

  test("every admin address asks for sign-in first, and shows nothing before it", async ({ page }) => {
    for (const s of ["", "/herbreview", "/herbphotos", "/events", "/articles", "/blog", "/pages", "/people", "/history", "/messages", "/newsletters", "/lists"]) {
      await page.goto("/admin" + s);
      await expect(page.getByRole("heading", { name: "IBVU Admin" })).toBeVisible();
      await expect(page.locator(".admin-switch")).toHaveCount(0);
      await expect(page.locator(".cadmin-wrap")).toHaveCount(0);
    }
  });

  test("an address that is not on the People page cannot sign in", async ({ page }) => {
    await signIn(page, "nobody@example.org");
    await expect(page.getByText("That code is not right or has expired.")).toBeVisible();
    await expect(page.locator(".admin-switch")).toHaveCount(0);
  });

  test("Owner sees every section, each with its own address, and can sign out", async ({ page }) => {
    await signIn(page, "hello@ibvu.org");
    await expect(sections(page)).toHaveCount(11);
    for (const s of ["herbreview", "herbphotos", "events", "articles", "blog", "pages", "people", "history", "messages", "newsletters", "lists"]) {
      await page.goto("/admin/" + s);
      await expect(page.locator(".admin-switch")).toBeVisible();
      await expect(page.getByText("is not part of your access")).toHaveCount(0);
      await expect(page.getByText("There is no admin section at this address")).toHaveCount(0);
      await noSidewaysScroll(page);
    }
    await signOut(page);
    await page.goto("/admin/people");
    await expect(page.getByRole("heading", { name: "IBVU Admin" })).toBeVisible();
  });

  test("signing in at a section's address lands on that section", async ({ page }) => {
    await signIn(page, "hello@ibvu.org", "/admin/events");
    await expect(page.getByRole("heading", { name: "Events", level: 2 })).toBeVisible();
  });

  test("people added on the People page sign in and see only their role's sections", async ({ page }) => {
    await signIn(page, "hello@ibvu.org");
    await addPerson(page, "writer@example.org", "writer");
    await addPerson(page, "reviewer@example.org", "writer", true);
    await addPerson(page, "editor@example.org", "editor");
    await signOut(page);

    await signIn(page, "writer@example.org");
    await expect(sections(page)).toHaveText([/Events/, /Articles/, /Blog/]);
    await page.goto("/admin/people");
    await expect(page.getByText("People is not part of your access")).toBeVisible();
    await page.goto("/admin/herbreview");
    await expect(page.getByText("Herb review is not part of your access")).toBeVisible();
    await signOut(page);

    await signIn(page, "reviewer@example.org");
    await expect(sections(page)).toHaveText([/Herb review/, /Herb photos/, /Events/, /Articles/, /Blog/]);
    await signOut(page);

    await signIn(page, "editor@example.org");
    await expect(sections(page)).toHaveText([/Events/, /Articles/, /Blog/, /Pages/, /History/, /Newsletters/]);
    await page.goto("/admin/lists");
    await expect(page.getByText("Mailing lists is not part of your access")).toBeVisible();
  });

  test("mailing lists: sign up, confirm, see it in admin, download, unsubscribe", async ({ page }) => {
    // sign up in the newsletter box, choosing two lists
    await page.goto("/innovate");
    const box = page.locator("#newsletter");
    await expect(box.getByLabel(/IBVU Monthly/)).toBeChecked();
    await box.getByLabel(/Research & collaboration/).check();
    await page.locator("#nl-email").fill("reader@example.org");
    await page.locator("button.newsletter-submit").click();
    await expect(page.getByText("Nearly there: please check your inbox.")).toBeVisible();
    // the preview stands in for the email's Confirm button
    await page.getByRole("link", { name: "Confirm now (preview)" }).click();
    await expect(page).toHaveURL(/\/newsletter\/confirm\?t=/);
    await expect(page.getByText("You'll receive: IBVU Monthly, Research & collaboration.")).toBeVisible();

    // the contact form adds a business contact to the business list only if ticked
    await page.goto("/contact");
    await expect(page.getByText(/Send me occasional updates/)).toHaveCount(0);
    await page.locator("#contact-name").fill("Bea Business");
    await page.locator("#contact-email").fill("bea@example.org");
    await page.locator("#contact-type").selectOption("advisory");
    await expect(page.getByText("Send me occasional updates about Services for businesses", { exact: false })).toBeVisible();
    await page.locator(".contact-updates input").check();
    await page.locator("#contact-message").fill("We need a claims review.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/confirm your subscription to Services for businesses/)).toBeVisible();

    // admin: Messages and Mailing lists (Owners only)
    await signIn(page, "hello@ibvu.org", "/admin/messages");
    await expect(page.getByText("We need a claims review.")).toBeVisible();
    await expect(page.getByText("Asked for updates")).toBeVisible();
    await page.goto("/admin/lists");
    await expect(page.locator(".cadmin-item-title", { hasText: "reader@example.org" })).toBeVisible();
    await page.locator("#ls-status").selectOption("waiting");
    await expect(page.locator(".cadmin-item-title", { hasText: "bea@example.org" })).toBeVisible();
    await expect(page.getByText("Services for businesses: waiting to confirm")).toBeVisible();
    await page.locator("#ls-list").selectOption("research");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download Research & collaboration as spreadsheet \(1\)/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^ibvu-research-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync(await download.path(), "utf8");
    expect(csv).toContain("reader@example.org");
    expect(csv).not.toContain("bea@example.org");
    expect(csv).toMatch(/\/unsubscribe\?t=/);

    // the person's own unsubscribe link: leave one list
    const link = csv.trim().split(/\r?\n/)[1].split(",").pop();
    const path = link.replace(/^.*?(\/unsubscribe\?t=)/, "$1");
    await page.goto(path);
    await expect(page.getByText("reader@example.org")).toBeVisible();
    await page.locator(".subscription-panel").getByLabel(/Research & collaboration/).uncheck();
    await page.getByRole("button", { name: "Save my choices" }).click();
    await expect(page.getByText("You'll now receive: IBVU Monthly.")).toBeVisible();
  });

  test("the old address ibvu.org/admin/content forwards to admin", async ({ page }) => {
    await page.goto("/admin/content");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("'Edit this page' shows only when signed in, and an edit appears on the page", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator(".edit-page")).toHaveCount(0);

    await signIn(page, "hello@ibvu.org");
    await expect(sections(page)).toHaveCount(11);
    await page.goto("/contact");
    await page.getByRole("link", { name: /Edit this page/ }).click();
    await expect(page).toHaveURL(/\/admin\/pages\?page=contact$/);

    await page.locator("#pg-lead").fill("A test line written in admin.");
    await page.getByRole("button", { name: "Publish changes" }).click();
    await page.goto("/contact");
    await expect(page.getByText("A test line written in admin.")).toBeVisible();

    // Reset puts the original wording back.
    await page.goto("/admin/pages?page=contact");
    await page.getByRole("button", { name: "Reset to original" }).click();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    await page.goto("/contact");
    await expect(page.getByText("A test line written in admin.")).toHaveCount(0);
  });

  // Signs up one confirmed reader through the newsletter box.
  async function confirmedReader(page, email) {
    await page.goto("/innovate");
    await page.locator("#nl-email").fill(email);
    await page.locator("button.newsletter-submit").click();
    await page.getByRole("link", { name: "Confirm now (preview)" }).click();
    await expect(page.getByText(/You'll receive: IBVU Monthly/)).toBeVisible();
  }

  test("newsletters: write, add from the site, preview, test, send, record, archive", async ({ page }) => {
    await confirmedReader(page, "reader@example.org");
    await signIn(page, "hello@ibvu.org", "/admin/newsletters");
    await expect(page.getByRole("heading", { name: "Newsletters", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: "New newsletter" }).click();
    await page.locator("#nl-title").fill("November at IBVU");
    await page.locator("#nl-subject").fill("RE: November at IBVU");
    await page.locator("#nl-preview").fill("Herbs, events and what is next.");
    await expect(page.getByLabel(/IBVU Monthly/)).toBeChecked();
    await expect(page.getByLabel(/Show on the website once sent/)).toBeChecked();
    await page.locator(".rte-content .ProseMirror").click();
    await page.keyboard.type("Hello from the team.");
    // a herb from the Herbarium, as a block with a link
    await page.locator("#nl-add-kind").selectOption("herb");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator(".rte-content a", { hasText: "Herbarium" })).toHaveCount(1);
    await expect(page.getByText("Draft saved")).toBeVisible();
    await noSidewaysScroll(page);

    // previews
    await page.getByRole("button", { name: "Preview as email" }).click();
    await expect(page.locator(".nl-inbox-subject")).toHaveText("RE: November at IBVU");
    await expect(page.frameLocator(".nl-email-frame").getByRole("heading", { name: "November at IBVU" })).toBeVisible();
    await expect(page.frameLocator(".nl-email-frame").getByText("Hello from the team.")).toBeVisible();
    await page.getByRole("button", { name: "Preview as web page" }).click();
    await expect(page.locator(".cadmin-preview h1", { hasText: "November at IBVU" })).toBeVisible();

    // test, then send
    await page.getByRole("button", { name: "Send a test to me" }).click();
    await expect(page.getByText(/In the preview no email is sent/)).toBeVisible();
    await page.getByRole("button", { name: "Send now…" }).click();
    await expect(page.getByText(/now to IBVU Monthly: 1 person\?/)).toBeVisible();
    await page.getByRole("button", { name: "Yes, send it now" }).click();
    await expect(page.getByText("Sent to 1 person.")).toBeVisible();
    const record = page.locator(".nl-record");
    await expect(record).toContainText("RE: November at IBVU");
    await expect(record).toContainText("1 person");
    await expect(record).toContainText("Owner");
    await expect(page.locator(".nl-sends", { hasText: "reader@example.org" })).toBeVisible();
    // a sent newsletter cannot be edited any more
    await expect(page.locator("#nl-title")).toHaveCount(0);

    // the archive on the site
    await page.goto("/newsletter");
    await page.getByRole("link", { name: /November at IBVU/ }).click();
    await expect(page).toHaveURL(/\/newsletter\/november-at-ibvu$/);
    await expect(page.getByRole("heading", { name: "November at IBVU" })).toBeVisible();
    await expect(page.getByText("Hello from the team.")).toBeVisible();
    await noSidewaysScroll(page);

    // the person's record in Mailing lists
    await page.goto("/admin/lists");
    await expect(page.getByText("Newsletters received: 1")).toBeVisible();

    // hide it from the website again; copy it to the Blog
    await page.goto("/admin/newsletters");
    await page.getByRole("button", { name: "Open" }).click();
    await page.getByRole("button", { name: "Hide from the website" }).click();
    await page.getByRole("button", { name: "Copy to Blog" }).click();
    await expect(page.getByText(/A blog post draft was made/)).toBeVisible();
    await page.goto("/newsletter");
    await expect(page.getByText("The first issue is coming soon")).toBeVisible();
    await page.goto("/admin/blog");
    await expect(page.locator(".cadmin-item-title", { hasText: "November at IBVU" })).toBeVisible();
  });

  test("newsletters: schedule in UK time, cancel, and who may send", async ({ page }) => {
    await signIn(page, "hello@ibvu.org", "/admin/newsletters");
    await page.getByRole("button", { name: "New newsletter" }).click();
    await page.locator("#nl-title").fill("December issue");
    await page.locator("#nl-subject").fill("December at IBVU");
    await page.locator(".rte-content .ProseMirror").click();
    await page.keyboard.type("See you next year.");
    await page.getByRole("button", { name: "Schedule…" }).click();
    await page.locator("#nl-when").fill("2020-01-01T09:00");
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page.getByText("Choose a time at least 5 minutes from now.")).toBeVisible();
    await page.locator("#nl-when").fill("2099-12-01T09:00");
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page.getByText(/Scheduled for Tue, 1 Dec 2099, 09:00 UK time/).first()).toBeVisible();
    await expect(page.locator("#nl-title")).toHaveCount(0);
    await page.getByRole("button", { name: "← All newsletters" }).click();
    await expect(page.locator(".cadmin-item", { hasText: "December issue" })).toContainText("Goes out Tue, 1 Dec 2099, 09:00 UK time");
    await page.getByRole("button", { name: "Run the timer now" }).click();
    await expect(page.getByText("Nothing is due yet.")).toBeVisible();
    await page.getByRole("button", { name: "Open" }).click();
    await page.getByRole("button", { name: "Cancel the schedule" }).click();
    await expect(page.getByText(/The schedule is cancelled/)).toBeVisible();
    await expect(page.locator("#nl-title")).toHaveValue("December issue");

    // Editors write and test, but cannot send or schedule; Writers have no Newsletters
    await addPerson(page, "editor@example.org", "editor");
    await addPerson(page, "writer@example.org", "writer");
    await signOut(page);
    await signIn(page, "editor@example.org", "/admin/newsletters");
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "Send a test to me" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now…" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Schedule…" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Reminders" })).toHaveCount(0);
    await signOut(page);
    await signIn(page, "writer@example.org", "/admin/newsletters");
    await expect(page.getByText("Newsletters is not part of your access")).toBeVisible();
  });

  test("newsletter reminders: Owners keep the list and choose the reminders", async ({ page }) => {
    await signIn(page, "hello@ibvu.org", "/admin/newsletters");
    await page.getByRole("tab", { name: "Reminders" }).click();
    await expect(page.getByText(/Nobody yet/)).toBeVisible();
    await page.locator("#rm-email").fill("team@example.org");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator(".nl-sends", { hasText: "team@example.org" })).toBeVisible();
    for (const label of [/A newsletter is due/, /A scheduled newsletter goes out soon/, /A newsletter has been sent/]) {
      await expect(page.getByLabel(label)).toBeChecked();
    }
    await expect(page.getByLabel("Day of the month")).toHaveValue("25");
    await page.getByLabel("Day of the month").selectOption("20");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Reminders" }).click();
    await expect(page.getByLabel("Day of the month")).toHaveValue("20");
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Yes, remove" }).click();
    await expect(page.locator(".nl-sends", { hasText: "team@example.org" })).toHaveCount(0);
    await noSidewaysScroll(page);
  });

  test("draft changes: live items stay as they are until the changes are published", async ({ page }) => {
    await signIn(page, "hello@ibvu.org", "/admin/articles");
    // publish the example article
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.locator("#ar-title").fill("Live title");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Close" }).click();
    // change it, but only as draft changes
    await page.locator("#ar-title").fill("Changed title");
    await page.getByRole("button", { name: "Save as draft changes" }).click();
    await expect(page.locator(".cadmin-save-state")).toHaveText("Draft changes saved");
    await page.getByRole("button", { name: "← All articles" }).click();
    await expect(page.locator(".cadmin-item", { hasText: "Live title" })).toContainText("Changes waiting");
    await page.goto("/media");
    await expect(page.getByRole("heading", { name: "Live title" })).toBeVisible();
    await expect(page.getByText("Changed title")).toHaveCount(0);

    // a Writer can open the live article and suggest changes
    await addPerson(page, "writer@example.org", "writer");
    await signOut(page);
    await signIn(page, "writer@example.org", "/admin/articles");
    await page.locator(".cadmin-item", { hasText: "Live title" }).getByRole("button", { name: "Suggest changes" }).click();
    await expect(page.locator("#ar-title")).toHaveValue("Changed title");
    await expect(page.getByRole("button", { name: "Publish changes" })).toHaveCount(0);
    await page.locator("#ar-title").fill("Writer's title");
    await page.getByRole("button", { name: "Save as draft changes" }).click();
    await signOut(page);

    // an Owner publishes them
    await signIn(page, "hello@ibvu.org", "/admin/articles");
    await page.locator(".cadmin-item", { hasText: "Live title" }).getByRole("button", { name: "Edit" }).click();
    await expect(page.getByText(/You are looking at draft changes saved by Writer/)).toBeVisible();
    await page.getByRole("button", { name: "Publish changes" }).click();
    await page.getByRole("button", { name: "← All articles" }).click();
    await expect(page.locator(".cadmin-item", { hasText: "Writer's title" })).not.toContainText("Changes waiting");
    await page.goto("/media");
    await expect(page.getByRole("heading", { name: "Writer's title" })).toBeVisible();

    // pages: draft wording is only shown to admin people who switch it on
    await page.goto("/admin/pages?page=contact");
    await page.locator("#pg-lead").fill("Draft wording for Contact.");
    await page.getByRole("button", { name: "Save as draft changes" }).click();
    await expect(page.locator(".cadmin-subtabs button", { hasText: "Contact •" })).toBeVisible();
    await page.goto("/contact");
    await expect(page.getByText("Draft wording for Contact.")).toHaveCount(0);
    await page.getByRole("button", { name: "Show draft changes" }).click();
    await expect(page.getByText("Draft wording for Contact.")).toBeVisible();
    await page.getByRole("button", { name: "Showing draft changes" }).click();
    await expect(page.getByText("Draft wording for Contact.")).toHaveCount(0);
    await page.goto("/admin/pages?page=contact");
    await page.getByRole("button", { name: "Discard draft changes" }).click();
    await page.getByRole("button", { name: "Yes, discard" }).click();
    await expect(page.locator("#pg-lead")).not.toHaveValue("Draft wording for Contact.");
  });

  test("pictures: framing (move and zoom in), built-in photos, events past and upcoming", async ({ page }) => {
    const photo = "src/assets/pillar-educate.jpg";
    await signIn(page, "hello@ibvu.org", "/admin/events");
    // an upcoming event with a picture: the framing window opens after choosing it
    await page.getByRole("button", { name: "New event" }).click();
    await page.locator("#ev-title").fill("Spring herb walk");
    await page.locator("#ev-date").fill("2099-04-10");
    await page.locator(".cadmin-image input[type=file]").setInputFiles(photo);
    const dialog = page.getByRole("dialog", { name: /Frame the image/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Size 100% (just fills the box)")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "− Smaller" })).toBeDisabled();   // never smaller than the box
    // drag the bottom-right corner outwards: larger
    const corner = await dialog.locator(".frame-handle.br").boundingBox();
    await page.mouse.move(corner.x + 10, corner.y + 10);
    await page.mouse.down();
    await page.mouse.move(corner.x + 60, corner.y + 50, { steps: 6 });
    await page.mouse.up();
    await expect(dialog.locator(".frame-size")).not.toHaveText(/Size 100%/);
    // drag the top-left corner far inwards: back to just filling the box
    const tl = await dialog.locator(".frame-handle.tl").boundingBox();
    await page.mouse.move(tl.x + 10, tl.y + 10);
    await page.mouse.down();
    await page.mouse.move(tl.x + 400, tl.y + 300, { steps: 6 });
    await page.mouse.up();
    await expect(dialog.getByText("Size 100% (just fills the box)")).toBeVisible();
    // the buttons, and moving with the keyboard
    await dialog.getByRole("button", { name: "Larger +" }).click();
    await dialog.getByRole("button", { name: "Larger +" }).click();
    await expect(dialog.locator(".frame-size")).toHaveText("Size 121%");
    await dialog.locator(".frame-clip").focus();
    await page.keyboard.press("ArrowLeft");
    await noSidewaysScroll(page);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Best at least 1200 pixels wide.")).toBeVisible();
    await page.locator(".cadmin-card").getByRole("button", { name: "Publish" }).click();

    // a past event (no picture)
    await page.getByRole("button", { name: "New event" }).click();
    await page.locator("#ev-title").fill("Autumn lecture");
    await page.locator("#ev-date").fill("2020-10-01");
    await page.locator(".cadmin-card").getByRole("button", { name: "Publish" }).click();

    await page.goto("/shop/events");
    await expect(page.getByRole("heading", { name: "Upcoming events" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Past events" })).toBeVisible();
    const upcoming = page.locator(".event-tile", { hasText: "Spring herb walk" });
    await expect(upcoming.locator("[data-framed] .framed-move")).toHaveAttribute("style", /scale\(1\.21\)/);
    const box = await upcoming.locator(".event-tile-image").boundingBox();
    if (page.viewportSize().width > 720) expect(box.width).toBeLessThanOrEqual(241);
    await expect(page.locator(".past-event", { hasText: "Autumn lecture" })).toBeVisible();
    await expect(page.locator(".past-event", { hasText: "Autumn lecture" }).getByText("Book a place")).toHaveCount(0);
    await noSidewaysScroll(page);

    // a built-in photo can be framed too (Shop → Herb Mail Club)
    await page.goto("/admin/pages?page=shop");
    const mail = page.locator(".cadmin-field", { hasText: "keep the collage" });
    await mail.getByRole("button", { name: "Frame picture" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Larger +" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "Publish changes" }).click();
    await page.goto("/shop");
    await expect(page.locator(".shop-feature").first().locator(".framed-move")).toHaveAttribute("style", /scale\(1\.1\)/);
    // and back to the original
    await page.goto("/admin/pages?page=shop");
    await mail.getByRole("button", { name: "Reset framing" }).click();
    await page.getByRole("button", { name: "Publish changes" }).click();
    await page.goto("/shop");
    await expect(page.locator(".shop-feature").first().locator("[data-framed]")).toHaveCount(0);
  });

  test("pictures in articles: whole cover, sizes, position, caption, full-screen view", async ({ page }) => {
    const photo = "src/assets/pillar-educate.jpg";
    await signIn(page, "hello@ibvu.org", "/admin/articles");
    await page.getByRole("button", { name: "New article" }).click();
    await page.locator("#ar-title").fill("Pictures test");
    // cover: framing sets the tile only
    await page.locator(".cadmin-image input[type=file]").first().setInputFiles(photo);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Larger +" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    // a picture inside the text
    await page.locator(".rte-content .ProseMirror").click();
    await page.keyboard.type("Some text before the picture.");
    await page.locator(".rte input[type=file]").setInputFiles(photo);
    const crop = page.getByRole("dialog", { name: /Crop and frame/ });
    await expect(crop).toBeVisible();
    await crop.getByRole("button", { name: "Square" }).click();
    await crop.getByRole("button", { name: "Save" }).click();
    await expect(crop).toHaveCount(0);
    // the cursor moves below the picture: typing does not replace it
    await page.keyboard.type("Text after the picture.");
    await expect(page.locator(".rte-content img")).toHaveCount(1);
    await page.locator(".rte-content img").click();
    const bar = page.getByRole("toolbar", { name: "Picture" });
    await expect(bar).toBeVisible();
    // drag the right-hand handle inwards: smaller, with a size label while dragging
    const pic = page.locator(".rte-pic");
    const full = (await pic.boundingBox()).width;
    const mr = await pic.locator(".rte-handle.mr").boundingBox();
    await page.mouse.move(mr.x + 6, mr.y + 14);
    await page.mouse.down();
    await page.mouse.move(mr.x - full * 0.2, mr.y + 14, { steps: 6 });
    await expect(page.locator(".rte-size-tip")).toBeVisible();
    await page.mouse.up();
    expect((await pic.boundingBox()).width).toBeLessThan(full * 0.8);
    await bar.getByRole("button", { name: "Small" }).click();
    await bar.getByRole("button", { name: "Left" }).click();
    await bar.getByRole("button", { name: "Caption…" }).click();
    await page.locator("#rte-caption").fill("Students in a lecture");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(bar.getByRole("button", { name: "Undo crop" })).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Close" }).click();

    // the tile is framed; the open article shows the whole cover
    await page.goto("/media");
    await expect(page.locator(".media-tile", { hasText: "Pictures test" }).locator(".framed-move")).toHaveAttribute("style", /scale\(1\.1\)/);
    await page.goto("/media/pictures-test");
    const cover = page.locator("img.article-cover");
    await expect(cover).toBeVisible();
    expect(await cover.getAttribute("src")).not.toContain("#frame=");
    const fig = page.locator(".article-body figure.article-figure");
    await expect(fig).toHaveAttribute("data-size", "small");
    await expect(fig).toHaveAttribute("data-align", "left");
    await expect(fig.locator("figcaption")).toHaveText("Students in a lecture");
    // square crop
    const ib = await fig.locator("img").boundingBox();
    expect(Math.abs(ib.width - ib.height)).toBeLessThan(3);
    // full-screen view
    await fig.locator("img").click();
    await expect(page.getByRole("dialog", { name: "Picture, full size" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Picture, full size" })).toHaveCount(0);
    await cover.click();
    await expect(page.getByRole("dialog", { name: "Picture, full size" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await noSidewaysScroll(page);
  });

  test("herb photos: square tiles on the herb page and the list, related herbs", async ({ page }) => {
    await signIn(page, "hello@ibvu.org", "/admin/herbphotos");
    const row = page.locator(".cadmin-item", { hasText: "Ashwagandha" });
    await row.locator("input[type=file]").setInputFiles("src/assets/pillar-educate.jpg");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Herb photo (herb page and Herbarium list)").first()).toBeVisible();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    // the herb page: a square tile beside the name
    await page.goto("/educate/hs/ashwagandha");
    const tile = page.locator(".profile-header .herb-thumb-btn");
    await expect(tile).toBeVisible();
    const box = await tile.boundingBox();
    expect(Math.abs(box.width - box.height)).toBeLessThan(2);
    expect(box.width).toBeLessThanOrEqual(page.viewportSize().width > 640 ? 192 : 112);
    await expect(page.getByText("Image for educational purposes only.")).toBeVisible();
    await tile.click();
    await expect(page.getByRole("dialog", { name: "Picture, full size" })).toBeVisible();
    await page.keyboard.press("Escape");
    // related herbs
    await expect(page.getByRole("heading", { name: "Related herbs" })).toBeVisible();
    const related = page.locator(".related-grid .herb-card");
    expect(await related.count()).toBeGreaterThan(0);
    expect(await related.count()).toBeLessThanOrEqual(4);
    await expect(page.locator(".related-grid").getByText("Ashwagandha", { exact: true })).toHaveCount(0);
    await noSidewaysScroll(page);

    // the list: a small tile on that card only
    await page.goto("/educate/hs");
    await expect(page.locator(".herb-card.has-photo")).toHaveCount(1);
    const thumb = await page.locator(".herb-card.has-photo .herb-card-thumb").boundingBox();
    expect(Math.round(thumb.width)).toBe(64);
    await noSidewaysScroll(page);
  });

  test("every page has a form in admin", async ({ page }) => {
    await signIn(page, "hello@ibvu.org");
    await expect(sections(page)).toHaveCount(11);
    await page.goto("/admin/pages");
    await expect(page.locator(".cadmin-subtabs button")).toHaveText(["Home", "About", "Regulate", "Herbarium", "Media and Blog", "Shop", "Innovate", "Contact", "Privacy", "Newsletter and footer"]);
    for (const key of ["home", "about", "regulate", "herbarium", "writing", "shop", "innovate", "contact", "privacy", "site"]) {
      await page.goto("/admin/pages?page=" + key);
      await expect(page.locator(".cadmin-card").first()).toBeVisible();
      await noSidewaysScroll(page);
    }
  });

  // ── v6.09 ──
  test("v6.09 herb photos: 'Show the whole photo' keeps the photo's own shape", async ({ page }) => {
    await signIn(page, "hello@ibvu.org", "/admin/herbphotos");
    const row = page.locator(".cadmin-item", { hasText: "Ashwagandha" });
    await row.locator("input[type=file]").setInputFiles("src/assets/pillar-educate.jpg"); // 900 × 600
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Show the whole photo/).check();
    await expect(dialog.getByRole("button", { name: "Larger +" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto("/educate/hs/ashwagandha");
    const img = page.locator(".profile-header .herb-thumb.whole img[data-whole]");
    await expect(img).toBeVisible();
    const b = await img.boundingBox();
    const max = page.viewportSize().width > 640 ? 190 : 110;
    expect(Math.round(b.width)).toBeLessThanOrEqual(max + 1);
    expect(Math.abs(b.width / b.height - 1.5)).toBeLessThan(0.05);           // its own shape, nothing cut off
    await page.goto("/educate/hs");
    const t = await page.locator(".herb-card.has-photo .herb-card-thumb img").boundingBox();
    expect(Math.round(t.width)).toBeLessThanOrEqual(64);
    expect(Math.abs(t.width / t.height - 1.5)).toBeLessThan(0.08);
    // and back to the square tile
    await page.goto("/admin/herbphotos");
    await page.locator(".cadmin-item", { hasText: "Ashwagandha" }).getByRole("button", { name: "Frame photo" }).click();
    await page.getByRole("dialog").getByLabel(/Show the whole photo/).uncheck();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await page.goto("/educate/hs/ashwagandha");
    await expect(page.locator(".profile-header .herb-thumb.whole")).toHaveCount(0);
  });

  test("v6.09 events: GMT or BST from the date, and a preview before saving", async ({ page }) => {
    await signIn(page, "hello@ibvu.org", "/admin/events");
    await page.getByRole("button", { name: "New event" }).click();
    await page.locator("#ev-title").fill("Summer herb walk");
    await page.locator("#ev-date").fill("2027-07-10");
    await page.locator("#ev-time").fill("18:00");
    await expect(page.locator(".ev-zone")).toHaveText("Shown as 18:00 BST (British Summer Time)");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const tile = page.locator(".ev-preview .event-tile");
    await expect(tile).toContainText("18:00 BST");
    await expect(tile).toContainText("Summer herb walk");
    await page.locator("#ev-date").fill("2027-12-04");
    await expect(page.locator(".ev-zone")).toHaveText("Shown as 18:00 GMT (Greenwich Mean Time)");
    await expect(tile).toContainText("18:00 GMT");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Close" }).click();
    await page.goto("/shop/events");
    await expect(page.locator(".event-tile", { hasText: "Summer herb walk" })).toContainText("Saturday 4 December 2027 · 18:00 GMT");
    // the calendar file uses the real time (18:00 GMT = 18:00Z)
    const href = await page.locator(".event-tile", { hasText: "Summer herb walk" }).getByRole("link", { name: /calendar/i }).first().getAttribute("href").catch(() => "");
    if (href) expect(decodeURIComponent(href)).toContain("DTSTART:20271204T180000Z");
  });

  test("v6.09 newsletters: title box, what is missing, picture size and caption in the email, sending history", async ({ page }) => {
    await confirmedReader(page, "history@example.org");
    await signIn(page, "hello@ibvu.org", "/admin/newsletters");
    await page.getByRole("button", { name: "New newsletter" }).click();
    // the Write button can be read (it was dark on dark)
    const write = page.locator(".cadmin-editor-bar .cadmin-tabs .cadmin-btn.on");
    await write.hover();                                      // it went blank while the mouse was over it
    const [fg, bg] = await write.evaluate(el => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; });
    expect(fg).not.toBe(bg);
    await expect(page.getByText("Newsletter title (shown at the top of the email and on the website)")).toBeVisible();
    await page.locator("#nl-subject").fill("Pictures");
    await page.getByRole("button", { name: "Send a test to me" }).click();
    await expect(page.locator(".cadmin-problem")).toContainText("Newsletter title");
    await expect(page.locator("#nl-title")).toHaveClass(/nl-missing/);
    await expect(page.locator("#nl-title")).toBeFocused();
    await page.locator("#nl-title").fill("Pictures issue");
    await expect(page.locator("#nl-title")).not.toHaveClass(/nl-missing/);
    // a picture with a caption, added in the framing window
    await page.locator(".rte-content .ProseMirror").click();
    await page.keyboard.type("Hello.");
    await page.locator(".rte input[type=file]").setInputFiles("src/assets/pillar-educate.jpg");
    const crop = page.getByRole("dialog", { name: /Crop and frame/ });
    await crop.getByLabel(/Caption/).fill("A lecture at IBVU");
    await crop.getByRole("button", { name: "Save" }).click();
    await expect(crop).toHaveCount(0);
    await expect(page.locator(".rte-pic-caption")).toHaveText("A lecture at IBVU");
    // make it smaller in the email preview
    await page.getByRole("button", { name: "Preview as email" }).click();
    const frame = page.frameLocator(".nl-email-frame");
    await expect(frame.getByText("A lecture at IBVU")).toBeVisible();
    // v6.10: a new picture starts at tile size (900 × 600 → 340 px)
    await expect(frame.locator("img[data-i='0']")).toHaveAttribute("width", "340");
    await frame.locator("img[data-i='0']").click();
    const bar = page.getByRole("toolbar", { name: "Picture size" });
    await expect(bar).toContainText("Picture 1: 340 px wide · tile size");
    await bar.getByRole("button", { name: "− Smaller" }).click();
    await expect(frame.locator("img[data-i='0']")).toHaveAttribute("width", "320");
    await bar.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "Write" }).click();
    await expect(page.locator(".rte-pic")).toHaveAttribute("style", /width: min\(320px, 58\.82%\)/);
    // send, then the sending history
    await page.getByRole("button", { name: "Send now…" }).click();
    await page.getByRole("button", { name: "Yes, send it now" }).click();
    await expect(page.getByText("Sent to 1 person.")).toBeVisible();
    await page.goto("/admin/newsletters");
    await page.getByRole("tab", { name: "Sending history" }).click();
    const person = page.locator(".nl-history-person", { hasText: "history@example.org" });
    await expect(person).toContainText("Pictures issue");
    await expect(person).toContainText("Sent");
    await page.locator("#nh-search").fill("nobody@");
    await expect(page.getByText("Nothing matches.")).toBeVisible();
    await page.locator("#nh-search").fill("history@");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download as spreadsheet/ }).click();
    expect((await download).suggestedFilename()).toMatch(/^ibvu-sending-history-/);
    await noSidewaysScroll(page);
  });

  test("v6.10 newsletters: pictures and cover start at tile size, resize by dragging in every view, smaller on a phone", async ({ page }) => {
    await signIn(page, "hello@ibvu.org", "/admin/newsletters");
    await page.getByRole("button", { name: "New newsletter" }).click();
    await page.locator("#nl-title").fill("Tile pictures");
    await page.locator("#nl-subject").fill("Tile pictures");
    // cover: 900 × 600 → tile size 340 px
    await page.locator(".cadmin-image input[type=file]").first().setInputFiles("src/assets/pillar-educate.jpg");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".nl-cover-size .cadmin-hint")).toContainText("340 px wide (tile size)");
    // a tall picture in the text: 900 × 1125 → fits in the tile: 182 px
    await page.locator(".rte-content .ProseMirror").click();
    await page.keyboard.type("Hello.");
    await page.locator(".rte input[type=file]").setInputFiles("src/assets/shop-events.jpg");
    await page.getByRole("dialog", { name: /Crop and frame/ }).getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".rte-pic")).toHaveAttribute("style", /min\(182px/);
    // the email: drag the picture's corner outwards
    await page.getByRole("button", { name: "Preview as email" }).click();
    const frame = page.frameLocator(".nl-email-frame");
    await expect(frame.locator("img[data-i='cover']")).toHaveAttribute("width", "340");
    await frame.locator("img[data-i='0']").click();
    const h = await frame.locator(".rz-h.br").boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + 30, h.y + 10, { steps: 6 });
    await page.mouse.up();
    const bar = page.getByRole("toolbar", { name: "Picture size" });
    await expect(bar).not.toContainText("182 px");
    const dragged = Number((await bar.locator(".nl-picbar-label").textContent()).match(/(\d+) px/)[1]);
    expect(dragged).toBeGreaterThan(200);
    // the web page: make the cover full width, then back to tile size
    await page.getByRole("button", { name: "Preview as web page" }).click();
    await page.locator(".nl-web [data-i='cover']").click();
    await bar.getByRole("button", { name: "Full width" }).click();
    await expect(bar).toContainText("Cover: 544 px wide · full width");
    await page.getByRole("button", { name: "Preview as email" }).click();
    await expect(frame.locator("img[data-i='cover']")).toHaveAttribute("width", "544");
    await page.getByRole("button", { name: "Write" }).click();
    await expect(page.locator(".nl-cover-size .cadmin-hint")).toContainText("544 px wide");
    await expect(page.locator(".rte-pic")).toHaveAttribute("style", new RegExp("min\\(" + dragged + "px"));
    // on a phone the pictures are smaller in proportion
    if (page.viewportSize().width <= 640) {
      await page.getByRole("button", { name: "Preview as email" }).click();
      const shown = (await frame.locator("img[data-i='cover']").boundingBox()).width;
      expect(shown).toBeLessThan(page.viewportSize().width);
    }
    await noSidewaysScroll(page);
  });

  test("v6.09 covers: a caption under the cover of an open article", async ({ page }) => {
    await signIn(page, "hello@ibvu.org", "/admin/articles");
    await page.getByRole("button", { name: "New article" }).click();
    await page.locator("#ar-title").fill("Cover caption test");
    await page.locator(".cadmin-image input[type=file]").first().setInputFiles("src/assets/pillar-educate.jpg");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Caption/).fill("Students in Harare");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".cadmin-image-caption input")).toHaveValue("Students in Harare");
    await page.locator(".rte-content .ProseMirror").click();
    await page.keyboard.type("Body text.");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Close" }).click();
    await page.goto("/media/cover-caption-test");
    await expect(page.locator(".article-cover-figure figcaption")).toHaveText("Students in Harare");
    expect(await page.locator("img.article-cover").getAttribute("src")).not.toContain("cap=");
  });

});
