`Textarea` takes free-text notes — the consent update note, a DSR comment, a complaint description.

```jsx
<Textarea placeholder="Add Notes (optional)" />
```

Unlike `Input`, it has **no visible border** at rest: the surface is `--input` at 50%, radius `--radius-2xl`, and resizing is disabled (the product grows it with `field-sizing: content`).
