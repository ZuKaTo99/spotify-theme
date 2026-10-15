// =============================================================================
// Datei: src/custom-app/modules/visualizer/media-store.ts
// Zweck: Lokale Wallpaper-Videos und eigene LRC-Texte persistent in IndexedDB.
// Wo ändern? Größengrenzen/Dateitypen und Persistenzfunktionen stehen hier.
// Wichtig: Kein Hochladen an einen Server, keine Blob-URLs dauerhaft speichern.
// =============================================================================

/** Vorschaubilder bleiben bewusst deutlich kleiner als Videodateien. */
const THUMBNAIL_MAX_BYTES = 120 * 1024;

export const MAX_WALLPAPER_BYTES = 80 * 1024 * 1024;
export const MAX_LRC_BYTES = 250 * 1024;
export const MAX_WALLPAPERS = 12;
export const MAX_TOTAL_WALLPAPER_BYTES = 256 * 1024 * 1024;
const DATABASE_NAME = "zukato-toolkit.visualizer-assets";
const STORE = "assets";
const VALID_TRACK = /^spotify:(?:track|episode):[A-Za-z0-9]+$/;

/** Der Platzhalter DEFAULT wird benutzt, wenn für den Titel kein eigenes Video vorliegt. */
export const DEFAULT_WALLPAPER_KEY = "default";

/**
 * Nicht-destruktiver Videobereich in Sekunden. Das eigentliche Video bleibt als
 * Original-Blob erhalten; ein Ausschnitt wird ausschließlich beim Abspielen
 * durch Sprünge innerhalb des HTMLVideoElements wiederholt.
 * `end: null` bedeutet: bis zum Dateiende abspielen.
 */
export interface VideoClip { start: number; end: number | null }
export const FULL_VIDEO_CLIP: Readonly<VideoClip> = { start: 0, end: null };
const MAX_CLIP_SECONDS = 4 * 60 * 60;

/** Alte Assets ohne Clip und manipulierte Metadaten ohne Absturz behandeln. */
export function normalizeVideoClip(source: unknown): VideoClip {
  if (!source || typeof source !== "object") return { ...FULL_VIDEO_CLIP };
  const record = source as Record<string, unknown>;
  const start = typeof record.start === "number" && Number.isFinite(record.start) &&
    record.start >= 0 && record.start < MAX_CLIP_SECONDS ? record.start : 0;
  const end = typeof record.end === "number" && Number.isFinite(record.end) &&
    record.end <= MAX_CLIP_SECONDS && record.end >= start + 0.25 ? record.end : null;
  return { start, end };
}

/**
 * Eingaben aus dem Editor NICHT heimlich korrigieren: ungültige Sekunden oder
 * ein Ende vor dem Anfang müssen eine sichtbare Fehlermeldung erzeugen.
 * duration ist optional, weil Chromium manche Codecs nicht decodieren kann.
 */
export function validateVideoClip(start: number, end: number | null, duration?: number): VideoClip {
  if (!Number.isFinite(start) || start < 0 || start >= MAX_CLIP_SECONDS)
    throw new Error("Der Start muss eine gültige Sekundenzahl ab 0 sein.");
  if (end !== null && (!Number.isFinite(end) || end > MAX_CLIP_SECONDS || end - start < 0.25))
    throw new Error("Das Ende muss mindestens 0,25 Sekunden nach dem Anfang liegen.");
  if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
    if (start >= duration - 0.1 || (end !== null && end > duration + 0.05))
      throw new Error("Der gewählte Ausschnitt liegt außerhalb der Videolänge.");
  }
  return { start, end };
}

/** Kleine Bibliothekseinträge: ohne Binärdaten, damit die Liste schnell bleibt. */
export interface WallpaperEntry {
  scope: string;
  filename: string;
  bytes: number;
  savedAt: number;
  clip: VideoClip;
}

export interface SavedWallpaper {
  key: string;
  filename: string;
  blob: Blob;
  clip: VideoClip;
}
interface StoredAsset {
  key: string;
  filename: string;
  blob?: Blob;
  text?: string;
  savedAt?: number;
  clip?: VideoClip;
}

/** Erlaubt nur echte Spotify-URI-Zuordnungen statt beliebiger DB-Schlüssel. */
function requireScope(scope: string): string {
  if (scope === DEFAULT_WALLPAPER_KEY || VALID_TRACK.test(scope)) return scope;
  throw new Error("Ungültiger Spotify-Titel für die Zuordnung.");
}

/** Kleine Promise-Brücke für die standardisierte IndexedDB-Request-API. */
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB-Anfrage fehlgeschlagen."));
  });
}

/** Datenbank pro Aktion öffnen und danach schließen, um Versionssperren zu vermeiden. */
async function openStore(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("Dieser Spotify-Client unterstützt keinen lokalen Video-Speicher.");
  const request = indexedDB.open(DATABASE_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "key" });
  };
  return requestResult(request);
}

/** Lesevorgang und Transaktion müssen vollständig abgeschlossen sein. */
async function readAsset(key: string): Promise<StoredAsset | undefined> {
  const db = await openStore();
  try {
    const transaction = db.transaction(STORE, "readonly");
    const result = await requestResult(transaction.objectStore(STORE).get(key));
    return result as StoredAsset | undefined;
  } finally { db.close(); }
}

/** Schreibvorgänge erst nach commit als erfolgreich behandeln. */
async function writeAsset(asset: StoredAsset | null, key: string): Promise<void> {
  await writeAssets([{ asset, key }]);
}

/** Video und zugehöriges Vorschaubild atomar aktualisieren, kein veraltetes Bild. */
async function writeAssets(changes: Array<{ asset: StoredAsset | null; key: string }>): Promise<void> {
  const db = await openStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("Speicheraktion abgebrochen (Speicherplatz prüfen)."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Schreiben fehlgeschlagen."));
      for (const { asset, key } of changes) {
        if (asset) transaction.objectStore(STORE).put(asset);
        else transaction.objectStore(STORE).delete(key);
      }
    });
  } finally { db.close(); }
}

/** Vor dem Import Platzverbrauch prüfen: QuotaExceeded wird zusätzlich von IndexedDB behandelt. */
async function listWallpapers(): Promise<StoredAsset[]> {
  const db = await openStore();
  try {
    const transaction = db.transaction(STORE, "readonly");
    const all = await requestResult(transaction.objectStore(STORE).getAll());
    return (all as StoredAsset[]).filter((asset) => asset.key.startsWith("wallpaper:") && asset.blob instanceof Blob);
  } finally { db.close(); }
}

/** MP4/WebM/Ogg prüfen; die tatsächlich verwendeten Codecs muss der Client unterstützen. */
export function validateWallpaper(file: Pick<File, "name" | "size" | "type">): void {
  if (file.size <= 0 || file.size > MAX_WALLPAPER_BYTES) throw new Error("Video muss zwischen 1 Byte und 80 MiB groß sein.");
  const validMime = /^(video\/(mp4|webm|ogg))$/i.test(file.type);
  const validExtension = /\.(mp4|webm|ogv)$/i.test(file.name);
  if (!validMime && !validExtension) throw new Error("Nur .mp4, .webm oder .ogv werden akzeptiert.");
}

/** Persistiert genau ein Videowallpaper pro Titel plus optional ein Standardvideo. */
export async function saveWallpaper(scope: string, file: File, thumbnail: Blob | null = null, clip: VideoClip = { ...FULL_VIDEO_CLIP }): Promise<void> {
  validateWallpaper(file);
  const safeClip = validateVideoClip(clip.start, clip.end);
  const key = `wallpaper:${requireScope(scope)}`;
  const otherVideos = (await listWallpapers()).filter((entry) => entry.key !== key);
  if (otherVideos.length >= MAX_WALLPAPERS) throw new Error("Maximal 12 Wallpapers gespeichert. Bitte ein anderes ersetzen oder löschen.");
  const bytesUsed = otherVideos.reduce((sum, entry) => sum + (entry.blob?.size ?? 0), 0);
  if (bytesUsed + file.size > MAX_TOTAL_WALLPAPER_BYTES) throw new Error("Wallpapers belegen zusammen maximal 256 MiB. Bitte alte Videos entfernen.");
  const image = validThumbnail(thumbnail) ? thumbnail : null;
  // Zweiter Datensatz statt Bild im Video-Blob: Vorschauliste kann ohne Decoder laden.
  const imageKey = `thumbnail:${requireScope(scope)}`;
  await writeAssets([
    { key, asset: { key, filename: file.name.slice(0, 180), blob: file, savedAt: Date.now(), clip: safeClip } },
    { key: imageKey, asset: image ? { key: imageKey, filename: "preview.jpg", blob: image } : null },
  ]);
}

/**
 * Übersicht der gespeicherten Videos: keine Blobs an die UI zurückgeben.
 * Alte Datenbankeinträge ohne Zeitstempel bleiben weiterhin lesbar.
 */
export async function listWallpaperEntries(): Promise<WallpaperEntry[]> {
  const videos = await listWallpapers();
  return videos.map((item) => ({
    scope: item.key.slice("wallpaper:".length),
    filename: item.filename,
    bytes: item.blob?.size ?? 0,
    savedAt: typeof item.savedAt === "number" ? item.savedAt : 0,
    clip: normalizeVideoClip(item.clip),
  })).sort((left, right) => right.savedAt - left.savedAt || left.scope.localeCompare(right.scope));
}


/** Verhindert fremde Binärformate und übergroße Bilder im lokalen Speicher. */
function validThumbnail(image: Blob | null): image is Blob {
  return image instanceof Blob && image.size > 0 && image.size <= THUMBNAIL_MAX_BYTES &&
    /^(image\/(jpeg|png|webp))$/i.test(image.type);
}

/** Gibt nur das kleine Bild zurück, ohne die große Videodatei zu lesen. */
export async function loadWallpaperThumbnail(scope: string): Promise<Blob | null> {
  const asset = await readAsset(`thumbnail:${requireScope(scope)}`);
  return validThumbnail(asset?.blob ?? null) ? asset!.blob! : null;
}

/** Alte v1.2-Videos erhalten auf Nutzerwunsch nachträglich ein Standbild. */
export async function saveWallpaperThumbnail(scope: string, image: Blob): Promise<void> {
  const key = `wallpaper:${requireScope(scope)}`;
  if (!validThumbnail(image)) throw new Error("Ungültiges oder zu großes Vorschaubild.");
  const original = await readAsset(key);
  if (!(original?.blob instanceof Blob)) throw new Error("Wallpaper existiert nicht mehr.");
  const imageKey = `thumbnail:${scope}`;
  await writeAsset({ key: imageKey, filename: "preview.jpg", blob: image }, imageKey);
}

/** Exakt ein Video laden; die Bibliothek darf NICHT zum Default-Slot zurückfallen. */
export async function loadExactWallpaper(scope: string): Promise<SavedWallpaper | null> {
  const key = `wallpaper:${requireScope(scope)}`;
  const asset = await readAsset(key);
  return asset?.blob instanceof Blob ? { key, filename: asset.filename, blob: asset.blob, clip: normalizeVideoClip(asset.clip) } : null;
}

/**
 * Eine vorhandene Videodatei einem weiteren Ziel zuordnen.
 * Nutzt dieselben Slot-/Speichergrenzen wie ein normaler Import.
 * WICHTIG: Die Daten werden dupliziert, keine fehleranfälligen DB-Referenzen.
 */
export async function assignStoredWallpaper(source: string, target: string): Promise<void> {
  requireScope(source);
  requireScope(target);
  if (source === target) return;
  const existing = await loadExactWallpaper(source);
  if (!existing) throw new Error("Das ausgewählte Wallpaper existiert nicht mehr.");
  const file = new File([existing.blob], existing.filename, { type: existing.blob.type });
  await saveWallpaper(target, file, await loadWallpaperThumbnail(source), existing.clip);
}

/**
 * Nur die Abspielgrenzen überschreiben, NICHT den großen Binärblob ersetzen.
 * Bei einer bereits vorhandenen Zuordnung bleibt auch das Thumbnail erhalten.
 */
export async function saveWallpaperClip(scope: string, clip: VideoClip, duration?: number): Promise<void> {
  const key = `wallpaper:${requireScope(scope)}`;
  const safe = validateVideoClip(clip.start, clip.end, duration);
  const original = await readAsset(key);
  if (!(original?.blob instanceof Blob)) throw new Error("Wallpaper existiert nicht mehr.");
  await writeAsset({ ...original, clip: safe }, key);
}

/** Bei jedem Songwechsel: erst Titelvideo, dann globalen Hintergrund prüfen. */
export async function loadWallpaper(scope: string): Promise<SavedWallpaper | null> {
  const key = requireScope(scope);
  const asset = await readAsset(`wallpaper:${key}`) ?? (key !== DEFAULT_WALLPAPER_KEY ? await readAsset(`wallpaper:default`) : undefined);
  return asset?.blob instanceof Blob ? { key: asset.key, filename: asset.filename, blob: asset.blob, clip: normalizeVideoClip(asset.clip) } : null;
}

/** Löscht nur die angeforderte Zuordnung, NICHT den globalen Fallback. */
export async function deleteWallpaper(scope: string): Promise<void> {
  const key = requireScope(scope);
  await writeAssets([
    { key: `wallpaper:${key}`, asset: null },
    { key: `thumbnail:${key}`, asset: null },
  ]);
}

/** Benutzerdefinierte LRC-Datei pro Spotify-URI speichern. */
export async function saveLyrics(uri: string, text: string, filename: string): Promise<void> {
  if (!VALID_TRACK.test(uri)) throw new Error("Bitte zuerst einen Spotify-Titel abspielen.");
  if (new Blob([text]).size > MAX_LRC_BYTES) throw new Error("LRC ist zu groß (maximal 250 KiB).");
  await writeAsset({ key: `lyrics:${uri}`, filename: filename.slice(0, 180), text }, `lyrics:${uri}`);
}

/** Keine API-Suche: Es werden nur explizit importierte Texte gelesen. */
export async function loadLyrics(uri: string): Promise<string | null> {
  if (!VALID_TRACK.test(uri)) return null;
  const asset = await readAsset(`lyrics:${uri}`);
  return typeof asset?.text === "string" ? asset.text : null;
}

/** Entfernt nur die synchronisierten Textzeilen des aktuellen Titels. */
export async function deleteLyrics(uri: string): Promise<void> {
  if (!VALID_TRACK.test(uri)) return;
  await writeAsset(null, `lyrics:${uri}`);
}
