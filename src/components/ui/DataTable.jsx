import { RowSkeleton } from './Skeleton';
import PanelError from './PanelError';
import './DataTable.css';

// Shared table (decision 21A): scrolls sideways inside its own wrapper, never
// the page, with the identifying first column pinned. Loading, error and empty
// states render in the table body (7A, 8A, 6A).
function DataTable({ caption, columns, rows, rowKey, loading = false, skeletonRows = 5, error, onRetry, empty, onRowClick }) {
  const span = columns.length;
  let body;
  if (loading) {
    body = Array.from({ length: skeletonRows }, (_, i) => <RowSkeleton key={i} columns={span} />);
  } else if (error) {
    body = <tr><td colSpan={span} className="ui-table__state"><PanelError message={error} onRetry={onRetry} /></td></tr>;
  } else if (rows.length === 0 && empty) {
    body = <tr><td colSpan={span} className="ui-table__state">{empty}</td></tr>;
  } else {
    body = rows.map((row) => (
      <tr
        key={rowKey(row)}
        className={onRowClick ? 'ui-table__row--clickable' : undefined}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
      >
        {columns.map((col, i) => {
          const content = col.render ? col.render(row) : row[col.key];
          const align = col.align === 'end' ? ' ui-table__cell--end' : '';
          return i === 0
            ? <th key={col.key} scope="row" className={`ui-table__sticky${align}`}>{content}</th>
            : <td key={col.key} className={align.trim() || undefined}>{content}</td>;
        })}
      </tr>
    ));
  }

  return (
    <div className="ui-table-scroll">
      <table className="ui-table" aria-busy={loading || undefined}>
        <caption className="ui-table__caption">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.key}
                scope="col"
                className={[i === 0 && 'ui-table__sticky', col.align === 'end' && 'ui-table__cell--end'].filter(Boolean).join(' ') || undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}

export default DataTable;
