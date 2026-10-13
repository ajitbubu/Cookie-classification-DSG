`Avatar` renders the signed-in user in the app header and stands in for a person in any table cell.

```jsx
<Avatar size="lg">
  <AvatarImage src={profile.profile_picture} alt={name} />
  <AvatarFallback>AR</AvatarFallback>
</Avatar>
```

Initials are two characters, uppercased, derived from the name. The ring is a `::after` 1px border in `--border` with `mix-blend-mode: darken` so it reads on any photo. `AvatarGroup` overlaps children by 8px and adds a 2px background ring.
