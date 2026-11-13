// IBVU v6.07 — new file. Google Analytics (GA4), only with the visitor's consent.
//
// - Property "IBVU", web stream https://ibvu.org, Measurement ID G-3SRNS52BJ4
//   (set up in Google Analytics by Tatenda; the ID is public, not a secret).
// - Nothing is loaded and nothing is sent until the visitor presses Accept on
//   the cookie bar (src/components/CookieBar.jsx). Reject, or no choice, means
//   Google's script is never loaded and no analytics cookies are set.
// - Only the real site sends data (ibvu.org, www.ibvu.org): not the Vercel test
//   address, the double-click preview or a computer running the site.
// - Admin (anything under /admin) is never sent.
// - Every page change is sent as a page view (the site changes pages without
//   reloading, so Google would otherwise only see the first page).
// - A few anonymous events: newsletter_sign_up, contact_sent, herb_submitted,
//   event_booking_click. No names, email addresses or form text are ever sent.
// - Google signals and ad personalisation are switched off.
// It is Google's own tag (the "manual" gtag.js code from Google Analytics → Get tagging
// instructions), only added to the page after Accept instead of always.
// The choice is kept in this browser ("ibvu_cookie_consent_v1": "granted" or
// "denied") and can be changed with "Cookie settings" in the footer.

export const GA_ID = "G-3SRNS52BJ4";
const LIVE_HOSTS = ["ibvu.org", "www.ibvu.org"];
const KEY = "ibvu_cookie_consent_v1";

const isLive = () => typeof window !== "undefined" && LIVE_HOSTS.includes(window.location.hostname);
const isAdmin = path => /^\/admin(\/|$)/.test(path || "");

export function getConsent() {
  try { return window.localStorage.getItem(KEY) || ""; } catch { return ""; }
}

let loaded = false;
let lastPath = "";

function gtag() { window.dataLayer.push(arguments); } // the standard Google tag function

function load() {
  if (loaded || !isLive()) return loaded;
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;
  gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  gtag("js", new Date());
  gtag("config", GA_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(s);
  loaded = true;
  return true;
}

function enabled(path) {
  return getConsent() === "granted" && isLive() && !isAdmin(path);
}

// Removes Google Analytics cookies (after someone changes their mind).
function clearCookies() {
  const names = document.cookie.split(";").map(c => c.split("=")[0].trim()).filter(n => n === "_ga" || n.startsWith("_ga_"));
  const host = window.location.hostname;
  for (const n of names) {
    for (const domain of ["", "; domain=" + host, "; domain=." + host.replace(/^www\./, "")]) {
      document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + domain;
    }
  }
}

export function setConsent(choice) {
  try { window.localStorage.setItem(KEY, choice); } catch { /* the choice lasts for this visit only */ }
  if (choice === "granted") {
    if (load() && lastPath && !isAdmin(lastPath)) sendPage(lastPath, document.title);
  } else {
    if (loaded) gtag("consent", "update", { analytics_storage: "denied" });
    clearCookies();
  }
  window.dispatchEvent(new CustomEvent("ibvu:consent", { detail: choice }));
}

function sendPage(path, title) {
  gtag("event", "page_view", { page_path: path, page_location: window.location.origin + path, page_title: title });
}

// Called on every page change (App.jsx).
export function trackPage(path, title) {
  lastPath = path;
  if (!enabled(path) || !load()) return;
  sendPage(path, title);
}

// A named event, e.g. track("newsletter_sign_up", { lists: "monthly" }).
export function track(name, params = {}) {
  if (!enabled(window.location.pathname) || !load()) return;
  gtag("event", name, params);
}

// For the cookie bar: should it be shown on this page?
export function needsChoice(path) {
  return !isAdmin(path) && !getConsent() && window.location.protocol !== "file:";
}
