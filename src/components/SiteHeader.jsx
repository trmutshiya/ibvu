// IBVU v6.03 — what changed in this file: "Newsletter" (past issues, ibvu.org/newsletter) is added under About, after Media.
//
// IBVU v5.8 — what changed in this file since v5.7:
// - "Blog" under Educate is now a working link to ibvu.org/educate/blog.
//   Research Library is still listed but not clickable (not built).
//
// IBVU v5.7 — what changed in this file since v5.6:
// - "Home" is added as the first item and goes to the landing page.
// - "Shop" moves out of the Educate menu and becomes its own item, with a
//   dropdown for Herb Mail Club, Events, Products, Educational Resources and
//   Membership.
// - With seven items, the Menu button now takes over on screens narrower than
//   a small laptop (it used to appear on phones only).
// Still as before: no logo, "← ibvu" back button on inner pages, About opens
// the About pop-up, Media under About. Blog and Research Library are listed
// but not clickable because those pages are not built.
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSite } from '../lib/site.js';
import { usePage } from '../lib/content.js';

// Devices with a mouse open dropdowns on hover, so a click on the top-level
// item goes straight to its main destination.
function canHover() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
}

function Dropdown({ label, isOpen, isCurrent, onToggle, onClose, onPrimary, children }) {
  return (
    <div className={"hdr-item" + (isOpen ? " open" : "")}>
      <button
        className={"hdr-link" + (isCurrent ? " current" : "")}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          if (canHover()) { onClose(); e.currentTarget.blur(); onPrimary(); }
          else onToggle();
        }}
      >
        {label} <span className="hdr-caret" />
      </button>
      <div className="hdr-dropdown">
        <div className="hdr-dropdown-inner">{children}</div>
      </div>
    </div>
  );
}

export default function SiteHeader({
  overHero = false, // home page only: transparent until the hero is scrolled past
  intro = false,    // home page only: fade in while the intro animation plays
}) {
  const { openAbout, goHerbarium, goShop } = useSite();
  const { pathname } = useLocation();
  const shop = usePage("shop");
  const isHome = pathname === "/";
  const at = prefix => pathname.startsWith(prefix);

  const [open, setOpen] = useState(null);          // dropdown: "about" | "educate" | "shop" | null
  const [menuOpen, setMenuOpen] = useState(false); // small-screen menu
  const [solid, setSolid] = useState(!overHero);
  const ref = useRef(null);

  // Transparent over the hero, solid once the hero has been scrolled past.
  useEffect(() => {
    if (!overHero) { setSolid(true); return; }
    function update() {
      const hero = document.getElementById('home-hero');
      const headerH = ref.current ? ref.current.offsetHeight : 0;
      setSolid(!hero || hero.getBoundingClientRect().bottom <= headerH);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [overHero]);

  // Close menus on outside click, Escape, or when the page changes.
  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(null); setMenuOpen(false); } }
    function onKey(e) { if (e.key === 'Escape') { setOpen(null); setMenuOpen(false); } }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  useEffect(() => { setOpen(null); setMenuOpen(false); }, [pathname]);

  // Run a menu action and close the menus.
  function go(action) {
    return (e) => {
      setOpen(null); setMenuOpen(false);
      if (e && e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
      if (action) action();
    };
  }
  const toggle = name => () => setOpen(open === name ? null : name);

  // Home: on the home page it scrolls back to the top; elsewhere it is a link.
  const goTop = go(() => window.scrollTo({ top: 0, behavior: "smooth" }));

  const shopLinks = [
    { to: "/shop/mail", label: shop.mailTitle },
    { to: "/shop/events", label: shop.eventsTitle },
    ...shop.more.map(t => ({ to: "/shop/" + t.slug, label: t.title })),
  ];

  const cls = "site-header"
    + (overHero ? " over-hero" : "")
    + (solid || menuOpen ? " solid" : "")
    + (intro ? " intro" : "");

  return (
    <header className={cls} ref={ref}>
      <div className="hdr-left">
        {!isHome && <Link className="hdr-back" to="/" aria-label="Back to the IBVU home page">← ibvu</Link>}
      </div>

      {/* Laptop and desktop: seven items across */}
      <nav className="main-nav" aria-label="Main">
        <div className="hdr-item">
          <Link className={"hdr-link" + (isHome ? " current" : "")} to="/" onClick={isHome ? goTop : go()}>Home</Link>
        </div>

        <Dropdown label="About" isOpen={open === "about"} isCurrent={at("/media") || at("/newsletter")} onToggle={toggle("about")} onClose={() => setOpen(null)} onPrimary={openAbout}>
          <button className="primary" onClick={go(openAbout)}>About IBVU</button>
          <Link to="/media" onClick={go()}>Media</Link>
          <Link to="/newsletter" onClick={go()}>Newsletter</Link>
        </Dropdown>

        <div className="hdr-item">
          <Link className={"hdr-link" + (at("/regulate") ? " current" : "")} to="/regulate" onClick={go()}>Regulate</Link>
        </div>

        <Dropdown label="Educate" isOpen={open === "educate"} isCurrent={at("/educate")} onToggle={toggle("educate")} onClose={() => setOpen(null)} onPrimary={goHerbarium}>
          <button className="primary" onClick={go(goHerbarium)}>Herbarium Scientifica</button>
          <Link to="/educate/blog" onClick={go()}>Blog</Link>
          <span className="hdr-pending" aria-disabled="true">Research Library</span>
        </Dropdown>

        <div className="hdr-item">
          <Link className={"hdr-link" + (at("/innovate") ? " current" : "")} to="/innovate" onClick={go()}>Innovate</Link>
        </div>

        <Dropdown label="Shop" isOpen={open === "shop"} isCurrent={at("/shop")} onToggle={toggle("shop")} onClose={() => setOpen(null)} onPrimary={goShop}>
          <Link className="primary" to="/shop" onClick={go()}>Shop</Link>
          {shopLinks.map(l => <Link to={l.to} onClick={go()} key={l.to}>{l.label}</Link>)}
        </Dropdown>

        <div className="hdr-item">
          <Link className={"hdr-link" + (at("/contact") ? " current" : "")} to="/contact" onClick={go()}>Contact</Link>
        </div>
      </nav>

      {/* Smaller screens: one Menu button */}
      <button
        className="hdr-menu-btn"
        aria-expanded={menuOpen}
        aria-controls="site-menu"
        onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
      >
        <span className="hdr-menu-icon" aria-hidden="true" />
        {menuOpen ? "Close" : "Menu"}
      </button>

      {menuOpen && (
        <nav className="hdr-mobile-menu" id="site-menu" aria-label="Main">
          <Link to="/" onClick={isHome ? goTop : go()}>Home</Link>
          <button onClick={go(openAbout)}>About</button>
          <Link className="sub" to="/media" onClick={go()}>Media</Link>
          <Link className="sub" to="/newsletter" onClick={go()}>Newsletter</Link>
          <Link to="/regulate" onClick={go()}>Regulate</Link>
          <button onClick={go(goHerbarium)}>Educate</button>
          <button className="sub" onClick={go(goHerbarium)}>Herbarium Scientifica</button>
          <Link className="sub" to="/educate/blog" onClick={go()}>Blog</Link>
          <span className="hdr-pending sub" aria-disabled="true">Research Library</span>
          <Link to="/innovate" onClick={go()}>Innovate</Link>
          <Link to="/shop" onClick={go()}>Shop</Link>
          {shopLinks.map(l => <Link className="sub" to={l.to} onClick={go()} key={l.to}>{l.label}</Link>)}
          <Link to="/contact" onClick={go()}>Contact</Link>
        </nav>
      )}
    </header>
  );
}
