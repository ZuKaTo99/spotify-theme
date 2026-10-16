// =============================================================================
// Datei: large-wallpaper-project.test.mjs
// Zweck: Realistische Projekte mit >60 Dateien, großen Blobs und Pfadtiefe
// durch Validierung, Sandbox-Dokument und verlustfreien ZIP-Export prüfen.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

async function loadSource(path, replace = (value) => value) {
  let code = await readFile(new URL(path, import.meta.url), "utf8");
  code = replace(code);
  return import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(code, { mode: "strip" }))}`);
}
const web = await loadSource("../src/custom-app/modules/visualizer/web-wallpaper.ts");
const project = await loadSource("../src/custom-app/modules/visualizer/wallpaper-project.ts", (s) =>
  s.replace('from "./web-wallpaper"', `from "data:text/javascript,${encodeURIComponent(stripTypeScriptTypes('export const WEB_WALLPAPER_CSP = '+JSON.stringify(web.WEB_WALLPAPER_CSP), {mode: "strip"}))}"`));
const exporter = await loadSource("../src/custom-app/modules/visualizer/wallpaper-export.ts");

function asFile(path, contents) {
  const file = new File([contents], path.split("/").at(-1));
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

function largeFiles() {
  const files = [
    asFile("MyCollection/Rain/index.html", '<html><head><link rel="stylesheet" href="css/main.css"></head><body><img src="images/background.png"><script src="js/main.js"></script></body></html>'),
    asFile("MyCollection/Rain/project.json", '{"title":"Regen"}'),
    asFile("MyCollection/Rain/css/main.css", '@import "partials/colors.css"; body {background-image:url(../images/background.png)}'),
    asFile("MyCollection/Rain/css/partials/colors.css", 'body { color: #fffffe; }'),
    asFile("MyCollection/Rain/js/main.js", 'document.body.dataset.loaded="yes";'),
    asFile("MyCollection/Rain/images/background.png", new Uint8Array(13 * 1024 * 1024)),
    asFile("MyCollection/Rain/models/scene.glb", new Uint8Array([1, 2, 3, 4])),
  ];
  for (let i = 0; i < 85; i++) files.push(asFile(`MyCollection/Rain/images/frame-${i}.png`, new Uint8Array([i])));
  return files;
}

test("Wallpaper: 92 Dateien und über 12 MiB ohne Base64-Zwang", () => {
  const prepared = project.prepareWallpaperProject(largeFiles());
  assert.equal(prepared.files.length, 92);
  assert.ok(prepared.bytes > 12 * 1024 * 1024);
  assert.equal(prepared.entry, "index.html");
  assert.equal(prepared.files.find((f) => f.path === "images/background.png").blob.size, 13 * 1024 * 1024);
  assert.ok(!("data" in prepared.files[0]));
});

test("Wallpaper: CSS-Imports, verschachtelte Bilder und Player-Brücke bleiben lokal", async () => {
  const source = project.prepareWallpaperProject(largeFiles());
  const result = await project.renderWallpaperProject(source);
  assert.match(result.html, /background-image:url\("zukato-asset:/);
  assert.match(result.html, /<style>body \{ color: #fffffe; \}/);
  assert.match(result.html, /document.body.dataset.loaded/);
  assert.match(result.html, /zukato:player/);
  assert.match(result.html, /Content-Security-Policy/);
  assert.match(result.bootstrap, /document\.write\(documentHtml\)/);
  assert.doesNotMatch(result.html, /data:image\/png;base64/);
  assert.doesNotMatch(result.html, /blob:example\//);
  assert.doesNotMatch(result.html, /src="js\/main.js"/);
  assert.equal(result.assets.length, 88);
  assert.equal(result.assets.find((a) => a.mime === "image/png")?.blob.size, 13 * 1024 * 1024);
  assert.ok(result.assets.every((a) => a.marker.startsWith("zukato-asset:")));
  result.dispose();
});

test("Wallpaper-ZIP erhält alle 92 Pfade und eine große Datei verlustfrei", async () => {
  const source = project.prepareWallpaperProject(largeFiles());
  const zip = await exporter.zipWallpaperProject(source.files);
  assert.equal(zip.type, "application/zip");
  const bytes = new Uint8Array(await zip.slice(0, 4).arrayBuffer());
  assert.deepEqual([...bytes], [0x50, 0x4b, 0x03, 0x04]);
  const central = new Uint8Array(await zip.arrayBuffer());
  const marker = [0x50, 0x4b, 0x05, 0x06];
  let found = false;
  for (let i = central.length - 22; i >= Math.max(0, central.length - 256); i--) {
    if (marker.every((value, j) => central[i + j] === value)) {
      const view = new DataView(central.buffer, central.byteOffset + i);
      assert.equal(view.getUint16(10, true), 92);
      found = true;
      break;
    }
  }
  assert.equal(found, true);
  assert.ok(zip.size > 13 * 1024 * 1024);
});

test("Projektpfade: Traversal, Duplikate und ausführbare Dateien blockiert", () => {
  assert.throws(() => project.prepareWallpaperProject([
    asFile("P/index.html", "<html/>"), asFile("P/../escape.js", "bad"),
  ]), /Unsicherer/);
  assert.throws(() => project.prepareWallpaperProject([
    asFile("P/index.html", "<html/>"), asFile("P/a.exe", "bad"),
  ]), /Nicht unterstützte/);
  assert.throws(() => project.prepareWallpaperProject([
    asFile("P/index.html", "<html/>"), asFile("P/INDEX.HTML", "<html/>"),
  ]), /Doppelte/);
  assert.equal(project.resolveProjectReference("../../../escape.js", "css/a.css"), null);
  assert.equal(project.resolveProjectReference("../images/a.png", "css/style.css"), "images/a.png");
});

// Das ist ein typisches großes Webprojekt: "web/" enthält die Einstiegseite,
// "js/", "fonts/" und "assets/" liegen direkt daneben. Relativpfade mit
// "../" müssen nach dem Import weiterhin auf die ursprünglichen Dateien zeigen.
test("Webprojekt: Einstieg in web/ erreicht JavaScript und Assets daneben", async () => {
  const prepared = project.prepareWallpaperProject([
    asFile("Regenweb/web/index.html",
      '<html><head></head><body><img src="../assets/bg.png"><script src="../js/app.js"></script></body></html>'),
    asFile("Regenweb/js/app.js", 'document.body.dataset.sibling="found"'),
    asFile("Regenweb/assets/bg.png", new Uint8Array([137, 80, 78, 71])),
    asFile("Regenweb/fonts/scene.woff2", new Uint8Array([1, 2])),
  ]);
  assert.equal(prepared.entry, "web/index.html");
  const rendered = await project.renderWallpaperProject(prepared);
  assert.match(rendered.html, /document\.body\.dataset\.sibling="found"/);
  assert.match(rendered.html, /<img src="zukato-asset:/);
  assert.doesNotMatch(rendered.html, /src="\.\.\/js\/app\.js"/);
  assert.equal(rendered.assets.length, 2);
  rendered.dispose();
});

// -----------------------------------------------------------------------------
// Browser-Isolation: Das HTML darf weder über Parent-Blob-URLs noch durch
// base64-Expansion von Großdateien funktionieren müssen. Das eigentliche
// Sandbox-iframe erzeugt die Blob-URLs erst nach postMessage innerhalb seines
// eigenen Origins; ein Chromium-Lauftest gehört zur Spotify-Live-Abnahme.
// -----------------------------------------------------------------------------
test("Sandbox-Bootstrap enthält lokale Blob-Freigaben ohne privilegierten Origin", async () => {
  const prepared = project.prepareWallpaperProject([
    asFile("Test/index.html", '<img src="pic.png">'),
    asFile("Test/pic.png", new Uint8Array([1, 2, 3])),
  ]);
  const original = URL.createObjectURL;
  try {
    URL.createObjectURL = () => { throw new Error("URLs dürfen nicht im Parent erzeugt werden"); };
    const runtime = await project.renderWallpaperProject(prepared);
    assert.equal(runtime.assets.length, 1);
    assert.match(runtime.html, /src="zukato-asset:0:"/);
    assert.match(runtime.bootstrap, /zukatoProjectInit/);
    assert.match(runtime.bootstrap, /document\.open\(\)/);
    assert.match(runtime.bootstrap, /URL\.createObjectURL/);
    assert.match(runtime.bootstrap, /img-src data: blob:/);
    assert.doesNotMatch(runtime.bootstrap, /allow-same-origin/);
  } finally { URL.createObjectURL = original; }
});

test("Komplexes HTML: srcset, Inline-CSS und CSS-Import mit Media Query", async () => {
  const prepared = project.prepareWallpaperProject([
    asFile("Gallery/index.html", '<head><style>@import "style/mobile.css" screen and (max-width: 500px);</style></head><picture><source srcset="images/a.png 1x, images/b.png 2x"><img src="images/a.png"></picture>'),
    asFile("Gallery/style/mobile.css", '@import "nested/colors.css"; .hero{background:url(../images/a.png)}'),
    asFile("Gallery/style/nested/colors.css", 'body{color:hotpink}'),
    asFile("Gallery/images/a.png", new Uint8Array([1])),
    asFile("Gallery/images/b.png", new Uint8Array([2])),
  ]);
  const rendered = await project.renderWallpaperProject(prepared);
  assert.match(rendered.html, /@media screen and \(max-width: 500px\)/);
  assert.match(rendered.html, /body\{color:hotpink\}/);
  assert.match(rendered.html, /srcset="zukato-asset:[^\"]+ 1x, zukato-asset:[^\"]+ 2x"/);
  assert.equal(rendered.assets.length, 2);
});
