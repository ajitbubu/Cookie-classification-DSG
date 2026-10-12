`DataTable` is the backbone of the portal: Consent, My DSR(s) and PIA assessments are all one `DataTable` plus a toolbar and a pager.

```jsx
const columns = [
  { id: "consents", header: "Consents", cell: (r) => r.consent_title },
  { id: "status", header: "Status", cell: (r) => <Badge variant="success">ACTIVE</Badge> },
  { id: "actions", header: "Actions", cell: (r, ctx) => <Switch checked={r.on} /> },
]
<DataTable columns={columns} rows={pageRows} getRowKey={(r) => r.id}
  isRowExpanded={(_r, k) => expanded === k} onToggleExpand={setExpanded}
  renderExpandedRow={(r) => <ConsentRowDetail row={r} />} />
```

The expand trigger lives inside a column's own `cell` via `ctx.toggleExpand` — `DataTable` never injects a chevron column of its own. Expanded rows in the consent table are tinted `--consent-row-expanded` (`#edf2f8`).
