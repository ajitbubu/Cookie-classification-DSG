`Switch` is how a data principal opts in or out of a consent, and how they enable a preference channel.

```jsx
<Switch checked={row.status === "enable"} onCheckedChange={(on) => stage(row, on)} />
```

Always wrap it in a `Tooltip` reading "Opted In" / "Opted Out". Flipping it **stages** a change rather than saving — the consent page collects pending changes and commits them from a bar with "Apply Changes". A mandatory consent renders a `MandatoryChip` instead of a switch.
