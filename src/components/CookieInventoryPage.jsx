import { useMemo, useState } from 'react';
import { Search, Cookie } from 'lucide-react';
import DataTable from './ui/DataTable';
import EmptyState from './ui/EmptyState';
import { CategoryTag, StatusChip } from './ui/Chip';
import { buildInventory } from '../lib/cookieInventory';
import './CookieInventoryPage.css';

const UNPUBLISHED = new Set(['Unclassified', 'Uncategorized', 'Unknown']);
const label = (category) => (!category || UNPUBLISHED.has(category) ? 'Unclassified' : category);

// Cookie Inventory tab (plan 3A): every cookie seen across stored scans.
function CookieInventoryPage({ scanHistory = [], loading = false, error = false, onRetry, onNewScan }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const inventory = useMemo(() => buildInventory(scanHistory), [scanHistory]);
  const categories = useMemo(() => [...new Set(inventory.map((c) => label(c.category)))].sort(), [inventory]);
  const q = query.trim().toLowerCase();
  const rows = inventory.filter((c) =>
    (!q || c.name.toLowerCase().includes(q) || (c.domain || '').toLowerCase().includes(q))
    && (category === 'all' || label(c.category) === category));

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
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="ci-filter">
              <span className="sr-only">Category</span>
              <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
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
        rows={rows}
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
          { key: 'lastSeen', header: 'Last seen', render: (c) => new Date(c.lastSeen).toLocaleDateString() },
          {
            key: 'source',
            header: 'Source scan',
            render: (c) => (c.sourceFailedPages > 0
              ? <StatusChip status="partial" failed={c.sourceFailedPages} />
              : <StatusChip status="completed" />),
          },
        ]}
      />
    </section>
  );
}

export default CookieInventoryPage;
