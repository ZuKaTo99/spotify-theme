// =============================================================================
// Datei: src/shared/appearance.ts
// Zweck: Umfangreiche Theme-Farbpalette und frei wählbare Hex-Akzentfarbe.
// Kompatibilität: bisherige IDs bleiben gleich; alte Backups funktionieren.
// Keine CSS-Manipulation außerhalb des ZuKaTo-Workspace.
// =============================================================================
export const APPEARANCE_KEY = "zukato-toolkit.appearance.v1";
export const APPEARANCE_CHANGED_EVENT = "zukato-toolkit:appearance-changed";

/** Nach Farbfamilien sortierte Presets; Namen dienen als sichtbare UI-Beschriftung. */
export const PALETTES = {
  emerald: { name: "Smaragd", accent: "#1ed760" },
  mint: { name: "Mint", accent: "#5eead4" },
  forest: { name: "Wald", accent: "#16a34a" },
  lime: { name: "Limette", accent: "#a3e635" },
  teal: { name: "Petrol", accent: "#14b8a6" },
  sky: { name: "Himmelblau", accent: "#38bdf8" },
  azure: { name: "Azur", accent: "#3b82f6" },
  cobalt: { name: "Kobalt", accent: "#2563eb" },
  navy: { name: "Nachtblau", accent: "#818cf8" },
  violet: { name: "Violett", accent: "#a78bfa" },
  lavender: { name: "Lavendel", accent: "#c4b5fd" },
  purple: { name: "Purpur", accent: "#c084fc" },
  fuchsia: { name: "Fuchsia", accent: "#e879f9" },
  magenta: { name: "Magenta", accent: "#f472b6" },
  rose: { name: "Rosé", accent: "#fb7185" },
  ruby: { name: "Rubin", accent: "#f43f5e" },
  crimson: { name: "Karminrot", accent: "#ef4444" },
  coral: { name: "Koralle", accent: "#fb923c" },
  amber: { name: "Bernstein", accent: "#fbbf24" },
  gold: { name: "Gold", accent: "#facc15" },
  sand: { name: "Sand", accent: "#e7c9a9" },
  ice: { name: "Eis", accent: "#bae6fd" },
  silver: { name: "Silber", accent: "#cbd5e1" },
  white: { name: "Weiß", accent: "#f8fafc" },
} as const;

export type PaletteId = keyof typeof PALETTES;
export type PaletteSelection = PaletteId | `#${string}`;

/** Nur sechsstellige HEX-Farben akzeptieren – keine beliebigen CSS-Ausdrücke. */
export function normalizePalette(value: unknown): PaletteSelection {
  if (typeof value !== "string") return "emerald";
  if (Object.prototype.hasOwnProperty.call(PALETTES, value)) return value as PaletteId;
  if (/^#[\da-fA-F]{6}$/.test(value)) return value.toLowerCase() as `#${string}`;
  return "emerald";
}

export function paletteColor(selection: PaletteSelection): string {
  return selection.startsWith("#") ? normalizePalette(selection) as string : PALETTES[selection as PaletteId].accent;
}

/** Bestimmt bei sehr hellen Farben die lesbare Beschriftungsfarbe auf Buttons. */
export function onAccentColor(hex: string): string {
  const normalized = /^#[\da-fA-F]{6}$/.test(hex) ? hex : "#1ed760";
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.18 ? "#101410" : "#ffffff";
}

export function loadPalette(): PaletteSelection {
  try { return normalizePalette(Spicetify.Platform.LocalStorageAPI.getItem(APPEARANCE_KEY)); }
  catch { return "emerald"; }
}

export function applyPalette(element: HTMLElement | null, selection: PaletteSelection): void {
  if (!element) return;
  const hex = paletteColor(normalizePalette(selection));
  element.style.setProperty("--zukato-accent", hex);
  element.style.setProperty("--zukato-on-accent", onAccentColor(hex));
}

export function savePalette(selection: PaletteSelection): void {
  const normalized = normalizePalette(selection);
  Spicetify.Platform.LocalStorageAPI.setItem(APPEARANCE_KEY, normalized);
  window.dispatchEvent(new CustomEvent(APPEARANCE_CHANGED_EVENT, { detail: normalized }));
}
