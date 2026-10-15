// =============================================================================
// Datei: src/shared/appearance.ts
// Zweck: Lokale Design-Palette für die Custom App; keine globalen Spotify-Eingriffe.
// =============================================================================
export const APPEARANCE_KEY = "zukato-toolkit.appearance.v1";
export const PALETTES = {
  emerald: { name: "Smaragd", accent: "#1ed760" },
  violet: { name: "Violett", accent: "#a78bfa" },
  sky: { name: "Himmelblau", accent: "#38bdf8" },
  rose: { name: "Rosé", accent: "#fb7185" },
  amber: { name: "Bernstein", accent: "#fbbf24" },
} as const;
export type PaletteId = keyof typeof PALETTES;

/** Storage-Validierung schützt gegen manipulierte CSS-Werte. */
export function loadPalette(): PaletteId {
  try {
    const value: unknown = Spicetify.Platform.LocalStorageAPI.getItem(APPEARANCE_KEY);
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(PALETTES, value)
      ? value as PaletteId : "emerald";
  } catch { return "emerald"; }
}
/** Der farbige Akzent ist auf .zukato-app begrenzt. */
export function applyPalette(element: HTMLElement | null, palette: PaletteId): void {
  if (element) element.style.setProperty("--zukato-accent", PALETTES[palette].accent);
}
export function savePalette(palette: PaletteId): void {
  Spicetify.Platform.LocalStorageAPI.setItem(APPEARANCE_KEY, palette);
  window.dispatchEvent(new CustomEvent("zukato-toolkit:appearance-changed", { detail: palette }));
}
