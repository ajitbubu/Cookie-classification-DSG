The three opt-in toolbar actions. All are 38px tall on a white surface with a `primary/25` hairline border — a lighter treatment than a normal `outline` Button.

```jsx
<DataTableFilterButton count={activeFilters} onClick={openFilters} />
<DataTableExportButton onClick={exportCsv} />
<DataTableViewOptionsButton onClick={openColumns} />
```

The filter button is icon-only on phones and icon + "Filters" + chevron at ≥768px.
