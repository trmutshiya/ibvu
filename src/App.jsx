// IBVU v6.07 — what changed in this file: Google Analytics page views (with consent) and the cookie bar.
//
// IBVU v6.03 — what changed in this file: new pages ibvu.org/newsletter (past issues) and
// ibvu.org/newsletter/issue-name. ibvu.org/newsletter/confirm keeps its own page.
//
// IBVU v6.02 — what changed in this file: new pages for the links in mailing list emails,
// ibvu.org/newsletter/confirm and ibvu.org/unsubscribe.
//
// IBVU v5.92 — what changed in this file: new address ibvu.org/privacy.
//
// IBVU v5.9 — what changed in this file since v5.8:
// - ibvu.org/about now works: it opens the home page with the About pop-up.
// - People signed in to admin see a small "Edit this page" button on the
//   public pages (EditPageButton.jsx). Visitors never see it.
// - Admin sign-in itself is handled inside the admin area (AdminArea.jsx).
// - Fix: the About pop-up now closes when you move to another page (for
//   example with the browser's back button). It used to stay open on top.
//
// IBVU v5.8 — what changed in this file since v5.7:
// - New addresses for the Blog: ibvu.org/educate/blog and
//   ibvu.org/educate/blog/post-title. Admin gains ibvu.org/admin/blog.
//
// IBVU v5.7 — what changed in this file since v5.6:
// - Every herb has its own address: ibvu.org/educate/hs/herb-name
//   (ibvu.org/educate/hs/submit is the submission form).
// - All of admin now lives under ibvu.org/admin:
//     /admin             front page listing the sections a person may use
//     /admin/herbreview  herb submission review (was ibvu.org/admin)
//     /admin/herbphotos  photos sent in with herbs, and photos added by admin
//     /admin/events  /admin/articles  /admin/pages  /admin/people  /admin/history
//   The old address ibvu.org/admin/content forwards to ibvu.org/admin.
//   Admin is not linked from the public site; it is reached by its address.
// - "Shop" in the menu goes to ibvu.org/shop (goShop).
// Unchanged: home page and intro, Regulate, Innovate, Contact, Media, Shop
// pages and the short addresses (ibvu.org/mail and so on).
// Not built: Blog, Research Library.
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Landing from './components/Landing.jsx';
import Herbarium from './components/Herbarium.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import PillarsSection from './components/PillarsSection.jsx';
import InfoPanel from './components/InfoPanel.jsx';
import Shop, { ShopSection } from './components/Shop.jsx';
import Regulate from './components/Regulate.jsx';
import Innovate from './components/Innovate.jsx';
import Contact from './components/Contact.jsx';
import Media, { MediaArticle, Blog, BlogArticle } from './components/Media.jsx';
import Privacy from './components/Privacy.jsx';
import { NewsletterConfirm, Unsubscribe } from './components/Subscriptions.jsx';
import { NewsletterIndex, NewsletterIssue } from './components/Newsletters.jsx';
import NotFound from './components/NotFound.jsx';
import EditPageButton from './components/EditPageButton.jsx';
import CookieBar from './components/CookieBar.jsx';
import { trackPage } from './lib/analytics.js';
import { ENTER_AT } from './constants/animation.js';
import { SiteContext, useSite, usePageTitle, scrollToId } from './lib/site.js';

// Admin is only downloaded when someone opens ibvu.org/admin.
const AdminArea = lazy(() => import('./components/admin/AdminArea.jsx'));

// The intro animation plays once per visit (remembered until the tab is closed).
const INTRO_KEY = "ibvu_intro_played";
function introAlreadyPlayed() {
  try { return window.sessionStorage.getItem(INTRO_KEY) === "1"; } catch { return false; }
}
function rememberIntroPlayed() {
  try { window.sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* private browsing: play it again next time */ }
}
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function HomePage() {
  usePageTitle(null);
  const { goHerbarium } = useSite();
  const location = useLocation();
  const arrivedForSection = location.state && location.state.scrollTo;
  // true = show the hero in its finished state (no animation)
  const [skipped, setSkipped] = useState(() => introAlreadyPlayed() || prefersReducedMotion() || !!arrivedForSection);

  // Arriving from another page via Regulate / Innovate: go to that pillar.
  useEffect(() => {
    if (arrivedForSection) {
      rememberIntroPlayed();
      requestAnimationFrame(() => scrollToId(arrivedForSection));
    }
  }, [arrivedForSection]);

  // When the animation has played out, scroll down to the pillars
  // (unless the visitor has already started scrolling by themselves).
  useEffect(() => {
    if (skipped) return;
    const timer = setTimeout(() => {
      rememberIntroPlayed();
      if (window.scrollY < 10) scrollToId("pillars");
    }, (ENTER_AT + 2) * 1000);
    return () => clearTimeout(timer);
  }, [skipped]);

  function skip() {
    setSkipped(true);
    rememberIntroPlayed();
    requestAnimationFrame(() => scrollToId("pillars"));
  }

  return (
    <div className="home-page">
      <SiteHeader overHero intro={!skipped} />
      <Landing skipped={skipped} onSkip={skip} onScrollDown={() => scrollToId("pillars")} />
      <PillarsSection onEducation={goHerbarium} />
      <SiteFooter />
    </div>
  );
}

function AdminPage() {
  return (
    <Suspense fallback={<div className="cadmin-shell" />}>
      <AdminArea />
    </Suspense>
  );
}

function Site() {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const [panel, setPanel]     = useState(null);  // "about" | "contact" | null
  const [leaving, setLeaving] = useState(false); // fade-to-dark when leaving the home page for the Herbarium
  const leaveTimer = useRef(null);

  // Start each page at the top (unless we are heading to a section of the home page).
  useEffect(() => {
    if (!(state && state.scrollTo)) window.scrollTo(0, 0);
    setPanel(null); // moving to another page closes the About pop-up
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  // Google Analytics: each page change is a page view (only with consent, only
  // on ibvu.org, never in admin; see src/lib/analytics.js). Sent after the page
  // has set its title.
  useEffect(() => {
    const t = setTimeout(() => trackPage(pathname, document.title), 300);
    return () => clearTimeout(t);
  }, [pathname]);

  // ibvu.org/about lands on the home page with the About pop-up open.
  useEffect(() => {
    if (!(state && state.about)) return;
    setPanel("about");
    // Forget the request, so reloading the page does not open the pop-up again.
    navigate(pathname, { replace: true, state: { scrollTo: state.scrollTo } });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const site = {
    openAbout:   () => setPanel("about"),
    // Contact is a page now. A type ("advisory", "research"…) pre-selects the enquiry type.
    openContact: (type) => navigate(typeof type === "string" ? "/contact?type=" + type : "/contact"),
    // Home → Herbarium keeps the existing fade-to-dark transition.
    goHerbarium: () => {
      if (pathname === "/educate/hs") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (pathname !== "/") { navigate("/educate/hs"); return; }
      if (leaving) return;
      setLeaving(true);
      leaveTimer.current = setTimeout(() => { navigate("/educate/hs"); setLeaving(false); }, 1000);
    },
    goShop: () => navigate("/shop"),
  };

  return (
    <SiteContext.Provider value={site}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<Navigate to="/" replace state={{ about: true, scrollTo: "home-hero" }} />} />
        <Route path="/educate" element={<Navigate to="/educate/hs" replace />} />
        <Route path="/educate/hs/:slug?" element={<Herbarium />} />
        <Route path="/educate/blog" element={<Blog />} />
        <Route path="/educate/blog/:slug" element={<BlogArticle />} />
        <Route path="/regulate" element={<Regulate />} />
        <Route path="/innovate" element={<Innovate />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/newsletter/confirm" element={<NewsletterConfirm />} />
        <Route path="/newsletter" element={<NewsletterIndex />} />
        <Route path="/newsletter/:slug" element={<NewsletterIssue />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/media" element={<Media />} />
        <Route path="/media/:slug" element={<MediaArticle />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/:section" element={<ShopSection />} />
        {/* Short addresses: ibvu.org/mail and so on forward to the shop pages. */}
        {["mail", "events", "products", "resources", "membership"].map(s => (
          <Route key={s} path={"/" + s} element={<Navigate to={"/shop/" + s} replace />} />
        ))}
        <Route path="/admin/content" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/:section?" element={<AdminPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {panel && <InfoPanel type={panel} onClose={() => setPanel(null)} />}
      <EditPageButton />
      <CookieBar />
      <div className={"overlay" + (leaving ? " on" : "")} />
    </SiteContext.Provider>
  );
}

export default function App() {
  // The single-file preview is opened straight from disk, where normal page
  // addresses cannot work, so it falls back to "#/shop"-style addresses.
  // On ibvu.org this is always the normal router.
  const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;
  return (
    <Router>
      <Site />
    </Router>
  );
}
