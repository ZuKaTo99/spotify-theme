// =============================================================================
// Datei: tests/named-collections-backup-v176.test.mjs
// Zweck: Neue Sammlungen im bestehenden Backup tatsächlich exportieren,
// prüfen und wiederherstellen. Kein Spotify- oder Dateisystem-Schreibzugriff.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import esbuild from "esbuild";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const validation = loadPureSharedModule(root, "src/shared/backup-validation.ts");
const source = path.join(root, "src/extension/modules/playlist-tools/named-collections/NamedCollections.ts");
const code = esbuild.buildSync({entryPoints: [source], bundle: true, platform: "node",
  format: "cjs", write: false}).outputFiles[0].text;
const named = {exports: {}};
new Function("module", "exports", code)(named, named.exports);
const {NAMED_COLLECTIONS_STORAGE_KEY: key} = named.exports;
const uri = "spotify:track:0000000000000000000001";
const collections = () => ({schemaVersion: 1, activeCollectionId: "id-1", collections: [
  {id: "id-1", name: "Workout", trackUris: [uri], createdAt: 10, updatedAt: 10}],
  trackDetails: {[uri]: {title: "Lied", artist: "Künstler", album: "Album"}}});
const backup = (namedCollections) => ({format: "zukato-toolkit-backup", version: 1,
  settings: {schemaVersion: 3}, library: {history: [], favorites: [], notes: []},
  ...(namedCollections === undefined ? {} : {namedCollections})});

/** Alle anderen Backup-Bereiche bleiben als einfache Zustände im Test-RAM. */
function harness(raw = null) {
  const values = new Map(raw === null ? [] : [[key, raw]]);
  const writes = [];
  const captures = [];
  let prompt = "";
  let failCollectionWrite = false;
  const exports = {};
  const storage = {
    getItem: name => values.get(name) ?? null,
    setItem: (name, value) => {
      if (name === key && failCollectionWrite) throw Error("quota");
      writes.push([name, value]); values.set(name, value);
    },
    removeItem: name => {writes.push([name, null]); values.delete(name);},
  };
  const window = {localStorage: storage, confirm: text => {prompt = text; return true;},
    setTimeout: () => 0};
  const document = {body: {append() {}}, createElement: () =>
    ({click() {}, remove() {}, href: "", download: ""})};
  const fakeUrl = {createObjectURL: blob => {captures.push(blob); return "blob:test";}, revokeObjectURL() {}};
  const plain = (initial) => ({load: () => initial, save: value => {writes.push(["other", value]); return value;},
    normalize: value => value});
  const settings = plain({schemaVersion: 3});
  const library = plain({history: [], favorites: [], notes: []});
  const palette = plain("emerald");
  const visualizer = plain({version: 1});
  const scene = plain({playlists: {}});
  const presets = plain([]);
  const scenes = plain([]);
  runInNewContext(compileTsxForTest(root, "src/custom-app/modules/settings/DataBackup.tsx"), {
    exports, window, document, URL: fakeUrl, Blob, console,
    Spicetify: {React: {}, showNotification() {}},
    require: name => {
      if (name.includes("backup-validation")) return validation;
      if (name.includes("named-collections/NamedCollections")) return named.exports;
      if (name.includes("shared/appearance")) return {loadPalette: palette.load, savePalette: palette.save, normalizePalette: palette.normalize};
      if (name.includes("shared/library")) return {loadLibraryStrict: library.load, saveLibrary: library.save, normalizeLibrary: library.normalize};
      if (name.includes("shared/settings")) return {loadSettings: settings.load, saveSettings: settings.save, normalizeSettings: settings.normalize};
      if (name.includes("shared/visualizer-config")) return {
        loadVisualizerConfig: visualizer.load, saveVisualizerConfig: visualizer.save, normalizeVisualizerConfig: visualizer.normalize,
        loadVisualizerPresets: presets.load, replaceVisualizerPresets: presets.save,
        loadTrackVisualizerScenes: scenes.load, replaceTrackVisualizerScenes: scenes.save,
      };
      if (name.includes("shared/scene-playlists")) return {
        loadScenePreferences: scene.load, saveScenePreferences: scene.save, normalizeScenePreferences: scene.normalize,
      };
      throw Error(`Unexpected import: ${name}`);
    },
  }, {timeout: 4000});
  return {exports, values, writes, captures,
    blockCollectionWrites: () => {failCollectionWrite = true;},
    get prompt() {return prompt;}};
}

test("Backup-Export enthält Songs, Reihenfolge und Namen der benannten Sammlung", async () => {
  const ui = harness(JSON.stringify(collections()));
  ui.exports.exportBackup();
  assert.equal(ui.captures.length, 1);
  const data = JSON.parse(await ui.captures[0].text());
  assert.deepEqual(data.namedCollections, collections());
  assert.equal(ui.writes.length, 0);
});

test("Altes Backup ohne Sammlungen lässt den neuen Speicher unverändert", async () => {
  const old = JSON.stringify(collections());
  const ui = harness(old);
  const file = {size: 1000, text: async () => JSON.stringify(backup())};
  await ui.exports.importBackup(file);
  assert.equal(ui.values.get(key), old);
  assert.match(ui.prompt, /Benannte Sammlungen: bleiben erhalten/);
});

test("Defekte Sammlungen werden vor dem ersten Restore-Schreibzugriff abgelehnt", async () => {
  const ui = harness();
  const damaged = collections();
  damaged.collections[0].trackUris = [uri, uri];
  const file = {size: 1000, text: async () => JSON.stringify(backup(damaged))};
  await assert.rejects(() => ui.exports.importBackup(file), /doppelte oder fehlerhafte Daten/);
  assert.equal(ui.writes.length, 0);
});

test("Gültige Sammlungen werden erst nach der Bestätigung geschrieben", async () => {
  const ui = harness();
  const file = {size: 1000, text: async () => JSON.stringify(backup(collections()))};
  await ui.exports.importBackup(file);
  assert.deepEqual(JSON.parse(ui.values.get(key)), collections());
  assert.match(ui.prompt, /Benannte Sammlungen: 0 → 1/);
  assert.equal(ui.writes.at(-1)[0], key);
});

test("Beschädigte vorhandene Sammlungen werden nur nach sichtbarer Bestätigung ersetzt", async () => {
  const ui = harness("{defekt");
  await ui.exports.importBackup({size: 1000, text: async () => JSON.stringify(backup(collections()))});
  assert.match(ui.prompt, /beschädigte Daten → 1/);
  assert.deepEqual(JSON.parse(ui.values.get(key)), collections());
});

test("Speicherfehler bei Sammlungen rollt frühere Backup-Bereiche zurück", async () => {
  const old = JSON.stringify(collections());
  const ui = harness(old);
  ui.blockCollectionWrites();
  await assert.rejects(() => ui.exports.importBackup({size: 1000,
    text: async () => JSON.stringify(backup(collections()))}), /Vorheriger Zustand wiederhergestellt/);
  assert.equal(ui.values.get(key), old);
  assert.ok(ui.writes.filter(([name]) => name === "other").length > 1);
});
