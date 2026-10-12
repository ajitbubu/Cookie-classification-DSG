`RadioGroup` covers the DSR flow's single-choice questions ("Primary Reason", "I am raising for/as", relationship).

```jsx
<RadioGroup aria-label="Primary Reason">
  {reasons.map((r) => (
    <Field key={r} orientation="horizontal">
      <RadioGroupItem checked={value === r} onSelect={() => setValue(r)} />
      <Label>{r}</Label>
    </Field>
  ))}
</RadioGroup>
```

Note the group gap is 12px, and the dot is white-on-brand — the ring does not stay visible when checked.
