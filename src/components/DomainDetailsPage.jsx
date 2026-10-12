import { useEffect, useMemo, useRef, useState } from 'react';
import Button from './ui/Button';
import {
  AlertTriangle, RefreshCw, Download, X, FileSearch, ChevronLeft, ChevronDown, History, ScanLine, Zap, Edit,
  LayoutList, Cookie, Layers, Globe, Store, ArrowDownLeft, ArrowUpRight, ClipboardCheck, Database, CheckCircle2,
} from 'lucide-react';
import KpiCard from './ui/KpiCard';
import DataTable from './ui/DataTable';
import EmptyState from './ui/EmptyState';
import MenuButton from './ui/MenuButton';
import Modal from './ui/Modal';
import Pagination from './ui/Pagination';
import TableToolbar from './ui/TableToolbar';
import { Chip, StatusChip, CategoryTag } from './ui/Chip';
import { useAnnounce } from './ui/LiveRegion';
import CookieClassificationTable from './CookieClassificationTable';
import BulkUpdateDrawer from './BulkUpdateDrawer';
import { BULK_CATEGORIES, categoryBreakdown, cookieKey, pagesFromScan, vendorsFromCookies } from '../lib/domainDetails';
import { scanStatus } from '../lib/scanResults';
import { calculateComplianceRisks, getRiskExplanation } from '../lib/riskCalculator';
import './DomainDetailsPage.css';

// UCM tags: Critical/High red, Moderate amber, Low green.
const RISK_TONE = { HIGH: 'unclassified', MEDIUM: 'marketing', LOW: 'necessary' };
const RISK_LABEL = { HIGH: 'High', MEDIUM: 'Moderate', LOW: 'Low' };
// Figma 1:184549 order: DPDP, CCPA, GDPR.
const REGULATIONS = [['dpdpRisk', 'dpdp', 'DPDP'], ['ccpaRisk', 'ccpa', 'CCPA / CPRA'], ['gdprRisk', 'gdpr', 'GDPR']];
const VERSIONS_SHOWN = 5;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pad = (n) => String(n).padStart(2, '0');
// Figma version dates: 03/14/2026 06:04:59
const versionDate = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
// Figma "Time Taken": 8 Min 43 sec
const timeTaken = (ms) => {
  if (!(ms > 0)) return null;
  const total = Math.round(ms / 1000);
  return total >= 60 ? `${Math.floor(total / 60)} Min ${total % 60} sec` : `${total} sec`;
};
const scanTypeName = (type) => (type === 'deep' ? 'Deep' : type === 'scheduled' ? 'Scheduled' : 'Quick');

function usePaged(rows, initialSize = 5) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const count = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, count);
  return {
    rows: rows.slice((current - 1) * pageSize, current * pageSize),
    footer: rows.length > 0 && (
      <Pagination page={current} pageSize={pageSize} total={rows.length} onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} />
    ),
    reset: () => setPage(1),
  };
}

const matches = (q, ...fields) => !q || fields.some((f) => (f || '').toLowerCase().includes(q));

// Domain Details (Figma 12.12.31 overview, 12.12.39 cookies, 12.13.22
// categories, 12.13.30 pages, 12.13.36 vendors). Versions are the domain's
// stored scans; Publish is browser-local until the backend stores publishes.
function DomainDetailsPage({
  scan, versions = [], currentVersionId, published, onPublish, onScanNow, onExport, onReview, onBulkUpdate, tableProps = {},
  initialTab = 'overview', onTabChange, onBack,
}) {
  const [tab, setTabState] = useState(initialTab);
  // Tab changes are reported so the URL can follow (/domains/:domain/<tab>, E3).
  const setTab = (next) => {
    setTabState(next);
    onTabChange?.(next);
  };
  // Back/Forward between tabs of the same scan changes initialTab; follow it.
  useEffect(() => { setTabState(initialTab); }, [initialTab]);
  const [selected, setSelected] = useState(() => new Set());
  const [barCategory, setBarCategory] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [allVersions, setAllVersions] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const tabRefs = useRef({});
  const versionsRef = useRef(null);
  const announce = useAnnounce();

  const cookies = useMemo(() => scan.cookies || [], [scan.cookies]);
  const categories = useMemo(() => categoryBreakdown(cookies), [cookies]);
  const pages = useMemo(() => pagesFromScan(scan), [scan]);
  const vendors = useMemo(() => vendorsFromCookies(cookies), [cookies]);
  const risks = useMemo(() => calculateComplianceRisks(cookies, scan.statistics || {}), [cookies, scan.statistics]);
  const selectedCookies = useMemo(() => cookies.filter((c) => selected.has(cookieKey(c))), [cookies, selected]);

  const q = query.trim().toLowerCase();
  const shownCookies = useMemo(() => cookies.filter((c) => matches(q, c.name, c.domain)
    && (categoryFilter === 'all' || (c.category || 'Unclassified') === categoryFilter)), [cookies, q, categoryFilter]);
  const shownPages = useMemo(() => pages.filter((p) => matches(q, p.url)), [pages, q]);
  const shownVendors = useMemo(() => vendors.filter((v) => matches(q, v.domain)), [vendors, q]);
  const pagedPages = usePaged(shownPages);
  const pagedVendors = usePaged(shownVendors);

  const failed = (scan.errorPages || []).length;
  const status = scanStatus({ failedPages: failed });
  const current = versions.find((v) => v.id === currentVersionId);
  const publishedVersion = versions.find((v) => v.id === published?.id);
  const unclassified = cookies.filter((c) => !c.category || c.category === 'Unclassified').length;
  const isDeep = scan.scanType === 'deep';

  useEffect(() => {
    if (selected.size > 0) announce(`${plural(selected.size, 'item')} selected`);
  }, [selected, announce]);

  const tabs = [
    ['overview', 'Overview', null, LayoutList],
    ['cookies', 'Cookies', cookies.length, Cookie],
    ['categories', 'Categories', categories.length, Layers],
    ['pages', 'Pages', pages.length, Globe],
    ['vendors', 'Vendors', vendors.length, Store],
  ];

  const changeTab = (next) => {
    setQuery('');
    setCategoryFilter('all');
    setTab(next);
  };

  const onTabKeyDown = (e) => {
    const i = tabs.findIndex(([id]) => id === tab);
    let next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length][0];
    if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length][0];
    if (e.key === 'Home') next = tabs[0][0];
    if (e.key === 'End') next = tabs[tabs.length - 1][0];
    if (next) {
      e.preventDefault();
      changeTab(next);
      tabRefs.current[next]?.focus();
    }
  };

  const toggle = (cookie) => setSelected((prev) => {
    const next = new Set(prev);
    const key = cookieKey(cookie);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleAll = () => setSelected((prev) => (prev.size === cookies.length ? new Set() : new Set(cookies.map(cookieKey))));
  const clearSelection = () => { setSelected(new Set()); setBarCategory(''); };

  const requestPublish = (version) => {
    if ((version.failedPages || 0) > 0) setConfirming(version);
    else onPublish(version);
  };

  const showHistory = () => {
    if (tab !== 'overview') changeTab('overview');
    requestAnimationFrame(() => versionsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  };

  const scanNowAction = { label: 'Scan Now', onClick: onScanNow };
  const toolbar = (label, filters) => (
    <TableToolbar
      label={label}
      query={query}
      onQuery={(v) => { setQuery(v); pagedPages.reset(); pagedVendors.reset(); }}
      filters={filters}
      filter={categoryFilter}
      onFilter={setCategoryFilter}
    />
  );

  let panel;
  if (tab === 'overview') {
    const shownVersions = allVersions ? versions : versions.slice(0, VERSIONS_SHOWN);
    panel = (
      <>
        <div className="dd-kpis">
          <KpiCard label="Total Cookies" value={cookies.length} icon={ArrowDownLeft} />
          <KpiCard
            label="Unclassified"
            value={unclassified}
            valueTone={unclassified > 0 ? 'critical' : undefined}
            icon={ArrowUpRight}
            action={unclassified > 0 ? { label: 'Review', variant: 'dark', onClick: onReview } : undefined}
          />
          <KpiCard label="Pages" value={pages.filter((p) => !p.failed).length || (scan.pageResults ? 0 : 1)} icon={ClipboardCheck} />
          <KpiCard label="Time Taken" value={timeTaken(scan.scanDuration)} icon={Database} />
        </div>

        <section className="dd-card dd-card--versions" ref={versionsRef} aria-labelledby="dd-versions">
          <div className="dd-card__head">
            <h3 id="dd-versions" className="dd-card__title">Version History</h3>
            {publishedVersion && (
              <span className="dd-published">
                <span>Published Version:</span>
                <Chip tone="necessary">{`V ${publishedVersion.version}`}</Chip>
              </span>
            )}
            {versions.length > VERSIONS_SHOWN && (
              <Button variant="outline" size="sm" className="dd-card__more" onClick={() => setAllVersions((v) => !v)}>
                {allVersions ? 'Show Less' : 'View All'}
              </Button>
            )}
          </div>
          <DataTable
            caption="Version history"
            rowKey={(v) => v.id}
            rows={shownVersions}
            empty={<p className="dd-none">No stored versions for this website.</p>}
            columns={[
              {
                key: 'version',
                header: 'Version',
                render: (v) => (
                  <span className="dd-version">
                    <span className="dd-version__id">{`V ${v.version}`}</span>
                    {published?.id === v.id && <span className="dd-version__tag">(Published)</span>}
                    {v.id === currentVersionId && <span className="dd-version__viewing">Viewing</span>}
                    {(v.failedPages || 0) > 0 && <StatusChip status="partial" failed={v.failedPages} />}
                  </span>
                ),
              },
              { key: 'type', header: 'Scan Type', render: (v) => scanTypeName(v.scanType) },
              {
                key: 'cookies',
                header: 'Updated Cookies',
                render: (v) => {
                  const net = v.diff ? v.diff.added - v.diff.removed : null;
                  return (
                    <span className="dd-updated">
                      {(v.totalCookies ?? 0).toLocaleString()}
                      {net != null && net !== 0 && <span className={net > 0 ? 'dd-up' : 'dd-down'}>{net > 0 ? `+${net}` : `${net}`}</span>}
                    </span>
                  );
                },
              },
              { key: 'by', header: 'Published By', render: () => '—' },
              { key: 'date', header: 'Scanned Date', render: (v) => versionDate(v.timestamp) },
              {
                key: 'action',
                header: 'Action',
                render: (v) => (published?.id === v.id ? <span className="dd-muted-dots" aria-label="Published">⋮</span> : (
                  <MenuButton
                    label={`Actions for version ${v.version}`}
                    items={[{ label: 'Publish', icon: ArrowUpRight, onSelect: () => requestPublish(v) }]}
                  />
                )),
              },
            ]}
          />
          <p className="dd-note">Publishing is saved in this browser until the backend can store it.</p>
        </section>

        <section className="dd-risk" aria-labelledby="dd-risk">
          <h3 id="dd-risk" className="dd-card__title">Risk Assessment</h3>
          <ul className="dd-risk__list">
            {REGULATIONS.map(([key, id, name]) => (
              <li key={key} className="dd-risk__row">
                <span className="dd-risk__name">
                  {name}
                  <span className="dd-risk__why">{getRiskExplanation(id, risks[key], scan.statistics || {})}</span>
                </span>
                <Chip tone={RISK_TONE[risks[key]]}>{RISK_LABEL[risks[key]]}</Chip>
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  } else if (tab === 'cookies') {
    panel = (
      <>
        {toolbar('Search cookies', [
          { value: 'all', label: 'All categories' },
          ...categories.map((c) => ({ value: c.category, label: c.category })),
        ])}
        <CookieClassificationTable
          cookies={shownCookies}
          totalCount={scan.totalCount ?? cookies.length}
          {...tableProps}
          selectedKeys={selected}
          onToggleSelect={toggle}
          onToggleSelectAll={toggleAll}
        />
        {selected.size > 0 && (
          <div className="dd-selection" role="region" aria-label="Selection">
            <button type="button" className="dd-selection__close" aria-label="Close selection" onClick={clearSelection}>
              <X size={20} aria-hidden="true" />
            </button>
            <span className="dd-selection__count">{plural(selected.size, 'item')} selected</span>
            <label className="dd-selection__category">
              <select value={barCategory} onChange={(e) => setBarCategory(e.target.value)} aria-label="Category for selected cookies">
                <option value="">Select Category</option>
                {BULK_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </label>
            <button type="button" className="dd-selection__apply" disabled={!barCategory} onClick={() => setDrawerOpen(true)}>
              Apply <CheckCircle2 size={20} aria-hidden="true" />
            </button>
            <button type="button" className="dd-selection__clear" onClick={clearSelection}>
              Clear <X size={20} aria-hidden="true" />
            </button>
          </div>
        )}
        <BulkUpdateDrawer
          open={drawerOpen}
          cookies={selectedCookies}
          initialCategory={barCategory || undefined}
          onClose={() => setDrawerOpen(false)}
          onConfirm={(changes) => setPendingChanges(changes)}
        />
        <Modal
          open={Boolean(pendingChanges)}
          title="Bulk Update Cookie Type"
          variant="confirm"
          icon={Edit}
          onClose={() => setPendingChanges(null)}
          footer={(
            <>
              <Button variant="outline" size="modal" onClick={() => setPendingChanges(null)}>Cancel</Button>
              <Button
                variant="primary"
                size="modal"
                onClick={() => {
                  const changes = pendingChanges;
                  setPendingChanges(null);
                  setDrawerOpen(false);
                  clearSelection();
                  onBulkUpdate(changes);
                }}
              >
                Confirm
              </Button>
            </>
          )}
        >
          <p className="dd-confirm">You’re about to update the cookie type for selected cookies. This action will apply all selected entries.</p>
        </Modal>
      </>
    );
  } else if (tab === 'categories') {
    panel = categories.length === 0
      ? <EmptyState title="No categories recorded for this scan" action={scanNowAction} />
      : (
        <DataTable
          caption="Categories"
          rowKey={(r) => r.category}
          rows={categories}
          columns={[
            { key: 'category', header: 'Category', render: (r) => <span className="dd-with-icon"><Layers size={22} aria-hidden="true" /><CategoryTag category={r.category} solid /></span> },
            { key: 'count', header: 'Total Cookies' },
            { key: 'requireConsent', header: 'Require Consent' },
            { key: 'thirdParty', header: 'Third Party' },
          ]}
        />
      );
  } else if (tab === 'pages') {
    panel = pages.length === 0
      ? <EmptyState icon={FileSearch} title="No pages recorded for this scan" description="Quick scans check one page. Run a Deep scan to list every page it crawled." action={scanNowAction} />
      : (
        <>
          {toolbar('Search pages')}
          <DataTable
            caption="Pages"
            rowKey={(p) => p.url}
            rows={pagedPages.rows}
            empty={<p className="dd-none">No pages match.</p>}
            columns={[
              { key: 'url', header: 'Pages URL', render: (p) => <span className="dd-with-icon"><Globe size={22} aria-hidden="true" />{p.url}</span> },
              { key: 'domains', header: 'Domain', render: (p) => (p.failed ? '—' : p.domains) },
              { key: 'initiators', header: 'Initiators', render: () => '—' },
              { key: 'duration', header: 'Duration', render: () => '—' },
              { key: 'secure', header: 'Secure', render: (p) => (p.failed ? '—' : p.secure) },
              { key: 'httpOnly', header: 'HttpOnly', render: (p) => (p.failed ? '—' : p.httpOnly) },
              { key: 'method', header: 'Method', render: (p) => (p.failed ? <StatusChip status="failed" /> : <span className="dd-method">Page Load</span>) },
            ]}
          />
          {pagedPages.footer}
        </>
      );
  } else {
    panel = vendors.length === 0
      ? <EmptyState title="No vendors recorded for this scan" action={scanNowAction} />
      : (
        <>
          {toolbar('Search vendors')}
          <DataTable
            caption="Vendors"
            rowKey={(v) => v.domain}
            rows={pagedVendors.rows}
            empty={<p className="dd-none">No vendors match.</p>}
            columns={[
              { key: 'domain', header: 'Pages URL', render: (v) => <span className="dd-with-icon"><Globe size={22} aria-hidden="true" />{v.domain}</span> },
              { key: 'cookies', header: 'Total Cookies' },
              { key: 'category', header: 'Category', render: (v) => <CategoryTag category={v.category} solid /> },
              { key: 'party', header: 'Party Type', render: (v) => (v.thirdParty ? <span className="dd-third">3rd Party</span> : '1st Party') },
            ]}
          />
          {pagedVendors.footer}
        </>
      );
  }

  return (
    <div className="dd-page">
      {/* Figma 12.12.31: title row with back button and actions, then the identity row */}
      <div className="dd-title-row">
        <div className="dd-title">
          {onBack && (
            <button type="button" className="dd-back" aria-label="Back to scan results" onClick={onBack}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          )}
          <h2 className="dd-title__text">Domain Details</h2>
        </div>
        <div className="dd-identity__actions">
          <Button variant="outline" icon={Download} onClick={onExport}>Export report</Button>
          <Button variant="primary" icon={RefreshCw} onClick={onScanNow}>Scan Now</Button>
          <button type="button" className="dd-history-btn" aria-label="Version history" onClick={showHistory}>
            <History size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      <section className="dd-identity" aria-labelledby="dd-domain">
        <div className="dd-identity__main">
          <h3 id="dd-domain" className="dd-identity__domain">{scan.domain}</h3>
          {current && <span className="dd-identity__meta">{`Version ${current.version}`}</span>}
          <span className={`dd-identity__meta ${status.status === 'partial' ? 'dd-identity__meta--partial' : ''}`}>
            {status.status === 'partial' ? `Partial (${status.failed} Failed)` : 'Completed'}
          </span>
        </div>
        <span className="dd-scantype">
          {isDeep ? <ScanLine size={20} aria-hidden="true" /> : <Zap size={20} aria-hidden="true" />}
          {`Scan Type: ${isDeep ? 'Deep' : 'Quick'} Scan`}
        </span>
      </section>

      {failed > 0 && (
        <div className="dd-partial" role="status" aria-label="Partial scan">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            {`This scan is incomplete: ${failed} of ${pages.length} pages failed. Results cover the pages that loaded; the Pages tab lists the failures.`}
          </span>
          <Button size="sm" onClick={onScanNow}>Rescan site</Button>
        </div>
      )}

      <div className="dd-tabs" role="tablist" aria-label="Domain details">
        {tabs.map(([id, label, count, Icon]) => (
          <button
            key={id}
            ref={(el) => { tabRefs.current[id] = el; }}
            type="button"
            role="tab"
            id={`dd-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="dd-panel"
            tabIndex={tab === id ? 0 : -1}
            className="dd-tab"
            onClick={() => changeTab(id)}
            onKeyDown={onTabKeyDown}
          >
            <Icon size={22} aria-hidden="true" />
            {label}
            {count !== null && <span className="dd-tab__count">{count}</span>}
          </button>
        ))}
      </div>

      <div id="dd-panel" className="dd-panel" role="tabpanel" aria-labelledby={`dd-tab-${tab}`}>
        {panel}
      </div>

      <Modal
        open={Boolean(confirming)}
        title="Publish a partial scan?"
        variant="confirm"
        tone="success"
        onClose={() => setConfirming(null)}
        footer={(
          <>
            <Button variant="outline" size="modal" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button variant="success" size="modal" onClick={() => { const v = confirming; setConfirming(null); onPublish(v); }}>
              Publish anyway
            </Button>
          </>
        )}
      >
        {confirming && (
          <p className="dd-confirm">
            {`Version ${confirming.version} is incomplete: ${plural(confirming.failedPages, 'page')} failed. Cookies set only on those pages are missing from it.`}
          </p>
        )}
      </Modal>
    </div>
  );
}

export default DomainDetailsPage;
