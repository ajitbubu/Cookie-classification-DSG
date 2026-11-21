`Skeleton` is the portal's only loading treatment — no spinners on page load, no "Loading…" text. Mirror the real element's box.

```jsx
<Skeleton style={{ height: 30, width: 224, borderRadius: 6 }} />
```

Skeletons come in sets that mimic the incoming layout (a group-list row = a 16px title bar, a 24×50 badge, a 12px count line). Override `borderRadius` for anything smaller than a card.
