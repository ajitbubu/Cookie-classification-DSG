`StatCard` is the KPI tile row above Consent, DSR and PIA lists — four tiles in a `grid-cols-2` on phones, `xl:grid-cols-4` on desktop.

```jsx
<StatCard label="Active Consent" value={12} tone="blue" icon={<FileTextIcon />} />
<StatCard label="Withdrawn" value={3} tone="green" icon={<CircleCheckIcon />} />
```

The tones are a fixed category convention, deliberately outside the semantic token set: `blue`, `green` and `amber` are gradients/solids from the DSG reference design and `violet` is `#741AF2`. Labels are uppercase 14px/600 in `--muted-foreground`; the number is 24px/700.
