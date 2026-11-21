`Combobox` is the searchable, free-text-tolerant dropdown. Reach for it whenever valid values come from a known list but must not be limited to it.

```jsx
<Combobox value={country} onValueChange={setCountry} options={countries} placeholder="Select country/region" />
```

It looks identical to `Input` (40px, bordered, 13px padding) plus a trailing chevron. The empty state deliberately reads "No matches — you can still type your own value."
