`Badge` is the portal's status pill — consent expiry state, PIA workflow stage, DSR status, "New" group markers.

```jsx
<Badge variant="success">ACTIVE</Badge>
<Badge variant="warning">EXPIRING SOON</Badge>
<Badge variant="destructive">EXPIRED</Badge>
<Badge variant="outline">Legitimate Interest</Badge>
```

Status text in tables is UPPERCASED by the caller (`label.toUpperCase()`) and set at `font-weight: 600` with wide tracking. Semantic variants (`success`/`warning`/`destructive`) are a 10% tint of the token with full-strength text — never a solid fill.
