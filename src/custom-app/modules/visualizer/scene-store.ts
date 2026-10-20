// =============================================================================
// Datei: scene-store.ts
// Zweck: Persistente HTML-Wallpaper-Bibliothek mit vollständigen Projektdateien.
// Wo ändern? Datenbankmigration, Limits, atomare Imports und Löschungen hier.
// Format v1: bereits importiertes, gepacktes HTML bleibt exakt kompatibel.
// Format v2: große Projektdateien liegen separat als unveränderte IDB-Blobs.
// =============================================================================
import { MAX_WALLPAPER_BYTES } from "./media-store";
import { groupWallpaperFolderFiles } from "./scene-folder";
import {
  MAX_TOTAL_SCENE_BYTES,
  prepareWallpaperProject, resolveWallpaperProjectEntry, type PreparedProject, type ProjectAsset,
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
  if (!VALID_ID.test(id)) return null;
  const db = await openScenes();
  try {
    // WICHTIG: Metadaten und Projektdateien aus DERSELBEN read-only-Transaktion
    // lesen. Ein Projektordner kann parallel über "Projekt aktualisieren"
    // ersetzt werden. Zwei getrennte Transaktionen könnten die ALTE Pfadliste
    // mit den NEUEN Blobs kombinieren und eine scheinbar beschädigte Szene laden.
    // IndexedDB gewährleistet für beide Stores in einer Transaktion dagegen
    // einen konsistenten Snapshot. Keine externen await-/Netzwerkoperationen
    // zwischen den Requests beginnen: die Transaktion muss aktiv bleiben.
    const tx = db.transaction([STORE, ASSET_STORE], "readonly");
    const scene = await requestResult(tx.objectStore(STORE).get(id)) as SceneAsset | undefined;
    if (!scene || scene.kind !== "html" || scene.format !== "project-v2" ||
        !(scene.blob instanceof Blob) || !scene.entry || !Array.isArray(scene.paths)) return null;
    const files = await requestResult(tx.objectStore(ASSET_STORE).index("byScene").getAll(id)) as StoredFile[];
    const byPath = new Map(files.map((entry) => [entry.path, entry.blob]));
    const assets: ProjectAsset[] = scene.paths.map((path) => {
      const blob = byPath.get(path);
      if (!(blob instanceof Blob)) throw new Error(`Wallpaper-Projektdatei fehlt: ${path}`);
      return { path, blob };
    });
    return { entry: scene.entry, files: assets, bytes: scene.bytes };
  } finally { db.close(); }
}

/**
 * Speicherkontrolle und Schreiben in EINER schreibenden IndexedDB-Transaktion.
 *
 * Eine reine Vorabprüfung kann bei zwei gleichzeitig gestarteten Importen
 * denselben alten Bibliotheksstand sehen. Die readwrite-Transaktion sperrt
 * den Szenen-Store dagegen exklusiv, prüft die tatsächlich vorhandenen Daten
 * und schreibt erst danach alle Blobs. So kann weder das Szenenlimit noch das
 * 2-GiB-Limit durch parallel gestartete Importe umgangen werden.
 */
async function writeScenes(records: readonly NewScene[]): Promise<void> {
  const db = await openScenes();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, ASSET_STORE], "readwrite");
      const sceneStore = tx.objectStore(STORE);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Wallpaper-Speicher voll oder Import abgebrochen."));
      tx.onerror = () => reject(tx.error ?? new Error("Wallpaper-Projektdaten konnten nicht gespeichert werden."));
      const existing = sceneStore.getAll();
      existing.onsuccess = () => {
        try {
          const current = (existing.result ?? []) as SceneAsset[];
          const currentBytes = current.reduce((sum, scene) => sum + (Number.isFinite(scene.bytes) ? scene.bytes : 0), 0);
          const newBytes = records.reduce((sum, project) => sum + project.record.bytes, 0);
          if (current.length + records.length > MAX_SCENES || currentBytes + newBytes > MAX_SCENE_BYTES) {
            throw new Error("Szenenbibliothek voll (128 Szenen / 2 GiB). Bitte ungenutzte Wallpapers entfernen.");
          }
          const fileStore = tx.objectStore(ASSET_STORE);
          for (const { record, project } of records) {
            sceneStore.put(record);
            if (project) for (const file of project.files) fileStore.put({
              key: `${record.id}:${file.path}`, sceneId: record.id, path: file.path, blob: file.blob,
            } satisfies StoredFile);
          }
        } catch (error) {
          // Keine Teilimporte schreiben: Ein Abort verwirft auch bereits
          // vorgemerkte Operationen dieser Transaktion vollständig.
          try { tx.abort(); } catch { /* Abbruch kann bereits erfolgt sein. */ }
          reject(error);
        }
      };
      existing.onerror = () => {
        reject(existing.error ?? new Error("Szenenbibliothek konnte nicht geprüft werden."));
      };
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
  // HTML wird NEU ausschließlich als vollständiges Projekt gespeichert.
  // Bereits vorhandene ältere Ein-Datei-Einträge bleiben über loadScene()
  // lesbar; kein automatischer Datenverlust durch dieses Upgrade.
  const project = await resolveWallpaperProjectEntry(prepareWallpaperProject(files));
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

/**
 * Einen bereits importierten HTML-Projektordner IN PLACE aktualisieren.
 *
 * Wichtig für Nebula-Engine-Korrekturen: Ein erneuter regulärer Import würde
 * eine neue sceneId erzeugen, wodurch die alte Playlist und die zugehörigen
 * gespeicherten Presets nicht mehr dieselbe Szene referenzieren. Hier bleibt
 * die ID erhalten. Die neue Version ersetzt sämtliche alten Assets in EINER
 * readwrite-Transaktion – bei Fehler bleibt die bisherige Version vorhanden.
 *
 * Nur EIN vollständiger Projektordner ist erlaubt, kein Sammelordner und
 * niemals eine einzelne HTML-Datei. Die Wallpaper-Originaldateien auf der
 * Festplatte werden nicht angerührt.
 */
export async function replaceSceneFolder(id: string, files: readonly File[]): Promise<SceneEntry> {
  if (!VALID_ID.test(id)) throw new Error("Ungültige Wallpaper-Szenen-ID.");
  const folders = groupWallpaperFolderFiles(files);
  if (folders.length !== 1) throw new Error("Zum Aktualisieren bitte genau EINEN vollständigen Wallpaper-Projektordner auswählen.");
  const prepared = await buildRecord(folders[0].files, folders[0].name.slice(0, 160), 0);
  if (prepared.record.kind !== "html" || prepared.record.format !== "project-v2" || !prepared.project)
    throw new Error("Nur vollständige HTML-Wallpaper-Projekte können so aktualisiert werden.");
  const db = await openScenes();
  let result: SceneEntry | null = null;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, ASSET_STORE], "readwrite");
      const scenes = tx.objectStore(STORE);
      const fileStore = tx.objectStore(ASSET_STORE);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Wallpaper-Aktualisierung wurde zurückgesetzt."));
      tx.onerror = () => reject(tx.error ?? new Error("Wallpaper-Aktualisierung fehlgeschlagen."));
      const existing = scenes.getAll();
      existing.onsuccess = () => {
        try {
          const current = existing.result as SceneAsset[];
          const old = current.find((item) => item.id === id);
          if (!old || old.kind !== "html" || old.format !== "project-v2")
            throw new Error("Bitte ein bereits importiertes vollständiges HTML-Projekt auswählen.");
          const bytes = current.reduce((sum, scene) => sum + (Number.isFinite(scene.bytes) ? scene.bytes : 0), 0);
          if (bytes - old.bytes + prepared.record.bytes > MAX_SCENE_BYTES)
            throw new Error("Szenenbibliothek voll (2 GiB). Aktualisierung abgebrochen.");
          const oldAssets = fileStore.index("byScene").getAll(id);
          oldAssets.onsuccess = () => {
            try {
              // Auch ehemals vorhandene Assets mit anderem Pfad entfernen;
              // IDB-Abbruch würde alle Löschungen und neue puts rückgängig machen.
              for (const asset of oldAssets.result as StoredFile[]) fileStore.delete(asset.key);
              const updated: SceneAsset = {
                ...prepared.record, id: old.id, name: old.name, created: old.created,
              };
              scenes.put(updated);
              for (const asset of prepared.project!.files) fileStore.put({
                key: `${id}:${asset.path}`, sceneId: id, path: asset.path, blob: asset.blob,
              } satisfies StoredFile);
              const { blob: _blob, entry: _entry, paths: _paths, ...metadata } = updated;
              result = metadata;
            } catch (error) { try { tx.abort(); } catch { /* Transaktion bereits beendet. */ } reject(error); }
          };
          oldAssets.onerror = () => { try { tx.abort(); } catch { /* Transaktion bereits beendet. */ } };
        } catch (error) { try { tx.abort(); } catch { /* Transaktion bereits beendet. */ } reject(error); }
      };
      existing.onerror = () => { try { tx.abort(); } catch { /* Transaktion bereits beendet. */ } };
    });
    if (!result) throw new Error("Wallpaper wurde nicht aktualisiert.");
    return result;
  } finally { db.close(); }
}

/** Nur noch für direkte Videodateien; HTML erfordert einen Ordnerimport. */
export async function importScene(files: readonly File[]): Promise<SceneEntry> {
  if (files.length !== 1 || !/\.(?:mp4|webm|ogv)$/i.test(files[0].name))
    throw new Error("HTML-Wallpapers bitte immer als vollständigen Projektordner importieren.");
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

/**
 * Projekt mitsamt ALLEN Asset-Blobs atomar entfernen.
 *
 * Der frühere Löschweg las erst `scene.paths` und löschte genau diese Keys.
 * War der Haupteintrag bereits beschädigt/gelöscht, blieben alle zugehörigen
 * Projektdateien als Speicherleichen zurück. Darum die tatsächlichen Asset-
 * Einträge via IndexedDB-Index `byScene` lesen, unabhängig von der Metadatei.
 */
export async function deleteScene(id: string): Promise<void> {
  if (!VALID_ID.test(id)) throw new Error("Unbekannte Szene.");
  const db = await openScenes();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, ASSET_STORE], "readwrite");
      const assetStore = tx.objectStore(ASSET_STORE);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Szene konnte nicht gelöscht werden."));
      tx.onerror = () => reject(tx.error ?? new Error("Szenenlöschung fehlgeschlagen."));
      const request = assetStore.index("byScene").getAll(id);
      request.onsuccess = () => {
        // Während des laufenden Requests bleibt die Transaktion offen.
        // Jede Löschung ist Teil derselben readwrite-Transaktion.
        for (const file of request.result as StoredFile[]) assetStore.delete(file.key);
        tx.objectStore(STORE).delete(id);
      };
      request.onerror = () => {
        try { tx.abort(); } catch { /* IndexedDB kann bereits abgebrochen haben. */ }
      };
    });
  } finally { db.close(); }
}
