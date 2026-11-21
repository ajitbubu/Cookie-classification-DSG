Use `Table` and friends only when you need full control of the markup; otherwise reach for `DataTable`, which is what every listing screen in the portal actually uses.

```jsx
<Table>
  <TableHeader><TableRow><TableHead>Consents</TableHead></TableRow></TableHeader>
  <TableBody><TableRow><TableCell>Marketing email</TableCell></TableRow></TableBody>
</Table>
```

Header cells are 40px tall, 12px, uppercase, `--muted-foreground`, on a `muted/60` band. Body cells are 12px padding (the consent table overrides to 16px) and `white-space: nowrap`.
