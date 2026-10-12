/**
 * Sentinel — Theme registry (single source of truth for the theme switcher).
 *
 * Each entry maps a `data-theme` id (whose CSS variables live in
 * design-system/tokens/themes.css) to display metadata. Adding a theme is two
 * steps: (1) add a [data-theme="<id>"] block in themes.css, (2) add an entry
 * here. The UI reads this list; nothing else needs to change.
 */

export type ThemeMode = "dark" | "light";

export interface ThemeDefinition {
  /** Matches the [data-theme="<id>"] selector in themes.css. */
  id: string;
  /** Brand family this theme belongs to. */
  brand: string;
  /** Human label shown in the theme switcher. */
  label: string;
  mode: ThemeMode;
  /** Seed swatch (the brand-primary) for preview chips. */
  swatch: string;
}

export const THEMES: ThemeDefinition[] = [
  { id: "sentinel-dark", brand: "Sentinel", label: "Sentinel · Dark", mode: "dark", swatch: "#2563EB" },
  { id: "sentinel-light", brand: "Sentinel", label: "Sentinel · Light", mode: "light", swatch: "#2563EB" },
  { id: "faceoff-dark", brand: "FaceOff", label: "FaceOff · Dark", mode: "dark", swatch: "#4F7CFF" },
  { id: "faceoff-light", brand: "FaceOff", label: "FaceOff · Light", mode: "light", swatch: "#4F7CFF" },
  { id: "datasafeguard", brand: "datasafeguard", label: "datasafeguard · Light", mode: "light", swatch: "#3979BD" },
];

/** Default theme applied before any user preference is read. */
export const DEFAULT_THEME_ID = "datasafeguard";

/** localStorage key used to persist the chosen theme. */
export const THEME_STORAGE_KEY = "sentinel-theme";

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id: string | null | undefined): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Brands grouped for a two-level switcher (brand → mode). */
export function themesByBrand(): Record<string, ThemeDefinition[]> {
  return THEMES.reduce<Record<string, ThemeDefinition[]>>((acc, t) => {
    (acc[t.brand] ??= []).push(t);
    return acc;
  }, {});
}
