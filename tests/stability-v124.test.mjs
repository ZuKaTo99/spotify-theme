// =============================================================================
// Datei: tests/stability-v124.test.mjs
// Zweck: Regressionen für den abgeschlossenen Stabilisierungslauf.
//       Zwei parallele Großimporte dürfen kein 128-Szenen-Limit umgehen.
//       UI-Doppelaktionen müssen früh entdeckt werden.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}
function moduleUrl(text) {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(text, { mode: "strip" }))}`;
}
async function loadSceneModule() {
  const web = await source("../src/custom-app/modules/visualizer/web-wallpaper.ts");
  const media = await source("../src/custom-app/modules/visualizer/media-store.ts");
  const folder = await source("../src/custom-app/modules/visualizer/scene-folder.ts");
  const project = (await source("../src/custom-app/modules/visualizer/wallpaper-project.ts"))
    .replace('from "./web-wallpaper"', `from "${moduleUrl(web)}"`);
  const store = (await source("../src/custom-app/modules/visualizer/scene-store.ts"))
    .replace('from "./media-store"', `from "${moduleUrl(media)}"`)
    .replace('from "./scene-folder"', `from "${moduleUrl(folder)}"`)
    .replace('from "./wallpaper-project"', `from "${moduleUrl(project)}"`);
  return import(moduleUrl(store));
}

/**
 * IndexedDB-Testadapter: Readwrite-Transaktionen werden nacheinander
 * ausgeführt. `getAll()` einer wartenden Transaktion sieht deshalb die
 * Ergebnisse aller vorherigen schreibenden Transaktionen.
 */
function serializedIndexedDB() {
  const scenes = new Map();
  const files = new Map();
  let queue = Promise.resolve();
  return {
    open() {
      const db = {
        objectStoreNames: { contains: () => false },
        createObjectStore() { return { createIndex() {} }; },
        close() {},
        transaction(_names, mode) {
          let release = () => {};
          const ready = mode === "readwrite" ? new Promise((resolve) => {
            const previous = queue;
            queue = new Promise((unlock) => { release = unlock; });
            void previous.then(resolve);
          }) : Promise.resolve();
          let completed = false;
          const tx = {
            error: null, oncomplete: null, onabort: null, onerror: null,
            abort() {
              if (completed) return;
              completed = true;
              queueMicrotask(() => { tx.onabort?.(); release(); });
            },
            objectStore(name) {
              const map = name === "scene-files" ? files : scenes;
              const request = (read) => {
                const result = { result: undefined, error: null, onsuccess: null, onerror: null };
                void ready.then(() => queueMicrotask(() => {
                  result.result = read();
                  result.onsuccess?.();
                }));
                return result;
              };
              const finish = () => queueMicrotask(() => {
                if (!completed) { completed = true; tx.oncomplete?.(); release(); }
              });
              return {
                getAll: () => request(() => [...map.values()]),
                get: (id) => request(() => map.get(id)),
                index() { return { getAll: (id) => request(() => [...map.values()].filter((entry) => entry.sceneId === id)) }; },
                put(record) { map.set(record.key ?? record.id, record); finish(); },
                delete(id) { map.delete(id); finish(); },
              };
            },
          };
          return tx;
        },
      };
      const handle = { result: db, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => { handle.onupgradeneeded?.(); handle.onsuccess?.(); });
      return handle;
    },
  };
}
function importFiles(collection) {
  return Array.from({ length: 70 }, (_, index) => {
    const file = new File(["<html><body>wallpaper</body></html>"], "index.html", { type: "text/html" });
    Object.defineProperty(file, "webkitRelativePath", {
      value: `${collection}/${String(index).padStart(3, "0")}/index.html`,
    });
    return file;
  });
}

test("Großimporte parallel: Speicherprüfung und Schreiben sind atomar", async () => {
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = serializedIndexedDB();
  try {
    const store = await loadSceneModule();
    const results = await Promise.allSettled([
      store.importSceneFolder(importFiles("SetA")),
      store.importSceneFolder(importFiles("SetB")),
    ]);
    assert.equal(results.filter((value) => value.status === "fulfilled").length, 1);
    assert.equal(results.filter((value) => value.status === "rejected").length, 1);
    const scenes = await store.listScenes();
    assert.equal(scenes.length, 70, "Keine 140 Szenen aus zwei konkurrierenden Importen");
    assert.equal((await store.loadSceneProject(scenes[0].id)).files.length, 1);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

test("Visualizer: Canvas-Retry darf nur einmal erscheinen", async () => {
  const text = await source("../src/custom-app/modules/visualizer/Visualizer.tsx");
  assert.equal((text.match(/className="zukato-viz__retry-canvas"/g) ?? []).length, 1);
});

test("Audio: sämtliche Freigabe-Listener werden beim Stop entfernt", async () => {
  const text = await source("../src/custom-app/modules/visualizer/useMicrophoneSpectrum.ts");
  assert.match(text, /for \(const track of old\.tracks\) track\.removeEventListener\("ended", old\.onEnded\)/);
});

test("Song-Notizen: bewusst ausgewählter Titel bleibt beim Spotify-Songwechsel aktiv", async () => {
  const text = await source("../src/custom-app/modules/song-notes/SongNotes.tsx");
  assert.match(text, /if \(!manualSelection\.current\) setActive\(currentTrack\(\)\)/);
  assert.match(text, /manualSelection\.current = true/);
  assert.match(text, /manualSelection\.current = false/);
});
