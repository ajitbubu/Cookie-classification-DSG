`EmptyState` fills a table or list that has no rows.

```jsx
<EmptyState
  title="No Consents Found"
  description="We couldn't find any consents matching your current filters."
  action={<Button variant="outline" onClick={clearFilters}>Clear Filters</Button>}
/>
```

Copy is always two lines: a Title Case headline naming what's missing, then a "We couldn't find…" sentence in first-person plural. When filters caused it, offer "Clear Filters". The DSR list uses `illustration="assets/illustrations/empty-graphics.png"` instead of the glyph tile.
