# Sentinel Design System

Calm authority for dense, high-signal privacy & security operations surfaces. This folder
is the single source of truth for the look of the app: tokens, themes, and the build
contract. Components that consume it live in `../components/`.

## Token layers

1. **`tokens/primitives.css`** — theme-independent: spacing (8px grid), radius (6/10/16),
   shadows, the type scale, weights, tracking, layout sizes, and motion easings/durations.
   These never change between themes.
2. **`tokens/themes.css`** — one `[data-theme="<id>"]` block per theme holding only **seed**
   values (the 3 `--brand-*` colors, the canvas/surface ramp, borders, text levels, and
   semantic bases). A shared `:root` block derives everything else — tints, `--shadow-*`,
   and the semantic aliases (`--surface-card`, `--text-secondary`, …) — once, via
   `color-mix()` and `var()`. Default `:root` = `sentinel-dark`.
3. **`themes/themes.ts`** — the typed registry the runtime theme switcher reads.

These flow into Tailwind through `@theme inline` in `../app/globals.css`, which maps each
token to a utility (`bg-surface`, `text-fg`, `text-safe-fg`, `rounded-lg`, `shadow-card`,
…). Because the mapping is `inline`, utilities resolve to the live CSS variable, so the
whole UI re-skins the instant `[data-theme]` changes — no rebuild.

## Themes shipped

| id | brand | mode |
| --- | --- | --- |
| `sentinel-dark` (default) | Sentinel | dark |
| `sentinel-light` | Sentinel | light |
| `faceoff-dark` | FaceOff | dark |
| `faceoff-light` | FaceOff | light |

**Re-brand:** change the three `--brand-*` seeds in a block — tints and accents follow.
**Add a theme:** copy a block, give it a new id, add it to `themes/themes.ts`.

## Foundations (from the prototype brief)

- **Canvas & surfaces:** dark, low-glare canvas; elevated card surfaces with a 1px hairline,
  16px radius, one soft shadow. Depth comes from the surface scale, not gradients.
- **Color:** a confident brand primary used *sparingly* (one key action per view). Semantic
  color (safe/warning/critical/info) is reserved for risk state and shown as soft-tinted
  pill badges + thin accent bars — never decorative.
- **Type:** Inter for UI/headings (H1 36/700/-0.02em, body 15/1.6); JetBrains Mono for IDs,
  hashes, timestamps and any tabular figure. 12px uppercase tracked eyebrow labels.
- **Motion:** restrained, functional — 120–180ms, standard easing, respects reduced motion.
- **Icons:** Lucide line icons, monochrome (color lives in badges, not icons). No emoji.

## Components

`../components/ui/` — Button, Badge, Card (+Header/Title/Content), Input, Textarea, Select,
Switch, Tabs (segmented), Avatar, NavItem, StatCard, Table primitives, Eyebrow/Mono. Built
on Radix + class-variance-authority following shadcn patterns, themed entirely through the
tokens above. `components.json` configures the shadcn CLI for adding more.

## Building screens

`PATTERNS.md` is the contract: component API, the exact Tailwind token vocabulary, the
prototype-DSL → React translation, and the data-layer rules. The original prototype is in
`reference/privacy-platform.dc.html`.
