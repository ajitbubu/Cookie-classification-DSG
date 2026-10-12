`DataTableToolbar` sits in a bordered, `muted/30` band at the top of the table card.

```jsx
<DataTableToolbar
  searchValue={search}
  onSearchChange={setSearch}
  searchProps={{ placeholder: "Search by Consent and Purpose..." }}
  filterSlot={<DataTableFilterButton count={2} />}
  actionsSlot={<DataTableExportButton />}
/>
```

It has no opinion about the filter's shape — the caller supplies a button, a popover, or nothing.
