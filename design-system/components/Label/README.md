`Label` is the field label everywhere in the portal.

```jsx
<Label htmlFor="auth-email" icon={<MailIcon />}>Email Address</Label>
<Label required htmlFor="citizenship">Citizenship</Label>
```

The required marker is a leading red asterisk, never a trailing one, and never the word "required". Auth-screen labels carry a 16px Lucide glyph; in-app form labels usually don't.
