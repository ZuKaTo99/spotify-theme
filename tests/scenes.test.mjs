// =============================================================================
// Datei: tests/scenes.test.mjs
// Zweck: Echte Modul-Logik für HTML-Import, Song-Diashow und sichere Online-URLs.
// Tests nutzen Quell-TS ohne Kopien, via Node stripTypeScriptTypes.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";

async function moduleFromSource(path) {
  const content = await readFile(new URL(path, import.meta.url), "utf8");
  const js = stripTypeScriptTypes(content, { mode: "strip", sourceUrl: path });
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`);
}

const playlist = await moduleFromSource("../src/shared/scene-playlists.ts");
const web = await moduleFromSource("../src/custom-app/modules/visualizer/web-wallpaper.ts");
const uri = "spotify:track:ABCD123";
const sceneA = "scene-aaaaaaaa";
const sceneB = "scene-bbbbbbbb";

/** Wichtigste Regel: jede neue Song-URI ODER Repeat bekommt genau EINEN Slot. */
test("Wallpaper-Ordner: ein Wallpaper pro Song; erst beim nächsten Titel zurück auf Anfang", () => {
  const settings = playlist.normalizeScenePreferences({
    mode: "wallpapers", playlists: { default: [sceneA, sceneB] },
    originals: { default: "https://media.example.net/default.webm" },
  });
  assert.deepEqual(playlist.resolveScene(settings, uri, 0), { kind: "scene", id: sceneA });
  assert.deepEqual(playlist.resolveScene(settings, uri, 1), { kind: "scene", id: sceneB });
  assert.deepEqual(playlist.resolveScene(settings, uri, 2), { kind: "scene", id: sceneA });
  assert.deepEqual(playlist.resolveScene(settings, uri, 3), { kind: "scene", id: sceneB });
  assert.equal(playlist.nextWallpaperSongIndex(0), 1);
  assert.equal(playlist.nextWallpaperSongIndex(1), 2);
  // Die Szene hängt ausschließlich am Songzähler – Zeit, Pause, Seek spielen
  // hier bewusst KEINE Rolle. Ein Repeat löst ebenfalls songchange aus.
  assert.deepEqual(playlist.resolveScene(settings, uri, 0), { kind: "scene", id: sceneA });
});

test("Quellen-Schalter AUS benutzt nie heimlich HTML-Wallpapers", () => {
  const settings = playlist.normalizeScenePreferences({ mode: "original", playlists: { default: [sceneA] },
    originals: { default: "https://clips.example.net/v.webm" } });
  assert.equal(playlist.resolveScene(settings, uri, 0).kind, "original");
  assert.deepEqual(playlist.resolveScene({ ...settings, originals: {} }, uri, 0), { kind: "missing-original" });
  assert.deepEqual(playlist.resolveScene({ ...settings, mode: "wallpapers", originals: {} }, uri, 99),
    { kind: "scene", id: sceneA });
  assert.equal(playlist.resolveScene({ ...settings, mode: "wallpapers", originals: {}, playlists: {} }, uri, 0).kind, "legacy");
  assert.equal(playlist.sceneList(settings, uri)[0], sceneA);
});

test("Songzuordnung überschreibt Reihenfolge der Standard-Wallpaper", () => {
  const settings = playlist.normalizeScenePreferences({
    playlists: { default: [sceneA, sceneB], [uri]: [sceneB] },
  });
  for (const index of [0, 1, 2, 11]) {
    assert.deepEqual(playlist.resolveScene(settings, uri, index), { kind: "scene", id: sceneB });
  }
  assert.deepEqual(playlist.resolveScene(settings, "spotify:track:OTHER", 1), { kind: "scene", id: sceneB });
});

test("Online-Originale: nur überprüfbare direkte HTTPS-Video-URLs", () => {
  assert.equal(playlist.validateOriginalVideoUrl("   "), "");
  assert.equal(playlist.validateOriginalVideoUrl("https://media.example.com/v.mp4?x=2"), "https://media.example.com/v.mp4?x=2");
  for (const unsafe of ["javascript:alert(1)", "http://example.org/video.mp4", "https://youtube.com/watch?v=1",
    "https://user:pass@example.com/v.mp4", "https://localhost/video.webm", "file:///tmp/movie.webm",
    "https://cdn.example.com/x.exe", "https://example.com:8080/a.mp4"]) {
    assert.throws(() => playlist.validateOriginalVideoUrl(unsafe), /Nur direkte|Ungültige/);
  }
});

test("Originalvideo-Segmente: validierte, nicht-destruktive Start-/Endzeiten", () => {
  const input = playlist.normalizeScenePreferences({ mode: "original",
    originals: { [uri]: "https://clips.example.net/c.mp4" },
    originalRanges: { [uri]: { start: 12.5, end: 26.5 } },
  });
  assert.deepEqual(playlist.resolveScene(input, uri, 0).range, { start: 12.5, end: 26.5 });
  assert.deepEqual(playlist.validateOriginalRange(0, null), { start: 0, end: null });
  assert.throws(() => playlist.validateOriginalRange(12, 10), /Clip-Ende/);
  assert.throws(() => playlist.validateOriginalRange(-1, null), /Startsekunde/);
  assert.deepEqual(playlist.normalizeScenePreferences({ originalRanges: { [uri]: { start: -30, end: 100 } } }).originalRanges, {});
});

test("Playlist-Storage: korrupte und manipulierte Einträge werden entfernt", () => {
  const settings = playlist.normalizeScenePreferences({ mode: "other", slideSeconds: 0,
    playlists: { default: [sceneA, sceneA, "../../bad", sceneB], "file:/hack": [sceneA] },
    originals: { [uri]: "http://fake.example.com/clip.mp4", default: "https://cdn.example.com/a.mp4" },
  });
  assert.equal(settings.slideSeconds, 3);
  assert.equal(settings.mode, "wallpapers");
  assert.deepEqual(settings.playlists.default, [sceneA, sceneB]);
  assert.equal(Object.keys(settings.playlists).length, 1);
  assert.equal(settings.originals[uri], undefined);
  assert.deepEqual(playlist.withoutScene(settings, sceneA).playlists.default, [sceneB]);
});

test("HTML-Datei: internes CSP, Inline-Code und keinerlei erforderlicher Fremdhost", async () => {
  const file = new File(['<!doctype html><html><head><style>body{color:red}</style></head><body><script>document.body.dataset.ok="yes"</script></body></html>'], "index.html", { type: "text/html" });
  const packed = await web.packWebWallpaper([file]);
  const value = await packed.text();
  assert.match(value, /Content-Security-Policy/);
  assert.match(value, /connect-src 'none'/);
  assert.match(value, /document.body.dataset.ok/);
  assert.equal(packed.type, "text/html");
  assert.match(web.ensureWallpaperCsp(value), /frame-src 'none'/);
});

test("HTML-Projektordner: CSS, JS und Bilder bleiben lokal und im Paket", async () => {
  const files = [
    new File(['<html><head><link rel="stylesheet" href="style.css"></head><body><img src="a.png"><script src="effects.js"></script></body></html>'], "index.html"),
    new File(['body{background-image:url("a.png")}'], "style.css"),
    new File(['document.body.dataset.ready="true"'], "effects.js"),
    new File([new Uint8Array([137,80,78,71])], "a.png", { type: "image/png" }),
  ];
  for (const file of files) Object.defineProperty(file, "webkitRelativePath", { value: `my-wallpaper/${file.name}` });
  const data = await web.packWebWallpaper(files);
  const html = await data.text();
  assert.ok(!html.includes('src="effects.js"'));
  assert.ok(!html.includes('href="style.css"'));
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /document.body.dataset.ready/);
  assert.match(html, /background-image/);
});

test("HTML-Paket verweigert gefährliche Pfade, unbekannte Dateitypen und zu große Dateien", async () => {
  const file = new File(["<html></html>"], "index.html");
  const wrong = new File(["binary"], "evil.exe");
  await assert.rejects(() => web.packWebWallpaper([file, wrong]), /Nicht unterstützte/);
  const traversal = new File(["abc"], "x.png");
  Object.defineProperty(traversal, "webkitRelativePath", { value: "../x.png" });
  await assert.rejects(() => web.packWebWallpaper([file, traversal]), /Unsicherer Pfad/);
  const huge = new File([new Uint8Array(web.MAX_HTML_PROJECT_BYTES + 1)], "index.html");
  await assert.rejects(() => web.packWebWallpaper([huge]), /12 MiB/);
});

/** IndexedDB-Schreibcommit und Asset-Übersicht ohne Spotify/Electron simulieren. */
test("Szenenbibliothek: HTML/Video-Import, Löschen, Größenlimit und getrennte Legacy-Daten", async () => {
  // Kein nativer esbuild-Test: Das hochgeladene node_modules ist für Windows,
  // diese Prüfumgebung nutzt Linux. Node lädt Original-TS über Data-URLs.
  const toModuleUrl = (text, path) => `data:text/javascript;charset=utf-8,${encodeURIComponent(
    stripTypeScriptTypes(text, { mode: "strip", sourceUrl: path }))}`;
  const mediaSrc = await readFile(new URL("../src/custom-app/modules/visualizer/media-store.ts", import.meta.url), "utf8");
  const webSrc = await readFile(new URL("../src/custom-app/modules/visualizer/web-wallpaper.ts", import.meta.url), "utf8");
  const folderSrc = await readFile(new URL("../src/custom-app/modules/visualizer/scene-folder.ts", import.meta.url), "utf8");
  const sceneSrc = await readFile(new URL("../src/custom-app/modules/visualizer/scene-store.ts", import.meta.url), "utf8");
  const source = sceneSrc.replace('from "./media-store"', `from "${toModuleUrl(mediaSrc, "media-store.ts")}"`)
    .replace('from "./web-wallpaper"', `from "${toModuleUrl(webSrc, "web-wallpaper.ts")}"`)
    .replace('from "./scene-folder"', `from "${toModuleUrl(folderSrc, "scene-folder.ts")}"`);
  const sceneStore = await import(toModuleUrl(source, "scene-store.ts"));
  const oldIDB = globalThis.indexedDB;
  const contents = new Map();
  globalThis.indexedDB = {
    open() {
      const db = {
        objectStoreNames: { contains: () => false }, createObjectStore() {}, close() {},
        transaction() {
          const tx = { oncomplete: null, onabort: null, onerror: null, error: null, objectStore() {
            return {
              get(id) {
                const request = { result: undefined, onsuccess: null, onerror: null };
                queueMicrotask(() => { request.result = contents.get(id); request.onsuccess?.(); });
                return request;
              },
              getAll() {
                const request = { result: undefined, onsuccess: null, onerror: null };
                queueMicrotask(() => { request.result = [...contents.values()]; request.onsuccess?.(); });
                return request;
              },
              put(record) { contents.set(record.id, record); queueMicrotask(() => tx.oncomplete?.()); },
              delete(id) { contents.delete(id); queueMicrotask(() => tx.oncomplete?.()); },
            };
          } };
          return tx;
        },
      };
      const request = { result: db, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
      return request;
    },
  };
  try {
    const first = await sceneStore.importScene([new File(["<html><body>Hello</body></html>"], "index.html")]);
    const video = await sceneStore.importScene([new File(["webm"], "clip.webm", { type: "video/webm" })]);
    assert.equal(first.kind, "html");
    assert.equal(video.kind, "video");
    assert.equal((await sceneStore.listScenes()).length, 2);
    assert.match(await (await sceneStore.loadScene(first.id)).blob.text(), /Content-Security-Policy/);
    assert.equal((await sceneStore.loadScene(video.id)).blob.size, 4);
    // Ein echter Sammelordner erzeugt in EINER Speicherung zwei Einträge.
    const multi = await sceneStore.importSceneFolder([
      fileAt("Pack/01/index.html", '<html><body>Scene 1</body></html>'),
      fileAt("Pack/02/index.html", '<html><body>Scene 2</body></html>'),
      fileAt("Pack/02/css/style.css", "body {color: red}"),
    ]);
    assert.equal(multi.length, 2);
    assert.equal((await sceneStore.listScenes()).length, 4);
    assert.match(await (await sceneStore.loadScene(multi[1].id)).blob.text(), /Scene 2/);
    // Scheitert das Packen eines Projekts, kommt NICHT die Hälfte in die DB.
    await assert.rejects(() => sceneStore.importSceneFolder([
      fileAt("BadPack/01/index.html", "<html>valid</html>"),
      fileAt("BadPack/02/index.html", "<html>invalid asset</html>"),
      fileAt("BadPack/02/infected.exe", "bytes"),
    ]), /Nicht unterstützte/);
    assert.equal((await sceneStore.listScenes()).length, 4);
    assert.equal(await sceneStore.loadScene("wrong-id"), null);
    await assert.rejects(() => sceneStore.importScene([new File(["bad"], "virus.exe")]), /Videodatei/);
    await sceneStore.deleteScene(first.id);
    assert.equal((await sceneStore.listScenes()).length, 3);
    assert.ok(contents.has(video.id), "Löschen verändert nicht andere Szenen");
  } finally { if (oldIDB === undefined) delete globalThis.indexedDB; else globalThis.indexedDB = oldIDB; }
});

test("Wallpaper-Engine-Projekt: project.json wird als Metadatei ohne Runtime-API akzeptiert", async () => {
  const files = [new File(["<html><head></head><body>ok</body></html>"], "index.html"),
    new File(['{"title":"my wallpaper"}'], "project.json")];
  for (const file of files) Object.defineProperty(file, "webkitRelativePath", { value: `demo/${file.name}` });
  assert.match(await (await web.packWebWallpaper(files)).text(), /<body>ok/);
});

// -----------------------------------------------------------------------------
// Hier zählt die Ordnerstruktur als Vertrag: zwei Unterordner mit index.html
// sind ZWEI nacheinander abzuspielende Wallpapers – nicht EIN großes Projekt.
// -----------------------------------------------------------------------------
const folders = await moduleFromSource("../src/custom-app/modules/visualizer/scene-folder.ts");
function fileAt(path, content) {
  const file = new File([content], path.split("/").at(-1));
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

test("Ordner mit mehreren HTML-Projekten wird natürlich sortiert und vollständig gruppiert", async () => {
  const input = [
    fileAt("meine-Wallpapers/10 Blitz/index.html", '<html><body><img src="a.png"></body></html>'),
    fileAt("meine-Wallpapers/10 Blitz/a.png", "image"),
    fileAt("meine-Wallpapers/2 Regen/index.html", '<html><body><script src="a.js"></script></body></html>'),
    fileAt("meine-Wallpapers/2 Regen/a.js", 'document.body.dataset.ok="yes"'),
    fileAt("meine-Wallpapers/2 Regen/project.json", "{}"),
  ];
  const planned = folders.groupWallpaperFolderFiles(input);
  assert.deepEqual(planned.map((item) => item.name), ["2 Regen", "10 Blitz"]);
  assert.deepEqual(planned.map((item) => item.files.length), [3, 2]);
  const pack = await web.packWebWallpaper(planned[0].files);
  assert.match(await pack.text(), /document.body.dataset.ok/);
});

test("Ein einzelnes HTML-Projekt mit Assets bleibt EIN Wallpaper", () => {
  const result = folders.groupWallpaperFolderFiles([
    fileAt("Ein-Wallpaper/index.html", "<html></html>"),
    fileAt("Ein-Wallpaper/css/style.css", "body{}"),
    fileAt("Ein-Wallpaper/assets/a.png", "png"),
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].files.length, 3);
  assert.equal(result[0].name, "Ein-Wallpaper");
});

test("Ungültige Pfade im ausgewählten Wallpaper-Ordner werden verworfen", () => {
  assert.throws(() => folders.groupWallpaperFolderFiles([fileAt("wallpapers/../index.html", "<html></html>")]), /Unsicherer/);
  assert.throws(() => folders.groupWallpaperFolderFiles([fileAt("wallpapers/image.png", "png")]), /Kein HTML-Wallpaper/);
});

test("Originalclip-Manifest validiert alle Songs, URLs und Zeitgrenzen vor Import", () => {
  const result = playlist.parseOriginalClipManifest({
    format: "zukato-original-clips-v1",
    videos: [{ trackUri: uri, url: "https://media.example.net/song.mp4", start: 3, end: 18 },
      { trackUri: "default", url: "https://media.example.net/fallback.webm" }],
  });
  assert.equal(result.originals[uri], "https://media.example.net/song.mp4");
  assert.deepEqual(result.originalRanges[uri], { start: 3, end: 18 });
  assert.deepEqual(result.originalRanges.default, { start: 0, end: null });
  assert.throws(() => playlist.parseOriginalClipManifest({format:"zukato-original-clips-v1", videos:[
    {trackUri:uri, url:"https://example.net/good.mp4"}, {trackUri:uri, url:"https://example.net/second.mp4"},
  ]}), /doppelter/);
  assert.throws(() => playlist.parseOriginalClipManifest({format:"zukato-original-clips-v1", videos:[
    {trackUri:uri, url:"http://example.net/bad.mp4"},
  ]}), /HTTPS/);
});

// -----------------------------------------------------------------------------
// v1.7: Neue Playlists starten bei einem ausdrücklich festgelegten Songlauf.
// Vorherige Songs dürfen beim Import des Hauptordners nicht zum Zufallsindex
// in einem neu importierten Ordner führen.
// -----------------------------------------------------------------------------
test("Neue Playlist startet bei Ankerposition; alter Songzähler bleibt intakt", () => {
  const input = playlist.normalizeScenePreferences({
    playlists: { default: [sceneA, sceneB] }, starts: { default: 102 },
  });
  assert.equal(playlist.resolveScene(input, uri, 101).id, sceneA);
  assert.equal(playlist.resolveScene(input, uri, 102).id, sceneA);
  assert.equal(playlist.resolveScene(input, uri, 103).id, sceneB);
  assert.equal(playlist.resolveScene(input, uri, 104).id, sceneA);
  assert.deepEqual(playlist.normalizeScenePreferences({ playlists: { default: [sceneA] },
    starts: { default: -1, "evil-key": 100, [uri]: 6 } }).starts, {});
});

test("HTML-Wallpaper: verschachtelte CSS/JS-Pfade und unquotiertes url() funktionieren", async () => {
  const files = [
    new File(['<html><head><link rel="stylesheet" href="css/theme.css"></head><body><script src="js/animate.js"></script></body></html>'], "index.html"),
    new File(['body{background-image:url(../images/background.png)}'], "theme.css"),
    new File(['document.body.dataset.wallpaper="yes";'], "animate.js"),
    new File([new Uint8Array([1,2,3])], "background.png"),
  ];
  const paths = ["Collection/MyWeb/index.html", "Collection/MyWeb/css/theme.css",
    "Collection/MyWeb/js/animate.js", "Collection/MyWeb/images/background.png"];
  for (const [index, file] of files.entries()) Object.defineProperty(file, "webkitRelativePath", { value: paths[index] });
  const packed = await web.packWebWallpaper(files);
  const result = await packed.text();
  assert.doesNotMatch(result, /src="js\/animate\.js"/);
  assert.doesNotMatch(result, /href="css\/theme\.css"/);
  assert.doesNotMatch(result, /url\(\.\.\/images\/background\.png\)/);
  assert.match(result, /url\("data:image\/png;base64,/);
  assert.match(result, /zukato:player/);
  assert.match(result, /positionMs/);
  assert.match(result, /document\.body\.dataset\.wallpaper/);
});
