// IBVU v5.3 — new file.
// Shown when someone opens an address that has no page (for example a mistyped link).
import { Link } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import { usePageTitle } from '../lib/site.js';

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <div className="page-header">
          <p className="page-eyebrow">✦ IBVU ✦</p>
          <h1>Page not found</h1>
          <p className="page-lead">There is no page at this address.</p>
          <Link className="page-back" to="/">← Back to the home page</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
