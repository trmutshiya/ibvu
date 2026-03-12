import { useState } from 'react';
import { CONDITION_GROUPS, CONDITION_SEARCH_TERMS } from '../constants/conditions.js';
import { fetchLiterature } from '../lib/edge.js';
import { Sentry } from '../lib/sentry.js';

const PAGE_SIZE = 10;

export default function ScientificSection({ herb, conditionId }) {
  const [papers, setPapers]     = useState(herb.papers || []);
  const [loading, setLoading]   = useState(false);
  const [loadStep, setLoadStep] = useState("");
  const [searched, setSearched] = useState((herb.papers || []).length > 0);
  const [error, setError]       = useState(null);
  const [page, setPage]         = useState(1);
  const [manualQuery, setManualQuery] = useState("");
  const [lastSearchLabel, setLastSearchLabel] = useState("");

  const conditionGroup = conditionId ? CONDITION_GROUPS.find(g => g.id === conditionId) : null;
  const conditionTerms = conditionId ? (CONDITION_SEARCH_TERMS[conditionId] || null) : null;

  async function runSearch(narrowTerms, label) {
    setLoading(true);
    setError(null);
    setPage(1);
    setLoadStep("Connecting…");
    try {
      const results = await fetchLiterature(herb.name, herb.latinName, setLoadStep, narrowTerms);
      setPapers(results);
      setSearched(true);
      setLastSearchLabel(label || "");
    } catch (e) {
      console.error(e);
      Sentry.captureException(e, { tags: { area: "pubmed-search" } });
      setError("Search failed: " + e.message + ". Please check your internet connection.");
    }
    setLoading(false);
    setLoadStep("");
  }

  function handleContextSearch() {
    const label = conditionGroup ? conditionGroup.label : "General";
    runSearch(conditionTerms || null, label);
  }

  function handleManualSearch() {
    const terms = manualQuery.trim().split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    if (terms.length === 0) return;
    runSearch(terms, "Custom: " + manualQuery.trim());
  }

  const totalPages = Math.ceil(papers.length / PAGE_SIZE);
  const pageStart  = (page - 1) * PAGE_SIZE;
  const pagePapers = papers.slice(pageStart, pageStart + PAGE_SIZE);
  const isLastPage = page === totalPages && totalPages > 0;

  const pubmedSearchUrl = "https://pubmed.ncbi.nlm.nih.gov/?term=" +
    encodeURIComponent(
      '"' + herb.name + '"[MeSH Terms] OR "' + herb.name +
      '"[Title/Abstract] OR "' + herb.latinName + '"[Title/Abstract]'
    ) + "&sort=relevance";

  const contextBtnLabel = conditionGroup
    ? "Search " + conditionGroup.label + " Research"
    : "Search PubMed Literature";

  return (
    <div>
      <button className="sci-btn" onClick={handleContextSearch} disabled={loading}>
        {loading ? <span className="spinner" /> : "⚗"}
        {loading ? loadStep : (searched && !manualQuery) ? "Refresh — " + contextBtnLabel : contextBtnLabel}
      </button>

      {conditionGroup && (
        <div className="search-context-pill">
          Narrowed to <strong>{conditionGroup.label}</strong> · {conditionGroup.description}
        </div>
      )}

      <div className="manual-search-wrap">
        <div className="manual-search-label">Custom search</div>
        <div className="manual-search-row">
          <input
            className="manual-search-input"
            placeholder={"Search within " + herb.name + " literature (e.g. anxiety, cortisol, RCT)…"}
            value={manualQuery}
            onChange={e => setManualQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleManualSearch(); }}
          />
          <button
            className="manual-search-btn"
            onClick={handleManualSearch}
            disabled={!manualQuery.trim() || loading}
          >
            Search
          </button>
        </div>
      </div>

      {error && (
        <div className="no-results" style={{ color: "var(--bark-light)", background: "#fdf5ec", border: "1px solid #e8d5b8", borderRadius: 2, padding: "16px 24px" }}>
          ⚠ {error}
        </div>
      )}

      {searched && !loading && !error && (
        <div>
          {papers.length === 0 ? (
            <div className="no-results">No papers found for this search. Try broader terms.</div>
          ) : (
            <>
              <div className="results-meta-bar">
                <span>{papers.length} result{papers.length !== 1 ? "s" : ""} · PubMed</span>
                <span className="results-meta-right">
                  {lastSearchLabel && <span className="search-label-pill">{lastSearchLabel}</span>}
                  <span style={{ opacity: 0.6 }}>
                    {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, papers.length)} of {papers.length}
                  </span>
                </span>
              </div>

              <div className="paper-list">
                {pagePapers.map((p, i) => (
                  <div className="paper" key={i}>
                    <div className="paper-title">{p.title}</div>
                    <div className="paper-meta">{p.authors} · {p.journal} · {p.year}</div>
                    <div className="paper-summary">{p.summary}</div>
                    <a className="paper-link" href={p.url} target="_blank" rel="noreferrer">
                      ↗ Read full abstract on PubMed
                    </a>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button className="page-arrow" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
                  <div className="pagination-pages">
                    {Array.from({ length: totalPages }, (_, i) => {
                      const p = i + 1;
                      const rangeStart = (p - 1) * PAGE_SIZE + 1;
                      const rangeEnd   = Math.min(p * PAGE_SIZE, papers.length);
                      return (
                        <button key={p} className={"page-btn" + (page === p ? " active" : "")} onClick={() => setPage(p)} title={rangeStart + "–" + rangeEnd}>{p}</button>
                      );
                    })}
                  </div>
                  <button className="page-arrow" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</button>
                </div>
              )}

              {isLastPage && (
                <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--cream-dark)" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Explore further</div>
                  <a className="pubmed-deep-link" href={pubmedSearchUrl} target="_blank" rel="noreferrer">
                    ↗ Continue research on PubMed
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!searched && !loading && !error && (
        <div className="no-results">
          {conditionGroup
            ? "Click above to search " + herb.name + " research narrowed to " + conditionGroup.label + ", or use the custom search below."
            : "Click above to search peer-reviewed research on " + herb.name + "."}
        </div>
      )}
    </div>
  );
}
