`ExpandableText` handles the long, server-authored consent titles and purposes in table cells.

```jsx
<ExpandableText html={sanitized} maxLines={2} moreLabel="more" lessLabel="less" />
```

Consent titles clip to 1 line, purposes to 2. "more" replaces the clipped block with the full text plus an inline "less" — it never shows both. Labels are lowercase ("more"/"less"), 12px, brand blue, underlined.
