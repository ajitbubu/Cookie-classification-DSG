`SearchField` is the only search input in the portal — group filters, table toolbars, the dashboard universal search.

```jsx
<SearchField placeholder="Search by Consent and Purpose..." value={q} onChange={(e) => setQ(e.target.value)} />
```

The glyph sits 12px from the leading edge and the input gains 36px of leading padding. Placeholders are sentence case with a trailing ellipsis ("Search groups...").
