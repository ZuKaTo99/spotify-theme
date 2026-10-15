// =============================================================================
// Datei: src/shared/visualizer-config.ts
// Zweck: Kleine, versionierte Einstellungen für den immersiven Visualizer.
// Wo ändern? Neue Regler hier deklarieren, normalisieren und in Visualizer.tsx anzeigen.
// Videodateien gehören NICHT hierher: große Binärdaten lagern separat in IndexedDB.
// =============================================================================

/** Alle auswählbaren Darstellungen; „off“ zeigt bewusst keine Fake-Audiodaten. */
export type SpectrumStyle = "off" | "bars" | "ring" | "wave" | "particles";
export type WallpaperFit = "cover" | "contain";
/** Freilaufendes Loop oder auf die aktuelle Spotify-Songposition ausgerichtet. */
export type VideoSyncMode = "free" | "song";
/** Anordnung und Position der LRC-Zeilen innerhalb der Videobühne. */
export type LyricAlign = "left" | "center" | "right";
export type LyricPosition = "top" | "middle" | "bottom";

export interface VisualizerConfig {
  version: 1;
  spectrum: SpectrumStyle;
  wallpaperFit: WallpaperFit;
  videoSync: VideoSyncMode;
  /** Zeitkorrektur zum Ausrichten eines Videoclips auf einzelne Songmomente. */
  videoOffsetMs: number;
  /** Farbkorrekturen betreffen ausschließlich das Video, nicht die Lyrics. */
  videoSaturation: number;
  videoHue: number;
  vignette: number;
  dim: number;
  blur: number;
  sensitivity: number;
  smoothing: number;
  bars: number;
  /** Farbe, Deckkraft und Schatten des Audiolayers (nicht des Hintergrundvideos). */
  spectrumColor: string;
  spectrumOpacity: number;
  spectrumGlow: number;
  lyricsEnabled: boolean;
  lyricScale: number;
  lyricOffsetMs: number;
  /** Gestaltung nur für die Anzeige: LRC-Dateien werden nie verändert. */
  lyricAlign: LyricAlign;
  lyricPosition: LyricPosition;
  lyricColor: string;
  lyricHighlight: string;
  lyricShadow: number;
  lyricLines: 1 | 3 | 5;
  showTrackInfo: boolean;
  videoSpeed: number;
  /** Dauer des Wallpaper-Crossfades in Millisekunden (0 = ohne Animation). */
  transitionMs: number;
}

/** Unveränderbare Ausgangswerte beim ersten Start bzw. nach defektem Storage. */
export const DEFAULT_VISUALIZER_CONFIG: Readonly<VisualizerConfig> = {
  version: 1,
  spectrum: "off",
  wallpaperFit: "cover",
  videoSync: "free",
  videoOffsetMs: 0,
  videoSaturation: 100,
  videoHue: 0,
  vignette: 0,
  dim: 35,
  blur: 0,
  sensitivity: 1.7,
  smoothing: 0.75,
  bars: 48,
  spectrumColor: "#1ed760",
  spectrumOpacity: 90,
  spectrumGlow: 6,
  lyricsEnabled: true,
  lyricScale: 1,
  lyricOffsetMs: 0,
  lyricAlign: "center",
  lyricPosition: "middle",
  lyricColor: "#ffffff",
  lyricHighlight: "#ffffff",
  lyricShadow: 55,
  lyricLines: 3,
  showTrackInfo: true,
  videoSpeed: 1,
  transitionMs: 700,
};

const STORAGE_KEY = "zukato-toolkit.visualizer.v1";
export const VISUALIZER_CONFIG_CHANGED_EVENT = "zukato-toolkit:visualizer-config-changed";

/** Begrenzung schützt Style-Werte gegen manipulierte oder veraltete Einstellungen. */
function numberIn(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Farben werden nur als vollständige Hexwerte übernommen, niemals als CSS-Fragmente. */
function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

/** Sowohl bei Import als auch beim Start werden alle Felder geprüft. */
export function normalizeVisualizerConfig(source: unknown): VisualizerConfig {
  const input = source && typeof source === "object" && !Array.isArray(source)
    ? source as Record<string, unknown> : {};
  return {
    version: 1,
    spectrum: ["off", "bars", "ring", "wave", "particles"].includes(String(input.spectrum))
      ? input.spectrum as SpectrumStyle : DEFAULT_VISUALIZER_CONFIG.spectrum,
    wallpaperFit: input.wallpaperFit === "contain" ? "contain" : "cover",
    videoSync: input.videoSync === "song" ? "song" : "free",
    videoOffsetMs: Math.round(numberIn(input.videoOffsetMs, 0, -10000, 10000)),
    videoSaturation: Math.round(numberIn(input.videoSaturation, 100, 0, 200)),
    videoHue: Math.round(numberIn(input.videoHue, 0, -180, 180)),
    vignette: Math.round(numberIn(input.vignette, 0, 0, 100)),
    dim: numberIn(input.dim, 35, 0, 90),
    blur: numberIn(input.blur, 0, 0, 20),
    sensitivity: numberIn(input.sensitivity, 1.7, 0.5, 5),
    smoothing: numberIn(input.smoothing, 0.75, 0, 0.95),
    bars: Math.round(numberIn(input.bars, 48, 12, 128)),
    spectrumColor: safeColor(input.spectrumColor, "#1ed760"),
    spectrumOpacity: Math.round(numberIn(input.spectrumOpacity, 90, 10, 100)),
    spectrumGlow: Math.round(numberIn(input.spectrumGlow, 6, 0, 30)),
    lyricsEnabled: typeof input.lyricsEnabled === "boolean" ? input.lyricsEnabled : true,
    lyricScale: numberIn(input.lyricScale, 1, 0.7, 1.8),
    lyricOffsetMs: Math.round(numberIn(input.lyricOffsetMs, 0, -5000, 5000)),
    lyricAlign: input.lyricAlign === "left" || input.lyricAlign === "right" ? input.lyricAlign : "center",
    lyricPosition: input.lyricPosition === "top" || input.lyricPosition === "bottom" ? input.lyricPosition : "middle",
    lyricColor: safeColor(input.lyricColor, "#ffffff"),
    lyricHighlight: safeColor(input.lyricHighlight, "#ffffff"),
    lyricShadow: Math.round(numberIn(input.lyricShadow, 55, 0, 100)),
    lyricLines: input.lyricLines === 1 || input.lyricLines === 5 ? input.lyricLines : 3,
    showTrackInfo: typeof input.showTrackInfo === "boolean" ? input.showTrackInfo : true,
    videoSpeed: numberIn(input.videoSpeed, 1, 0.5, 2),
    transitionMs: Math.round(numberIn(input.transitionMs, 700, 0, 3000)),
  };
}

/** Settings liegen in der kleinen synchronen Spicetify-Storage-API. */
export function loadVisualizerConfig(): VisualizerConfig {
  try {
    return normalizeVisualizerConfig(Spicetify.Platform.LocalStorageAPI.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_VISUALIZER_CONFIG };
  }
}

/** Schreibt stets ein vollständig normalisiertes Konfigurationsobjekt. */
export function saveVisualizerConfig(config: VisualizerConfig): VisualizerConfig {
  const normalized = normalizeVisualizerConfig(config);
  Spicetify.Platform.LocalStorageAPI.setItem(STORAGE_KEY, normalized);
  window.dispatchEvent(new CustomEvent(VISUALIZER_CONFIG_CHANGED_EVENT, { detail: normalized }));
  return normalized;
}

// -----------------------------------------------------------------------------
// Persönliche Szenen-Presets: kleine, exportierbare Settings ohne Mediendateien.
// Wo ändern? Vorlagen, Namensregeln und Preset-Grenze ausschließlich hier.
// -----------------------------------------------------------------------------
export interface VisualizerPreset {
  id: string;
  name: string;
  config: VisualizerConfig;
}

/** Drei eingebaute Vorlagen, deren Beschriftung die React-UI übersetzt. */
export const BUILTIN_VISUALIZER_PRESETS: ReadonlyArray<{ id: string; config: VisualizerConfig }> = [
  { id: "cinema", config: normalizeVisualizerConfig({ ...DEFAULT_VISUALIZER_CONFIG, dim: 25, blur: 0, spectrum: "off", lyricPosition: "bottom", lyricShadow: 85, lyricLines: 1 }) },
  { id: "karaoke", config: normalizeVisualizerConfig({ ...DEFAULT_VISUALIZER_CONFIG, dim: 65, lyricScale: 1.4, lyricPosition: "middle", lyricHighlight: "#1ed760", lyricLines: 3 }) },
  { id: "concert", config: normalizeVisualizerConfig({ ...DEFAULT_VISUALIZER_CONFIG, dim: 30, spectrum: "ring", sensitivity: 2.5, lyricsEnabled: false, transitionMs: 1200 }) },
];

export const MAX_VISUALIZER_PRESETS = 8;
const PRESET_STORAGE_KEY = "zukato-toolkit.visualizer-presets.v1";
export const VISUALIZER_PRESETS_CHANGED_EVENT = "zukato-toolkit:visualizer-presets-changed";

/** Import und Storage gegen ungültige Namen, IDs und Settings absichern. */
export function normalizeVisualizerPresets(source: unknown): VisualizerPreset[] {
  const data = typeof source === "string" ? (() => { try { return JSON.parse(source) as unknown; } catch { return []; } })() : source;
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const presets: VisualizerPreset[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name.trim().slice(0, 40) : "";
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!name || !/^custom-[a-zA-Z0-9-]{1,60}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    presets.push({ id, name, config: normalizeVisualizerConfig(entry.config) });
    if (presets.length === MAX_VISUALIZER_PRESETS) break;
  }
  return presets;
}

/** Presets bleiben lokal in Spicetifys Settings-Storage gespeichert. */
export function loadVisualizerPresets(): VisualizerPreset[] {
  try { return normalizeVisualizerPresets(Spicetify.Platform.LocalStorageAPI.getItem(PRESET_STORAGE_KEY)); }
  catch { return []; }
}

/** Gemeinsamer Writer auch für Backup-Importe; UI per Event aktualisieren. */
export function replaceVisualizerPresets(value: unknown): VisualizerPreset[] {
  const presets = normalizeVisualizerPresets(value);
  Spicetify.Platform.LocalStorageAPI.setItem(PRESET_STORAGE_KEY, presets);
  window.dispatchEvent(new CustomEvent(VISUALIZER_PRESETS_CHANGED_EVENT));
  return presets;
}

/** Der Name wird erst beim Speichern getrimmt, damit Tippen mit Leerzeichen funktioniert. */
export function saveVisualizerPreset(name: string, settings: VisualizerConfig): VisualizerPreset[] {
  const cleaned = name.trim().slice(0, 40);
  if (!cleaned) throw new Error("Bitte einen Preset-Namen eingeben.");
  const presets = loadVisualizerPresets();
  if (presets.length >= MAX_VISUALIZER_PRESETS) throw new Error("Maximal acht eigene Presets möglich.");
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return replaceVisualizerPresets([...presets, { id, name: cleaned, config: normalizeVisualizerConfig(settings) }]);
}

/** Ausschließlich eigene Presets können gelöscht werden. */
export function deleteVisualizerPreset(id: string): VisualizerPreset[] {
  return replaceVisualizerPresets(loadVisualizerPresets().filter((preset) => preset.id !== id));
}

// -----------------------------------------------------------------------------
// Songbezogene Szenen (v1.5): nur kleine Styles, KEINE Video-/LRC-Binärdateien.
// Die globale Einstellung bleibt unberührt, wenn ein Song eine eigene Szene hat.
// Wo ändern? Maximalzahl, Normalisierung und Backup-Schnittstelle hier.
// -----------------------------------------------------------------------------
export interface TrackVisualizerScene { uri: string; config: VisualizerConfig }
export const MAX_TRACK_SCENES = 100;
const TRACK_SCENES_KEY = "zukato-toolkit.visualizer-track-scenes.v1";
export const VISUALIZER_TRACK_SCENES_CHANGED_EVENT = "zukato-toolkit:visualizer-track-scenes-changed";
const VALID_SCENE_URI = /^spotify:(?:track|episode):[A-Za-z0-9]+$/;

/** Untrusted JSON von Backups oder Storage immer inklusive Track-URI prüfen. */
export function normalizeTrackVisualizerScenes(source: unknown): TrackVisualizerScene[] {
  let value: unknown = source;
  if (typeof value === "string") {
    try { value = JSON.parse(value) as unknown; } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const scenes: TrackVisualizerScene[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.uri !== "string" || !VALID_SCENE_URI.test(entry.uri) || seen.has(entry.uri)) continue;
    seen.add(entry.uri);
    scenes.push({ uri: entry.uri, config: normalizeVisualizerConfig(entry.config) });
    if (scenes.length >= MAX_TRACK_SCENES) break;
  }
  return scenes;
}

export function loadTrackVisualizerScenes(): TrackVisualizerScene[] {
  try { return normalizeTrackVisualizerScenes(Spicetify.Platform.LocalStorageAPI.getItem(TRACK_SCENES_KEY)); }
  catch { return []; }
}

/** Einzelnen Song ansehen, ohne die globale Config oder ein Preset zu verändern. */
export function loadTrackVisualizerScene(uri: string): VisualizerConfig | null {
  if (!VALID_SCENE_URI.test(uri)) return null;
  return loadTrackVisualizerScenes().find((item) => item.uri === uri)?.config ?? null;
}

/** Ein Writer für UI und Backup-Import; Änderungsereignis hält die Seite aktuell. */
export function replaceTrackVisualizerScenes(source: unknown): TrackVisualizerScene[] {
  const scenes = normalizeTrackVisualizerScenes(source);
  Spicetify.Platform.LocalStorageAPI.setItem(TRACK_SCENES_KEY, scenes);
  window.dispatchEvent(new CustomEvent(VISUALIZER_TRACK_SCENES_CHANGED_EVENT));
  return scenes;
}

/** Speichert eine individuelle Stilkopie; frühere Scenes werden überschrieben. */
export function saveTrackVisualizerScene(uri: string, settings: VisualizerConfig): VisualizerConfig {
  if (!VALID_SCENE_URI.test(uri)) throw new Error("Bitte zuerst einen Spotify-Titel abspielen.");
  const scenes = loadTrackVisualizerScenes().filter((item) => item.uri !== uri);
  if (scenes.length >= MAX_TRACK_SCENES) throw new Error("Maximal 100 Song-Szenen möglich.");
  const config = normalizeVisualizerConfig(settings);
  replaceTrackVisualizerScenes([...scenes, { uri, config }]);
  return config;
}

/** Nur die zugehörige Style-Zuordnung entfernen; Wallpaper/Lyrics nie löschen. */
export function deleteTrackVisualizerScene(uri: string): void {
  if (!VALID_SCENE_URI.test(uri)) return;
  replaceTrackVisualizerScenes(loadTrackVisualizerScenes().filter((item) => item.uri !== uri));
}
