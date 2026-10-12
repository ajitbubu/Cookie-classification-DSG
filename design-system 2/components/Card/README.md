`Card` wraps every panel in the portal: the consent group list, the table shell, KPI tiles, the dashboard hero.

```jsx
<Card size="sm">
  <CardHeader><CardTitle>Consents</CardTitle></CardHeader>
  <CardContent>…</CardContent>
</Card>
```

Padding is vertical on the root and horizontal on the parts, both from `--card-spacing` — so a full-bleed child (a table, an image) just skips `CardContent`. Never add a border: the look is a hairline `ring` plus `--shadow-sm`.
