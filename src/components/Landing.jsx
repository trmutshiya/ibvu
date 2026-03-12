import { BRANCHES, TREE_START, LEVEL_DUR, BRANCH_DUR, LEAVES_AT, MOTES, DROPLETS } from '../constants/animation.js';

export default function Landing({ skipped, onSkip, onEnter, panel, onPanel }) {
  return (
    <div className={"ibvu-landing" + (skipped ? " anim-skip" : "")}>
      <button className="skip-btn" onClick={onSkip}>skip ›</button>
      <div className="atm">
        {MOTES.map(m => (
          <div key={m.id} className="mote" style={{ left: m.x + "%", top: m.y + "%", width: m.size, height: m.size, "--d": m.dur, "--dl": m.delay }} />
        ))}
      </div>
      <div className="ibvu-title">IBVU</div>
      <div className="ibvu-lower">ibvu</div>
      <div className="scene">
        <div className="bowl-wrap">
          <svg width="100" height="66" viewBox="0 0 100 66" fill="none">
            <ellipse cx="50" cy="22" rx="40" ry="13" stroke="#c9a84c" strokeWidth="1.5" fill="rgba(201,168,76,0.06)" />
            <path d="M10 22 Q50 62 90 22" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <ellipse cx="50" cy="22" rx="30" ry="6" fill="rgba(120,200,240,0.42)" />
            <ellipse cx="46" cy="21" rx="11" ry="2.5" fill="rgba(190,235,255,0.28)" />
            <path d="M90 22 Q100 14 97 5" stroke="#c9a84c" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="water-pour" />
        {DROPLETS.map(d => (
          <div key={d.id} className="droplet" style={{ left: d.left, top: d.top, width: d.size, height: d.size, "--dd": d.dur, "--ddl": d.delay, "--dx": d.dx, "--dy": d.dy }} />
        ))}
        <div className="ripple" />
        <div className="ripple2" />
        <div className="wet-earth" />
        <svg style={{ position: "absolute", bottom: 50, left: "50%", transform: "translateX(-50%)", overflow: "visible" }} width="300" height="310" viewBox="0 0 300 310" fill="none">
          {BRANCHES.map(b => (
            <line key={b.id} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={b.color} strokeWidth={b.sw} strokeLinecap="round"
              style={{ strokeDasharray: b.len, strokeDashoffset: b.len, animation: `drawBranch ${BRANCH_DUR}s ease-out forwards ${(TREE_START + b.level * LEVEL_DUR).toFixed(2)}s` }} />
          ))}
          {BRANCHES.filter(b => b.isLeaf).map(b => (
            <circle key={"lf" + b.id} cx={b.x2} cy={b.y2} r="4" fill="rgba(138,171,138,0.85)"
              style={{ transformOrigin: `${b.x2}px ${b.y2}px`, opacity: 0, transform: "scale(0)", animation: `leafBloom 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards ${LEAVES_AT.toFixed(2)}s` }} />
          ))}
        </svg>
      </div>
      <div className="brand-nav">
        <div className="nav-rule" />
        <button className="nav-link" onClick={() => onPanel("about")}>About</button>
        <button className="enter-btn" onClick={onEnter}>Enter Herbarium</button>
        <button className="nav-link" onClick={() => onPanel("contact")}>Contact</button>
      </div>

      {panel === "about" && (
        <div className="panel">
          <button className="panel-close" onClick={() => onPanel(null)}>✕ close</button>
          <div className="panel-inner">
            <p className="panel-eyebrow">IBVU</p>
            <h2 className="panel-title">From the Earth</h2>
            <p className="panel-body">
              IBVU is rooted in the belief that all knowledge begins with the earth
              beneath us. IBVU is inspired by the Shona word <em>ivhu</em>, meaning
              soil or earth, the foundation from which life, knowledge, and innovation grow.
              <br /><br />
              Founded by neuroscientist Tatenda Mutshiya and analytical chemist Dara Pierre,
              IBVU builds scientific platforms that draw on knowledge from people around the
              world and bring it into conversation with modern research.
              <br /><br />
              Herbarium Scientifica is the first of these platforms. It provides global
              user submitted plant solutions which are scientifically verified to provide
              information on the latest research. Our goal is for understudied plants to
              be highlighted and brought to the attention of laboratories around the world.
              <br /><br />
              Our inspiration comes from Nobel Prize winner Tu Youyou, who looked back to
              traditional knowledge and identified sweet wormwood (<em>Artemisia annua</em>),
              a discovery that transformed malaria treatment. IBVU believes that when global
              communities share knowledge, science advances.
            </p>
            <div className="panel-rule" />
            <div style={{ marginTop: 28 }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 300, letterSpacing: 4, textTransform: "uppercase", color: "rgba(245,240,232,0.3)", marginBottom: 10 }}>Get to Know the Founders</p>
              <a href="https://www.linkedin.com/in/tatenda-mutshiya/" target="_blank" rel="noreferrer" className="panel-contact-link">Tatenda Mutshiya ↗</a>
              <br />
              <a href="https://www.linkedin.com/in/dlpierre/" target="_blank" rel="noreferrer" className="panel-contact-link">Dara Pierre ↗</a>
            </div>
          </div>
        </div>
      )}

      {panel === "contact" && (
        <div className="panel">
          <button className="panel-close" onClick={() => onPanel(null)}>✕ close</button>
          <div className="panel-inner">
            <p className="panel-eyebrow">get in touch</p>
            <h2 className="panel-title">Contact</h2>
            <p className="panel-body">For enquiries, collaborations, or to learn more about IBVU and what we're building.</p>
            <a className="panel-contact-link" href="mailto:hello@ibvu.org">hello@ibvu.org</a>
            <div className="panel-rule" />
          </div>
        </div>
      )}

      <p className="bottom-label">Herbarium Scientifica &middot; From the Earth</p>
    </div>
  );
}
