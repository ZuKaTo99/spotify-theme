// =============================================================================
// Datei: src/shared/visualizer-workspace.ts
// Zweck: Bedienansicht des Visualizers ohne Änderung der Musik-/Szenendaten.
// Wo ändern? Neue Registerkarte, Speicherstrategie oder Fallback hier.
// Warum getrennt? Die reine Logik kann ohne Spotify, Browser oder React getestet
// werden. Bestehende Visualizer-Presets/Backups sind NICHT betroffen.
// =============================================================================

/** Die vier Einstellungen-Seiten; Szenen und andere Medien werden separat geladen. */
export const VISUALIZER_PANELS = ["wallpapers", "lyrics", "audio", "advanced"] as const;
export type VisualizerPanel = typeof VISUALIZER_PANELS[number];

const SESSION_KEY = "zukato.visualizer.active-panel.v1";

/** Auf manipulierte oder alte Sitzungswerte niemals blind vertrauen. */
export function normalizeVisualizerPanel(value: unknown): VisualizerPanel {
  return typeof value === "string" && (VISUALIZER_PANELS as readonly string[]).includes(value)
    ? value as VisualizerPanel : "wallpapers";
}

/** sessionStorage speichert nur die UI-Position, KEINE Lyrics oder Medien. */
export function readVisualizerPanel(): VisualizerPanel {
  try { return normalizeVisualizerPanel(window.sessionStorage.getItem(SESSION_KEY)); }
  catch { return "wallpapers"; } // Webviews können Sitzungsspeicher sperren.
}

/** Ein Speicherfehler darf niemals die eigentliche Wiedergabe unterbrechen. */
export function rememberVisualizerPanel(panel: VisualizerPanel): void {
  try { window.sessionStorage.setItem(SESSION_KEY, normalizeVisualizerPanel(panel)); }
  catch { /* Ein Wechsel ohne dauerhafte Speicherung ist weiterhin möglich. */ }
}

/** Niedrigschwelliger Status, beispielsweise wenn noch keine Datei importiert wurde. */
export function sourceStatus(
  kind: "scene" | "original" | "missing-original" | "legacy",
  hasLegacyVideo: boolean,
): "wallpaper" | "video" | "missing" | "empty" {
  if (kind === "scene") return "wallpaper";
  if (kind === "original") return "video";
  if (kind === "missing-original") return "missing";
  return hasLegacyVideo ? "video" : "empty";
}
