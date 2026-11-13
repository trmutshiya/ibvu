// IBVU v6.03 — what changed in this file: the newsletter pages lead to admin → Newsletters, and
// people who can edit see a "Show draft changes" switch.
// IBVU v5.92 — what changed in this file: the Privacy page has its button too.
// IBVU v5.9 — new file.
// A small "Edit this page" button, shown on the public site only to people
// who are signed in to admin and allowed to edit. It leads straight to the
// right form in admin. Visitors never see it.
import { Link, useLocation } from 'react-router-dom';
import { useSession, can, useContent, setShowDraftChanges } from '../lib/content.js';

// Which admin screen edits the page at this address.
function target(pathname) {
  if (pathname === "/") return { to: "/admin/pages?page=home", needs: "pages" };
  if (pathname.startsWith("/regulate")) return { to: "/admin/pages?page=regulate", needs: "pages" };
  if (pathname.startsWith("/innovate")) return { to: "/admin/pages?page=innovate", needs: "pages" };
  if (pathname.startsWith("/contact")) return { to: "/admin/pages?page=contact", needs: "pages" };
  if (pathname.startsWith("/privacy")) return { to: "/admin/pages?page=privacy", needs: "pages" };
  if (pathname.startsWith("/newsletter")) return { to: "/admin/newsletters", needs: "newsletters", label: "Edit newsletters" };
  if (pathname === "/shop/events") return { to: "/admin/events", needs: "draft", label: "Edit events" };
  if (pathname.startsWith("/shop")) return { to: "/admin/pages?page=shop", needs: "pages" };
  if (pathname === "/media" || pathname === "/educate/blog") return { to: "/admin/pages?page=writing", needs: "pages" };
  if (pathname.startsWith("/media/")) return { to: "/admin/articles", needs: "draft", label: "Edit articles" };
  if (pathname.startsWith("/educate/blog/")) return { to: "/admin/blog", needs: "draft", label: "Edit blog posts" };
  if (pathname.startsWith("/educate/hs")) return { to: "/admin/pages?page=herbarium", needs: "pages" };
  return null;
}

export default function EditPageButton() {
  const { pathname } = useLocation();
  const session = useSession();
  const { drafts, showDraftChanges } = useContent();
  if (!session || pathname.startsWith("/admin")) return null;
  const t = target(pathname);
  const mayEdit = t && can(session.role, t.needs);
  const pageDrafts = Object.keys(drafts).some(k => k.startsWith("page:"));
  return (
    <div className="edit-page" role="region" aria-label="Admin shortcuts">
      {mayEdit && <Link className="edit-page-main" to={t.to}>✎ {t.label || "Edit this page"}</Link>}
      {pageDrafts && (
        <button type="button" className={"edit-page-drafts" + (showDraftChanges ? " on" : "")} aria-pressed={showDraftChanges} onClick={() => setShowDraftChanges(!showDraftChanges)}>
          {showDraftChanges ? "Showing draft changes" : "Show draft changes"}
        </button>
      )}
      <Link to="/admin">Admin</Link>
    </div>
  );
}
