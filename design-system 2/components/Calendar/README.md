`Calendar` is only ever shown inside `DatePickerField`'s popover — the portal has no standalone month view.

```jsx
<Calendar selected={date} onSelect={setDate} />
```

Selected day is a solid `--primary` square with `--radius-lg`; today is a 1px inset brand ring. Weekday headers are 12px `--muted-foreground`.
