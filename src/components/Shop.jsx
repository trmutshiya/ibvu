// IBVU v6.07 — what changed in this file: "Book a place" clicks are counted in Google Analytics (only with consent).
//
// IBVU v6.04 — what changed in this file: the Shop tiles, the Herb Mail Club and Events pictures and event
// pictures are shown as framed in admin (moved, zoomed in). The Events page now
// has Upcoming events (soonest first, picture about 240 × 160) and Past events
// (newest first, small picture about 120 × 80, no Book button; the latest 6
// with "Show all past events"). An event moves to Past the day after it happens.
//
// IBVU v6.02 — what changed in this file since v6.01: on Events (when no dates
// are announced) and on the Coming soon pages, "email hello@ibvu.org" became
// "subscribe to our newsletter", which scrolls to the newsletter box with
// Herb Mail Club & shop ticked. Both lines are editable in admin → Pages → Shop.
//
// IBVU v6.01 — what changed in this file: nothing in the code. The Herb Mail Club picture it shows
// (src/assets/shop-mail-club.jpg) was replaced with Tatenda's corrected collage, fixing the
// "NEUROSCIENTOST" typo (now "NEUROSCIENTIST").
//
// IBVU v5.6 — what changed in this file since v5.5:
// - All shop wording (tiles, Herb Mail Club page, the Shopify address for the
//   Subscribe button, "Coming soon" switches) now comes from the editable page
//   content: admin → Pages → Shop. The built-in wording is in
//   src/content/defaults.js. The Shopify address is no longer set in this file.
// - Events page: lists the upcoming events published in admin as tiles, each
//   with share buttons and "Add to calendar". With no upcoming events it shows
//   the "Dates coming soon" line as before.
// - A "Coming soon" tile that is switched off in admin, and given a link,
//   becomes a normal clickable tile.
import { track } from '../lib/analytics.js';
import { Link, useParams } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import NotFound from './NotFound.jsx';
import Banner from './Banner.jsx';
import { SmartLink } from './Innovate.jsx';
import { ShareButtons, AddToCalendar } from './Share.jsx';
import { usePageTitle } from '../lib/site.js';
import { useState } from 'react';
import { usePage, useUpcomingEvents, usePastEvents, formatDate } from '../lib/content.js';
import { openNewsletter } from '../lib/lists.js';
import Framed from './Framed.jsx';
import mailClubImg from '../assets/shop-mail-club.jpg';
import eventsImg from '../assets/shop-events.jpg';

const MAIL_ALT = "IBVU Herb Mail Club: an envelope with a letter, stamps, plant stickers and activity cards";
const EVENTS_ALT = "A group of people smiling and talking together at a gathering";

export default function Shop() {
  usePageTitle("Shop");
  const c = usePage("shop");
  const featured = [
    { slug: "mail", title: c.mailTitle, text: c.mailTile, link: c.mailTileLink, image: c.mailImage, fallback: mailClubImg, alt: MAIL_ALT },
    { slug: "events", title: c.eventsTitle, text: c.eventsTile, link: c.eventsTileLink, image: c.eventsImage, fallback: eventsImg, alt: EVENTS_ALT },
  ];
  return (
    <div className="page-shell">
      <SiteHeader />
      <Banner />
      <main className="page-main">
        <h1 className="visually-hidden">Shop</h1>
        <p className="shop-intro">{c.intro}</p>

        <div className="shop-feature-grid">
          {featured.map(s => (
            <Link className="shop-feature" to={"/shop/" + s.slug} key={s.slug}>
              <div className="shop-feature-image">
                <Framed value={s.image} fallback={s.fallback} alt={s.alt} width="900" height="1125" />
              </div>
              <div className="shop-feature-text">
                <h2 className="shop-tile-title">{s.title}</h2>
                <p className="shop-tile-line">{s.text}</p>
                {s.link && <span className="shop-tile-link">{s.link} →</span>}
              </div>
            </Link>
          ))}
        </div>

        <div className="shop-soon-grid">
          {c.more.map(t => {
            const inner = (
              <>
                <h2 className="shop-tile-title">{t.title}</h2>
                <p className="shop-tile-line">{t.text}</p>
                {t.comingSoon
                  ? <span className="shop-soon-label">Coming soon</span>
                  : (t.link && t.linkLabel && <span className="shop-tile-link">{t.linkLabel} →</span>)}
              </>
            );
            return !t.comingSoon && t.link
              ? <SmartLink className="shop-soon live" to={t.link} key={t.slug}>{inner}</SmartLink>
              : <div className="shop-soon" key={t.slug}>{inner}</div>;
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

// "To hear when…, *subscribe to our newsletter*.": the words between stars
// become a link that opens the newsletter box with Herb Mail Club & shop ticked.
function NotifyLine({ text }) {
  return String(text).split(/\*([^*]+)\*/g).map((part, i) => i % 2
    ? <button type="button" className="text-link" key={i} onClick={() => openNewsletter("mailclub")}>{part}</button>
    : part);
}

// A past event: small picture, date, title and place.
function PastEvent({ event }) {
  return (
    <li className="past-event" id={"event-" + event.id}>
      {event.image ? <span className="past-event-image"><Framed value={event.image} ratio="3/2" alt="" loading="lazy" /></span> : <span className="past-event-image empty" aria-hidden="true" />}
      <span className="past-event-text">
        <span className="event-tile-date">{formatDate(event.date)}</span>
        <span className="past-event-title">{event.title}</span>
        {event.location && <span className="event-tile-place">{event.location}</span>}
      </span>
    </li>
  );
}

const PAST_SHOWN = 6;

function EventTile({ event }) {
  const path = "/shop/events";
  return (
    <article className="event-tile" id={"event-" + event.id}>
      {event.image && <div className="event-tile-image"><Framed value={event.image} ratio="3/2" alt="" loading="lazy" /></div>}
      <div className="event-tile-text">
        <p className="event-tile-date">{formatDate(event.date)}{event.time ? " · " + event.time : ""}</p>
        <h3 className="event-tile-title">{event.title}</h3>
        {event.location && <p className="event-tile-place">{event.location}</p>}
        {event.description && <p className="event-tile-body">{event.description}</p>}
        <div className="event-tile-actions">
          {event.bookingUrl && <a className="buy-btn small" href={event.bookingUrl} target="_blank" rel="noreferrer" onClick={() => track("event_booking_click", { event_title: event.title })}>Book a place</a>}
          <AddToCalendar event={event} path={path} />
        </div>
        <ShareButtons path={path} text={event.title + ", " + formatDate(event.date)} />
      </div>
    </article>
  );
}

export function ShopSection() {
  const { section } = useParams();
  const c = usePage("shop");
  const events = useUpcomingEvents();
  const past = usePastEvents();
  const [allPast, setAllPast] = useState(false);
  const extra = c.more.find(t => t.slug === section);
  const title = section === "mail" ? c.mailTitle : section === "events" ? c.eventsTitle : extra ? extra.title : null;
  usePageTitle(title || "Page not found");
  if (!title) return <NotFound />;

  // Products, Educational Resources, Membership.
  if (extra) {
    return (
      <div className="page-shell">
        <SiteHeader />
        <main className="page-main">
          <div className="page-header">
            <p className="page-eyebrow">✦ Shop ✦</p>
            <h1>{extra.title}</h1>
            {extra.text && <p className="page-lead">{extra.text}</p>}
          </div>
          <div className="soon-panel">
            {extra.comingSoon ? (
              <>
                <h2>Coming soon</h2>
                {c.soonNotify && <p><NotifyLine text={c.soonNotify} /></p>}
              </>
            ) : (
              extra.link && extra.linkLabel && <p><SmartLink className="buy-btn" to={extra.link}>{extra.linkLabel}</SmartLink></p>
            )}
            <Link className="page-back" to="/shop">← Shop</Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (section === "mail") {
    return (
      <div className="page-shell">
        <SiteHeader />
        <main className="page-main">
          <div className="product-layout">
            <div className="product-image">
              <Framed value={c.mailImage} fallback={mailClubImg} alt={MAIL_ALT} width="900" height="1125" />
            </div>
            <div className="product-text">
              <p className="page-eyebrow">✦ Shop ✦</p>
              <h1>{c.mailTitle}</h1>
              {c.mailLead && <p className="product-lead">{c.mailLead}</p>}
              {c.mailBody && <p className="product-body">{c.mailBody}</p>}
              {c.mailInside.length > 0 && (
                <>
                  <p className="product-list-title">What's inside</p>
                  <ul className="product-list">{c.mailInside.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </>
              )}
              {c.mailNote && <p className="product-note">{c.mailNote}</p>}
              {c.mailBuyLabel && (c.mailBuyUrl
                ? <a className="buy-btn" href={c.mailBuyUrl}>{c.mailBuyLabel}</a>
                : <span className="buy-btn unlinked" aria-disabled="true">{c.mailBuyLabel}</span>)}
              <Link className="page-back" to="/shop">← Shop</Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Events
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <div className="product-layout">
          <div className="product-image">
            <Framed value={c.eventsImage} fallback={eventsImg} alt={EVENTS_ALT} width="900" height="1125" />
          </div>
          <div className="product-text">
            <p className="page-eyebrow">✦ Shop ✦</p>
            <h1>{c.eventsTitle}</h1>
            {events.length === 0 && c.eventsEmpty && <p className="product-lead">{c.eventsEmpty}</p>}
            <p className="product-body">{c.eventsTile}</p>
            {events.length === 0 && (
              c.eventsNotify && <p className="product-body"><NotifyLine text={c.eventsNotify} /></p>
            )}
            <Link className="page-back" to="/shop">← Shop</Link>
          </div>
        </div>

        {events.length > 0 && (
          <section className="tile-section">
            <h2 className="section-heading">Upcoming events</h2>
            <div className="event-list">{events.map(e => <EventTile event={e} key={e.id} />)}</div>
          </section>
        )}

        {past.length > 0 && (
          <section className="tile-section past-events">
            <h2 className="section-heading">Past events</h2>
            <ul className="past-event-list">{(allPast ? past : past.slice(0, PAST_SHOWN)).map(e => <PastEvent event={e} key={e.id} />)}</ul>
            {past.length > PAST_SHOWN && !allPast && (
              <button type="button" className="page-btn past-more" onClick={() => setAllPast(true)}>Show all past events ({past.length})</button>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
