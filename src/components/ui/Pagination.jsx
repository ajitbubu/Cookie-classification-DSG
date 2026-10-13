import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

const SIZES = [5, 10, 25];

/** Page numbers to show: first pages, ellipses and the last page (Figma: 1 2 3 … 10). */
export function pageItems(current, count) {
  if (count <= 5) return Array.from({ length: count }, (_, i) => i + 1);
  if (current <= 2) return [1, 2, 3, '…', count];
  if (current >= count - 1) return [1, '…', count - 2, count - 1, count];
  return [1, '…', current - 1, current, current + 1, '…', count];
}

// Table footer from Figma 12.10.31: "Rows per page" on the left, pages on the right.
function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="ui-pagination">
      <label className="ui-pagination__size">
        <span>Rows per page</span>
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} aria-label="Rows per page">
          {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <nav className="ui-pagination__pages" aria-label="Pages">
        <button type="button" className="ui-pagination__step" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {pageItems(page, count).map((item, i) => (item === '…'
          ? <span key={`gap-${i}`} className="ui-pagination__gap" aria-hidden="true">…</span>
          : (
            <button
              key={item}
              type="button"
              className={`ui-pagination__page ${item === page ? 'ui-pagination__page--current' : ''}`}
              aria-label={`Page ${item}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          )))}
        <button type="button" className="ui-pagination__step" aria-label="Next page" disabled={page >= count} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}

export default Pagination;
