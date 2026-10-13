import { useMemo, useState } from 'react';
import { Globe, Search } from 'lucide-react';
import DataTable from './ui/DataTable';
import EmptyState from './ui/EmptyState';
import MenuButton from './ui/MenuButton';
import { Chip, StatusChip } from './ui/Chip';
import { RISK_ORDER, websitesFromHistory } from '../lib/websites';
import './WebsitesPage.css';

// UCM tags: Critical/High red, Moderate amber, Low green.
const RISK_TONE = { HIGH: 'unclassified', MEDIUM: 'marketing', LOW: 'necessary' };
const RISK_LABEL = { HIGH: 'High', MEDIUM: 'Moderate', LOW: 'Low' };

const SORTS = {
  recent: (a, b) => (a.latest.timestamp < b.latest.timestamp ? 1 : -1),
  risk: (a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9),
  cookies: (a, b) => b.cookies - a.cookies,
  alpha: (a, b) => a.domain.localeCompare(b.domain),
};

// Websites tab (plan 3A): every scanned website, described by its newest scan.
function WebsitesPage({ scanHistory = [], domainHistory = {}, loading = false, error = false, onRetry, onOpenScan, onScanNow, onNewScan }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const sites = useMemo(() => websitesFromHistory(scanHistory, domainHistory), [scanHistory, domainHistory]);
  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () => [...sites].filter((s) => !q || s.domain.toLowerCase().includes(q)).sort(SORTS[sort]),
    [sites, q, sort]
  );

  if (!loading && !error && sites.length === 0) {
    return (
      <section className="ws-card">
        <EmptyState
          icon={Globe}
          title="No websites added"
          description="Websites appear here after you scan them, with their latest cookie count, risk and scan status."
          action={{ label: 'Scan a website', onClick: onNewScan }}
        />
      </section>
    );
  }

  return (
    <section className="ws-card" aria-labelledby="ws-heading">
      <div className="ws-card__header">
        <h2 id="ws-heading" className="ws-card__title">Websites</h2>
        {!error && (
          <div className="ws-tools">
            <label className="ws-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" aria-label="Search websites" placeholder="Search websites" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <select className="ws-sort" aria-label="Sort websites" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Most recent</option>
              <option value="risk">Highest risk</option>
              <option value="cookies">Most cookies</option>
              <option value="alpha">A to Z</option>
            </select>
          </div>
        )}
      </div>
      <DataTable
        caption="Websites"
        rowKey={(s) => s.domain}
        rows={rows}
        loading={loading}
        error={error ? "Couldn't load websites." : null}
        onRetry={onRetry}
        empty={<p className="ws-none">No websites match “{query}”.</p>}
        columns={[
          {
            key: 'domain',
            header: 'Website',
            render: (s) => (
              <button type="button" className="ws-site" onClick={() => onOpenScan(s.latest)} disabled={!s.latest.fullResults}
                title={s.latest.fullResults ? undefined : 'Details for this scan were trimmed from storage'}>
                {s.domain}
              </button>
            ),
          },
          { key: 'last', header: 'Last scan', render: (s) => new Date(s.latest.timestamp).toLocaleString() },
          { key: 'scans', header: 'Scans', align: 'end' },
          { key: 'cookies', header: 'Cookies', align: 'end' },
          { key: 'unclassified', header: 'Unclassified', align: 'end' },
          { key: 'risk', header: 'Risk', render: (s) => (s.risk ? <Chip tone={RISK_TONE[s.risk]} size="sm">{RISK_LABEL[s.risk]}</Chip> : '—') },
          { key: 'status', header: 'Last scan status', render: (s) => <StatusChip status={s.status.status} failed={s.status.failed} /> },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            render: (s) => (
              <MenuButton
                label={`Actions for ${s.domain}`}
                items={[
                  ...(s.latest.fullResults ? [{ label: 'Open latest scan', onSelect: () => onOpenScan(s.latest) }] : []),
                  { label: 'Scan now', onSelect: () => onScanNow(s.url) },
                ]}
              />
            ),
          },
        ]}
      />
    </section>
  );
}

export default WebsitesPage;
