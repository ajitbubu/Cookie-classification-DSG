---
name: datasafeguard
source: Data Safeguard PMP design system, UCM extension (https://claude.ai/artifact/3wguTnHx69YLGQ3usi6Dun, version 1791766183-a23e)
theme: '[data-theme="datasafeguard"] in design-system/tokens/themes.css (default, set in index.html), mapped onto src/styles/ucm-tokens.css'
colors:
  brand-primary: "#3979BD"
  brand-primary-hover: "#2F659E"
  color-canvas: "#F0F1F6"
  color-surface: "#FFFFFF"
  color-surface-raised: "#F6F9FD"
  color-surface-inset: "#F4F5F7"
  color-border: "#CBDCF6"
  color-border-strong: "#B8CFF0"
  color-text: "#092339"
  color-text-secondary: "#425667"
  color-text-muted: "#788692"
  color-primary-text: "#3979BD"
  color-safe: "#1CC279"
  color-safe-text: "#148018"
  color-safe-solid: "#148018"
  color-warning: "#FDBD5B"
  color-warning-text: "#846534"
  color-critical: "#E94141"
  color-critical-text: "#E94141"
  color-critical-solid: "#E94141"
  color-nav: "#112437"
  color-tab-bar: "#CBDCF6"
typography:
  content: "Larsseit (licensed, falls back to Inter) (--font-sans)"
  titles: "Inter 700 18px, 'H2/Bold' (--font-display)"
  nav: "Source Sans 3 400 / 700 active, 14px, 'H5/Regular' (--font-nav)"
  body-size: "14px (--fs-body); table cells and labels 16px (--fs-table); 12px minimum (--fs-xs)"
  kpi-value: "500 28px (--fs-kpi), #2A3547"
rounded:
  tag: "4px"
  control: "8px (inputs, nav items, buttons, scan card)"
  stat: "10px"
  panel: "12px"
  pill: "16px (scan-type pills)"
---

# DESIGN.md — datasafeguard Cookie Classification

**Source of truth: the Data Safeguard design system**, UCM extension
(<https://claude.ai/artifact/3wguTnHx69YLGQ3usi6Dun>: `project/README.md`,
`project/ucm/README.md`, `project/tokens.json`, `project/components/ucm/ucm.css`).
Its `--ucm-*` tokens are vendored unchanged in `src/styles/ucm-tokens.css`; the
datasafeguard theme maps the app's semantic tokens onto them. When the design
system changes, update the vendored file and this front matter together.
`src/test/design-doc.test.js` fails if the colours above drift from the theme,
and `src/test/accessibility-regressions.test.js` fails if the theme drifts from
the vendored UCM tokens.

## Brand

datasafeguard only, wordmark in the sidebar. UCM screens use the softer brand
accent `#3979BD` (`--ucm-brand-accent`) for pills, links, active nav, tab
underlines and progress, never PMP's `#086DE8`.

## Colour

- **Text** is DSG black `#092339`. Labels sit at 77% (`#425667` flattened),
  timestamps and hints at 55% (`#788692`). KPI values use `#2A3547`.
- **Surfaces**: canvas `#F0F1F6`, white panels, row hover `#F6F9FD`.
- **Borders**: "DSG - blue 4" `#CBDCF6` on cards, table rules and search fields;
  `#B8CFF0` on text inputs in modals.
- **Sidebar**: `#112437`, active row filled with the accent.
- **Tags** (soft, 4px radius): Necessary/Low green `#148018` on `#C7E1C8`;
  Analytics/Quick `#3979BD` on `#E1EBF5`; Marketing/Scheduled `#846534` on
  `#FFF5E6`; Advertising/Deep `#1B1480` on `#C8C7E1`; Unclassified/Critical
  `#E94141` on `#FAD1D1`. Functional has no tag colour in the design system and
  uses the neutral version-chip pair (`#092339` on `#F4F5F7`).
- **Scan-type pills** (solid, 32px): Quick `#3979BD`, Deep `#092339`,
  Schedule `#1CC279`, all with white text.
- **Charts**: series `#00AEFE`, `#0088FE`, `#FFBB28`, `#00C49F`, `#3979BD`.

## Contrast exceptions

User decision 2026-10-12: match the design system exactly, superseding plan
decision 19A ("every pair at WCAG AA"). These design-system pairs are below
4.5:1 and ship as drawn. They are listed here so they stay a deliberate choice:

| Pair | Ratio | Where |
|---|---|---|
| white on Schedule green `#1CC279` | 2.3:1 | Schedule scan pill |
| Unclassified/Critical `#E94141` on `#FAD1D1` | 2.9:1 | category and risk tags |
| `#E94141` text on white | 4.0:1 | Delete, Deactivate, failed states |
| Necessary/Low `#148018` on `#C7E1C8` | 3.6:1 | category, status and risk tags |
| Analytics/Quick `#3979BD` on `#E1EBF5` | 3.8:1 | category and scan-type tags |
| white on `#4879B8` | 4.47:1 | primary page buttons |
| trend-down `#FF5757` on `#F7E0E0` | 2.5:1 | KPI trend chip |
| white on Republish `#DF7900` | 3.1:1 | not used in this app yet |
| muted text at 55% (`#788692`) | 3.7:1 | timestamps, hints |

The design system's own suggested fixes, if this decision is revisited: navy
text on the Schedule pill and `#B42318` for red text.

## Type

Content is Larsseit (Medium 500 labels and headers, Regular 400 cells, Bold 700
card titles). Larsseit is licensed and not on Google Fonts, so it falls back to
Inter until the woff2 files are added. Page titles are Inter 700 18px; the
sidebar is Source Sans 3 14px (700 when active). Table cells and form labels are
16px; body copy 14px; tags 12px/18px.

## Layout

- Sidebar 280px (Figma 1:189761), `#112437`, 16px radius and padding, 40px rows
  8px apart. Full product menu; Cookie Classification expands to Dashboard,
  Scanning, Website, Cookie Inventory, Review Queue. Modules this app does not
  have are shown disabled.
- Content column starts at x=316: header bar, breadcrumb 24px below, then one
  white 12px-radius panel 24px below that. Scanning has three tabs inside the
  panel (Launch New Scan | Active Scan | Scan Result, 200px each, 84px bar,
  4px `#4879B8` underline); other pages have no tab bar.
- Header bar 74px, white, 8px radius; breadcrumb 14px.
- Panels: white, 12px radius, 24px padding and gap, title 500 18px.
- Stat cards: 10px radius, 18/14 padding, `0 4 16 #919EAB @ 14%`.
- Single breakpoint at 768px: rail at 769–1279px, drawer at 768px and below
  (decision 20A); tables scroll sideways inside their panel (21A).

## Components

`src/components/ui/` implements the design system's UCM classes in the app's
own components: tags and pills (`Chip`), stat card (`KpiCard`), table panel
(`DataTable`), underline tabs, buttons (page 40px / 8px radius `#4879B8`,
outline, success `#148018`, modal 120x44 / 4px radius), inputs (40px, 6px
radius, `#B8CFF0`), form modal (798px, 12px radius), confirm dialog (400px,
centred icon tile), drawer, toast and the scan progress card.

## Motion

Short and functional: 100ms menus, about 200ms colour transitions, drawers on
`cubic-bezier(0.22, 1, 0.36, 1)`. No motion under `prefers-reduced-motion`.

## Legacy docs

`design-system/README.md` and `PATTERNS.md` describe the old Next.js token
system and are kept only for history.
