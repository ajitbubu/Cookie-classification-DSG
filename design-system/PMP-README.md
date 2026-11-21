# Data Safeguard — Privacy Management Portal design system

The design system behind **ID-PRIVACY® Privacy Management Portal (PMP)**, the
consent- and privacy-rights portal built by **Data Safeguard**. It is a
white-label product: one codebase, one component kit, and a per-tenant theme
that swaps the palette and typefaces for each client deployment.

## What the product does

The PMP is the surface a *data principal* (an individual) uses to exercise
their privacy rights, and the surface a privacy team uses to assess risk. Five
areas, each gated by a per-tenant feature flag:

| Area | What it is |
| --- | --- |
| **Dashboard** | Universal portal search, suggested actions, quick notifications |
| **Consent** | Consent groups → consents → linked preference channels; opt in/out, extend expiry, audit log |
| **Preference** | Channel-level marketing preferences (email/SMS/WhatsApp/push). Temporarily disabled in the product — nav item and quick action are commented out |
| **DPAR / DSR** | Data Subject / Data Principal Requests: access, erasure, rectification, nomination, complaint, appeal. Submit, track, upload evidence |
| **PIA** | Privacy Impact Assessments with a seven-stage workflow (draft → risk generated → privacy review → business owner correction → assessor review → business approver review → completed) |

Regulatory vocabulary is region-aware: the same feature is "DSAR" (UK GDPR),
"DPR/DPAR" (India DPDPA), or a CCPA request depending on the tenant.

## Sources this system was built from

Both sources were read directly; nothing here was reconstructed from memory or
from screenshots.

- **Codebase (primary, and the tie-breaker for every value):** the mounted
  folder `pmp-ui-v2/` — a Turborepo/npm-workspaces monorepo. `apps/web` is
  Vite + React 19 + React Router + TanStack Query + Tailwind v4; the component
  kit is `packages/ui` (shadcn/ui, style `base-rhea`, on Base UI primitives).
  Key files read: `packages/ui/src/components/**`,
  `packages/ui/src/styles/{globals,theme-inline,components}.css`,
  `apps/web/themes/{default,exl,indiraivf,samsung}/theme.css`,
  `apps/web/src/{layout,pages}/**`, `packages/i18n/src/locales/en/translation.json`,
  and `CLAUDE.md` / `README.md` for the engineering conventions.
- **Figma file:** `PMP.fig`, pages `PMP-Final-Design` (22 frames: Login ×5,
  Dashboard, Consent, DPAR, PIA ×8, Mobile, Approved, Drafts), `Research-Doc`,
  `page`. It corroborates the codebase — the 108px `#0D1120` rail, radius 12,
  brand `#1A77F2`, and the `1920×1200` canvas all match. Its frames are HTML
  imports (`DivPageWrapper`, `LiNavItem`, `SpanInlineFlex`), so the layer tree
  is machine-generated rather than a curated library.

No Figma URL, GitHub remote, or slide deck was supplied. If you have access to
the originals, the Figma file is `PMP.fig` (page GUIDs `40003561:14631`,
`40008095:1825`, `40002703:298`) and the repo publishes through
`bitbucket-pipelines.yml`.

### Why the component inventory comes from the codebase

`PMP.fig`'s `METADATA.md` lists 123 "component families", but they are not a
design-system inventory: ~60 are auto-named HTML-import artifacts
(`Component 1` … `Component 16`, each with a `variant=N` axis), a further large
block is a vendored **tabler.io** icon/token library (`preview.tabler.io` and
`tabler.io` variable collections, a 281-variant Feather icon set), and the rest
are one-off vectors (`Vector`, `Subtract`, `Spacer`, `Circle`). The Figma
variables are likewise mostly tabler's own (`color/azure/27`, `line height/20`)
rather than DSG tokens.

The real, named, maintained inventory is `packages/ui/src/components/**` — 30
primitives whose `theme.css` header explicitly cites the Figma DSG system as its
source. **That is the inventory this design system implements**, in the
codebase's own vocabulary. The Figma is used as design reference for the
screens and for asset extraction.

## Components

`components/<group>/<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`, with one
`@dsCard` specimen HTML per directory.

**core/** — `Button` · `Badge` · `Card` (+ `CardHeader`, `CardTitle`,
`CardDescription`, `CardContent`, `CardFooter`) · `Avatar` (+ `AvatarImage`,
`AvatarFallback`, `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount`) ·
`Skeleton` · `Separator` · `Label`

**forms/** — `Input` · `Textarea` · `Checkbox` · `Switch` · `RadioGroup`
(+ `RadioGroupItem`) · `Select` · `Combobox` · `Field` (+ `FieldSet`,
`FieldLegend`, `FieldGroup`, `FieldContent`, `FieldTitle`, `FieldDescription`,
`FieldError`) · `SearchField` · `InputOTP` · `Toggle` (+ `ToggleGroup`) ·
`Calendar` · `DatePickerField`

**data/** — `Table` (+ `TableHeader`, `TableBody`, `TableFooter`, `TableRow`,
`TableHead`, `TableCell`, `TableCaption`) · `DataTable` · `DataTableToolbar` ·
`DataTableActions` (+ `DataTableFilterButton`, `DataTableExportButton`,
`DataTableViewOptionsButton`) · `DataTablePagination` · `StatCard` ·
`SidebarList` · `ExpandableText` · `CountryPill` · `UserPill`

**feedback/** — `Dialog` (+ `DialogContent`, `DialogHeader`, `DialogTitle`,
`DialogDescription`, `DialogFooter`) · `Drawer` (+ `DrawerHeader`,
`DrawerTitle`, `DrawerDescription`, `DrawerBody`, `DrawerFooter`) · `Tooltip` ·
`Popover` (+ `PopoverTitle`, `PopoverDescription`) · `DropdownMenu`
(+ `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`,
`DropdownMenuShortcut`) · `SuccessToast`

**navigation/** — `Sidebar` · `BottomNav` (+ `BottomNavItem`, `BottomNavLabel`)
· `Tabs` (+ `TabsList`, `TabsTrigger`, `TabsContent`) · `Header` ·
`PageHeader` (+ `PageHeaderBackButton`, `PageHeaderTitle`, `PageHeaderActions`)

**pmp/** — the consent-domain pieces, lifted from `apps/web/src/pages/**`:
`MandatoryChip` · `GuardianPendingChip` · `PendingChangesBar` ·
`PreferenceCard` · `EmptyState` · `BrandLockup`

### Intentional additions

Everything above has a counterpart in `packages/ui` or `apps/web`, with three
exceptions, all consolidations rather than inventions:

- **`EmptyState`** — the product ships four near-identical empty states
  (`consent-empty-state`, `dsar-empty-state`, `audit-history-empty-state`,
  `preference` empty). One component, one API.
- **`BrandLockup`** — the ID-PRIVACY® auth hero is inline JSX inside
  `auth-page.tsx`; extracted so it can be reused.
- **`DataTableActions`** — a wrapper that renders the three existing toolbar
  action buttons in the product's order. The individual buttons are the source's.

Sub-part exports (`CardHeader`, `CardContent`, `FieldDescription`, `TableCell`,
`DropdownMenuItem`, `TabsTrigger`, …) are also intentional: each is a named
export of the source component it belongs to in `packages/ui`, kept under the
same name so a developer reading this system and a developer reading the repo
use identical vocabulary. The remaining unmatched names — `Label`, `Separator`,
`Skeleton`, `CountryPill`, `DataTable`, `DataTableToolbar`,
`DataTablePagination`, `DataTableActions`, `StatCard`, `SidebarList`,
`ExpandableText`, `UserPill`, `SearchField`, `InputOTP`, `DatePickerField`,
`Combobox`, `MandatoryChip`, `GuardianPendingChip`, `PendingChangesBar`,
`BottomNav`, `PageHeader`, `SuccessToast` — are all files in
`packages/ui/src/components/**` or `apps/web/src/pages/**`. They have no
counterpart in `PMP.fig` because the Figma file carries no named library for
them (see above); the codebase is their source of truth.

### Not built (and why)

- `sonner` / `Toaster` — a third-party toast host, not a design decision.
- `pagination.tsx` — the generic shadcn pager. The product only ever uses
  `DataTablePagination`.
- `bottom-nav.tsx` is shipped but currently unused: `Sidebar` renders its own
  mobile bar. Both are included here because both exist in the kit.

### Figma families intentionally skipped (21 of 123)

Every `PMP.fig` family that has no counterpart here falls into one of four
groups. All are skipped deliberately; none is an oversight.

1. **Auto-named HTML-import artifacts** — `Component 1` (×7, with 23/25/31/39/40
   `variant=N` axes), `Component 2`…`Component 18`, `Component 25`. These are
   what the importer produced from pasted HTML; the `variant=N` axis is an
   index, not a design property. `variant=14` alone has 1,257 instances across
   the file.
2. **Vendored tabler.io library** — the `Icon` set (281 Feather variants),
   `Icons`, `Icon / chevron`, `Icon / Info`, `Icon / tick`, `Icon / toggle`,
   `find_in_page`, `keyboard_arrow_down`, `layers`, `lock`, `search`,
   `select_all`, `settings`, `Symbols`, `spinner`, `Option item`,
   `Option list`, `Item`, `Dropdown`, `Search container`, `Component/Tree-Switcher`,
   `Components/Radio`, `Check Box`, `checkbox`, `Button radio`, plus the
   `preview.tabler.io` / `tabler.io` variable collections. Third-party set, no
   presence in the product. Icons come from Lucide instead — see ICONOGRAPHY.
3. **Chart and layout scaffolding** — `.data / line` (72 variants),
   `.grid-lines`, `.line / point`, `.grid-data / multi-line`, `Legend`, `Line`,
   `Spacer` (×2), `Circle`, `Background+Border+OverlayBlur` (×2), `Container`,
   `Vector`/`Subtract` one-offs. The product ships no charts (`--chart-1…5`
   tokens are declared but unused), and spacers/vectors are not components.
4. **Duplicate or unreferenced UI** — `.Accordian` / `Accordian`,
   `.tabBar-item` / `tabBar`, `Avatar-group-multiple-type`, `Badge/Count`,
   `Badge/Dot`, `.badge-dot`, `Tag` (33 stages), `Sidebar/Sidebar`,
   `NAVBAR`, `More Option`, `Edit Task`, `Title`, `Text`, `Logo`,
   `Card / Assessment outcome`. No accordion, count-badge, dot-badge or
   tab-bar component exists anywhere in `pmp-ui-v2`, so building them would
   invent API that consumers would trust and the product doesn't have. `Tag`
   and the badge variants are covered by `Badge`; `Sidebar/Sidebar` and
   `NAVBAR` by `Sidebar`; `Logo` by the shipped brand assets.

**If any of these is genuinely a DSG component rather than library noise, name
it and I will build it from the Figma values.**

---

## UCM extension

The Universal Consent Management module has its own section: **ucm/README.md**. It covers every page of the UCM Figma file: cookie classification, domain configuration, webhooks, notifications, audit log, the GPC consent banner and the Policy Builder. It adds `--ucm-*` tokens (`tokens/ucm.css`, imported by `styles.css`), plain-CSS components in `components/ucm/`, and guideline cards. It sits on top of PMP and doesn't change any PMP token.

# CONTENT FUNDAMENTALS

Voice: **second person, plain, procedural, and quietly reassuring.** This is a
compliance product handling a stressful subject, so the copy works to make the
user feel in control without ever sounding breezy.

**Person.** "You" and "your" throughout — *"Review and adjust how your data is
processed across services."* The product says "we" only when it is the one
acting or failing: *"We're updating your consent choices."* /
*"We couldn't find any consents matching your current filters."* /
*"We've sent a 6-digit verification code to…"*. Never "I".

**Casing.** Title Case for page titles, section headings, and button labels
("Manage Consent", "Submit Request", "Apply Changes", "Clear Filters"). Sentence
case for descriptions, hints, and placeholders. Uppercasing is applied *in code*
(`toUpperCase()` / `text-transform`) for table headers, KPI labels, and status
text — the strings in the locale files stay Title Case.

**Sentence shape.** Descriptions are one sentence and end with a full stop.
Field hints are imperative and specific: *"Select your citizenship country as
per official documents."* / *"All updates and verification emails will be sent
to this Email ID."* Every DSR field has one — that is a house rule, not decoration.

**Errors** name the fix, not the fault. The backend's *"User not found. Please
verify the email id."* is deliberately rewritten client-side to
*"No account found for this email. Please sign up."* Validation messages are
polite imperatives: *"Please input first name!"*, *"Only alphabets and spaces
are allowed"*. Generic fallback: *"Something went wrong. Please try again."*

**Success** messages name what succeeded and end with a stop or a bang:
*"Consent updated successfully."*, *"DSR Submitted successfully!"*,
*"Expiry extended successfully."* Never a bare "Success".

**Legal copy is a separate register** — dense, defined-term, and unabridged. The
consent-to-processing modal reads: *"…may process your personal data through
this platform for user authentication, consent and cookie preference
management, Data Principal rights handling, grievance redressal, security
monitoring, audit logging, and regulatory compliance purposes."* Do not
paraphrase, shorten, or "simplify" this text.

**Terminology.** Capitalised defined terms: Data Principal, Data Fiduciary,
Data Subject Request, Privacy Notice, Cookie Notice, Grievance Redressal, DPO.
Region-aware naming is handled at runtime (`useDsarTerm` / `withRegionTerm`), so
never hardcode "DSAR" — the same string may need to render "DPR" for an Indian
tenant.

**Emoji: never.** Not in the product, not in the locale files, not in this
system. Unicode is used only for punctuation the design calls for — `®` in
ID-PRIVACY®, `·` as a metadata separator, `—`/`–` for missing table values,
`→` in audit trails, and typographic apostrophes (`Didn't`, `We've`).

**Numbers and dates.** Counts are pluralised with i18n plural forms
(`{{count}} Consent` / `{{count}} Consent(s)`). Dates render in the *viewer's*
local timezone via `formatToLocalTime` / `formatToLocalDate` — the backend
returns several non-ISO shapes (`2026/06/18 11:16:12` year-first, `20/11/2030`
day-first) that native `Date` parsing silently gets wrong. Missing values render
as `—` (consent), `-` (pills), or `N/A` (PIA) — never as a blank cell.

**Localisation.** ~25 locales ship, weighted to Indian languages (as, bn, gu,
hi, kn, ks, mai, ml, mr, ne, or, pa, sa, sd, ta, te, ur) plus de, es, fr, ko,
br, do. Assume any string may double in length; nothing may depend on English
word length. The layout is fully logical-direction (`ms-`/`me-`, `start`/`end`,
`inset-inline`) for RTL (Urdu, Kashmiri, Sindhi).

---

# VISUAL FOUNDATIONS

The portal reads as **calm institutional software**: white surfaces, cool-gray
neutrals, one brand blue used sparingly for action and state, and a single dark
navy anchor on the left. Nothing decorative competes with the data.

### Colour

One brand hue. `--primary` is `#086DE8` — the Figma value `#1A77F2` deliberately
darkened so white text and links clear 4.5:1 on white (WCAG 2.1 AA, 1.4.3). The
original `#1A77F2` still ships verbatim inside icon fills and the logo mark, and
`#127EE2` appears as an icon tint; both are kept as `--dsg-blue-figma` /
`--dsg-blue-icon` for exact recreations.

Neutrals are cool-tinted, not pure gray: `#F2F6FA` surface → `#F0F1F7` divider →
`#E5EAF0` border → `#2A3547` text → `#092339` "DSG black". `--muted-foreground`
is that navy `#092339`, *not* a mid-gray — secondary text in this product is
darker than most systems'.

Status colours render as a **10% tint of the token with full-strength text**:
green `#148018` active, orange `--orange-700` expiring soon, red destructive
expired, and a literal `#DBEAFE` / `#2563EB` pair for `info`. Never a solid
semantic fill.

Two areas sit deliberately outside the token system. The **navy rail**
(`--sidebar: #0D1120`) stays fixed in light and dark mode — it is the one
surface that ignores the theme. And the four **KPI-tile accents** are a fixed
category convention: `--stat-blue`, a `#36D399 → #3CDDC2` gradient, a
`#FA9F38 → #F57A3D` gradient, and `#741AF2` — carried per-theme, never derived
from the brand ramp.

Maximum two background colours per screen: white surfaces on `--muted`, with
the accent-tinted hero box on the dashboard as the single exception.

### Type

**Inter Variable** for everything. **Poppins** appears in exactly one place —
the ID-PRIVACY® auth lockup. (`PMP.fig` also reports heavy **Larsseit** use;
that comes from the vendored tabler library, not the product, so it is not
part of this system — see CAVEATS.)

The scale is small and fixed in px, never rem, so it survives the responsive
root-font clamp: `--text-title` 30 · `--text-heading` 28 · `--text-body` 14 ·
`--text-caption` 12, with 16/18/20/24 in between. Body copy is 14px; 16px is
reserved for auth screens and dialog titles.

Weights: 400 body · 500 labels, buttons, table headers, nav · 600 emphasis,
headings, status text · 700 page titles and toast titles. Tracking is
mostly default, with three literal exceptions worth copying: `-0.08px` on form
labels, `-0.32px` on auth body copy, and `-0.03em` on the Poppins lockup. The
consent page heading is 28px on a literal `30.8px` line-height.

### Space and layout

A 4px step scale, but the shell runs on fixed measurements: the rail is
**108px** (`6.75rem`), the app gap is **16px**, the consent split-pane is
**782px** tall with a **20rem** master list, controls are **40px** tall, and
inputs pad **13px** horizontally (not 12). Cards carry a `--card-spacing` of
20px, or 16px at `size="sm"`, applied vertically on the root and horizontally on
the parts — so a table or image child can go full-bleed just by skipping
`CardContent`.

The design canvas is 1920×1200. Components branch on a **single breakpoint,
768px** (`md:`) — there is no tablet tier. Fixed elements: the rail (desktop),
the bottom nav and staged-changes bar (mobile), the drill-down header, and
sticky table headers.

### Surfaces, borders, radii

**Ring-first elevation.** A card is a 1px `foreground/5` ring plus
`--shadow-sm` — never a border. Popovers and dropdowns add `--shadow-lg`;
dialogs and drawers `--shadow-xl`. There are no inner shadows and no coloured
glows, with one exception: the PIA shield icon carries a
`0 1.51px 2.23px rgb(64 126 244 / 0.15)` brand glow from the Figma effect.

Radii all derive from `--radius: 0.5rem`: 2.5px checkbox (noticeably squarer
than everything else), 8px inputs, 11.2px header, 14.4px buttons and badges,
24px cards, dialogs and drawers (clamped: `min(var(--radius-4xl), 24px)`),
and full pills for tabs, avatars and chips.

Borders appear where a ring can't: `--input` on text fields, `#E3E6ED` on KPI
tiles, `#C1DFFF` on dashboard action cards, `#E2E8F0` on preference cards
(hovering to `#127EE2`), and `0.8px` hairlines on the consent page's section
rules. A few borders are dashed — the `MandatoryChip` only.

### Motion

Short and functional. 100ms for popovers and menus; ~200ms for colour and
box-shadow transitions; 450ms on `cubic-bezier(0.22, 1, 0.36, 1)` for drawers,
which is the only motion anyone notices. Overlays fade + zoom from 95%. No
bounce, no spring, no parallax, no looping ambient animation — the single
continuous animation in the product is the skeleton's 1.6s shimmer sweep.

### Interaction states

- **Hover:** fills lighten or a `--muted` fill appears. Primary buttons go to
  80% opacity of `--primary`; secondary mixes 5% foreground in; ghost and
  outline pick up `--muted`; table rows pick up `muted/50`.
- **Press:** buttons translate down **1px** (`active:translate-y-px`) — no
  scale, no colour change. Buttons with a popup (`aria-haspopup`) skip it.
- **Focus:** a solid 1px `--ring` border *plus* a 3px ring at 20–30% alpha.
  20% on inputs, 30% on controls. Focus is always visible; nothing relies on
  hover alone.
- **Invalid:** `aria-invalid` drives a red border and a 3px `destructive/20`
  ring — no icon, no shake.
- **Disabled:** `opacity: 0.5` plus `cursor: not-allowed` and
  `pointer-events: none`. Disabled *toggles* are avoided entirely: a locked
  consent shows `MandatoryChip` instead.
- **Selected:** a solid `--primary` fill with white text (group list rows,
  pill tabs, current page button). Expanded consent rows get the literal
  `#EDF2F8`.

### Transparency, blur, gradients

Transparency is used as tint, not as glass: `color-mix`/alpha at 5% (rings),
8% (active nav), 10% (status badges, `#127EE20D` chips), 24% ("New" badge),
30% (focus rings, toolbar bands), 40–60% (muted surfaces). Blur appears only
on modal and drawer scrims — `black/30` with a 4px backdrop blur, inset `-4px`
so the compositing seam sits off-viewport.

Gradients: **three**, all deliberate. The auth hero (`#3676B8 → #154470`,
top to bottom), and two KPI icon badges. Everything else is flat. No
bluish-purple hero gradients.

### Imagery

Five raster assets, all cool-toned, all flat-vector illustration rather than
photography: the ID-PRIVACY® brain/network graphic on the auth hero, the
dashboard monitor illustration, the empty-state graphic, and the two logo
lockups. No photography, no stock imagery, no grain, no full-bleed background
images, no repeating pattern or texture anywhere.

### Client theming

`--primary` and the neutral ramp are the whole contract. `apps/web/themes/<name>/theme.css`
overrides them at `:root`; here the three non-default themes are scoped as
`.theme-exl`, `.theme-indiraivf`, `.theme-samsung` so all four can be compared
side by side. `exl` is a warm orange ramp, `indiraivf` a magenta ramp, and
`samsung` breaks the single-hue pattern entirely: neutral black/white/gray with
a separate `#2A82F0` accent and its own typefaces. Radius, spacing, elevation
and motion never change per tenant.

---

# ICONOGRAPHY

**Lucide is the icon system**, imported per-icon from `lucide-react` and
rendered at `currentColor` with a **2px stroke**, round caps and round joins.
Sizes are strictly tied to context: 12px inside a badge, 14px for an inline
"more/history" affordance, 16px the default (buttons, inputs, table cells),
20px in dialog menu items and KPI badges, 24px in the nav rail and header.
Icons never carry their own colour — they inherit, which is why the whole set
themes for free.

Icons actually in use: `search`, `bell`, `chevron-down/left/right/up`,
`chevrons-left/right`, `check`, `x`, `arrow-left`, `arrow-right`, `history`,
`filter`, `list-filter`, `sliders-horizontal`, `upload`, `download`, `eye`,
`eye-off`, `pencil`, `lock`, `info`, `circle`, `circle-check`, `clock`,
`file-text`, `shield-check`, `shield-alert`, `user-round`, `user-round-check`,
`log-out`, `globe`, `mail`, `key-round`, `refresh-cw`, `calendar`, `plus`,
`trash`, `sliders-vertical`, `popcorn`.

**Six marks are bespoke** and shipped as assets rather than Lucide glyphs,
because no Lucide icon matches them:

| Asset | Where |
| --- | --- |
| `assets/brand/favicon.svg` | The shield-with-tick logo mark in the rail (also the tab icon) |
| `assets/icons/shield-lock.svg` | The Consent quick action — "shield with a lock badge" |
| `assets/icons/sidebar/consent{,-filled}.png` | Consent nav, inactive / active |
| `assets/icons/sidebar/dpar{,-filled}.png` | DPAR nav, inactive / active |
| `assets/icons/sidebar/pia{,-filled}.png` | PIA nav, inactive / active |
| `assets/icons/sidebar/dashboard-icon.png` | Dashboard nav |

Note the asymmetry, which is real: the **outline** nav icons exist as inline
SVG paths in `apps/web/src/layout/icons.tsx` and recolour with the theme, while
the **filled/active** variants are pre-coloured PNG exports and render the same
fixed brand blue regardless of theme. If you need a themeable active state,
that is a gap to raise, not something to fake.

No icon font, no sprite sheet, no emoji, and no Unicode-as-icon (the `·`, `—`
and `→` characters are punctuation, not iconography). Do not hand-roll new
SVG glyphs: take them from Lucide at 2px stroke, or copy an asset in.

---

# Index

| Path | What's there |
| --- | --- |
| `styles.css` | The single entry point consumers link. `@import` lines only |
| `tokens/colors.css` | DSG ramp + semantic aliases + `.dark` scope |
| `tokens/typography.css` | Font stacks, named size scale, weights, tracking |
| `tokens/spacing.css` | 4px step scale + fixed shell measurements |
| `tokens/radius.css` | Radius scale derived from `--radius` |
| `tokens/elevation.css` | Ring, shadow, focus-ring and scrim tokens |
| `tokens/motion.css` | Durations, easings, shimmer keyframes |
| `tokens/fonts.css` | Inter + Poppins webfont loading |
| `tokens/base.css` | Minimal global reset (link colours, scrollbars, cursors) |
| `tokens/themes/*.css` | `exl`, `indiraivf`, `samsung` client themes |
| `components/core/**` | Button, Badge, Card, Avatar, Skeleton, Separator, Label |
| `components/forms/**` | Inputs, selection controls, Field, OTP, date picker |
| `components/data/**` | Table stack, StatCard, SidebarList, cell renderers |
| `components/feedback/**` | Dialog, Drawer, Tooltip, Popover, DropdownMenu, toast |
| `components/navigation/**` | Sidebar, BottomNav, Tabs, Header, PageHeader |
| `components/pmp/**` | Consent-domain chips, PreferenceCard, EmptyState, BrandLockup |
| `guidelines/*.html` | 19 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `ui_kits/pmp-portal/` | Click-through recreation of the web portal — start at `index.html` |
| `assets/brand/` | Logos, favicon, auth-hero art |
| `assets/icons/` | The six bespoke marks |
| `assets/illustrations/` | Dashboard hero, empty-state graphic |
| `thumbnail.html` | Homepage tile |
| `assets/notes/SKILL.from-standalone.md` | Agent-Skills front matter for use outside this project |
| `tokens.json` | Every colour (five themes: Light, Dark, EXL, Indira IVF, Samsung), type style, spacing, radius and shadow token the page shows and edits |
| `tokens.css` | Compiled from `tokens.json` by the page |
| `components/bundle.js` | The component bundle, `window.DataSafeguardPMPDesignSystem_85ce82` |
| `components/bundle.css` | What `tokens.json` cannot hold: derived radii, focus rings, gradients, the type-scale variables, motion, UCM font stacks, the Samsung typeface override, base rules |
| `components/index.d.ts` | Props for every component |
| `components/<Name>/README.md` | Each component's guidelines |
| `components/<Name>/preview.html` | Live previews: the PMP specimen cards, the `Ucm*` cards, `Logos`, `Iconography`, `Illustrations` |

Each component directory also carries `<Name>.prompt.md` — a one-line "what &
when", a usage snippet, and the values worth copying.

---

# CAVEATS

- **No standalone Data Safeguard wordmark SVG exists in the sources.** The only
  logo assets are raster PNGs (`datasafeguard-logo.png`, `IDP-logo.png`) plus
  the shield-only `favicon.svg`. `BrandLockup` therefore renders "ID-PRIVACY®"
  as live Poppins type, exactly as `auth-page.tsx` does. Nothing was drawn or
  reconstructed. Vector logo files would be a welcome addition.
- **Fonts load from the Google Fonts CDN**, not from bundled binaries: the
  product installs Inter and Poppins via `@fontsource`, and no font files ship
  in the repo. Both families are genuinely Inter and Poppins — this is a
  delivery-mechanism substitution, not a typeface substitution.
- **Larsseit is not included.** `PMP.fig` reports ~2,800 Larsseit text nodes,
  but they all sit inside the vendored tabler.io library frames, and no
  `theme.css` or component references it. If Larsseit *is* a real DSG typeface,
  send the files and I'll wire it in.
- **Samsung theme fonts are not redistributed.** `SamsungSSHead` /
  `SamsungSSBody` are licensed client assets; the tokens point at them and fall
  back to the system sans until the `.woff2` files are dropped in.
- **The mobile breakpoint is documented but not built.** Every component
  carries the desktop treatment; the `max-md:` branches are described in the
  prompt files rather than implemented, and the UI kit recreates desktop only.
- **Four product screens are omitted from the UI kit** because the sources have
  no settled design for them: the multi-step Submit DSR form, the Profile/KYC
  form, Guardian approval, and the Preference page (disabled in the product).
- **Interactive components are simplified.** The product builds on Base UI
  primitives (portals, focus traps, collision-aware positioning). These are
  cosmetic recreations with local state — correct to the pixel, not to the
  accessibility spec. Use them for design, not production.

---

## **Please help me sharpen this**

Four things would take this from good to exact — **which should I do first?**

1. **Mobile.** Every screen has a real `max-md:` design in the codebase and the
   Figma `Mobile` frames. Want me to build the phone breakpoint into the
   components and add a mobile UI kit?
2. **The missing screens.** Submit DSR is the product's most complex surface —
   a multi-step, conditional, seven-request-type form. Should I recreate it
   from `pages/dsar/submit-dsar/**`?
3. **The Figma question.** I treated the 123 Figma "families" as vendored
   library noise and built the codebase's 30 primitives instead. **If any of
   those Figma families are actually yours, tell me which and I'll build them.**
4. **Brand assets.** Vector logos, the Larsseit files if they're real, and the
   Samsung webfonts would close every substitution flagged above.

Anything that looks wrong, say so bluntly — every value here is traceable to a
file, so I can point at exactly where it came from and fix it at the source.
