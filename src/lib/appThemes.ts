// Full-app UI theme presets. Each preset is identified by its unique primary
// hex, saved in store_settings.theme_color, so no schema change is needed.
export type AppTheme = {
  id: string;
  name: string;
  tagline: string;
  primary: string; // unique key, saved as theme_color
  swatches: string[];
};

export const APP_THEMES: AppTheme[] = [
  { id: "sky-sea", name: "Sky Sea", tagline: "Bright sky blue like the open sea", primary: "#0284c7", swatches: ["#f0f9ff", "#0284c7", "#22d3ee", "#ffffff"] },
  { id: "ocean-luxury", name: "Ocean Luxury", tagline: "Deep navy with gold accents", primary: "#1e3a8a", swatches: ["#0b1736", "#1e3a8a", "#d4a537", "#f7f8fb"] },
  { id: "fresh-market", name: "Fresh Market", tagline: "Light, airy green and white", primary: "#15803d", swatches: ["#f4fbf6", "#15803d", "#84cc16", "#ffffff"] },
  { id: "midnight-sea", name: "Midnight Sea", tagline: "Dark navy with bright cyan", primary: "#06b6d4", swatches: ["#030a1c", "#0b1a33", "#06b6d4", "#e0f7fb"] },
  { id: "coral-harbor", name: "Coral Harbor", tagline: "Navy with warm coral pops", primary: "#e5484d", swatches: ["#fff7f5", "#e5484d", "#1e2a4a", "#ffd9cf"] },
  { id: "pearl-minimal", name: "Pearl Minimal", tagline: "Clean graphite and slate", primary: "#27272a", swatches: ["#fafafa", "#27272a", "#a1a1aa", "#ffffff"] },
  { id: "saffron-spice", name: "Saffron Spice", tagline: "Warm saffron and cream", primary: "#ea580c", swatches: ["#fffaf2", "#ea580c", "#7c2d12", "#fde68a"] },
  { id: "royal-teal", name: "Royal Teal", tagline: "Rich teal with sand tones", primary: "#0f766e", swatches: ["#f5f3ee", "#0f766e", "#c2a878", "#ffffff"] },
];

export const DEFAULT_APP_THEME = APP_THEMES[0]!;

/** Find the preset for a saved theme_color. Empty means the default theme. */
export function themeForColor(color?: string | null): AppTheme | null {
  const c = (color ?? "").trim().toLowerCase();
  if (!c) return DEFAULT_APP_THEME;
  return APP_THEMES.find((t) => t.primary.toLowerCase() === c) ?? null;
}
