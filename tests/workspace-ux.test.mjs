// =============================================================================
// Datei: tests/workspace-ux.test.mjs
// Zweck: Neue UX-Funktionen direkt am echten Quellcode prüfen, nicht nachbauen.
// Ausdrücklich KEIN Spotify-Live-Test; nur reine Logik und lokaler Speicher.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";

/** Node kann TypeScript-Typen entfernen, ohne Spicetify oder einen Browser zu starten. */
async function loadSource(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(source, { mode: "strip" }))}`);
}
const progress = await loadSource("../src/shared/player-progress.ts");
const navigation = await loadSource("../src/shared/workspace-navigation.ts");
const library = await loadSource("../src/shared/library.ts");

test("Dashboard: reale Songzeit und Fortschritt statt Fantasiewerten", () => {
  const sample = progress.normalizedPlayerProgress(30000, 180000);
  assert.equal(sample.elapsed, "0:30");
  assert.equal(sample.total, "3:00");
  assert.ok(Math.abs(sample.percent - 100 / 6) < 1e-9);
  assert.equal(progress.formatPlayerTime(3661000), "1:01:01");
  assert.equal(progress.formatPlayerTime(-1000), "0:00");
  assert.equal(progress.normalizedPlayerProgress(Infinity, 60000).percent, 0);
  assert.equal(progress.normalizedPlayerProgress(190000, 60000).percent, 100);
  assert.equal(progress.normalizedPlayerProgress(90000, 0).elapsed, "0:00");
  assert.equal(progress.normalizedPlayerProgress(NaN, NaN).percent, 0);
});

test("Navigation: Gruppen bleiben stabil, technische Feature-IDs bleiben unverändert", () => {
  assert.equal(navigation.workspaceGroup("dashboard"), "start");
  assert.equal(navigation.workspaceGroup("song-notes"), "library");
  assert.equal(navigation.workspaceGroup("theme-studio"), "creative");
  assert.equal(navigation.workspaceGroup("settings"), "system");
});

test("Navigation: deaktivierte und unbekannte Seiten werden sicher abgefangen", () => {
  assert.equal(navigation.resolveWorkspaceFeature("favorites", ["dashboard", "favorites", "settings"]), "favorites");
  assert.equal(navigation.resolveWorkspaceFeature("favorites", ["dashboard", "settings"]), "dashboard");
  assert.equal(navigation.resolveWorkspaceFeature("something-else", ["settings"]), "settings");
  assert.equal(navigation.resolveWorkspaceFeature(null, []), "settings");
});

test("Navigation: Sitzungsstorage fehlertolerant und optional", () => {
  const old = globalThis.window;
  const items = new Map();
  globalThis.window = { sessionStorage: { setItem: (k,v) => items.set(k,v), getItem: (k) => items.get(k) ?? null } };
  try {
    navigation.rememberWorkspaceFeature("visualizer");
    assert.equal(navigation.readWorkspaceFeature(), "visualizer");
    globalThis.window = { get sessionStorage() { throw new Error("gesperrt"); } };
    assert.doesNotThrow(() => navigation.rememberWorkspaceFeature("dashboard"));
    assert.equal(navigation.readWorkspaceFeature(), null);
  } finally { if (old === undefined) delete globalThis.window; else globalThis.window = old; }
});

test("Favoriten: Mehrfach hinzufügen ist idempotent und ändert keine bestehenden Notizen", () => {
  const oldSpicetify = globalThis.Spicetify;
  const oldWindow = globalThis.window;
  const oldEvent = globalThis.CustomEvent;
  const data = new Map();
  globalThis.Spicetify = { Platform: { LocalStorageAPI: {
    getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value),
  } } };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class { constructor(type, config) { this.type = type; this.detail = config.detail; } };
  try {
    const song = { uri: "spotify:track:4iV5W9uYEdYUVa79Axb7Rh", title: "Test", artist: "Artist", album: "Album" };
    library.setSongNote(song, "my note");
    assert.equal(library.addFavorite(song), true);
    assert.equal(library.addFavorite(song), false);
    assert.equal(library.loadLibrary().favorites.length, 1);
    assert.equal(library.loadLibrary().notes[0].text, "my note");
    assert.equal(library.addFavorite({ ...song, uri: "not-a-track" }), false);
    assert.equal(library.loadLibrary().favorites.length, 1);
  } finally {
    if (oldSpicetify === undefined) delete globalThis.Spicetify; else globalThis.Spicetify = oldSpicetify;
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldEvent === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = oldEvent;
  }
});
