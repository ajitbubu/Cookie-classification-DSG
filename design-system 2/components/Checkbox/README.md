`Checkbox` handles multi-select filters, DSR declarations and table row selection.

```jsx
<Checkbox checked={accepted} onCheckedChange={setAccepted} aria-label="I declare…" />
```

The unchecked border is the literal hex `#767676` (a contrast fix, not a token) on a hard `#fff` fill, and the corner radius is `2.5px` — noticeably squarer than every other control. Pair with `Field` + `Label` for a labelled row.
