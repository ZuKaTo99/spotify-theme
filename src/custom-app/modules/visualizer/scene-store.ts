// =============================================================================
// Datei: scene-store.ts
// Zweck: Bibliothek freier HTML-Wallpapers und eigener Videodateien (Diashow).
// Wo ändern? Importgrenzen, Löschvorgang, Speicherkontrolle und Metadaten hier.
// Bestehende v1.5-Videodatenbank bleibt UNBERÜHRT (Abwärtskompatibilität).
// =============================================================================
import { MAX_WALLPAPER_BYTES } from "./media-store";
import { packWebWallpaper } from "./web-wallpaper";
import { groupWallpaperFolderFiles } from "./scene-folder";

export const MAX_SCENES = 128;
export const MAX_SCENE_BYTES = 512 * 1024 * 1024;
const DATABASE_NAME = "zukato-toolkit.visualizer-scenes";
const STORE = "scenes";
const VALID_ID = /^scene-[a-zA-Z0-9-]{8,80}$/;

export interface SceneEntry {
  id: string;
  name: string;
  kind: "html" | "video";
  bytes: number;
  created: number;
}
export interface SceneAsset extends SceneEntry { blob: Blob }

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Szenendaten konnten nicht gelesen werden."));
  });
}

/** Separate Datenbank verhindert Änderungen an bereits vorhandenen Videos. */
async function openScenes(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("Lokale Szenen benötigen IndexedDB.");
  const request = indexedDB.open(DATABASE_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
  };
  return requestResult(request);
}

/** Große Blobs nicht in Render-State-Listen halten. */
export async function listScenes(): Promise<SceneEntry[]> {
  const db = await openScenes();
  try {
    const records = await requestResult(db.transaction(STORE, "readonly").objectStore(STORE).getAll()) as SceneAsset[];
    return records.filter((record) => VALID_ID.test(record.id) && record.blob instanceof Blob)
      .map(({ id, name, kind, bytes, created }) => ({ id, name, kind, bytes, created }))
      .sort((a, b) => a.created - b.created);
  } finally { db.close(); }
}

export async function loadScene(id: string): Promise<SceneAsset | null> {
  if (!VALID_ID.test(id)) return null;
  const db = await openScenes();
  try {
    const value = await requestResult(db.transaction(STORE, "readonly").objectStore(STORE).get(id)) as SceneAsset | undefined;
    return value?.blob instanceof Blob && (value.kind === "html" || value.kind === "video") ? value : null;
  } finally { db.close(); }
}

/** Konsistenter Schreibcommit, statt einen Button vor dem Commit freizugeben. */
async function changeScene(asset: SceneAsset | null, id: string): Promise<void> {
  const db = await openScenes();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Speicherplatz für die Szene fehlt."));
      tx.onerror = () => reject(tx.error ?? new Error("Szenenänderung fehlgeschlagen."));
      if (asset) tx.objectStore(STORE).put(asset);
      else tx.objectStore(STORE).delete(id);
    });
  } finally { db.close(); }
}

/**
 * Eigene HTML-Datei/eigenen Webprojektordner oder Videodatei importieren.
 * Weder vorgefertigte Medien noch externe Downloads werden mitgeliefert.
 * Bei HTML-Ordnern: alle Dateien vor dem Speichern in eine Sandbox-Seite packen.
 */
export async function importScene(files: readonly File[]): Promise<SceneEntry> {
  if (!files.length) throw new Error("Bitte eine Szene auswählen.");
  const html = files.some((file) => /\.html?$/i.test(file.name));
  let blob: Blob;
  if (html) blob = await packWebWallpaper(files);
  else {
    if (files.length !== 1) throw new Error("Eine Videoszene besteht aus genau einer Datei.");
    const file = files[0];
    if (file.size <= 0 || file.size > MAX_WALLPAPER_BYTES || !/\.(mp4|webm|ogv)$/i.test(file.name))
      throw new Error("Videodatei muss MP4, WebM oder OGV sein (max. 80 MiB).");
    blob = file;
  }
  const existing = await listScenes();
  if (existing.length >= MAX_SCENES || existing.reduce((sum, entry) => sum + entry.bytes, 0) + blob.size > MAX_SCENE_BYTES)
    throw new Error("Die Szenenbibliothek ist voll (128 Einträge / 512 MiB).");
  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const id = `scene-${unique}`;
  const name = (html ? (files.find((file) => /(^|\/)index\.html$/i.test(file.name)) ?? files[0]) : files[0]).name.slice(0, 160);
  const record: SceneAsset = { id, name, kind: html ? "html" : "video", blob, bytes: blob.size, created: Date.now() };
  await changeScene(record, id);
  return { id, name, kind: record.kind, bytes: record.bytes, created: record.created };
}

/**
 * Einen ganzen Wallpaper-Ordner in EINEM Datenbank-Commit importieren.
 * Die gewählte Sammlung kann viele Unterordner mit je einer index.html
 * enthalten. Erst NACH Prüfung und Packen aller Projekte wird geschrieben:
 * ein unvollständiger Ordner soll nicht halb in der Bibliothek stehen.
 */
export async function importSceneFolder(files: readonly File[]): Promise<SceneEntry[]> {
  const projects = groupWallpaperFolderFiles(files);
  const existing = await listScenes();
  if (existing.length + projects.length > MAX_SCENES)
    throw new Error(`Zu viele Wallpapers: maximal ${MAX_SCENES} Einträge insgesamt.`);
  const records: SceneAsset[] = [];
  let totalBytes = existing.reduce((sum, item) => sum + item.bytes, 0);
  for (const [index, project] of projects.entries()) {
    const html = project.files.some((file) => /\.html?$/i.test(file.name));
    const blob = html ? await packWebWallpaper(project.files) : project.files[0];
    if (!html && (project.files.length !== 1 || blob.size > MAX_WALLPAPER_BYTES))
      throw new Error(`Ungültige Videodatei: ${project.name}`);
    totalBytes += blob.size;
    if (totalBytes > MAX_SCENE_BYTES) throw new Error("Wallpaper-Sammlung überschreitet 512 MiB.");
    const unique = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID() : `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
    records.push({ id: `scene-${unique}`, name: project.name.slice(0, 160), kind: html ? "html" : "video",
      blob, bytes: blob.size, created: Date.now() + index });
  }
  const db = await openScenes();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("Ordnerimport fehlgeschlagen."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Wallpaper-Speicherung fehlgeschlagen."));
      for (const asset of records) transaction.objectStore(STORE).put(asset);
    });
  } finally { db.close(); }
  // Große Blob-Daten verbleiben in IndexedDB, nicht im React-Komponentenstate.
  return records.map(({ id, name, kind, bytes, created }) => ({ id, name, kind, bytes, created }));
}

/** Beim Entfernen separat die Zuordnungen in scene-playlists.ts bereinigen. */
export async function deleteScene(id: string): Promise<void> {
  if (!VALID_ID.test(id)) throw new Error("Unbekannte Szene.");
  await changeScene(null, id);
}
