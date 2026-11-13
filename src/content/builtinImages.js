// IBVU v6.04 — new file. For admin → Pages: the built-in photo behind each page
// picture (so the built-in photos can be framed too) and the shape each one
// is shown in on the site. Used only in admin.
import regulateImg from '../assets/pillar-regulate.jpg';
import educateImg from '../assets/pillar-educate.jpg';
import innovateImg from '../assets/pillar-innovate.jpg';
import labImg from '../assets/regulate-lab.jpg';
import mailClubImg from '../assets/shop-mail-club.jpg';
import eventsImg from '../assets/shop-events.jpg';
import logoImg from '../assets/ibvu-logo.webp';

// "<page>.<field>" (and "<page>.<list>.<number>" for the home page cards)
export const BUILTIN_IMAGES = {
  "home.pillars.0": regulateImg,
  "home.pillars.1": educateImg,
  "home.pillars.2": innovateImg,
  "regulate.soonImage": labImg,
  "shop.mailImage": mailClubImg,
  "shop.eventsImage": eventsImg,
  "site.footerLogo": logoImg,
};

export const IMAGE_SHAPES = {
  "home.pillars": [{ label: "Home page card", ratio: 3 / 2 }],
  "regulate.soonImage": [{ label: "Regulate “coming soon” picture", ratio: 3 / 2 }],
  "shop.mailImage": [{ label: "Shop tile and Herb Mail Club page", ratio: 4 / 5 }],
  "shop.eventsImage": [{ label: "Shop tile and Events page", ratio: 4 / 5 }],
  "site.footerLogo": [{ label: "Footer logo", ratio: 1 }],
};
