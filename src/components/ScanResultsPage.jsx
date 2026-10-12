import { useMemo, useState } from 'react';
import { History, ArrowDownLeft, ArrowUpRight, ClipboardCheck, Database } from 'lucide-react';
import KpiCard from './ui/KpiCard';
import DataTable from './ui/DataTable';
import EmptyState from './ui/EmptyState';
import MenuButton from './ui/MenuButton';
import Pagination from './ui/Pagination';
import TableToolbar from './ui/TableToolbar';
import { KpiSkeleton } from './ui/Skeleton';
import { StatusChip, ScanTypeChip } from './ui/Chip';
import { scanResultKpis, scanStatus, formatScanDate, pagesLabel, newCookieCount } from '../lib/scanResults';
import './ScanResultsPage.css';

const FILTERS = [
  { value: 'all', label: 'All scans' },
  { value: 'quick', label: 'Quick scans' },
  { value: 'deep', label: 'Deep scans' },
  { value: 'partial', label: 'Scans with failed pages' },
];
const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'cookies', label: 'Most cookies' },
];

const trendOf = (t) => (t == null ? undefined : { text: `${Math.round(Math.abs(t) * 100)}%`, direction: t < 0 ? 'down' : 'up' });

const durationLabel = (ms) => {
  if (ms == null) return null;
  return ms >= 60000 ? `${(ms / 60000).toFixed(1)}m` : `${Math.round(ms / 1000)}s`;
};

// Scan Result list (Figma 12.10.31): KPI row with week-on-week trends, then the
// searchable, filterable, paginated results table.
function ScanResultsPage({ scanHistory = [], loading = false, error = false, onRetry, onOpenScan, onDeleteScan, onClearHistory, onNewScan }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const kpis = useMemo(() => scanResultKpis(scanHistory), [scanHistory]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = scanHistory.filter((s) => {
      if (q && !(s.domain || '').toLowerCase().includes(q) && !(s.url || '').toLowerCase().includes(q)) return false;
      if (filter === 'quick') return s.scanType !== 'deep';
      if (filter === 'deep') return s.scanType === 'deep';
      if (filter === 'partial') return (s.failedPages || 0) > 0;
      return true;
    });
    const by = {
      newest: (a, b) => (a.timestamp < b.timestamp ? 1 : -1),
      oldest: (a, b) => (a.timestamp > b.timestamp ? 1 : -1),
      cookies: (a, b) => (b.totalCookies || 0) - (a.totalCookies || 0),
    }[sort];
    return [...matches].sort(by);
  }, [scanHistory, query, filter, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const resetPage = (fn) => (v) => { fn(v); setPage(1); };

  const value = (n) => (error ? null : n);
  const empty = !loading && !error && scanHistory.length === 0;

  const columns = [
    {
      key: 'domain',
      header: 'Website',
      render: (s) => (
        <button type="button" className="sr-site" onClick={() => onOpenScan(s)} disabled={!s.fullResults}
          title={s.fullResults ? undefined : 'Details for this older scan were trimmed from storage'}>
          {s.domain}
        </button>
      ),
    },
    { key: 'scanType', header: 'Scan Type', render: (s) => <ScanTypeChip type={s.scanType === 'deep' ? 'deep' : 'quick'} variant="pill" /> },
    { key: 'timestamp', header: 'Date & Time', render: (s) => formatScanDate(s.timestamp) },
    { key: 'pages', header: 'Pages', render: (s) => pagesLabel(s) },
    { key: 'newCookies', header: 'Cookies found', render: (s) => `+${newCookieCount(s, scanHistory)}` },
    { key: 'status', header: 'Status', render: (s) => { const st = scanStatus(s); return <StatusChip status={st.status} failed={st.failed} />; } },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (s) => (
        <MenuButton
          label={`Actions for ${s.domain}`}
          items={[
            ...(s.fullResults ? [{ label: 'View results', onSelect: () => onOpenScan(s) }] : []),
            { label: 'Delete scan', tone: 'critical', onSelect: () => onDeleteScan(s.id) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="sr-page">
      <div className="sr-kpis" aria-busy={loading || undefined}>
        {loading ? (
          [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Total Scan" value={value(kpis.totalScans.value)} icon={ArrowDownLeft} trend={trendOf(kpis.totalScans.trend)} />
            <KpiCard label="Avg. Scan Duration" value={value(durationLabel(kpis.avgDurationMs.value))} icon={ArrowUpRight} trend={trendOf(kpis.avgDurationMs.trend)} />
            <KpiCard
              label="Success Rate"
              value={value(kpis.successRate.value == null ? null : `${(kpis.successRate.value * 100).toFixed(1)}%`)}
              icon={ClipboardCheck}
              trend={trendOf(kpis.successRate.trend)}
            />
            <KpiCard label="Pages Scanned" value={value(kpis.pagesScanned.value)} icon={Database} trend={trendOf(kpis.pagesScanned.trend)} />
          </>
        )}
      </div>

      <section className="sr-card" aria-labelledby="sr-heading">
        <h2 id="sr-heading" className="sr-card__title">Scan Result</h2>
        {scanHistory.length > 0 && !error && (
          <TableToolbar
            label="Search scans"
            query={query}
            onQuery={resetPage(setQuery)}
            filters={FILTERS}
            filter={filter}
            onFilter={resetPage(setFilter)}
            sorts={SORTS}
            sort={sort}
            onSort={setSort}
            actions={[{ label: 'Clear history', tone: 'critical', onSelect: onClearHistory }]}
          />
        )}

        {empty ? (
          <EmptyState
            icon={History}
            title="No scans yet"
            description="Every scan you run is listed here with its status and the cookies it found."
            action={{ label: 'New Scan', onClick: onNewScan }}
          />
        ) : (
          <>
            <DataTable
              caption="Scan results"
              columns={columns}
              rows={visible}
              rowKey={(s) => s.id}
              loading={loading}
              error={error ? "Couldn't load scan results." : null}
              onRetry={onRetry}
              empty={<p className="sr-none">No scans match.</p>}
            />
            {!loading && !error && rows.length > 0 && (
              <Pagination page={current} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={resetPage(setPageSize)} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default ScanResultsPage;
