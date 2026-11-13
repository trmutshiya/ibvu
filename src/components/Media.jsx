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
import { usePageTitle } from '../lib/site.js';
import { useContent, usePublishedArticles, usePage, excerpt, formatDate, WRITING, sectionOf, articlePath } from '../lib/content.js';

// One article laid out for reading. Also used by the preview in admin.
export function ArticleView({ article, share = true }) {
  const clean = DOMPurify.sanitize(article.body || "", { ADD_ATTR: ["target"] });
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
      {article.cover && <img className="article-cover" src={article.cover} alt="" />}
      <div className="article-body" dangerouslySetInnerHTML={{ __html: clean }} />
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
                <div className="media-tile-image">{a.cover && <img src={a.cover} alt="" loading="lazy" />}</div>
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
