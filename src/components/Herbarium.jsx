// IBVU v5.92 — what changed in this file: herbs published twice no longer share one address (see src/lib/herbs.js).
//
// IBVU v5.9 — what changed in this file: the line under the title and the two tab labels now come from admin → Pages → Herbarium (same wording as before until edited).
//
// IBVU v5.7 — what changed in this file since v5.3:
// - Every herb has its own page and address: ibvu.org/educate/hs/herb-name.
//   The submission form is at ibvu.org/educate/hs/submit. The browser's back
//   button and shared links now work for individual herbs.
// - The small dot at the bottom of the page that opened admin is removed.
//   Admin is reached at ibvu.org/admin.
// - Search, filters, sorting and paging are unchanged.
import { useState, useEffect } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { HERBS_FALLBACK } from '../constants/herbs.js';
import { CONDITION_GROUPS } from '../constants/conditions.js';
import { sbFetchApproved, sbFetchStaticHerbs } from '../lib/supabase.js';
import ConditionSidebar from './ConditionSidebar.jsx';
import HerbCard from './HerbCard.jsx';
import HerbProfile from './HerbProfile.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import SubmitForm from './SubmitForm.jsx';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import { usePageTitle } from '../lib/site.js';
import { usePage } from '../lib/content.js';
import { mergeHerbs } from '../lib/herbs.js';

const HERBS_PER_PAGE = 24;

export default function Herbarium() {
  // The address decides what is shown:
  //   /educate/hs            the catalogue
  //   /educate/hs/submit     the submission form
  //   /educate/hs/herb-name  one herb's page
  const c = usePage("herbarium");
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = slug === "submit" ? "submit" : "browse";
  const herbSlug = slug && slug !== "submit" ? slug : null;
  const [loaded, setLoaded]                   = useState(false);
  const [approvedHerbs, setApprovedHerbs]     = useState([]);
  const [staticHerbs, setStaticHerbs]         = useState(HERBS_FALLBACK);
  const [query, setQuery]                     = useState("");
  const [activeCondition, setActiveCondition] = useState(null);
  const [sortMode, setSortMode]               = useState("default");
  const [herbPage, setHerbPage]               = useState(1);

  useEffect(function() {
    Promise.all([
      sbFetchApproved().then(rows => setApprovedHerbs(rows)),
      sbFetchStaticHerbs().then(rows => { if (rows.length > 0) setStaticHerbs(rows); }),
    ]).finally(() => setLoaded(true));
  }, []);

  // Built-in herbs plus approved ones, each with its own address (herb.slug).
  const herbs = mergeHerbs(staticHerbs, approvedHerbs);

  // The herb whose page is open (if any), found by its address.
  const selected = herbSlug ? herbs.find(h => h.slug === herbSlug) : null;
  const selectedCondition = (location.state && location.state.condition) || null;
  usePageTitle(
    selected ? selected.name : tab === "submit" ? "Submit an herb" : "Herbarium Scientifica",
    selected ? selected.name + (selected.latinName ? " (" + selected.latinName + "). " : ". ") + (selected.description || "") : "A community-powered catalogue of medicinal plants with evidence-based literature."
  );

  const conditionFiltered = activeCondition
    ? herbs.filter(h => (h.conditions || []).includes(activeCondition))
    : herbs;

  const queryFiltered = conditionFiltered.filter(function(h) {
    const q = query.toLowerCase();
    return (
      h.name.toLowerCase().includes(q) ||
      (h.latinName || "").toLowerCase().includes(q) ||
      (h.category || "").toLowerCase().includes(q)
    );
  });

  const filtered = sortMode === "az"
    ? queryFiltered.slice().sort((a, b) => a.name.localeCompare(b.name))
    : sortMode === "za"
    ? queryFiltered.slice().sort((a, b) => b.name.localeCompare(a.name))
    : queryFiltered;

  useEffect(function() { setHerbPage(1); }, [query, activeCondition, sortMode]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / HERBS_PER_PAGE));
  const safePage    = Math.min(herbPage, totalPages);
  const pagedHerbs  = filtered.slice((safePage - 1) * HERBS_PER_PAGE, safePage * HERBS_PER_PAGE);
  const totalHerbs  = herbs.length;
  const activeGroup = activeCondition ? CONDITION_GROUPS.find(g => g.id === activeCondition) : null;

  function handleConditionSelect(id) {
    setActiveCondition(id);
    setQuery("");
  }

  return (
    <div className="herb-shell">
      <SiteHeader />

      <div className="herb-app">
        <div className="herb-header">
          {/* On a herb's own page the herb name is the main heading. */}
          {herbSlug
            ? <Link className="herb-title-link" to="/educate/hs"><span className="herb-title">Herbarium<br />Scientifica</span></Link>
            : <h1>Herbarium<br />Scientifica</h1>}
          <p>{c.lead}</p>
        </div>
        {!herbSlug && (
          <nav className="herb-nav">
            <Link className={tab === "browse" ? "active" : ""} to="/educate/hs">{c.browseLabel}</Link>
            <Link className={tab === "submit" ? "active" : ""} to="/educate/hs/submit">{c.submitLabel}</Link>
          </nav>
        )}

        {herbSlug ? (
          selected ? (
            <HerbProfile
              herb={selected}
              conditionId={selectedCondition}
              onBack={() => navigate("/educate/hs")}
            />
          ) : (
            <div className="empty-state">
              <p>{loaded ? "We could not find that herb." : "Loading…"}</p>
              {loaded && <p style={{ marginTop: 16 }}><Link className="page-back" to="/educate/hs">← All Herbs</Link></p>}
            </div>
          )
        ) : tab === "browse" ? (
          <div className="browse-layout">
            <ConditionSidebar
              herbs={herbs}
              active={activeCondition}
              onSelect={handleConditionSelect}
            />

            <div className="browse-main">
              <div className="search-wrap">
                <span className="search-icon">⌕</span>
                <input
                  placeholder={activeCondition ? "Search within " + activeGroup.label + "…" : "Search by name, latin name, or category…"}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              {activeGroup && (
                <div className="active-filter-bar">
                  <span className="active-filter-label">
                    {activeGroup.label} · {conditionFiltered.length} herb{conditionFiltered.length !== 1 ? "s" : ""}
                  </span>
                  <button className="clear-filter" onClick={() => { setActiveCondition(null); setQuery(""); }}>
                    ✕ Clear filter
                  </button>
                </div>
              )}

              <div className="grid-toolbar">
                <span className="grid-count">
                  {filtered.length === totalHerbs
                    ? "All " + totalHerbs + " herbs"
                    : "Showing " + filtered.length + " of " + totalHerbs + " herbs"}
                  {activeGroup ? " · " + activeGroup.label : ""}
                </span>
                <div className="sort-toggle">
                  <button className={"sort-btn" + (sortMode === "default" ? " active" : "")} onClick={() => setSortMode("default")} title="Default order">Default</button>
                  <button className={"sort-btn" + (sortMode === "az" ? " active" : "")} onClick={() => setSortMode("az")} title="Sort A–Z">A → Z</button>
                  <button className={"sort-btn" + (sortMode === "za" ? " active" : "")} onClick={() => setSortMode("za")} title="Sort Z–A">Z → A</button>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="empty-state">
                  <p>{activeGroup ? "No herbs found for " + activeGroup.label + " yet." : "No herbs match your search."}</p>
                </div>
              ) : (
                <>
                  <div className="herb-grid">
                    {pagedHerbs.map(h => (
                      <HerbCard key={h.slug} herb={h} conditionId={activeCondition} />
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="herb-pagination">
                      <button className="page-btn" disabled={safePage === 1} onClick={() => setHerbPage(p => Math.max(1, p - 1))}>← Prev</button>
                      <span className="page-info">Page {safePage} of {totalPages} · {filtered.length} herbs</span>
                      <button className="page-btn" disabled={safePage === totalPages} onClick={() => setHerbPage(p => Math.min(totalPages, p + 1))}>Next →</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <ErrorBoundary>
            <SubmitForm />
          </ErrorBoundary>
        )}

      </div>

      <SiteFooter disclaimer />
    </div>
  );
}
