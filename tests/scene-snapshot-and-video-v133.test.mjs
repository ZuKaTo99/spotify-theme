// =============================================================================
// Datei: tests/scene-snapshot-and-video-v133.test.mjs
// Zweck: Regression für zwei echte Praxisfehler:
//   1. Update und Wiedergabe eines Projektordners dürfen niemals zwei
//      unterschiedliche IndexedDB-Versionen miteinander vermischen.
//   2. Video-Wallpapers dürfen erst nach CANPLAY gestartet werden; eine
//      spätere Freigabe darf den Spotify-Pausenstatus nicht ignorieren.
// Alle Tests verwenden den produktiven TypeScript-Code ohne Fake-Logik im
// Produkt selbst und ohne Verbindung zu einem Spotify-Konto.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const urlOf = (value) => `data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(value, { mode: "strip" }))}`;
async function source(name) {
  return readFile(new URL(`../src/custom-app/modules/visualizer/${name}`, import.meta.url), "utf8");
}
async function sceneModule() {
  const web = urlOf(await source("web-wallpaper.ts"));
  const project = urlOf((await source("wallpaper-project.ts")).replace('from "./web-wallpaper"', `from "${web}"`));
  const store = (await source("scene-store.ts"))
    .replace('from "./media-store"', `from "${urlOf(await source("media-store.ts"))}"`)
    .replace('from "./scene-folder"', `from "${urlOf(await source("scene-folder.ts"))}"`)
    .replace('from "./wallpaper-project"', `from "${project}"`);
  return import(urlOf(store));
}

test("Wallpaper-Update während des Ladens: Metadaten und Assets stammen aus einem Snapshot", async () => {
  const oldIndexedDB = globalThis.indexedDB;
  const id = "scene-aaaabbbb-ccccdddd";
  const oldEntry = { id, kind: "html", format: "project-v2", entry: "index.html",
    paths: ["index.html"], bytes: 7, blob: new Blob(), name: "Nebula", created: 1 };
  const newEntry = { ...oldEntry, entry: "web.html", paths: ["web.html"] };
  const oldFiles = [{ sceneId: id, path: "index.html", blob: new Blob(["OLD HTML"]) }];
  const newFiles = [{ sceneId: id, path: "web.html", blob: new Blob(["NEW HTML"]) }];
  let currentEntry = oldEntry, currentFiles = oldFiles, transactions = 0;
  globalThis.indexedDB = {
    open() {
      const db = {
        close() {}, objectStoreNames: { contains: () => true },
        transaction(stores, mode) {
          assert.deepEqual(stores, ["scenes", "scene-files"], "Beide Stores müssen in derselben Transaktion liegen");
          assert.equal(mode, "readonly");
          transactions += 1;
          // Datenbank-Momentaufnahme: noch während der ersten IDB-Antwort
          // schreibt ein anderer Vorgang die aktuelle Projektversion um.
          const snapshot = { entry: currentEntry, files: currentFiles };
          return { objectStore(name) {
            return name === "scenes" ? { get() { return request(snapshot.entry, true); } }
              : { index() { return { getAll() { return request(snapshot.files, false); } }; } };
          } };
        },
      };
      const opening = { result: db, onsuccess: null, onerror: null };
      queueMicrotask(() => opening.onsuccess?.());
      return opening;
    },
  };
  function request(value, simulateConcurrentReplacement) {
    const req = { result: value, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      if (simulateConcurrentReplacement) {
        currentEntry = newEntry;
        currentFiles = newFiles;
      }
      req.onsuccess?.();
    });
    return req;
  }
  try {
    const store = await sceneModule();
    const loaded = await store.loadSceneProject(id);
    assert.equal(transactions, 1, "Zweite Transaktion darf kein neues Asset-Set lesen");
    assert.deepEqual(loaded.files.map((file) => file.path), ["index.html"]);
    assert.equal(await loaded.files[0].blob.text(), "OLD HTML");
  } finally {
    if (oldIndexedDB === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = oldIndexedDB;
  }
});

test("Video-Lifecycle: Datenladezeit, Pause und verspätete Freigabe", async () => {
  const helper = await import(urlOf(await source("canvas-playback.ts")));
  const player = { readyState: 0, paused: true, plays: 0, pauses: 0,
    play() { this.plays++; this.paused = false; return Promise.resolve(); },
    pause() { this.pauses++; this.paused = true; } };
  let failures = 0;
  helper.syncCanvasVideoPlayback(player, true, () => { failures++; });
  assert.equal(player.plays, 0, "Keine Wiedergabe vor geladenen Mediendaten");
  player.readyState = 3;
  helper.syncCanvasVideoPlayback(player, false, () => { failures++; });
  assert.equal(player.plays, 0, "Spotify-Pause während der Ladezeit hat Vorrang");
  helper.syncCanvasVideoPlayback(player, true, () => { failures++; });
  assert.equal(player.plays, 1, "Nach canplay einmal starten");
  helper.syncCanvasVideoPlayback(player, false, () => { failures++; });
  assert.equal(player.paused, true);
  assert.equal(failures, 0);
});

test("Beide Wallpaper-Videoplayer verwenden den einheitlichen CANPLAY-/Pause-Lebenszyklus", async () => {
  const scene = await source("SceneBackdrop.tsx");
  const video = await source("WallpaperBackdrop.tsx");
  assert.match(scene, /onCanPlay=\{\(event\) => \{/);
  assert.match(scene, /syncCanvasVideoPlayback\(video, playingRef\.current/);
  assert.match(video, /onCanPlay=\{\(event\) => synchronizeLayerVideo\(event\.currentTarget\)\}/);
  assert.match(video, /syncCanvasVideoPlayback\(video, callbacks\.current\.playing/);
});
