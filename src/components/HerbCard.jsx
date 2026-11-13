// IBVU v5.92 — what changed in this file: the card links to the herb's own address (herb.slug), which is unique even when a herb was published twice.
//
// IBVU v5.7 — what changed in this file:
// - Each card is now a real link to the herb's own page
//   (ibvu.org/educate/hs/herb-name), so it can be opened with the keyboard,
//   opened in a new tab, and shared. It used to be a click-only box.
import { Link } from 'react-router-dom';
import { herbKey } from '../lib/content.js';

export default function HerbCard({ herb, conditionId }) {
  return (
    <Link className="herb-card" to={"/educate/hs/" + (herb.slug || herbKey(herb.name))} state={{ condition: conditionId || null }}>
      <h3>{herb.name}</h3>
      <p className="latin">{herb.latinName}</p>
      <div className="tags">
        {herb.category && <span className="tag">{herb.category}</span>}
        {herb.family && <span className="tag gold">{herb.family}</span>}
      </div>
    </Link>
  );
}
