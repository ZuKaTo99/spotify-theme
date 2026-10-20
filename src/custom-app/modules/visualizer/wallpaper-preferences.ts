// =============================================================================
// Datei: wallpaper-preferences.ts
// Zweck: Einstellungen EINES importierten HTML-Wallpapers songübergreifend
// speichern, ohne der fremden iframe-Sandbox Spotifys localStorage freizugeben.
//
// Architektur:
//   Wallpaper-iframe -> postMessage -> überprüfter Parent-Adapter -> Storage.
//   Beim nächsten Start erhält das iframe nur die Werte DIESER Szenen-ID.
//   Speicherplatz ist pro Szene begrenzt; niemals beliebige Spotify-Schlüssel
//   lesen, schreiben oder in den Sandbox-Kontext übertragen.
//
// Wo ändern? Speicherlimit, Validierung und Speicher-Namespace nur hier.
// =============================================================================

export const WALLPAPER_PREFS_CHANGED = "zukato-toolkit:wallpaper-prefs-changed";
export const MAX_WALLPAPER_PREFS_KEYS = 128;
export const MAX_WALLPAPER_PREFS_CHARS = 48 * 1024;
export const MAX_WALLPAPER_PREFS_KEY_CHARS = 256;
export const MAX_WALLPAPER_PREFS_VALUE_CHARS = 16 * 1024;
const PREFIX = "zukato-toolkit.wallpaper-prefs.v1:";
// Session-Werte bewusst über Songwechsel erhalten: jedes HTML-Wallpaper
// bekommt bei jedem Titel technisch ein NEUES iframe (neue Browser-Sitzung).
// Ohne diese zweite, projektbezogene Ablage sind sessionStorage-Presets weg.
const SESSION_PREFIX = "zukato-toolkit.wallpaper-session-prefs.v1:";
export type WallpaperPrefsScope = "local" | "session";

export type WallpaperPrefs = Record<string, string>;
export type WallpaperPrefsOperation =
  | { action: "set"; key: string; value: string }
  | { action: "remove"; key: string }
  | { action: "clear" };

/** Der Kanal ist Teil der validierten Operation; ältere Meldungen sind local. */
export type ScopedWallpaperPrefsOperation = WallpaperPrefsOperation & { scope?: WallpaperPrefsScope };

/** Szenen-IDs werden vom Szenenstore erzeugt, niemals aus iframe-Nachrichten. */
function storageKey(sceneId: string, scope: WallpaperPrefsScope = "local"): string {
  if (typeof sceneId !== "string" || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(sceneId))
    throw new Error("Ungültige Wallpaper-Szenenkennung.");
  return `${scope === "session" ? SESSION_PREFIX : PREFIX}${sceneId}`;
}

/** Eigene Objektkopie ohne Prototyp: Schlüssel wie '__proto__' sind Daten. */
function normalize(input: unknown): WallpaperPrefs {
  const result: WallpaperPrefs = Object.create(null) as WallpaperPrefs;
  if (!input || typeof input !== "object" || Array.isArray(input)) return result;
  for (const [key, value] of Object.entries(input)) {
    if (typeof key !== "string" || !key || key.length > MAX_WALLPAPER_PREFS_KEY_CHARS ||
        typeof value !== "string" || value.length > MAX_WALLPAPER_PREFS_VALUE_CHARS ||
        Object.keys(result).length >= MAX_WALLPAPER_PREFS_KEYS) continue;
    result[key] = value;
  }
  // Historische bzw. beschädigte Daten niemals unverändert zurückgeben.
  if (JSON.stringify(result).length > MAX_WALLPAPER_PREFS_CHARS)
    return Object.create(null) as WallpaperPrefs;
  return result;
}

/** Fehlender/gesperrter Host-Speicher darf die Wallpaper-Wiedergabe nicht stoppen. */
export function loadWallpaperPrefs(sceneId: string, scope: WallpaperPrefsScope = "local"): WallpaperPrefs {
  try { return normalize(JSON.parse(localStorage.getItem(storageKey(sceneId, scope)) || "{}")); }
  catch { return Object.create(null) as WallpaperPrefs; }
}

/** Nur drei erlaubte Operationen und ausschließlich Strings akzeptieren. */
export function parseWallpaperPrefsOperation(data: unknown): ScopedWallpaperPrefsOperation | null {
  if (!data || typeof data !== "object") return null;
  const input = data as Record<string, unknown>;
  if (input.zukatoProjectStorage !== true) return null;
  // Fremde/kaputte Kanäle ausdrücklich ablehnen. Die ältere lokale API
  // ohne scope bleibt mit bereits importierten Projekten kompatibel.
  if (input.scope !== undefined && input.scope !== "local" && input.scope !== "session") return null;
  const scope: WallpaperPrefsScope = input.scope === "session" ? "session" : "local";
  if (input.action === "clear") return { action: "clear", scope };
  if ((input.action === "set" || input.action === "remove") &&
      typeof input.key === "string" && input.key.length > 0 &&
      input.key.length <= MAX_WALLPAPER_PREFS_KEY_CHARS) {
    if (input.action === "remove") return { action: "remove", key: input.key, scope };
    if (typeof input.value === "string" && input.value.length <= MAX_WALLPAPER_PREFS_VALUE_CHARS)
      return { action: "set", key: input.key, value: input.value, scope };
  }
  return null;
}

/**
 * Ein fehlgeschlagener Schreibversuch verändert den gespeicherten Stand NICHT.
 * Insbesondere dürfen mehrere versehentliche oder bösartige iframe-Nachrichten
 * nicht unbegrenzt den Host-localStorage füllen.
 */
export function applyWallpaperPrefsOperation(sceneId: string, operation: ScopedWallpaperPrefsOperation): boolean {
  try {
    const scope = operation.scope ?? "local";
    if (scope !== "local" && scope !== "session") return false;
    const key = storageKey(sceneId, scope);
    const next = loadWallpaperPrefs(sceneId, scope);
    if (operation.action === "clear") {
      for (const name of Object.keys(next)) delete next[name];
    } else if (operation.action === "remove") {
      delete next[operation.key];
    } else {
      // Auch direkte interne Aufrufer dürfen keine überlangen Schlüssel oder
      // Werte am Message-Parser vorbei in den lokalen Speicher schreiben.
      if (!operation.key || operation.key.length > MAX_WALLPAPER_PREFS_KEY_CHARS ||
          operation.value.length > MAX_WALLPAPER_PREFS_VALUE_CHARS) return false;
      next[operation.key] = operation.value;
    }
    const serialized = JSON.stringify(next);
    if (Object.keys(next).length > MAX_WALLPAPER_PREFS_KEYS ||
        serialized.length > MAX_WALLPAPER_PREFS_CHARS) return false;
    localStorage.setItem(key, serialized);
    // Die Vorschau und die Hauptbühne teilen dieselbe Szene. Beide bekommen
    // die Änderungen mit, ohne Spotify- oder andere Projektwerte zu sehen.
    window.dispatchEvent(new CustomEvent(WALLPAPER_PREFS_CHANGED, { detail: { sceneId } }));
    return true;
  } catch { return false; }
}

/** Beim endgültigen Löschen der Szene auch ihren kleinen Preference-Store löschen. */
export function deleteWallpaperPrefs(sceneId: string): void {
  // Beide Bereiche gehören derselben Szene. Beim Löschen niemals verwaiste
  // Sitzungseinstellungen zurücklassen (auch wenn eine einzelne Löschung
  // durch den Browser blockiert wird).
  for (const scope of ["local", "session"] as const) {
    try { localStorage.removeItem(storageKey(sceneId, scope)); }
    catch { /* Storage kann z. B. durch den Benutzer gesperrt sein. */ }
  }
}
