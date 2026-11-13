// IBVU v6.02 — new file. The website's mailing lists.
//
// People choose which lists to join (newsletter box at the bottom of every
// page, or a tick on the contact form) and only hear about what they chose.
// A business contact on "Services for businesses" never gets Mail Club news,
// and so on. Shopify keeps its own, separate list of buyers.
//
// The keys (monthly, mailclub, business, research) are also written in the
// database rules and in the site-forms function on the server, so they must
// not be changed here alone. The names and descriptions can be changed.
export const MAILING_LISTS = [
  { key: "monthly",  name: "IBVU Monthly",             about: "General news, the Herbarium and the blog" },
  { key: "mailclub", name: "Herb Mail Club & shop",    about: "The Mail Club, products and events" },
  { key: "business", name: "Services for businesses",  about: "Regulatory advisory and analytical testing" },
  { key: "research", name: "Research & collaboration", about: "Innovate: research, discovery and collaborations" },
];

export const LIST_KEYS = MAILING_LISTS.map(l => l.key);
export function listName(key) { const l = MAILING_LISTS.find(x => x.key === key); return l ? l.name : key; }
export function listNames(keys) { return (keys || []).map(listName).join(", "); }

// Contact form: which list the "send me occasional updates" tick adds to,
// depending on the type of enquiry.
export const LIST_FOR_ENQUIRY = {
  general: "monthly", advisory: "business", research: "research", partnerships: "research",
  shop: "mailclub", events: "mailclub", media: "monthly",
};

// "Subscribe to our newsletter" links elsewhere on the page call this: the
// newsletter box at the bottom scrolls into view with that list ticked.
export function openNewsletter(listKey) {
  window.dispatchEvent(new CustomEvent("ibvu:newsletter", { detail: { list: listKey } }));
}
