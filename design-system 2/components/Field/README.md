`Field` and friends compose every form row in the portal — the DSR submission form is almost entirely `FieldSet` → `FieldGroup` → `Field`.

```jsx
<FieldSet>
  <FieldLegend>Subject details</FieldLegend>
  <FieldGroup>
    <Field>
      <Label required htmlFor="first">First name</Label>
      <Input id="first" />
      <FieldDescription>Provide the legal first name of the data subject.</FieldDescription>
      <FieldError>{errors.first}</FieldError>
    </Field>
  </FieldGroup>
</FieldSet>
```

Every DSR field carries a one-line `FieldDescription` hint under the control — that's a house rule, not decoration. Errors are plain red 14px text with `role="alert"`.
