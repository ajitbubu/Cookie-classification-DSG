`Input` is the standard text field.

```jsx
<Input id="auth-email" type="email" placeholder="name@company.com" />
```

Exact values that matter: height 40px (auth screens grow it to 44px on phones / 48px at ≥500px), horizontal padding **13px** (not 12), border `--input`, radius `--radius-lg`. Placeholders are `foreground` at 66% — not `--muted-foreground`. Invalid state sets `aria-invalid` and gets a red border plus a 3px red ring.
