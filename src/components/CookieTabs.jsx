import { ScanLine } from 'lucide-react';
import Button from './ui/Button';
import { SCANNING_TABS, pathForRoute } from '../lib/routes';
import './CookieTabs.css';

// Scanning page tabs (Figma 1:189760) and Dashboard tabs (Figma 12.06.45),
// with the New Scan button on the right. Tabs are real links so they can be
// opened in a new tab; plain clicks navigate in-app.
function CookieTabs({ currentPage, activeCount = 0, onNavigate, onNewScan, tabs = SCANNING_TABS, label = 'Scanning' }) {
  return (
    <div className="cookie-tabs">
      <nav className="cookie-tabs__nav" aria-label={label}>
        {tabs.map(({ page, label }) => {
          const current = page === currentPage;
          const count = page === 'active' && activeCount > 0 ? activeCount : null;
          return (
            <a
              key={page}
              href={pathForRoute(page)}
              className={`cookie-tabs__tab ${current ? 'cookie-tabs__tab--current' : ''}`}
              aria-current={current ? 'page' : undefined}
              aria-label={count ? `${label}, ${count} active` : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                onNavigate(page);
              }}
            >
              {label}
              {count && <span className="cookie-tabs__count" aria-hidden="true">{count}</span>}
            </a>
          );
        })}
      </nav>
      {onNewScan && (
        <Button variant="primary" size="sm" icon={ScanLine} className="cookie-tabs__new" onClick={onNewScan}>New Scan</Button>
      )}
    </div>
  );
}

export default CookieTabs;
