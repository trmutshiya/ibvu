import ScientificSection from './ScientificSection.jsx';

export default function HerbProfile({ herb, conditionId, onBack }) {
  return (
    <div>
      <button className="back-btn" onClick={onBack}>← All Herbs</button>
      <div className="profile-header">
        <div>
          <h1>{herb.name}</h1>
          <p className="latin">{herb.latinName}</p>
          <div className="tags">
            <span className="tag">{herb.category}</span>
            <span className="tag gold">{herb.family}</span>
          </div>
        </div>
      </div>
      <div className="sections">
        <div className="section">
          <div className="section-header"><span className="section-icon">☿</span><span className="section-label">Identity</span></div>
          <div className="section-body">
            <div className="info-grid">
              <div className="info-item"><label>Common Name</label><p>{herb.name}</p></div>
              <div className="info-item"><label>Latin Name</label><p><em>{herb.latinName}</em></p></div>
              <div className="info-item"><label>Plant Family</label><p>{herb.family}</p></div>
              <div className="info-item"><label>Origin</label><p>{herb.origin}</p></div>
              <div className="info-item"><label>Part Used</label><p>{herb.partUsed}</p></div>
              <div className="info-item"><label>Category</label><p>{herb.category}</p></div>
            </div>
          </div>
        </div>
        <div className="section">
          <div className="section-header"><span className="section-icon">◈</span><span className="section-label">Other Names</span></div>
          <div className="section-body">
            <div className="alt-names">
              {(herb.altNames || []).map((n, i) => <span className="alt-name" key={i}>{n}</span>)}
              {(!herb.altNames || herb.altNames.length === 0) && <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Not recorded</span>}
            </div>
          </div>
        </div>
        <div className="section">
          <div className="section-header"><span className="section-icon">✦</span><span className="section-label">Overview</span></div>
          <div className="section-body">
            <p style={{ lineHeight: 1.8, fontSize: "1.05rem", color: "var(--bark)", marginBottom: 20 }}>{herb.description}</p>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>Traditional Uses</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {herb.uses.map((u, i) => <span className="tag" key={i}>{u}</span>)}
              </div>
            </div>
          </div>
        </div>
        <div className="section">
          <div className="section-header"><span className="section-icon">⚗</span><span className="section-label">Scientific Literature</span></div>
          <div className="section-body"><ScientificSection herb={herb} conditionId={conditionId} /></div>
        </div>
      </div>
    </div>
  );
}
