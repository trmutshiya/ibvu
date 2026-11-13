// IBVU v6.08 — what changed in this file: Tatenda's cookie bar wording (Accept All /
// Reject All, "Cookie Policy" link, editable).
//
// IBVU v6.07 — what changed in this file: Privacy has a new section "Analytics and
// cookies" (and small changes to "What we collect", "Services we use" and "On your
// device"); the cookie bar's wording is editable under Newsletter and footer.
//
// IBVU v6.02 — what changed in this file since v5.92: newsletter wording for the Confirm
// email; Shop: the "subscribe to our newsletter" lines on Events and the Coming soon pages
// (editable); Privacy: the mailing lists and the confirm step are described.
//
// IBVU v5.92 — what changed in this file since v5.91: a Privacy page
// (ibvu.org/privacy) with its wording and admin form. The wording is a DRAFT
// written from what the site actually collects; it must be checked by someone
// qualified before the site goes live.
//
// IBVU v5.91 — what changed in this file since v5.9:
// - About: "Dr" added before Tatenda Mutshiya's name, in the text and in the
//   founders list.
// - Newsletter and footer: a logo field, so the footer logo can be swapped in admin.
//
// IBVU v5.9 — what changed in this file since v5.7: every page of the site now
// has its wording here and a form in admin → Pages. Added: Home, About,
// Herbarium, Media and Blog, Contact, and Newsletter and footer. Their wording
// is the site's existing wording, moved here unchanged. In longer texts, words
// between *stars* are shown in italics (or highlighted, on the Home page).
// Regulate, Shop and Innovate are as before.
//
// IBVU v5.7 — what changed in this file since v5.6: the Herb Mail Club Subscribe
// button now points to the Shopify shop (https://ibvu-shop.myshopify.com). It can
// be changed to the Mail Club product page in admin → Pages → Shop.
//
// IBVU v5.6 — new file.
// The built-in wording for the pages whose tiles can be edited in admin
// (Regulate, Shop, Innovate). Two jobs:
//   1. It is what the site shows until someone changes a page in admin.
//   2. It is the safety net: if the saved content can't be loaded, visitors
//      see this text instead of an empty page.
// PAGE_FORMS further down describes the editing form admin shows for each page.

export const DEFAULT_PAGES = {
  home: {
    lead: "IBVU is an organisation dedicated to bringing greater scientific rigour, transparency and innovation to the global herbal remedies industry.",
    sub: "Our work is built around three interconnected pillars: *Regulate*, *Educate* and *Innovate*.",
    // Always three cards, in this order: Regulate, Educate, Innovate. Where each one leads is fixed.
    pillars: [
      { title: "Regulate", tagline: "Establishing confidence through science.", text: "We champion scientific standards, transparency and independent verification to support greater confidence in herbal remedies. Discover how IBVU aims to strengthen quality, accountability and trust across the industry.", linkLabel: "Explore Regulation", image: "" },
      { title: "Educate", tagline: "Making herbal science accessible.", text: "Knowledge should be accessible to everyone. Through our Herbarium and educational resources, we connect traditional herbal knowledge with modern scientific research, helping people explore the evidence behind the plants and remedies around us.", linkLabel: "Explore Education", image: "" },
      { title: "Innovate", tagline: "Turning botanical knowledge into discovery.", text: "We believe the future of herbal medicine lies in scientific exploration. By connecting researchers, institutions and industry, we aim to identify promising botanical compounds, encourage collaborative research and support new discoveries.", linkLabel: "Explore Innovation", image: "" },
    ],
  },

  about: {
    eyebrow: "IBVU",
    title: "From the Earth",
    intro: [
      { text: "IBVU takes its inspiration from the Shona word *ivhu*, meaning soil or earth, the foundation from which life, knowledge and innovation grow." },
      { text: "Founded by neuroscientist Dr Tatenda Mutshiya and analytical chemist Dara Pierre, IBVU brings together traditional knowledge, global communities and modern science to advance the understanding of plant-based remedies." },
      { text: "Through three pillars, Regulate, Educate and Innovate, we aim to build a more transparent, informed and scientifically driven future for the global remedies industry." },
    ],
    pillars: [
      { name: "Regulate", text: "by promoting scientific standards, transparency and independent verification of plant-based remedies." },
      { name: "Educate", text: "by making scientific knowledge accessible, connecting traditional uses of plants with the latest research and evidence." },
      { name: "Innovate", text: "by identifying understudied plants and creating opportunities for new research, discovery and collaboration." },
    ],
    more: [
      { text: "Our first platform, Herbarium Scientifica, brings these ambitions to life by creating a global space where communities can share plant knowledge, explore scientific evidence and help bring overlooked plants to the attention of researchers worldwide." },
      { text: "Inspired by Nobel Prize winner Tu Youyou, whose investigation of traditional knowledge led to the discovery of artemisinin from sweet wormwood (*Artemisia annua*), we believe that valuable discoveries can begin with knowledge shared across generations and communities." },
    ],
    signoff: "From the earth, through knowledge, to discovery.",
    foundersHeading: "Get to Know the Founders",
    founders: [
      { name: "Dr Tatenda Mutshiya", link: "https://www.linkedin.com/in/tatenda-mutshiya/" },
      { name: "Dara Pierre", link: "https://www.linkedin.com/in/dlpierre/" },
    ],
  },

  herbarium: {
    lead: "A community-powered catalogue of medicinal plants with evidence-based literature",
    browseLabel: "Browse Herbs",
    submitLabel: "Submit an Herb",
    photoWarning: "Only add a photo if it is your own. Do not use copyrighted images or pictures taken from the internet.",
    photoCaption: "Image for educational purposes only.",
    disclaimer: "Information on this site is for educational purposes only and is not medical advice. Please consult a qualified healthcare professional for health concerns. IBVU is not responsible for decisions made based on the information provided.",
  },

  writing: {
    mediaTitle: "Media",
    mediaEmpty: "Articles coming soon",
    blogTitle: "Blog",
    blogEmpty: "Posts coming soon",
  },

  contact: {
    eyebrow: "Get in touch",
    heading: "Contact",
    lead: "For enquiries, collaborations, or to learn more about IBVU and what we're building.",
    buttonLabel: "Send message",
    thanksHeading: "Thank you",
  },

  privacy: {
    heading: "Privacy",
    lead: "What IBVU collects through this website, why, and the choices you have.",
    updated: "Last updated: November 2026",
    sections: [
      { title: "Who we are", text: "This website (ibvu.org) is run by IBVU. If you have any question about your information, email hello@ibvu.org." },
      { title: "What we collect, and why", text: "When you submit a herb: the herb's name, other names, traditional uses and country, and your email address. We use your email address to tell you what happened to your submission. If you tick the consent box, we may also contact you about your submission and about updates to the Herbarium Scientifica. If you add a photo, we keep it and, if it is approved, publish it on that herb's page.\n\nWhen you send the contact form: your name, email address, organisation (if you give one), the type of enquiry and your message. We use these to reply to you.\n\nWhen you subscribe to the newsletter: your name (if you give it), your email address and the mailing lists you choose. We first send you an email to confirm, and only add you once you press Confirm. We only send you what you chose, and every email has a link to unsubscribe from one list or all of them. If you tick the box on the contact form, we add you to the matching list in the same way.\n\nYou do not need an account to use this site. We do not use advertising cookies. We use Google Analytics only if you agree (see “Analytics and cookies” below)." },
      { title: "What is published", text: "Herb names, traditional uses, countries and approved photos are published in the Herbarium Scientifica. Your name and email address are never published." },
      { title: "Services we use", text: "The website is hosted by Vercel. Submissions, messages and newsletter sign-ups are stored with Supabase. Emails are sent through Resend. The submission form uses Cloudflare Turnstile to stop automated spam. We use Sentry to find out about errors on the site. Fonts are loaded from Google Fonts. If you accept analytics cookies, Google Analytics (Google) measures how the site is used. To check the scientific literature, herb names (not your details) are sent to PubMed and GBIF. These companies handle information on our behalf or in order to show you the page, and may do so in other countries." },
      { title: "How long we keep it", text: "Herb submissions: for as long as the Herbarium Scientifica is running, so that there is a record of where knowledge came from. Contact messages: for up to two years. Newsletter details: until you unsubscribe. You can ask us to delete your details sooner." },
      { title: "Analytics and cookies", text: "The first time you visit, a bar at the bottom of the page asks whether we may use analytics cookies. If you press Accept, we use Google Analytics to understand how the site is used: which pages are visited, roughly where visitors are (country and city), the kind of device and browser, how people found the site, and a few actions such as signing up to the newsletter, sending the contact form, submitting a herb or clicking to book an event. Google Analytics sets cookies (named _ga) so that it can recognise a returning browser. It never receives your name, your email address or anything you type into the forms, and advertising features are switched off.\n\nIf you press Reject, or do not choose, Google Analytics is not loaded at all and no analytics cookies are set. You can change your choice at any time with “Cookie settings” at the foot of every page; if you change to Reject, the analytics cookies are removed.\n\nGoogle keeps the detailed analytics data for 2 months; summary reports are kept longer. Google may process this data in other countries." },
      { title: "On your device", text: "The site remembers in your browser that you have already seen the opening animation, and your cookie choice. Apart from analytics cookies (only if you accept), it does not set cookies of its own. The spam check provided by Cloudflare may use its own." },
      { title: "Your choices", text: "You can ask for a copy of the information we hold about you, ask us to correct or delete it, or withdraw a consent you gave, by emailing hello@ibvu.org. You also have the right to complain to the data protection regulator where you live (in the UK, the Information Commissioner's Office)." },
      { title: "Changes to this page", text: "If we change how we use information, we will update this page and the date at the top." },
    ],
  },

  site: {
    newsletterEyebrow: "Subscribe to IBVU Monthly Newsletter",
    newsletterHeading: "Subscribe to our Newsletter",
    newsletterTagline: "Sign up to receive the latest news and updates on our research",
    newsletterButton: "Subscribe",
    newsletterNote: "We'll email you a link to confirm. Every email has a link to unsubscribe at any time.",
    newsletterThanks: "Nearly there: please check your inbox.",
    footerLogo: "",
    footerLine: "IBVU · Regulate · Educate · Innovate",
    cookieText: "IBVU uses cookies to ensure our website works properly and, with your permission, to analyse website traffic through Google Analytics. This helps us understand how visitors use our website and improve your experience.\n\nYou can accept or reject non-essential cookies.",
    cookieAccept: "Accept All",
    cookieReject: "Reject All",
    cookieLink: "Cookie Policy",
  },

  regulate: {
    heading: "Scientific & Regulatory Advisory",
    intro: "IBVU provides scientific and regulatory advisory services to support businesses working across the herbal remedies industry. We help assess scientific evidence, strengthen product transparency and navigate the information and requirements surrounding herbal products.",
    buttonLabel: "Enquire about our services",
    servicesHeading: "Our services include",
    services: [
      { name: "Scientific Literature Reviews", text: "Researching and evaluating published evidence on herbal ingredients and their properties." },
      { name: "Ingredient Research & Assessment", text: "Exploring the composition, active constituents and scientific background of herbal ingredients." },
      { name: "Product Claims Review", text: "Assessing the scientific basis of product descriptions and health-related claims." },
      { name: "Labelling & Regulatory Guidance", text: "Supporting businesses in understanding relevant labelling requirements and regulatory considerations." },
      { name: "Scientific Communications", text: "Developing clear, evidence-based scientific content and product documentation." },
    ],
    soonLabel: "Coming soon",
    soonTitle: "Analytical Testing & Chemical Profiling",
    soonText: "Expanding our services to include laboratory-based analysis of herbal ingredients and products, supporting greater transparency, quality assessment and scientific verification.",
    soonListHeading: "Planned services include",
    soonList: [
      "Phytochemical screening",
      "Chemical composition and profiling",
      "Active compound identification and quantification",
      "Heavy metal and contaminant testing",
      "Purity and quality analysis",
    ],
    soonImage: "",
  },

  shop: {
    intro: "Explore the science of plants with IBVU: by post, in person and at home.",
    mailTitle: "Herb Mail Club",
    mailTile: "Monthly plant science by post. Brain facts from a neuroscientist, the science of herbs, activities and plant stickers. Worldwide postage.",
    mailTileLink: "Join the club",
    mailLead: "Monthly plant science by post.",
    mailBody: "Discover the world of plants, explore the science of the brain and enjoy monthly facts, discoveries and activities delivered straight to your door.",
    mailInside: ["Brain facts from a neuroscientist", "The science of herbs", "Activities", "Plant stickers"],
    mailNote: "Worldwide postage",
    mailBuyLabel: "Subscribe",
    mailBuyUrl: "https://ibvu-shop.myshopify.com",
    mailImage: "",
    eventsTitle: "Events",
    eventsTile: "Talks and gatherings for people curious about the science of plants.",
    eventsTileLink: "See events",
    eventsEmpty: "Dates coming soon.",
    eventsNotify: "To hear when dates are announced, *subscribe to our newsletter*.",
    soonNotify: "To hear when this opens, *subscribe to our newsletter*.",
    eventsImage: "",
    more: [
      { slug: "products",   title: "Products",              text: "Products from IBVU.", comingSoon: true, linkLabel: "", link: "" },
      { slug: "resources",  title: "Educational Resources", text: "Guides and resources on the science behind herbs.", comingSoon: true, linkLabel: "", link: "" },
      { slug: "membership", title: "Membership",            text: "", comingSoon: true, linkLabel: "", link: "" },
    ],
  },

  innovate: {
    heading: "Innovate",
    subtitle: "Life Sciences Research & Development",
    intro: "Innovate is the life sciences arm of IBVU. We combine artificial intelligence and laboratory research to build platforms that advance health technology and the discovery of new plant-based compounds.",
    platformsHeading: "Our platforms",
    platforms: [
      { title: "Herbarium Scientifica", status: "", tagline: "Explore the science behind the plants.", text: "Discover a growing collection of medicinal herbs, their active constituents, traditional uses and the scientific research investigating their properties.", linkLabel: "Explore the Herbarium", link: "/educate/hs" },
      { title: "AI Discovery Platform", status: "In development", tagline: "", text: "The future home of our AI-powered platform for compound screening. We aim to use machine learning to search plant compounds for promising candidates and prioritise them for laboratory study.", linkLabel: "", link: "" },
    ],
    researchHeading: "Research and development",
    research: [
      { title: "In Vitro Research", status: "Coming soon", tagline: "", text: "Laboratory research in compound screening and disease modelling, examining how plant compounds behave in cells and turning promising leads into evidence.", linkLabel: "", link: "" },
      { title: "Research Collaborations", status: "", tagline: "", text: "We work with researchers, institutions and industry to study understudied plants and support new discoveries.", linkLabel: "Start a conversation", link: "/contact?type=research" },
    ],
    buttonLabel: "Get in touch",
  },
};

// The editing form shown in admin for each page. type: text | long | switch |
// image | lines (a simple list) | items (a list of small cards with `fields`).
const TILE_FIELDS = [
  { key: "title", label: "Title", type: "text" },
  { key: "status", label: "Status label (for example Coming soon). Leave empty for none.", type: "text" },
  { key: "tagline", label: "Tagline (optional)", type: "text" },
  { key: "text", label: "Text", type: "long" },
  { key: "linkLabel", label: "Link wording (optional)", type: "text" },
  { key: "link", label: "Link address (for example /educate/hs or https://…)", type: "text" },
];

const STARS = " Put *stars* around words to show them in italics.";
const PARAGRAPH = [{ key: "text", label: "Text." + STARS, type: "long" }];

export const PAGE_FORMS = {
  home: {
    name: "Home",
    address: "/",
    sections: [
      { title: "Introduction (under the animation)", fields: [
        { key: "lead", label: "First line", type: "long" },
        { key: "sub", label: "Second line. Put *stars* around words to highlight them.", type: "long" },
      ] },
      { title: "The three cards", fields: [
        { key: "pillars", label: "Cards (Regulate, Educate, Innovate, in that order; where each one leads is fixed)", type: "items", itemName: "card", fixed: true, fields: [
          { key: "title", label: "Title", type: "text" },
          { key: "tagline", label: "Tagline", type: "text" },
          { key: "text", label: "Text", type: "long" },
          { key: "linkLabel", label: "Link wording", type: "text" },
          { key: "image", label: "Image (leave as it is to keep the current photo)", type: "image" },
        ] },
      ] },
    ],
  },
  about: {
    name: "About",
    address: "/about",
    note: "This is the About pop-up, opened from the menu.",
    sections: [
      { title: "Heading", fields: [
        { key: "eyebrow", label: "Small line above the title", type: "text" },
        { key: "title", label: "Title", type: "text" },
      ] },
      { title: "Opening paragraphs", fields: [
        { key: "intro", label: "Paragraphs", type: "items", itemName: "paragraph", fields: PARAGRAPH },
      ] },
      { title: "The three pillar lines", fields: [
        { key: "pillars", label: "Lines", type: "items", itemName: "line", fields: [
          { key: "name", label: "First word (shown in bold)", type: "text" },
          { key: "text", label: "Rest of the line", type: "long" },
        ] },
      ] },
      { title: "Closing paragraphs", fields: [
        { key: "more", label: "Paragraphs", type: "items", itemName: "paragraph", fields: PARAGRAPH },
        { key: "signoff", label: "Sign-off line", type: "text" },
      ] },
      { title: "Founders", fields: [
        { key: "foundersHeading", label: "Heading", type: "text" },
        { key: "founders", label: "Founders", type: "items", itemName: "founder", fields: [
          { key: "name", label: "Name", type: "text" },
          { key: "link", label: "Link (for example a LinkedIn address, https://…)", type: "text" },
        ] },
      ] },
    ],
  },
  regulate: {
    name: "Regulate",
    address: "/regulate",
    sections: [
      { title: "Top of page", fields: [
        { key: "heading", label: "Heading", type: "text" },
        { key: "intro", label: "Introduction", type: "long" },
        { key: "buttonLabel", label: "Enquiry button wording", type: "text" },
      ] },
      { title: "Services", fields: [
        { key: "servicesHeading", label: "Heading", type: "text" },
        { key: "services", label: "Services", type: "items", itemName: "service", fields: [
          { key: "name", label: "Name", type: "text" },
          { key: "text", label: "Description", type: "long" },
        ] },
      ] },
      { title: "Coming soon tile", fields: [
        { key: "soonLabel", label: "Label (for example Coming soon). Leave empty to remove the label.", type: "text" },
        { key: "soonTitle", label: "Title", type: "text" },
        { key: "soonText", label: "Text", type: "long" },
        { key: "soonListHeading", label: "List heading", type: "text" },
        { key: "soonList", label: "List", type: "lines" },
        { key: "soonImage", label: "Image (leave as it is to keep the lab photo)", type: "image" },
      ] },
    ],
  },
  herbarium: {
    name: "Herbarium",
    address: "/educate/hs",
    note: "The title “Herbarium Scientifica” is fixed. Each herb's own details are edited in Herb review, and photos in Herb photos.",
    sections: [
      { title: "Top of page", fields: [
        { key: "lead", label: "Line under the title", type: "long" },
        { key: "browseLabel", label: "First tab wording", type: "text" },
        { key: "submitLabel", label: "Second tab wording", type: "text" },
      ] },
      { title: "Photos", fields: [
        { key: "photoWarning", label: "Warning on the submission form", type: "long" },
        { key: "photoCaption", label: "Line shown under every herb photo", type: "text" },
      ] },
      { title: "Disclaimer", fields: [
        { key: "disclaimer", label: "Disclaimer at the foot of the Herbarium pages", type: "long" },
      ] },
    ],
  },
  writing: {
    name: "Media and Blog",
    address: "/media",
    note: "Articles and blog posts themselves are written under Articles and Blog.",
    sections: [
      { title: "Media page", fields: [
        { key: "mediaTitle", label: "Heading", type: "text" },
        { key: "mediaEmpty", label: "Shown when nothing is published yet", type: "text" },
      ] },
      { title: "Blog page", fields: [
        { key: "blogTitle", label: "Heading", type: "text" },
        { key: "blogEmpty", label: "Shown when nothing is published yet", type: "text" },
      ] },
    ],
  },
  shop: {
    name: "Shop",
    address: "/shop",
    sections: [
      { title: "Shop front page", fields: [
        { key: "intro", label: "Line under the banner", type: "text" },
      ] },
      { title: "Herb Mail Club", fields: [
        { key: "mailTitle", label: "Title", type: "text" },
        { key: "mailTile", label: "Text on the shop tile", type: "long" },
        { key: "mailTileLink", label: "Link wording on the shop tile", type: "text" },
        { key: "mailLead", label: "Mail Club page: line under the title", type: "text" },
        { key: "mailBody", label: "Mail Club page: description", type: "long" },
        { key: "mailInside", label: "Mail Club page: what's inside", type: "lines" },
        { key: "mailNote", label: "Mail Club page: note (for example Worldwide postage)", type: "text" },
        { key: "mailBuyLabel", label: "Button wording", type: "text" },
        { key: "mailBuyUrl", label: "Shopify address for the button (https://…). The button is greyed out while this is empty.", type: "text" },
        { key: "mailImage", label: "Image (leave as it is to keep the collage)", type: "image" },
      ] },
      { title: "Events", fields: [
        { key: "eventsTitle", label: "Title", type: "text" },
        { key: "eventsTile", label: "Text on the shop tile", type: "long" },
        { key: "eventsTileLink", label: "Link wording on the shop tile", type: "text" },
        { key: "eventsEmpty", label: "Shown when there are no upcoming events", type: "text" },
        { key: "eventsNotify", label: "Line under it. The words between *stars* become the link to the newsletter (with Herb Mail Club & shop ticked).", type: "text" },
        { key: "eventsImage", label: "Image (leave as it is to keep the photo)", type: "image" },
      ] },
      { title: "Coming soon pages", fields: [
        { key: "soonNotify", label: "Line on the Coming soon pages. The words between *stars* become the link to the newsletter.", type: "text" },
      ] },
      { title: "Other tiles", fields: [
        { key: "more", label: "Tiles", type: "items", itemName: "tile", fixed: true, fields: [
          { key: "title", label: "Title", type: "text" },
          { key: "text", label: "Text", type: "long" },
          { key: "comingSoon", label: "Show as Coming soon", type: "switch" },
          { key: "linkLabel", label: "Link wording (used when Coming soon is off)", type: "text" },
          { key: "link", label: "Link address (used when Coming soon is off, for example a Shopify address)", type: "text" },
        ] },
      ] },
    ],
  },
  innovate: {
    name: "Innovate",
    address: "/innovate",
    sections: [
      { title: "Top of page", fields: [
        { key: "heading", label: "Heading", type: "text" },
        { key: "subtitle", label: "Subtitle", type: "text" },
        { key: "intro", label: "Introduction", type: "long" },
        { key: "buttonLabel", label: "Button wording at the bottom", type: "text" },
      ] },
      { title: "Platforms", fields: [
        { key: "platformsHeading", label: "Heading", type: "text" },
        { key: "platforms", label: "Tiles", type: "items", itemName: "tile", fields: TILE_FIELDS },
      ] },
      { title: "Research and development", fields: [
        { key: "researchHeading", label: "Heading", type: "text" },
        { key: "research", label: "Tiles", type: "items", itemName: "tile", fields: TILE_FIELDS },
      ] },
    ],
  },
  contact: {
    name: "Contact",
    address: "/contact",
    note: "The form's boxes and the list of enquiry types are fixed.",
    sections: [
      { title: "Top of page", fields: [
        { key: "eyebrow", label: "Small line above the heading", type: "text" },
        { key: "heading", label: "Heading", type: "text" },
        { key: "lead", label: "Line under the heading", type: "long" },
      ] },
      { title: "Form", fields: [
        { key: "buttonLabel", label: "Button wording", type: "text" },
        { key: "thanksHeading", label: "Heading shown after a message is sent", type: "text" },
      ] },
    ],
  },
  privacy: {
    name: "Privacy",
    address: "/privacy",
    note: "This wording is a draft. Have it checked by someone qualified before the site goes live.",
    sections: [
      { title: "Top of page", fields: [
        { key: "heading", label: "Heading", type: "text" },
        { key: "lead", label: "Line under the heading", type: "long" },
        { key: "updated", label: "Date line", type: "text" },
      ] },
      { title: "Sections", fields: [
        { key: "sections", label: "Sections", type: "items", itemName: "section", fields: [
          { key: "title", label: "Heading", type: "text" },
          { key: "text", label: "Text. Leave an empty line between paragraphs.", type: "long" },
        ] },
      ] },
    ],
  },
  site: {
    name: "Newsletter and footer",
    address: "/",
    note: "These appear at the foot of every page.",
    sections: [
      { title: "Newsletter block", fields: [
        { key: "newsletterEyebrow", label: "Small line above the heading", type: "text" },
        { key: "newsletterHeading", label: "Heading", type: "text" },
        { key: "newsletterTagline", label: "Line under the heading", type: "text" },
        { key: "newsletterButton", label: "Button wording", type: "text" },
        { key: "newsletterNote", label: "Consent line under the button", type: "long" },
        { key: "newsletterThanks", label: "Shown after someone subscribes (they still need to press Confirm in the email we send)", type: "text" },
      ] },
      { title: "Footer", fields: [
        { key: "footerLogo", label: "Logo (leave as it is to keep the IBVU logo)", type: "image" },
        { key: "footerLine", label: "Line at the very bottom", type: "text" },
      ] },
      { title: "Cookie bar (asks before Google Analytics is used)", fields: [
        { key: "cookieText", label: "Text. Leave an empty line between paragraphs.", type: "long" },
        { key: "cookieAccept", label: "Accept button", type: "text" },
        { key: "cookieReject", label: "Reject button", type: "text" },
        { key: "cookieLink", label: "Link to the Privacy page's cookie section", type: "text" },
      ] },
    ],
  },
};
