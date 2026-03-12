import { CONDITION_GROUPS } from '../constants/conditions.js';

export default function ConditionSidebar({ herbs, active, onSelect }) {
  const allCount = herbs.length;
  return (
    <aside className="condition-sidebar">
      <div className="sidebar-header">Filter by condition</div>

      <button
        className={"sidebar-all" + (!active ? " active" : "")}
        onClick={() => onSelect(null)}
      >
        <span>All Herbs</span>
        <span className="all-count">{allCount}</span>
      </button>

      {CONDITION_GROUPS.map(function(group) {
        const count = herbs.filter(function(h) {
          return (h.conditions || []).includes(group.id);
        }).length;
        const isActive = active === group.id;
        const isEmpty  = count === 0;
        return (
          <div className="condition-group" key={group.id}>
            <button
              className={"condition-btn" + (isActive ? " active" : "") + (isEmpty ? " zero" : "")}
              onClick={function() { if (!isEmpty) onSelect(isActive ? null : group.id); }}
              title={group.description}
            >
              <span className="cond-text">
                <div className="cond-label">{group.label}</div>
                <div className="cond-desc">{group.description}</div>
              </span>
              <span className="cond-count">{count}</span>
            </button>
          </div>
        );
      })}
    </aside>
  );
}
