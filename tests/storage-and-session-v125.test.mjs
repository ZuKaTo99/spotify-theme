// =============================================================================
// Datei: tests/storage-and-session-v125.test.mjs
// Zweck: Genau die Speicher-/Songwechsel-Fehler gegen den aktuellen Quellcode
//        testen, die im normalen Lauf mit seriellen Aktionen verborgen blieben.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const source = async (name) => readFile(new URL(name, import.meta.url), "utf8");
const asUrl = (sourceCode) => `data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(sourceCode, { mode: "strip" }))}`;
const media = await import(asUrl(await source("../src/custom-app/modules/visualizer/media-store.ts")));

/**
 * IDB-Testadapter mit exklusiven readwrite-Transaktionen.
 * Er isoliert die Daten bis zum Commit und führt konkurrierende Requests
 * in der Reihenfolge aus, in der sie die Datenbank erreichen.
 */
function indexedDbWithTransactions(preloaded = []) {
  const data = new Map(preloaded.map((item) => [item.key, item]));
  let lock = Promise.resolve();
  return {
    data,
    open() {
      const db = {
        objectStoreNames: { contains() { return false; } },
        createObjectStore() { return { createIndex() {} }; },
        close() {},
        transaction(_stores, mode) {
          let unlock = () => {};
          const waiting = mode === "readwrite" ? new Promise((resolve) => {
            const previous = lock;
            lock = new Promise((release) => { unlock = release; });
            void previous.then(resolve);
          }) : Promise.resolve();
          let finished = false;
          let snapshot;
          const tx = {
            error: null, oncomplete: null, onabort: null, onerror: null,
            abort() {
              if (finished) return;
              finished = true;
              queueMicrotask(() => { tx.onabort?.(); unlock(); });
            },
            objectStore() {
              function request(read) {
                const item = { result: undefined, error: null, onsuccess: null, onerror: null };
                void waiting.then(() => queueMicrotask(() => {
                  if (finished) return;
                  snapshot ??= new Map(data);
                  item.result = read(snapshot);
                  item.onsuccess?.();
                }));
                return item;
              }
              function settle() {
                queueMicrotask(() => {
                  if (finished) return;
                  finished = true;
                  if (mode === "readwrite") {
                    data.clear();
                    for (const [key, value] of snapshot) data.set(key, value);
                  }
                  tx.oncomplete?.(); unlock();
                });
              }
              return {
                getAll: () => request((state) => [...state.values()]),
                get: (key) => request((state) => state.get(key)),
                put: (asset) => { snapshot.set(asset.key, asset); settle(); },
                delete: (key) => { snapshot.delete(key); settle(); },
              };
            },
          };
          return tx;
        },
      };
      const req = { result: db, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => { req.onupgradeneeded?.(); req.onsuccess?.(); });
      return req;
    },
  };
}

test("Zwei parallele Video-Imports dürfen zusammen maximal zwölf Slots belegen", async () => {
  const previous = globalThis.indexedDB;
  const initial = Array.from({ length: 11 }, (_, i) => ({
    key: `wallpaper:spotify:track:PRE${i}`,
    blob: new Blob(["x"], { type: "video/mp4" }),
    filename: "old.mp4",
  }));
  const mock = indexedDbWithTransactions(initial);
  globalThis.indexedDB = mock;
  try {
    const file = new File(["new"], "new.mp4", { type: "video/mp4" });
    const results = await Promise.allSettled([
      media.saveWallpaper("spotify:track:NEWONE", file),
      media.saveWallpaper("spotify:track:NEWTWO", file),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal([...mock.data.keys()].filter((key) => key.startsWith("wallpaper:")).length, 12);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

test("Ein abgelehnter Import hinterlässt weder Video noch Vorschaubild", async () => {
  const previous = globalThis.indexedDB;
  const initial = Array.from({ length: 12 }, (_, i) => ({
    key: `wallpaper:spotify:track:PRE${i}`,
    blob: new Blob(["x"], { type: "video/mp4" }), filename: "old.mp4",
  }));
  const mock = indexedDbWithTransactions(initial);
  globalThis.indexedDB = mock;
  try {
    await assert.rejects(media.saveWallpaper(
      "spotify:track:NEW", new File(["x"], "new.mp4", { type: "video/mp4" }),
      new Blob(["image"], { type: "image/png" }),
    ), /Maximal 12/);
    assert.equal(mock.data.has("wallpaper:spotify:track:NEW"), false);
    assert.equal(mock.data.has("thumbnail:spotify:track:NEW"), false);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

test("Gelöschtes Video wird durch nachträgliche Clip-/Thumbnail-Aktion nicht wieder erzeugt", async () => {
  const previous = globalThis.indexedDB;
  const mock = indexedDbWithTransactions();
  globalThis.indexedDB = mock;
  try {
    const uri = "spotify:track:REMOVED";
    await assert.rejects(media.saveWallpaperClip(uri, { start: 0, end: null }), /nicht mehr/);
    await assert.rejects(media.saveWallpaperThumbnail(uri, new Blob(["picture"], { type: "image/jpeg" })), /nicht mehr/);
    assert.deepEqual([...mock.data.keys()], [], "Keine Wiederherstellung eines gelöschten Blobs");
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

// Die Szene braucht ihre Importabhängigkeiten nur für das Laden des Moduls.
const web = asUrl(await source("../src/custom-app/modules/visualizer/web-wallpaper.ts"));
const folder = asUrl(await source("../src/custom-app/modules/visualizer/scene-folder.ts"));
const projectCode = (await source("../src/custom-app/modules/visualizer/wallpaper-project.ts"))
  .replace('from "./web-wallpaper"', `from "${web}"`);
const project = asUrl(projectCode);
const sceneSource = (await source("../src/custom-app/modules/visualizer/scene-store.ts"))
  .replace('from "./media-store"', `from "${asUrl(await source("../src/custom-app/modules/visualizer/media-store.ts"))}"`)
  .replace('from "./scene-folder"', `from "${folder}"`)
  .replace('from "./wallpaper-project"', `from "${project}"`);
const sceneStore = await import(asUrl(sceneSource));

test("Verwaiste Dateien werden beim Löschen auch ohne Szene-Metadatensatz entfernt", async () => {
  const previous = globalThis.indexedDB;
  const sceneId = "scene-12345678";
  const blobs = new Map([
    [`${sceneId}:a.png`, { key: `${sceneId}:a.png`, sceneId, path: "a.png", blob: new Blob([1]) }],
    [`${sceneId}:js/app.js`, { key: `${sceneId}:js/app.js`, sceneId, path: "js/app.js", blob: new Blob([2]) }],
    ["scene-another00:image.png", { key: "scene-another00:image.png", sceneId: "scene-another00", path: "image.png", blob: new Blob([3]) }],
  ]);
  const scenes = new Map();
  globalThis.indexedDB = {
    open() {
      const db = {
        objectStoreNames: { contains: () => false },
        createObjectStore() { return { createIndex() {} }; }, close() {},
        transaction() {
          const tx = { oncomplete: null, onabort: null, onerror: null, error: null };
          const store = (map) => ({
            index() { return { getAll(id) {
              const request = { result: undefined, onsuccess: null, onerror: null };
              queueMicrotask(() => { request.result = [...blobs.values()].filter((v) => v.sceneId === id); request.onsuccess?.(); });
              return request;
            } }; },
            delete(key) { map.delete(key); queueMicrotask(() => tx.oncomplete?.()); },
          });
          return { ...tx, objectStore(name) { return store(name === "scene-files" ? blobs : scenes); },
            set oncomplete(fn) { tx.oncomplete = fn; }, set onabort(fn) { tx.onabort = fn; },
            set onerror(fn) { tx.onerror = fn; }, get error() { return tx.error; },
          };
        },
      };
      const req = { result: db, onsuccess: null, onupgradeneeded: null };
      queueMicrotask(() => { req.onupgradeneeded?.(); req.onsuccess?.(); });
      return req;
    },
  };
  try {
    await sceneStore.deleteScene(sceneId);
    assert.equal(blobs.size, 1);
    assert.ok(blobs.has("scene-another00:image.png"));
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});
