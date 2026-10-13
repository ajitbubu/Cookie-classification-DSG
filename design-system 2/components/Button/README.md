Use `Button` for every clickable action in the PMP portal — form submits, toolbar actions, pagination pages, dialog confirm/cancel.

```jsx
<Button>Send OTP</Button>
<Button variant="outline" size="sm">Export</Button>
<Button variant="ghost" size="icon" aria-label="Notifications"><BellIcon /></Button>
<Button variant="link">Audit Log</Button>
```

- `variant`: `default` (brand-blue fill, primary submit) · `outline` (white surface, hairline border — toolbar) · `secondary` (light gray) · `ghost` (icon buttons in the header/pager) · `destructive` (10%-tint red, used for Logout) · `link` (inline text action, e.g. "Audit Log").
- `size`: default 40px, `lg` 36, `sm` 28, `xs` 24, `xl` 48 (auth submit, 16px text), plus square `icon`/`icon-xs`/`icon-sm`/`icon-lg`.
- Radius is `--radius-2xl` (14.4px) at every size except `xl`, which uses `--radius-xl`. Pressing nudges the button down 1px.
