`DataTablePagination` closes every table card, inside a top-bordered strip.

```jsx
<DataTablePagination from={1} to={10} total={48} page={1} totalPages={5} pageSize={10}
  onPageChange={setPage} onPageSizeChange={setPageSize} />
```

It renders nothing when `total` is 0. The pager always shows five page buttons (fewer only when `totalPages < 5`); the current page is a filled `default` Button, the rest are `ghost`. On phones the range text and rows-per-page select are hidden and only the pager shows.
