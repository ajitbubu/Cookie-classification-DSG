`Tabs` with `variant="pill"` is the consent-category filter — a horizontally scrolling row of capsules where the active one is a solid brand-blue fill.

```jsx
<Tabs>
  <TabsList variant="pill">
    {categories.map((c) => (
      <TabsTrigger key={c} active={c === category} onSelect={() => setCategory(c)}>{c} ({counts[c]})</TabsTrigger>
    ))}
  </TabsList>
</Tabs>
```

Use `pill` for content filtering, `default` (segmented on `--muted`) or `line` (2px underline) for switching views. Pill tabs hide their scrollbar.
