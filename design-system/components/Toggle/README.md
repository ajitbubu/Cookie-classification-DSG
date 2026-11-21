`Toggle` is a pressable option button; `ToggleGroup` with `spacing={0}` fuses several into a segmented control.

```jsx
<ToggleGroup spacing={0}>
  <Toggle variant="outline" pressed={view === "list"} onPressedChange={() => setView("list")}>List</Toggle>
  <Toggle variant="outline" pressed={view === "grid"} onPressedChange={() => setView("grid")}>Grid</Toggle>
</ToggleGroup>
```

Pressed is a `--muted` fill — do not reach for brand blue here; that's reserved for `Tabs variant="pill"` and primary buttons.
