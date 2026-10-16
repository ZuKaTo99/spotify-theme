// =============================================================================
// Datei: scene-store.ts
// Zweck: Persistente HTML-Wallpaper-Bibliothek mit vollständigen Projektdateien.
// Wo ändern? Datenbankmigration, Limits, atomare Imports und Löschungen hier.
// Format v1: bereits importiertes, gepacktes HTML bleibt exakt kompatibel.
// Format v2: große Projektdateien liegen separat als unveränderte IDB-Blobs.
// =============================================================================
import { MAX_WALLPAPER_BYTES } from "./media-store";
import { MAX_HTML_PROJECT_BYTES, packWebWallpaper } from "./web-wallpaper";
import { groupWallpaperFolderFiles } from "./scene-folder";
import {
  MAX_TOTAL_SCENE_BYTES,
  prepareWallpaperProject, type PreparedProject, type ProjectAsset,
} from "./wallpaper-project";

export const MAX_SCENES = 128;
export const MAX_SCENE_BYTES = MAX_TOTAL_SCENE_BYTES;
const DATABASE_NAME = "zukato-toolkit.visualizer-scenes";
const STORE = "scenes";
const ASSET_STORE = "scene-files";
const VALID_ID = /^scene-[a-zA-Z0-9-]{8,80}$/;

export interface SceneEntry {
  id: string;
  name: string;
  kind: "html" | "video";
  bytes: number;
  created: number;
  /** >1 Datei: Projekt wird getrennt gespeichert, statt inline/base64. */
  format?: "project-v2";
  fileCount?: number;
}
export interface SceneAsset extends SceneEntry {
  /** Legacy-HTML oder Videodatei. Für format=project-v2 leer. */
  blob: Blob;
  entry?: string;
  paths?: string[];
}
interface StoredFile {
  key: string;
  sceneId: string;
  path: string;
  blob: Blob;
}
interface NewScene { record: SceneAsset; project?: PreparedProject }

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Szenendaten konnten nicht gelesen werden."));
  });
}

/** Upgrade fügt nur einen Store hinzu; die bisherigen v1-Daten bleiben erhalten. */
async function openScenes(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("Lokale Szenen benötigen IndexedDB.");
  const request = indexedDB.open(DATABASE_NAME, 2);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    if (!db.objectStoreNames.contains(ASSET_STORE)) {
      const files = db.createObjectStore(ASSET_STORE, { keyPath: "key" });
      files.createIndex("byScene", "sceneId", { unique: false });
    }
  };
  return requestResult(request);
}

/** Listen enthalten niemals Binärdateien; sie dürfen nicht im React-State liegen. */
export async function listScenes(): Promise<SceneEntry[]> {
  const db = await openScenes();
  try {
    const records = await requestResult(db.transaction(STORE, "readonly").objectStore(STORE).getAll()) as SceneAsset[];
    return records.filter((entry) => VALID_ID.test(entry.id) && entry.blob instanceof Blob)
      .map(({ id, name, kind, bytes, created, format, fileCount }) => ({ id, name, kind, bytes, created, format, fileCount }))
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

/** Große Projektdaten werden nur beim Abspielen, Export oder in der Vorschau geladen. */
export async function loadSceneProject(id: string): Promise<PreparedProject | null> {
  const scene = await loadScene(id);
  if (!scene || scene.format !== "project-v2" || !scene.entry || !scene.paths) return null;
  const db = await openScenes();
  try {
    const files = await requestResult(db.transaction(ASSET_STORE, "readonly")
      .objectStore(ASSET_STORE).index("byScene").getAll(id)) as StoredFile[];
    const byPath = new Map(files.map((entry) => [entry.path, entry.blob]));
    const assets: ProjectAsset[] = scene.paths.map((path) => {
      const blob = byPath.get(path);
      if (!blob) throw new Error(`Wallpaper-Projektdatei fehlt: ${path}`);
      return { path, blob };
    });
    return { entry: scene.entry, files: assets, bytes: scene.bytes };
  } finally { db.close(); }
}

/** Ein IDB-Commit für Metadaten und ALLE zugehörigen Asset-Blobs. */
async function writeScenes(records: readonly NewScene[]): Promise<void> {
  const db = await openScenes();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, ASSET_STORE], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Wallpaper-Speicher voll oder Import abgebrochen."));
      tx.onerror = () => reject(tx.error ?? new Error("Wallpaper-Projektdaten konnten nicht gespeichert werden."));
      for (const { record, project } of records) {
        tx.objectStore(STORE).put(record);
        if (project) for (const file of project.files) tx.objectStore(ASSET_STORE).put({
          key: `${record.id}:${file.path}`, sceneId: record.id, path: file.path, blob: file.blob,
        } satisfies StoredFile);
      }
    });
  } finally { db.close(); }
}

/** Nur das unveränderte Original erhalten, nicht eine duplizierte Base64-Version. */
async function buildRecord(files: readonly File[], name: string, index: number): Promise<NewScene> {
  const isHtml = files.some((file) => /\.html?$/i.test(file.name));
  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID() : `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
  const id = `scene-${unique}`;
  const created = Date.now() + index;
  if (!isHtml) {
    if (files.length !== 1 || files[0].size <= 0 || files[0].size > MAX_WALLPAPER_BYTES ||
        !/\.(mp4|webm|ogv)$/i.test(files[0].name))
      throw new Error("Videodatei muss MP4, WebM oder OGV sein (max. 80 MiB).");
    return { record: { id, name, kind: "video", bytes: files[0].size, created, blob: files[0] } };
  }
  // Einzelseiten im alten Format lassen sich weiterhin ohne Migration laden.
  // Sobald weitere Dateien dazugehören, werden sie vollständig und effizient
  // im neuen Projektformat gespeichert – inklusive project.json und 3D-Assets.
  if (files.length === 1 && files[0].size <= MAX_HTML_PROJECT_BYTES) {
    const blob = await packWebWallpaper(files);
    return { record: { id, name, kind: "html", bytes: blob.size, created, blob } };
  }
  const project = prepareWallpaperProject(files);
  return { record: {
    id, name, kind: "html", bytes: project.bytes, created, blob: new Blob(),
    format: "project-v2", entry: project.entry, paths: project.files.map((file) => file.path),
    fileCount: project.files.length,
  }, project };
}

/** Speichergrenzen VOR einem einzigen, atomaren Commit kontrollieren. */
async function validateCapacity(projects: readonly NewScene[]): Promise<void> {
  const current = await listScenes();
  if (current.length + projects.length > MAX_SCENES ||
      current.reduce((sum, scene) => sum + scene.bytes, 0) +
        projects.reduce((sum, project) => sum + project.record.bytes, 0) > MAX_SCENE_BYTES) {
    throw new Error("Szenenbibliothek voll (128 Szenen / 2 GiB). Bitte ungenutzte Wallpapers entfernen.");
  }
}

/** Ein Webprojekt oder ein direktes Video importieren. */
export async function importScene(files: readonly File[]): Promise<SceneEntry> {
  if (!files.length) throw new Error("Bitte eine Szene auswählen.");
  // Der Aufruf wählt einen einzelnen Projektordner bzw. einzelne HTML-Datei.
  const prepared = await buildRecord(files, files[0].name.slice(0, 160), 0);
  await validateCapacity([prepared]);
  await writeScenes([prepared]);
  const { blob: _blob, entry: _entry, paths: _paths, ...metadata } = prepared.record;
  return metadata;
}

/** Gesamten Hauptordner atomar importieren; bei Fehler niemals Teilbibliothek. */
export async function importSceneFolder(files: readonly File[]): Promise<SceneEntry[]> {
  const projects = groupWallpaperFolderFiles(files);
  if (projects.length > MAX_SCENES) throw new Error("Zu viele Wallpaper-Projekte in einem Ordner.");
  const records: NewScene[] = [];
  for (const [index, project] of projects.entries()) {
    records.push(await buildRecord(project.files, project.name.slice(0, 160), index));
  }
  await validateCapacity(records);
  await writeScenes(records);
  return records.map(({ record: { blob: _blob, entry: _entry, paths: _paths, ...metadata } }) => metadata);
}

/** Löscht Projekt und sämtliche eigenen Asset-Blobs in derselben Transaktion. */
export async function deleteScene(id: string): Promise<void> {
  if (!VALID_ID.test(id)) throw new Error("Unbekannte Szene.");
  const scene = await loadScene(id);
  const db = await openScenes();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, ASSET_STORE], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Szene konnte nicht gelöscht werden."));
      tx.onerror = () => reject(tx.error ?? new Error("Szenenlöschung fehlgeschlagen."));
      tx.objectStore(STORE).delete(id);
      for (const path of scene?.paths ?? []) tx.objectStore(ASSET_STORE).delete(`${id}:${path}`);
    });
  } finally { db.close(); }
}
