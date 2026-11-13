// IBVU v6.11 — what changed in this file: comment highlights from admin's review are
// never shown (stripReviewMarks), even if one were left in the text.
//
// IBVU v6.10 — what changed in this file: a newsletter's cover is shown at its own width
// (tile size, 340 px, unless changed in admin) and shrinks in proportion on a phone;
// pictures in a newsletter keep their own widths the same way. markPictures (admin's
// "Preview as web page") marks the pictures so they can be resized there.
//
// IBVU v6.09 — what changed in this file: an article, blog post or newsletter cover can
// have a caption (set in admin); it is shown under the cover when the item is open.
//
// IBVU v6.06 — what changed in this file: the full-screen picture view (Lightbox) is
// shared with the herb pages.
//
// IBVU v6.05 — what changed in this file: a picture whose size was set by
// dragging keeps that size when it has a caption.
//
// IBVU v6.04 — what changed in this file:
// - Tiles show the cover as framed in admin. The open article shows the whole
//   cover in its own shape at the width of the text (as Medium does).
// - Pictures inside the text can be small, medium, large or full width, placed
//   left, centre or right, and can have a caption underneath (set in admin;
//   the styles are in index.css).
// - Clicking a picture in an article opens it full screen; ✕, Esc or a click
//   closes it.
//
// IBVU v6.0 — what changed in this file: an article or post opened by its address waits for the content to arrive from the database before deciding the page does not exist.
//
// IBVU v5.9 — what changed in this file: Blog pages now carry the small Educate disclaimer in the footer, like the Herbarium; and the Media and Blog headings and their "coming soon" lines now come from admin → Pages → Media and Blog (same wording as before until edited).
//
// IBVU v5.8 — what changed in this file since v5.6:
// - The Blog uses this same layout. ibvu.org/educate/blog shows published blog
//   posts as tiles, and each post has its own page at
//   ibvu.org/educate/blog/the-post-title. Media is unchanged.
//
// (v5.6) Media: ibvu.org/media shows published articles as tiles, newest first.
// Each article has its own page at ibvu.org/media/the-article-title.
// Articles and blog posts are written and published in admin.
import { Link, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import NotFound from './NotFound.jsx';
import { ShareButtons } from './Share.jsx';
import { useState, useEffect } from 'react';
import Framed from './Framed.jsx';
import { wholeSrc, captionOf, widthOf, shownWidth, TILE_W } from '../lib/frame.js';
import { usePageTitle } from '../lib/site.js';
import { useContent, usePublishedArticles, usePage, excerpt, formatDate, WRITING, sectionOf, articlePath, stripReviewMarks } from '../lib/content.js';

// One article laid out for reading. Also used by the preview in admin.
// Pictures with a caption are wrapped in <figure> with the caption underneath.
function withCaptions(html) {
  if (!html.includes("data-caption") || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
  doc.querySelectorAll("img[data-caption]").forEach(img => {
    const fig = doc.createElement("figure");
    fig.className = "article-figure";
    fig.setAttribute("data-pic-box", "");
    ["data-size", "data-align"].forEach(a => { if (img.hasAttribute(a)) fig.setAttribute(a, img.getAttribute(a)); });
    if (img.style.width) { fig.style.width = img.style.width; img.style.width = ""; } // a dragged size belongs to the figure
    const cap = doc.createElement("figcaption");
    cap.textContent = img.getAttribute("data-caption");
    const holder = img.parentNode.tagName === "P" && img.parentNode.childNodes.length === 1 ? img.parentNode : img;
    holder.replaceWith(fig);
    fig.appendChild(img);
    fig.appendChild(cap);
  });
  return doc.body.firstChild.innerHTML;
}

// Full-screen view of a picture (also used on herb pages).
export function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Picture, full size" onClick={onClose}>
      <button type="button" className="lightbox-close" aria-label="Close" onClick={onClose}>✕</button>
      <img src={src} alt={alt || ""} />
    </div>
  );
}

export function ArticleView({ article, share = true, markPictures = false }) {
  const clean = withCaptions(DOMPurify.sanitize(stripReviewMarks(article.body || ""), { ADD_ATTR: ["target"] }));
  const [big, setBig] = useState(null);
  const cover = wholeSrc(article.cover);
  const coverCaption = captionOf(article.cover);
  // newsletters: the cover at its own width (tile size unless changed)
  const coverW = widthOf(article.cover) || (sectionOf(article) === "newsletter" ? TILE_W : 0);
  const sizedBox = coverW ? { width: shownWidth(coverW), marginLeft: "auto", marginRight: "auto" } : undefined;
  const mark = markPictures ? { "data-i": "cover" } : {};
  const openPicture = e => {
    const img = e.target.closest && e.target.closest("img");
    if (img) setBig({ src: img.currentSrc || img.src, alt: img.alt });
  };
  return (
    <article className="article">
      <header className="article-header">
        <p className="page-eyebrow">
          {article.publishedAt ? formatDate(article.publishedAt, false) : "Draft"}
          {article.author ? " · " + article.author : ""}
        </p>
        <h1>{article.title || "Untitled"}</h1>
        {article.summary && <p className="article-summary">{article.summary}</p>}
      </header>
      {cover && (coverCaption
        ? <figure className={"article-cover-figure" + (coverW ? " sized" : "")} style={sizedBox} data-pic-box=""><button type="button" className="article-cover-btn" onClick={() => setBig({ src: cover, alt: coverCaption })} aria-label="View the picture full size"><img className="article-cover" src={cover} alt="" {...mark} /></button><figcaption>{coverCaption}</figcaption></figure>
        : <button type="button" className={"article-cover-btn" + (coverW ? " sized" : "")} style={sizedBox} data-pic-box="" onClick={() => setBig({ src: cover, alt: "" })} aria-label="View the picture full size"><img className="article-cover" src={cover} alt="" {...mark} /></button>)}
      <div className="article-body" onClick={openPicture} dangerouslySetInnerHTML={{ __html: clean }} />
      {big && <Lightbox src={big.src} alt={big.alt} onClose={() => setBig(null)} />}
      {share && article.status === "published" && <ShareButtons path={articlePath(article)} text={article.title} label={sectionOf(article) === "blog" ? "Share this post" : "Share this article"} />}
    </article>
  );
}

// The words that differ between the two sections.
const PAGE = {
  media: { title: "Media", eyebrow: "✦ IBVU ✦",    empty: "Articles coming soon", back: "← All articles", description: "News and articles from IBVU." },
  blog:  { title: "Blog",  eyebrow: "✦ Educate ✦", empty: "Posts coming soon",    back: "← All posts",    description: "The IBVU blog: writing on the science of plants." },
};

// The tiles page for one section.
function WritingIndex({ section }) {
  const words = usePage("writing");
  const page = { ...PAGE[section], title: words[section + "Title"] || PAGE[section].title, empty: words[section + "Empty"] || PAGE[section].empty };
  usePageTitle(page.title, page.description);
  const articles = usePublishedArticles(section);
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <div className="page-header">
          <p className="page-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
        </div>
        {articles.length === 0 ? (
          <div className="soon-panel"><h2>{page.empty}</h2></div>
        ) : (
          <div className="media-grid">
            {articles.map(a => (
              <Link className="media-tile" to={articlePath(a)} key={a.id}>
                <div className="media-tile-image">{a.cover && <Framed value={a.cover} alt="" loading="lazy" />}</div>
                <div className="media-tile-text">
                  <p className="media-tile-date">{formatDate(a.publishedAt, false)}</p>
                  <h2 className="media-tile-title">{a.title}</h2>
                  <p className="media-tile-summary">{excerpt(a)}</p>
                  <span className="shop-tile-link">Read →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter disclaimer={section === "blog"} />
    </div>
  );
}

// One published article or post on its own page.
function WritingArticle({ section }) {
  const { slug } = useParams();
  const { articles, loaded } = useContent();
  const article = articles.find(a => a.slug === slug && a.status === "published" && sectionOf(a) === section);
  usePageTitle(article ? article.title : loaded ? "Page not found" : PAGE[section].title, article ? excerpt(article) : undefined);
  if (!article && !loaded) {
    return (
      <div className="page-shell">
        <SiteHeader />
        <main className="page-main"><p className="page-loading">Loading…</p></main>
        <SiteFooter />
      </div>
    );
  }
  if (!article) return <NotFound />;
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <ArticleView article={article} />
        <p className="article-back"><Link className="page-back" to={WRITING[section].path}>{PAGE[section].back}</Link></p>
      </main>
      <SiteFooter disclaimer={section === "blog"} />
    </div>
  );
}

export default function Media() { return <WritingIndex section="media" />; }
export function MediaArticle() { return <WritingArticle section="media" />; }
export function Blog() { return <WritingIndex section="blog" />; }
export function BlogArticle() { return <WritingArticle section="blog" />; }
