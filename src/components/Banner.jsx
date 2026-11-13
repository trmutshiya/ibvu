// IBVU v5.5 — new file.
// The IBVU tree banner shown across the top of the Shop and Regulate pages.
// (It was previously written directly inside Shop.jsx.)
import bannerImg from '../assets/shop-banner.jpg';

export default function Banner() {
  return (
    <div className="shop-banner">
      <img src={bannerImg} alt="IBVU. Regulate, Educate, Innovate." width="2048" height="901" />
    </div>
  );
}
