// IBVU v6.04 — what changed in this file: covers are shown as framed in admin.
//
// IBVU v6.03 — new file. The newsletter on the website:
//   ibvu.org/newsletter            past issues as tiles, newest first
//   ibvu.org/newsletter/issue-name one issue, as it was sent
// Only issues that were sent with "Show on the website" ticked appear.
// Issues are written and sent in admin → Newsletters.
import { Link, useParams } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import NotFound from './NotFound.jsx';
import { ArticleView } from './Media.jsx';
import Framed from './Framed.jsx';
import { usePageTitle } from '../lib/site.js';
import { useContent, usePublishedIssues, issueAsArticle, formatDate } from '../lib/content.js';
import { openNewsletter, listNames } from '../lib/lists.js';

export function NewsletterIndex() {
  usePageTitle("Newsletter", "Past issues of the IBVU newsletter.");
  const issues = usePublishedIssues();
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <div className="page-header">
          <p className="page-eyebrow">✦ About ✦</p>
          <h1>Newsletter</h1>
          <p className="page-lead">Past issues of our newsletter. <button type="button" className="text-link" onClick={() => openNewsletter("monthly")}>Subscribe</button> to get the next one by email.</p>
        </div>
        {issues.length === 0 ? (
          <div className="soon-panel"><h2>The first issue is coming soon</h2></div>
        ) : (
          <div className="media-grid">
            {issues.map(n => (
              <Link className="media-tile" to={"/newsletter/" + n.slug} key={n.id}>
                <div className="media-tile-image">{n.cover && <Framed value={n.cover} alt="" loading="lazy" />}</div>
                <div className="media-tile-text">
                  <p className="media-tile-date">{formatDate((n.sentAt || "").slice(0, 10), false)}</p>
                  <h2 className="media-tile-title">{n.title}</h2>
                  {n.previewText && <p className="media-tile-summary">{n.previewText}</p>}
                  <span className="shop-tile-link">Read →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export function NewsletterIssue() {
  const { slug } = useParams();
  const { loaded } = useContent();
  const issue = usePublishedIssues().find(n => n.slug === slug);
  usePageTitle(issue ? issue.title : loaded ? "Page not found" : "Newsletter", issue ? issue.previewText : undefined);
  if (!issue && !loaded) {
    return <div className="page-shell"><SiteHeader /><main className="page-main"><p className="page-loading">Loading…</p></main><SiteFooter /></div>;
  }
  if (!issue) return <NotFound />;
  const firstList = (issue.lists || [])[0] || "monthly";
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <ArticleView article={issueAsArticle(issue)} />
        <div className="issue-next">
          <p>This issue went to {listNames(issue.lists)} subscribers.</p>
          <button type="button" className="buy-btn" onClick={() => openNewsletter(firstList)}>Get the next one by email</button>
        </div>
        <p className="article-back"><Link className="page-back" to="/newsletter">← All issues</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
