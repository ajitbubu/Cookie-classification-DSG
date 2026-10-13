# Sentinel — Screen build patterns (agent contract)

> **Legacy.** This document describes a Next.js + Tailwind + shadcn build that this app does not use.
> The design system for this app is [`DESIGN.md`](../DESIGN.md) at the repo root.

You are implementing ONE screen (a Next.js App Router `page.tsx`) or ONE data module
for the Sentinel enterprise privacy platform. Follow this contract exactly so every
screen is visually consistent and the project compiles.

The visual source of truth is the prototype at
`design-system/reference/privacy-platform.dc.html`. You will be told the **line range**
for your screen. Read it and reproduce its layout, copy, and data faithfully.

---

## Golden rules

1. **Use the component library** (`@/components/ui`) and the `PageHeader`
   (`@/components/shell/page-header`) — never hand-roll buttons/badges/cards/tables.
2. **Use Tailwind utilities mapped to design tokens** (vocabulary below). For exact
   pixels not on Tailwind's scale, use arbitrary values like `p-[18px]`, `gap-[14px]`.
3. **Raw `style={{}}` only for dynamic values** (bar widths from data, SVG geometry,
   chart sizing). Never hardcode hex colors — use tokens/utilities. The design's inline
   `var(--surface-card)` etc. all map to utilities like `bg-surface`.
4. Add `"use client"` at the top if the screen uses `useState`, `onClick`, inputs,
   toggles, tabs, or modals. Otherwise it can stay a server component.
5. Do not render the topbar/nav — that is the shell layout. Your page renders only the
   **content** for `app/(app)/<route>/page.tsx`. Wrap the screen body in
   `<div className="screen"> … </div>` (gives the mount fade).
6. Use **realistic, domain-accurate mock data** that matches the prototype's intent
   (incident IDs, hashes, timestamps in `mono`). No "lorem ipsum", no `TODO`.
7. Numbers, IDs, hashes, timestamps, IPs → wrap in the `mono` class (tabular figures).
8. Severity vocabulary is fixed: **Critical, Warning, Info, Safe** → tones
   `critical / warning / info / safe`. Don't invent synonyms.
9. No emoji. Icons are from `lucide-react` (line icons).

---

## Component API (`@/components/ui`)

```tsx
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Input, Textarea, Select, Switch, Tabs, Avatar, NavItem, StatCard,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Eyebrow, Mono,
} from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
```

- **Button** `variant="primary|secondary|ghost|danger|outline"` `size="sm|md|lg|icon"`
  `iconLeft={<Icon/>}` `iconRight={<Icon/>}` `fullWidth` `onClick`. Use `asChild` to wrap
  a single `<Link>` (then put icon+label *inside* the Link). Primary = the one key action.
- **Badge** `tone="safe|warning|critical|info|primary|neutral"` `dot` `size="sm|md"`
  `uppercase`. Soft-tinted status pill.
- **Card** `padded` (default true; set `padded={false}` for edge-to-edge tables).
  `CardHeader` (title left, actions right, bottom border), `CardTitle` (eyebrow),
  `CardContent` (p-5).
- **Input** `iconLeft` `iconRight` `mono` + native input props (`value`, `placeholder`,
  `onChange`, `type`, `defaultValue`).
- **Textarea** native textarea props.
- **Select** `options={[{label,value}]}` `value` `onValueChange` `placeholder`.
- **Switch** `checked` `onCheckedChange` (Radix).
- **Tabs** (segmented control) `tabs={[{label,value,badge?}]}` `value` `onChange`
  `fullWidth` `size="sm|md"`.
- **Avatar** `name` `tone="primary|safe|warning|critical|info|neutral"` `size={32}`.
- **NavItem** `icon` `active` `badge` `href` | `onClick`.
- **StatCard** `label` `value` `unit?` `delta?` `deltaTone?` `tone?` `icon?`. KPI tile.
- **Table** primitives — render header in `TableHeader > TableRow > TableHead`, rows in
  `TableBody > TableRow (interactive? selected?) > TableCell`. Put a `<Table>` inside an
  unpadded `<Card>`. Example:
  ```tsx
  <Card padded={false}>
    <CardHeader><CardTitle>Detected elements</CardTitle></CardHeader>
    <Table>
      <TableHeader><TableRow>
        <TableHead>Element</TableHead><TableHead>Sensitivity</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map(r => (
          <TableRow key={r.id} interactive>
            <TableCell className="mono text-fg">{r.element}</TableCell>
            <TableCell><Badge tone={r.tone} dot>{r.sens}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Card>
  ```
- **PageHeader** `eyebrow` `title` `description` `actions={<Button.../>}` `size="h1|h2"`.
  Every screen starts with one.

---

## Tailwind token vocabulary (use these class names)

Surfaces: `bg-canvas` `bg-sunken` `bg-surface` `bg-raised` `bg-inset`
Borders:  `border-line` `border-line-strong` `border-line-subtle`
Text:     `text-fg` (primary) · `text-dim` (secondary) · `text-faint` (meta) · `text-inverse`
Brand:    `bg-primary` `text-primary` `text-primary-fg` `bg-primary-tint`
Semantic (base / -fg text / -tint bg), all theme-aware:
  `text-safe text-safe-fg bg-safe-tint` · `…-warning…` · `…-critical…` · `…-info…`
Radius:   `rounded-sm` (6) `rounded-md` (10) `rounded-lg` (16) `rounded-full`
Shadow:   `shadow-card` `shadow-raised`
Type:     `text-h1 text-h2 text-h3 text-h4 text-body-lg text-body` (+ Tailwind `text-sm/xs`)
Fonts:    `font-mono` (or the `.mono` class with tabular figures)
Helpers (global classes): `.mono` `.eyebrow` `.row` (hover-tinting clickable row) `.screen`
Animations: `animate-fade` `animate-flyin` `animate-spinner` `animate-pulse-ring`

Everything re-themes automatically when the theme changes — never hardcode colors.

---

## Icons (lucide-react)

Import what you need: `import { Shield, Search, Plus, Download, ... } from "lucide-react"`.
Prototype name → lucide: icShield→Shield, icShieldCheck→ShieldCheck, icScan→ScanLine,
icSearch→Search, icBell→Bell, icCheck/icCheckSm→Check, icChevron→ChevronRight,
icChevDown→ChevronDown, icClose/icCloseSm→X, icPlus/icPlusSm→Plus, icTrash/icTrashSm→Trash2,
icCopy→Copy, icDownload/icDownloadSm→Download, icEye→Eye, icFlag→Flag, icKey→KeyRound,
icLayers→Layers, icLock→Lock, icPalette→Palette, icPencil→Pencil, icSend→Send,
icServer→Server, icSignout→LogOut, icSparkles→Sparkles, icUserCheck→UserCheck,
icUp→ChevronUp, icDown→ChevronDown, icBack→ArrowLeft, icGrid→LayoutGrid, icClock→Clock,
icAlert→AlertTriangle, icBannerPen→PenLine.

---

## Reading the prototype DSL

The reference uses a small template DSL — translate to React:
- `<sc-if value="{{ is_X }}">…</sc-if>` — the wrapper for screen X. Implement what's inside.
- `<sc-for list="{{ items }}" as="r">…{{ r.field }}…</sc-for>` — `items.map(r => …)`.
- `<x-import component-from-global-scope="SentinelDesignSystem_9a86f8.Button" variant=…>Label</x-import>`
  → our `<Button variant=…>Label</Button>`. Same for Badge, Input, Select, Switch, Tabs,
  Avatar, StatCard, NavItem.
- `{{ expr }}` — bind to your mock data.
- Inline `style="background:var(--surface-card);border:1px solid var(--border-default);
  border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:20px"` → just use
  `<Card>` (that IS this style). Other inline vars map to the utilities above.
- `class="eyb"` → `className="eyebrow"`; `class="mono"` → `className="mono"`;
  `class="s-row"` → `className="row"`; `class="s-screen"` → `className="screen"`.

For SVG diagrams/charts in the prototype, reproduce the SVG markup; replace literal hex
fills with the matching token (e.g. `fill="var(--surface-card)"`, stroke
`var(--color-border)`, brand `var(--brand-primary)`). Keep coordinates as-is.

---

## Data layer

Per-domain mock data lives in `data/<domain>.ts`. It exports typed data and **accessor
functions** (so a backend can replace the bodies later), plus the types. Screens import
from `@/data/<domain>` and shared primitives from `@/data/types` (`Tone`, `Severity`,
`severityTone`, `Kpi`, `Option`).

Pattern:
```ts
// data/<domain>.ts
import type { Tone } from "./types";
export interface CookieRow { id: string; name: string; tone: Tone; /* … */ }
const COOKIES: CookieRow[] = [ /* realistic rows from the prototype */ ];
export function getCookies(): CookieRow[] { return COOKIES; }
```

Icons must NOT be stored in data (keep data serializable). Store an `iconKey: string` and
map it to a lucide component inside the screen if needed.

Dynamic detail routes (`[id]`) read the id with `useParams()` from `next/navigation`
(client) and look up the record from the domain accessor; fall back to the first record.

---

## Worked example

See `app/(app)/hub/page.tsx` + `data/hub.ts` for the exact conventions: `"use client"`,
`PageHeader`, `Card`, `Button`, token utilities, `mono`, lucide icons, accessor functions,
and the `track()` analytics helper (optional: `import { track } from "@/lib/analytics"`).

## Before you finish (self-check)

- File default-exports a React component; imports resolve from `@/components/ui`,
  `@/components/shell/page-header`, `@/data/*`, `lucide-react`.
- No TypeScript errors (props match the API above); no unused imports.
- No hardcoded hex colors; only tokens/utilities.
- Layout matches the prototype range you were given (sections, columns, tables, KPIs).
