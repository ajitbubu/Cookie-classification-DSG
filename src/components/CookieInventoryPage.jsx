import { useMemo, useState } from 'react';
import { Search, Cookie } from 'lucide-react';
import DataTable from './ui/DataTable';
import EmptyState from './ui/EmptyState';
import Pagination from './ui/Pagination';
import { CategoryTag, StatusChip } from './ui/Chip';
import { buildInventory } from '../lib/cookieInventory';
import { formatScanDate } from '../lib/scanResults';
import './CookieInventoryPage.css';

const UNPUBLISHED = new Set(['Unclassified', 'Uncategorized', 'Unknown']);
const label = (category) => (!category || UNPUBLISHED.has(category) ? 'Unclassified' : category);

// Cookie Inventory tab (plan 3A): every cookie seen across stored scans.
function CookieInventoryPage({ scanHistory = [], loading = false, error = false, onRetry, onNewScan }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const inventory = useMemo(() => buildInventory(scanHistory), [scanHistory]);
  const categories = useMemo(() => [...new Set(inventory.map((c) => label(c.category)))].sort(), [inventory]);
  const q = query.trim().toLowerCase();
  const rows = inventory.filter((c) =>
    (!q || c.name.toLowerCase().includes(q) || (c.domain || '').toLowerCase().includes(q))
    && (category === 'all' || label(c.category) === category));
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const resetPage = (fn) => (v) => { fn(v); setPage(1); };
  const hasPartial = inventory.some((c) => c.sourceFailedPages > 0);

  if (!loading && !error && inventory.length === 0) {
    return (
      <section className="ci-card">
        <EmptyState
          icon={Cookie}
          title="No cookies discovered yet"
          description="Cookies appear here after your first scan."
          action={{ label: 'New Scan', onClick: onNewScan }}
        />
      </section>
    );
  }

  return (
    <section className="ci-card" aria-labelledby="ci-heading">
      <div className="ci-header">
        <div>
          <h2 id="ci-heading" className="ci-title">Cookie inventory</h2>
          {!loading && !error && <p className="ci-subtitle">{inventory.length} distinct cookies across your stored scans</p>}
        </div>
        {!error && (
          <div className="ci-tools">
            <label className="ci-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" aria-label="Search cookies" placeholder="Search by cookie name or domain"
                value={query} onChange={(e) => resetPage(setQuery)(e.target.value)} />
            </label>
            <label className="ci-filter">
              <span className="sr-only">Category</span>
              <select aria-label="Category" value={category} onChange={(e) => resetPage(setCategory)(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      <DataTable
        caption="Cookie inventory"
        rowKey={(c) => `${c.name}|${c.domain}`}
        rows={visible}
        loading={loading}
        skeletonRows={8}
        error={error ? "Couldn't load the cookie inventory." : null}
        onRetry={onRetry}
        empty={<p className="ci-none">No cookies match these filters.</p>}
        columns={[
          { key: 'name', header: 'Cookie', render: (c) => <span className="mono">{c.name}</span> },
          { key: 'domain', header: 'Domain' },
          { key: 'category', header: 'Category', render: (c) => <CategoryTag category={c.category} /> },
          { key: 'sites', header: 'Sites', align: 'end', render: (c) => <span title={c.sites.join(', ')}>{c.sites.length}</span> },
          { key: 'lastSeen', header: 'Last seen', render: (c) => formatScanDate(c.lastSeen) },
          // Only partial scans are worth flagging; a column of identical "Completed" was noise (FINDING-012)
          ...(hasPartial ? [{
            key: 'source',
            header: 'Source scan',
            render: (c) => (c.sourceFailedPages > 0 ? <StatusChip status="partial" failed={c.sourceFailedPages} /> : null),
          }] : []),
        ]}
      />
      {!loading && !error && rows.length > 0 && (
        <Pagination page={current} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={resetPage(setPageSize)} />
      )}
    </section>
  );
}

export default CookieInventoryPage;
