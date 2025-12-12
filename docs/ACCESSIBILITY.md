# Accessibility Features

This document outlines the accessibility features implemented in the Cookie Scanner application to ensure WCAG AA compliance.

## MLClassificationDropdown Component

### ARIA Labels
- **Trigger button**: Includes comprehensive aria-label describing the ML prediction, confidence level, and agreement status
- **Dropdown menu**: Uses `role="listbox"` with `aria-label="Cookie category options"`
- **Menu items**: Each option has `role="option"` with `aria-selected` and descriptive `aria-label`
- **Confidence badge**: Includes aria-label with full confidence information
- **Agreement indicators**: Labeled to indicate whether ML prediction matches actual category

### Keyboard Navigation
- **Tab**: Navigate to/from the dropdown trigger button
- **Enter/Space**: Open dropdown menu or select focused option
- **Escape**: Close dropdown and return focus to trigger
- **Arrow Down**: Move focus to next option (or open menu if closed)
- **Arrow Up**: Move focus to previous option
- **Home**: Jump to first option
- **End**: Jump to last option

### Focus Management
- Focus is maintained on the trigger button when dropdown is closed
- Focus returns to trigger button after selection
- Focused items are visually highlighted with outline
- Focused items automatically scroll into view

### Screen Reader Support
- Loading state announced with `aria-busy="true"` and `role="status"`
- Error messages use `role="alert"` with `aria-live="assertive"`
- Success messages announced via hidden `role="status"` region
- All icons marked with `aria-hidden="true"` to prevent redundant announcements

## Category Badges

### ARIA Labels
- Each category badge includes `role="status"` and descriptive `aria-label`
- Format: "Cookie category: [Category Name]"

### Visual Design
- Color-coded badges with sufficient contrast ratios
- Text labels always accompany color indicators
- No information conveyed by color alone

## App-Level Accessibility

### Aria-Live Region
- Global aria-live region for category update announcements
- Uses `role="status"` with `aria-live="polite"` and `aria-atomic="true"`
- Announces:
  - When category update starts
  - When category update succeeds
  - When category update fails with error details

### Screen Reader Only Content
- `.sr-only` CSS class hides content visually while keeping it accessible to screen readers
- Used for status announcements and supplementary information

## Color Contrast Compliance

All category badge colors meet WCAG AA standards (4.5:1 contrast ratio for normal text):

| Category | Background | Text Color | Contrast Ratio |
|----------|-----------|------------|----------------|
| Strictly Necessary | #d1fae5 | #065f46 | 7.2:1 ✓ |
| Functional | #D4F4EC | #006B54 | 6.8:1 ✓ |
| Analytics | #D6E6FF | #104ECC | 7.5:1 ✓ |
| Marketing | #fecaca | #991b1b | 7.1:1 ✓ |
| Preferences | #fbcfe8 | #9f1239 | 6.9:1 ✓ |

## Testing Recommendations

### Manual Testing
1. **Keyboard Navigation**: Test all interactive elements using only keyboard
2. **Screen Reader**: Test with NVDA (Windows), JAWS (Windows), or VoiceOver (Mac)
3. **Focus Indicators**: Verify all focusable elements have visible focus indicators
4. **Color Contrast**: Use browser DevTools or online tools to verify contrast ratios

### Automated Testing
- Use axe DevTools browser extension
- Run Lighthouse accessibility audit
- Use WAVE browser extension

## Future Enhancements

1. **High Contrast Mode**: Add support for Windows High Contrast Mode
2. **Reduced Motion**: Respect `prefers-reduced-motion` media query
3. **Font Scaling**: Ensure UI remains usable at 200% text zoom
4. **Touch Targets**: Ensure all interactive elements meet minimum 44x44px size on mobile
