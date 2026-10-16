// =============================================================================
// Datei: tests/folder-only-import-v123.test.mjs
// Zweck: End-to-end-Ordnervalidierung aus echten hochgeladenen Verzeichnisbäumen
//        und Wallpaper-Engine-Metadaten mit alternativer HTML-Startseite.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

async function fromSource(path, transform = (text) => text) {
  const source = transform(await readFile(new URL(path, import.meta.url), "utf8"));
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(source, { mode: "strip" }))}`);
}
const folders = await fromSource("../src/custom-app/modules/visualizer/scene-folder.ts");
const web = await fromSource("../src/custom-app/modules/visualizer/web-wallpaper.ts");
const project = await fromSource("../src/custom-app/modules/visualizer/wallpaper-project.ts", (source) =>
  source.replace('from "./web-wallpaper"',
    `from "data:text/javascript,${encodeURIComponent('export const WEB_WALLPAPER_CSP = '+JSON.stringify(web.WEB_WALLPAPER_CSP))}"`));

function file(path, contents) {
  const item = new File([contents], path.split("/").at(-1));
  Object.defineProperty(item, "webkitRelativePath", { value: path });
  return item;
}

test("Kein Einzeldatei-HTML-Import: Benutzer muss den kompletten Ordner wählen", async () => {
  assert.throws(() => folders.groupWallpaperFolderFiles([
    new File(["<html></html>"], "index.html"),
  ]), /vollständigen Wallpaper-Ordner/);
  const ui = await readFile(new URL("../src/custom-app/modules/visualizer/SceneManager.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /viz\.sceneImportFile|accept="\.html/);
  assert.match(ui, /webkitdirectory/);
});

test("Komplettes Projekt mit 130 Dateien und Geschwister-Assets bleibt EIN Import", () => {
  const files = [
    file("Bahn/web/index.html", "<script src='../js/a.js'></script>"),
    file("Bahn/js/a.js", "console.log('yes')"),
    file("Bahn/fonts/font.woff2", "font"),
    file("Bahn/models/car.glb", new Uint8Array([1, 2, 3])),
  ];
  for (let i = 0; i < 126; i++) files.push(file(`Bahn/assets/images/${i}.png`, new Uint8Array([i])));
  const grouped = folders.groupWallpaperFolderFiles(files);
  assert.equal(grouped.length, 1);
  const prepared = project.prepareWallpaperProject(grouped[0].files);
  assert.equal(prepared.files.length, 130);
  assert.equal(prepared.entry, "web/index.html");
  assert.ok(prepared.files.some(({ path }) => path === "models/car.glb"));
});

test("Sammelordner mit zwei verschachtelten Webprojekten trennt niemals ihre Assets", () => {
  const grouped = folders.groupWallpaperFolderFiles([
    file("Sammlung/10/web/index.html", "A"),
    file("Sammlung/10/assets/a.png", "A"),
    file("Sammlung/02/project.json", '{"file":"site/wallpaper.html"}'),
    file("Sammlung/02/site/wallpaper.html", "B"),
    file("Sammlung/02/assets/b.png", "B"),
  ]);
  assert.deepEqual(grouped.map(({ name }) => name), ["02", "10"]);
  assert.deepEqual(grouped.map(({ files }) => files.length), [3, 2]);
  assert.equal(grouped[0].files.every((item) => item.webkitRelativePath.includes("Sammlung/02/")), true);
});

test("Mehrere Wallpaper mit gemeinsamen Root-Assets werden abgelehnt statt abgeschnitten", () => {
  assert.throws(() => folders.groupWallpaperFolderFiles([
    file("Sammlung/01/index.html", "one"),
    file("Sammlung/02/index.html", "two"),
    file("Sammlung/shared/sun.png", "shared image"),
  ]), /Dateien außerhalb/);
});

test("Wallpaper Engine project.json kann eine alternative HTML-Datei ausdrücklich festlegen", async () => {
  const prepared = project.prepareWallpaperProject([
    file("Wallpaper/web/other.html", "Not chosen"),
    file("Wallpaper/web/wallpaper.html", "Chosen"),
    file("Wallpaper/project.json", '{"type":"web","file":"web/wallpaper.html"}'),
  ]);
  const resolved = await project.resolveWallpaperProjectEntry(prepared);
  assert.equal(resolved.entry, "web/wallpaper.html");
  const built = await project.renderWallpaperProject(resolved);
  assert.match(built.html, /Chosen/);
  assert.doesNotMatch(built.html, /Not chosen/);
});

test("Defekte Manifest-Verweise und uneindeutige Startseiten blockieren Import", async () => {
  const files = [
    file("W/web/a.html", "one"), file("W/web/b.html", "two"),
    file("W/project.json", '{"file":"../escape.html"}'),
  ];
  await assert.rejects(() => project.resolveWallpaperProjectEntry(project.prepareWallpaperProject(files)), /außerhalb/);
  files[2] = file("W/project.json", '{"file":"missing.html"}');
  await assert.rejects(() => project.resolveWallpaperProjectEntry(project.prepareWallpaperProject(files)), /fehlt/);
  files[2] = file("W/project.json", '{"title":"without entry"}');
  await assert.rejects(() => project.resolveWallpaperProjectEntry(project.prepareWallpaperProject(files)), /HTML-Startseite/);
});
