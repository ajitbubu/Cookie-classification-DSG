`DatePickerField` is the portal's date input — date of birth, expiry date, DSR created-date filters.

```jsx
<DatePickerField id="dob" label="Date of Birth" required value={dob} onValueChange={setDob} />
```

Displayed text is `MM-DD-YYYY`; the value passed around is ISO `yyyy-MM-dd`. Server timestamps arrive in several non-ISO shapes and must be rendered in the viewer's own timezone — see the CONTENT FUNDAMENTALS note in readme.md.
