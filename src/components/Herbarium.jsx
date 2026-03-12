import { useState, useEffect } from 'react';
import { HERBS_FALLBACK } from '../constants/herbs.js';
import { CONDITION_GROUPS } from '../constants/conditions.js';
import { sbFetchApproved, sbFetchStaticHerbs } from '../lib/supabase.js';
import ConditionSidebar from './ConditionSidebar.jsx';
import HerbCard from './HerbCard.jsx';
import HerbProfile from './HerbProfile.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import SubmitForm from './SubmitForm.jsx';

const HERBS_PER_PAGE = 24;

export default function Herbarium({ onBack, onAdmin }) {
  const [tab, setTab]                         = useState("browse");
  const [approvedHerbs, setApprovedHerbs]     = useState([]);
  const [staticHerbs, setStaticHerbs]         = useState(HERBS_FALLBACK);
  const [selected, setSelected]               = useState(null);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [query, setQuery]                     = useState("");
  const [activeCondition, setActiveCondition] = useState(null);
  const [sortMode, setSortMode]               = useState("default");
  const [herbPage, setHerbPage]               = useState(1);

  useEffect(function() {
    sbFetchApproved().then(rows => setApprovedHerbs(rows));
    sbFetchStaticHerbs().then(rows => { if (rows.length > 0) setStaticHerbs(rows); });
  }, []);

  // Deduplication: if a static herb was promoted to Supabase, use the Supabase version
  const approvedNames = new Set(approvedHerbs.map(h => h.name.toLowerCase().trim()));
  const herbs = [
    ...staticHerbs.filter(h => !approvedNames.has(h.name.toLowerCase().trim())),
    ...approvedHerbs,
  ];

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
      <button className="back-to-ibvu" onClick={onBack}>← ibvu</button>
      <div className="herb-app">
        <div className="herb-header">
          <h1>Herbarium<br />Scientifica</h1>
          <p>A community-powered catalogue of medicinal plants with evidence-based literature</p>
        </div>
        {!selected && (
          <nav className="herb-nav">
            <button className={tab === "browse" ? "active" : ""} onClick={() => setTab("browse")}>Browse Herbs</button>
            <button className={tab === "submit" ? "active" : ""} onClick={() => setTab("submit")}>Submit an Herb</button>
          </nav>
        )}

        {selected ? (
          <HerbProfile
            herb={selected}
            conditionId={selectedCondition}
            onBack={() => { setSelected(null); setSelectedCondition(null); }}
          />
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
                      <HerbCard key={h.id} herb={h} onClick={herb => {
                        setSelected(herb);
                        setSelectedCondition(activeCondition);
                      }} />
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

        <div className="herb-footer">
          <button className="admin-trigger" onClick={onAdmin} title="">·</button>
        </div>
      </div>
    </div>
  );
}
