// IBVU v6.09 — what changed in this file: "Add to calendar" uses the real UK start time
// (GMT or BST), so the event appears at the right time in any visitor's calendar.
//
// IBVU v5.6 — new file.
// Share buttons (LinkedIn, WhatsApp, copy link) for articles and events, and
// the "Add to calendar" link for events.
import { useState } from 'react';
import { pageUrl, ukMoment } from '../lib/content.js';

export function shareLinks(path, text) {
  const url = pageUrl(path);
  return {
    url,
    linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url),
    whatsapp: "https://wa.me/?text=" + encodeURIComponent((text ? text + " " : "") + url),
  };
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    // Older browsers, or pages opened from disk.
    const el = document.createElement("textarea");
    el.value = text; el.style.position = "fixed"; el.style.opacity = "0";
    document.body.appendChild(el); el.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(el);
    return ok;
  }
}

export function ShareButtons({ path, text, label = "Share" }) {
  const [copied, setCopied] = useState(false);
  const links = shareLinks(path, text);
  return (
    <div className="share-row">
      <span className="share-label">{label}</span>
      <a href={links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
      <a href={links.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
      <button type="button" onClick={async () => { if (await copyText(links.url)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}

// A calendar file for one event. With a time it lasts one hour; without, all day.
function calendarHref(event, path) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const day = event.date.replace(/-/g, "");
  const esc = s => (s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
  let start, end;
  if (event.time) {
    const s = ukMoment(event.date, event.time).utc;
    const e = new Date(s.getTime() + 3600000);
    const z = x => x.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    start = "DTSTART:" + z(s);
    end = "DTEND:" + z(e);
  } else {
    const [y, mo, d] = event.date.split("-").map(Number);
    const next = new Date(y, mo - 1, d + 1);
    const nextDay = next.getFullYear() + String(next.getMonth() + 1).padStart(2, "0") + String(next.getDate()).padStart(2, "0");
    start = "DTSTART;VALUE=DATE:" + day;
    end = "DTEND;VALUE=DATE:" + nextDay;
  }
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//IBVU//Events//EN", "BEGIN:VEVENT",
    "UID:" + event.id + "@ibvu.org", "DTSTAMP:" + stamp, start, end,
    "SUMMARY:" + esc(event.title),
    event.location ? "LOCATION:" + esc(event.location) : null,
    "DESCRIPTION:" + esc(event.description),
    "URL:" + pageUrl(path),
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
}

export function AddToCalendar({ event, path }) {
  return <a className="calendar-link" href={calendarHref(event, path)} download={"ibvu-event.ics"}>Add to calendar</a>;
}
