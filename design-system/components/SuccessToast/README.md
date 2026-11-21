`SuccessToast` confirms a completed action — "DSR Submitted successfully!", "Consent updated successfully."

```jsx
<SuccessToast title="DSR Submitted successfully!" description="The Data Subject Request has been submitted successfully." />
```

The product renders it through `toast.custom()` because the built-in single-line toast can't fit the icon tile + title + description layout. Titles end with an exclamation mark or a full stop and always name what succeeded — never a bare "Success".
