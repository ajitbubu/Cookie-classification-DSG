`Select` is for a value that must come from a fixed list — rows-per-page, document type, relationship, state.

```jsx
<Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))} options={["10", "20", "50"]} />
<Select size="lg" placeholder="Select citizenship" options={countries} />
```

If the user should be able to type a value that isn't in the list (country, city, tag), use `Combobox` instead — that's the product's explicit rule. The selected item gets a trailing check, not a filled row.
