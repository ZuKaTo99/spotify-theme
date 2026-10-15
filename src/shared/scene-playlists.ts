// =============================================================================
// Datei: src/shared/scene-playlists.ts
// Zweck: Ein Wallpaper pro Spotify-Song; bei jedem Titelwechsel zum nächsten.
// Wo ändern? Reihenfolge, Song-Overrides, Quellen-Schalter und URL-Validierung.
// WICHTIG: Nicht innerhalb eines Songs wechseln. Nur das Event "songchange"
// erhöht den Zähler; nach dem letzten Ordner-Wallpaper folgt bei der nächsten
// Songänderung wieder Wallpaper Nr. 1 (Modulo-Prinzip).
// =============================================================================

export type SourceMode = "wallpapers" | "original";
export const SCENE_PLAYLIST_CHANGED_EVENT = "zukato-toolkit:scene-playlists-changed";
const STORAGE_KEY = "zukato-toolkit.scene-playlists.v1";
const VALID_SCOPE = /^(default|spotify:(?:track|episode):[A-Za-z0-9]+)$/;
const VALID_SCENE = /^scene-[a-zA-Z0-9-]{8,80}$/;
export const MAX_PLAYLIST_ITEMS = 128;
export const MAX_PLAYLIST_SCOPES = 100;

export interface ScenePreferences {
  /** Einstellungen: an=HTML-Wallpaper, aus=Original-Musikvideoquelle. */
  mode: SourceMode;
  /** Nur für Abwärtskompatibilität mit v1.6-Vorversion – wird NICHT benutzt. */
  slideSeconds: number;
  /** default=Ordner-Reihenfolge; Track-Liste überschreibt für diesen Song. */
  playlists: Record<string, string[]>;
  /** Seit welchem Songlauf eine neu zugeordnete Playlist bei Eintrag 1 startet. */
  starts: Record<string, number>;
  /** Optionaler, manuell und rechtmäßig eingetragener HTTPS-Videolink. */
  originals: Record<string, string>;
  originalRanges: Record<string, { start: number; end: number | null }>;
}

export const DEFAULT_SCENE_PREFERENCES: Readonly<ScenePreferences> = {
  mode: "wallpapers", slideSeconds: 15, playlists: {}, starts: {}, originals: {}, originalRanges: {},
};

/** Nur direkte HTTPS-Videodateien, keine Webseiten, Logins oder lokalen Adressen. */
export function validateOriginalVideoUrl(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  let url: URL;
  try { url = new URL(cleaned); } catch { throw new Error("Ungültige Originalvideo-URL."); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
    !/\.(mp4|webm|ogv)$/i.test(url.pathname) ||
    url.hostname === "localhost" || /^(127|10|192\.168|169\.254)\./.test(url.hostname)) {
    throw new Error("Nur direkte HTTPS-Links auf .mp4, .webm oder .ogv sind erlaubt.");
  }
  return url.href;
}

/** Gespeicherte Daten gegenüber beschädigten/unerwarteten Werten absichern. */
export function normalizeScenePreferences(value: unknown): ScenePreferences {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const playlists: Record<string, string[]> = {};
  const originals: Record<string, string> = {};
  const starts: Record<string, number> = {};
  const originalRanges: ScenePreferences["originalRanges"] = {};
  if (input.playlists && typeof input.playlists === "object") {
    for (const [key, ids] of Object.entries(input.playlists).slice(0, MAX_PLAYLIST_SCOPES)) {
      if (VALID_SCOPE.test(key) && Array.isArray(ids)) {
        const clean = [...new Set(ids.filter((id): id is string => typeof id === "string" && VALID_SCENE.test(id)))].slice(0, MAX_PLAYLIST_ITEMS);
        if (clean.length) playlists[key] = clean;
      }
    }
  }
  // Alte v1.6-Dateien besitzen dieses Feld nicht -> Index 0 als Legacy-Wert.
  if (input.starts && typeof input.starts === "object") {
    for (const [key, raw] of Object.entries(input.starts).slice(0, MAX_PLAYLIST_SCOPES)) {
      if (VALID_SCOPE.test(key) && playlists[key] && Number.isSafeInteger(raw) &&
        (raw as number) >= 0) starts[key] = raw as number;
    }
  }
  if (input.originals && typeof input.originals === "object") {
    for (const [key, raw] of Object.entries(input.originals).slice(0, MAX_PLAYLIST_SCOPES)) {
      if (!VALID_SCOPE.test(key) || typeof raw !== "string") continue;
      try { if (raw.trim()) originals[key] = validateOriginalVideoUrl(raw); }
      catch { /* Ungültige Links weder speichern noch anzeigen. */ }
    }
  }
  if (input.originalRanges && typeof input.originalRanges === "object") {
    for (const [key, raw] of Object.entries(input.originalRanges).slice(0, MAX_PLAYLIST_SCOPES)) {
      if (!VALID_SCOPE.test(key) || !originals[key] || !raw || typeof raw !== "object") continue;
      const candidate = raw as Record<string, unknown>;
      try { originalRanges[key] = validateOriginalRange(candidate.start, candidate.end); }
      catch { /* Defekten Ausschnitt ignorieren, Ganzvideo verwenden. */ }
    }
  }
  const duration = typeof input.slideSeconds === "number" && Number.isFinite(input.slideSeconds)
    ? Math.round(input.slideSeconds) : 15;
  return { mode: input.mode === "original" ? "original" : "wallpapers",
    slideSeconds: Math.min(120, Math.max(3, duration)), playlists, starts, originals, originalRanges };
}

export interface OriginalRange { start: number; end: number | null }

/** Zeitgrenzen ändern nur die Wiedergabe, nicht die Originaldatei. */
export function validateOriginalRange(start: unknown, end: unknown): OriginalRange {
  if (typeof start !== "number" || !Number.isFinite(start) || start < 0 || start > 14400)
    throw new Error("Ungültige Startsekunde für den Originalclip.");
  if (end !== null && (typeof end !== "number" || !Number.isFinite(end) || end < start + 0.25 || end > 14400))
    throw new Error("Clip-Ende muss mindestens 0,25 Sekunden nach dem Anfang liegen.");
  return { start, end: end as number | null };
}

/** Die geordnete globale Ordnerliste gilt, wenn keine Song-Zuordnung vorliegt. */
export function sceneList(settings: ScenePreferences, trackUri: string): string[] {
  return settings.playlists[trackUri] ?? settings.playlists.default ?? [];
}

/**
 * Von der Nutzerin/dem Nutzer gepflegte Quellenliste importieren, OHNE
 * Videodateien herunterzuladen. Schema:
 * {"format":"zukato-original-clips-v1","videos":[
 *   {"trackUri":"spotify:track:ABC", "url":"https://.../video.mp4",
 *    "start":12, "end":28}
 * ]}
 * "default" statt trackUri ist ebenfalls zulässig.
 * Keine inoffiziellen Spotify-/Canvas-Endpoints oder urheberrechtlich
 * fragwürdige Downloads. Ungültiger Eintrag -> kompletter Import verworfen.
 */
export function parseOriginalClipManifest(value: unknown): Pick<ScenePreferences, "originals" | "originalRanges"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültiges Video-Manifest.");
  const record = value as Record<string, unknown>;
  if (record.format !== "zukato-original-clips-v1" || !Array.isArray(record.videos) ||
    record.videos.length === 0 || record.videos.length > MAX_PLAYLIST_SCOPES)
    throw new Error("Originalclip-Manifest hat ein unbekanntes Format oder zu viele Einträge.");
  const originals: Record<string, string> = {};
  const originalRanges: ScenePreferences["originalRanges"] = {};
  for (const entry of record.videos) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Ungültiger Manifest-Eintrag.");
    const item = entry as Record<string, unknown>;
    if (typeof item.trackUri !== "string" || !VALID_SCOPE.test(item.trackUri) ||
      typeof item.url !== "string" || Object.prototype.hasOwnProperty.call(originals, item.trackUri))
      throw new Error("Ungültiger oder doppelter Song im Originalclip-Manifest.");
    const url = validateOriginalVideoUrl(item.url);
    if (!url) throw new Error("Leere Originalvideo-URL im Manifest.");
    originals[item.trackUri] = url;
    originalRanges[item.trackUri] = validateOriginalRange(item.start ?? 0, item.end ?? null);
  }
  return { originals, originalRanges };
}

/** Reine, testbare Regel: Jeder Aufruf steht für einen SONG, nicht einen Slide. */
export function resolveScene(
  settings: ScenePreferences, trackUri: string, songIndex: number,
): { kind: "scene"; id: string } | { kind: "original"; url: string; range: OriginalRange } |
  { kind: "missing-original" } | { kind: "legacy" } {
  const usesTrackUrl = Boolean(settings.originals[trackUri]);
  const url = settings.originals[trackUri] ?? settings.originals.default ?? "";
  const range = (usesTrackUrl ? settings.originalRanges[trackUri] : settings.originalRanges.default)
    ?? { start: 0, end: null };
  // Ausgeschaltet bedeutet tatsächlich AUS: ohne hinterlegtes Originalvideo
  // KEIN stillschweigender Rückfall zum eigenen HTML-Wallpaper.
  if (settings.mode === "original") {
    return url ? { kind: "original", url, range } : { kind: "missing-original" };
  }
  const entries = sceneList(settings, trackUri);
  if (entries.length) {
    const safeIndex = Number.isFinite(songIndex) ? Math.max(0, Math.floor(songIndex)) : 0;
    // Ein neuer Hauptordner beginnt beim NÄCHSTEN neuen Song wieder mit
    // Eintrag 1, unabhängig davon, wie viele Songs vorher abgespielt wurden.
    const scope = settings.playlists[trackUri] ? trackUri : "default";
    const offset = settings.starts[scope] ?? 0;
    const relative = Math.max(0, safeIndex - offset);
    return { kind: "scene", id: entries[relative % entries.length] };
  }
  // Kompatibilität: ein altes lokales Video bleibt nutzbar, sofern noch kein
  // neuer Wallpaper-Ordner gewählt wurde.
  if (url) return { kind: "original", url, range };
  return { kind: "legacy" };
}

/** Beim neuen Titel GENAU EINEN Schritt vorwärts; keine Zeitintervalle. */
export function nextWallpaperSongIndex(current: number): number {
  return Number.isSafeInteger(current) && current >= 0 ? current + 1 : 0;
}

export function loadScenePreferences(): ScenePreferences {
  try { return normalizeScenePreferences(JSON.parse(Spicetify.LocalStorage.get(STORAGE_KEY) || "null")); }
  catch { return normalizeScenePreferences(null); }
}

/** Nach dem Speichern alle offenen Einstellungs- und Player-Ansichten informieren. */
export function saveScenePreferences(value: ScenePreferences): ScenePreferences {
  const next = normalizeScenePreferences(value);
  Spicetify.LocalStorage.set(STORAGE_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SCENE_PLAYLIST_CHANGED_EVENT));
  return next;
}

/** Löschen entfernt nur Verweise auf diese eine Datei. */
export function withoutScene(settings: ScenePreferences, sceneId: string): ScenePreferences {
  const playlists: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(settings.playlists)) {
    const filtered = ids.filter((id) => id !== sceneId);
    if (filtered.length) playlists[key] = filtered;
  }
  const starts = { ...settings.starts };
  for (const scope of Object.keys(starts)) if (!playlists[scope]) delete starts[scope];
  return { ...settings, playlists, starts };
}
