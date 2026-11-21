Every consent `Switch` and every truncated group name in the portal is wrapped in a `Tooltip`.

```jsx
<Tooltip content="Opted In"><Switch checked onCheckedChange={…} /></Tooltip>
```

The bubble is `--foreground` (dark navy) with `--background` text at 12px, `--radius-md`, and opens with no delay. Mandatory consents use it to explain why the row can't change: "This is a mandatory consent. Once you opt in, it can't be changed."
