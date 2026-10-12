import { Search, SlidersHorizontal, ListFilter } from 'lucide-react';
import MenuButton from './MenuButton';
import './TableToolbar.css';

// Figma table toolbar: search on the left (magnifier on the right of the field),
// filter and sort icon buttons on the right.
function TableToolbar({ label, query, onQuery, filters, filter, onFilter, sorts, sort, onSort, actions = [] }) {
  return (
    <div className="ui-toolbar">
      <label className="ui-toolbar__search">
        <input type="search" aria-label={label} placeholder="Search" value={query} onChange={(e) => onQuery(e.target.value)} />
        <Search size={20} aria-hidden="true" />
      </label>
      <div className="ui-toolbar__buttons">
        {(filters || actions.length > 0) && (
          <MenuButton
            label="Filter"
            className="ui-toolbar__icon"
            items={[
              ...(filters || []).map((f) => ({ label: f.label, checked: f.value === filter, onSelect: () => onFilter(f.value) })),
              ...actions,
            ]}
          >
            <SlidersHorizontal size={20} aria-hidden="true" />
          </MenuButton>
        )}
        {sorts && (
          <MenuButton
            label="Sort"
            className="ui-toolbar__icon"
            items={sorts.map((s) => ({ label: s.label, checked: s.value === sort, onSelect: () => onSort(s.value) }))}
          >
            <ListFilter size={20} aria-hidden="true" />
          </MenuButton>
        )}
      </div>
    </div>
  );
}

export default TableToolbar;
