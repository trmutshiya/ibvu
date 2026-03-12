export default function HerbCard({ herb, onClick }) {
  return (
    <div className="herb-card" onClick={() => onClick(herb)}>
      <h3>{herb.name}</h3>
      <p className="latin">{herb.latinName}</p>
      <div className="tags">
        {herb.category && <span className="tag">{herb.category}</span>}
        {herb.family && <span className="tag gold">{herb.family}</span>}
      </div>
    </div>
  );
}
