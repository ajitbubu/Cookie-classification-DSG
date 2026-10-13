`PageHeader` is the phone-only drill-down chrome: when a consent group opens full-screen, the app header and bottom nav hide and this takes over.

```jsx
<PageHeader>
  <PageHeaderBackButton onClick={back} />
  <PageHeaderTitle>Marketing Communications</PageHeaderTitle>
  <PageHeaderActions><Button variant="ghost" size="icon"><MoreIcon /></Button></PageHeaderActions>
</PageHeader>
```

56px tall, sticky, padded for the status bar. Titles use `--font-heading` at 18px/600 and truncate rather than wrap.
