`Popover` holds the table filter panels (consent state, preference, PIA stage) and the column picker.

```jsx
<Popover align="end" trigger={<DataTableFilterButton count={2} />}>
  <PopoverTitle>Filter Consents</PopoverTitle>
  …checkbox groups…
</Popover>
```

Default alignment is `end` with an 8px offset — filter panels hang off the right edge of the toolbar. Width is 20rem in the product (`min-width: 18rem` here).
