// IBVU v6.06 — what changed in this file: a herb with an approved photo shows it as a
// small square tile (about 64 × 64 px) in the card's top-right corner, framed as set in
// admin → Herb photos. Herbs without a photo look as before.
//
// IBVU v5.92 — what changed in this file: the card links to the herb's own address (herb.slug), which is unique even when a herb was published twice.
//
// IBVU v5.7 — what changed in this file:
// - Each card is now a real link to the herb's own page
//   (ibvu.org/educate/hs/herb-name), so it can be opened with the keyboard,
//   opened in a new tab, and shared. It used to be a click-only box.
import { Link } from 'react-router-dom';
import { herbKey, useHerbPhoto } from '../lib/content.js';
import Framed from './Framed.jsx';

export default function HerbCard({ herb, conditionId }) {
  const photo = useHerbPhoto(herb.name);
  return (
    <Link className={"herb-card" + (photo ? " has-photo" : "")} to={"/educate/hs/" + (herb.slug || herbKey(herb.name))} state={{ condition: conditionId || null }}>
      {photo && <span className="herb-card-thumb"><Framed value={photo} ratio="1" alt="" loading="lazy" /></span>}
      <h3>{herb.name}</h3>
      <p className="latin">{herb.latinName}</p>
      <div className="tags">
        {herb.category && <span className="tag">{herb.category}</span>}
        {herb.family && <span className="tag gold">{herb.family}</span>}
      </div>
    </Link>
  );
}
