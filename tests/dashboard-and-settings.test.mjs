// =============================================================================
// Datei: tests/dashboard-and-settings.test.mjs
// Zweck: Neue Dashboard-Berechnungen und einheitliche Einstellungsstruktur
//        ohne Browser-, Netzwerk- oder Spotify-Live-Zugriff kontrollieren.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(import.meta.dirname, "..");

/** Compile only a pure TS module: type-only imports disappear. */
function loadSummary() {
  const file = "src/shared/dashboard-summary.ts";
  const output = ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: file,
  });
  const exports = {};
  runInNewContext(output.outputText, { exports, Map, Set });
  return exports;
}

const { summarizeDashboard } = loadSummary();
// Gleiches Transpile-Verfahren für die Cover-URL-Validierung.
function loadArtwork() {
  const file = "src/shared/artwork.ts";
  const output = ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: file,
  });
  const exports = {};
  runInNewContext(output.outputText, { exports, URL });
  return exports;
}

const a = (uri, artist) => ({ uri, title: uri, artist, album: "", playedAt: 123 });

test("Dashboard zählt nur gespeicherte Wechsel und einzigartige Songs", () => {
  const result = summarizeDashboard([a("one", "Künstlerin"), a("one", "Künstlerin"), a("two", "Anderer")]);
  assert.equal(result.changes, 3);
  assert.equal(result.distinct, 2);
  assert.equal(result.topArtist, "Künstlerin");
  assert.equal(result.latest.length, 3);
});

test("Dashboard-Verlauf ist auf fünf begrenzt und sortiert nicht unerwartet um", () => {
  const history = Array.from({ length: 8 }, (_, i) => a(String(i), i ? "Künstler" : ""));
  const result = summarizeDashboard(history);
  assert.equal(result.latest.length, 5);
  assert.equal(result.latest[0].uri, "0");
  assert.equal(result.latest[4].uri, "4");
});

test("Leeres Dashboard zeigt keine erfundenen Top-Künstler", () => {
  const result = summarizeDashboard([]);
  assert.equal(result.topArtist, null);
  assert.equal(result.changes, 0);
});

test("Einstellungen nutzen fünf Bereiche und zeigen nicht alle Panels gleichzeitig", () => {
  const source = readFileSync(path.join(root, "src/custom-app/modules/settings/SettingsModule.tsx"), "utf8");
  for (const tab of ["general", "wallpapers", "modules", "shortcuts", "data"]) {
    assert.match(source, new RegExp(`view === ["']${tab}["']`));
  }
  assert.match(source, /aria-current=/);
  const wallpaper = readFileSync(path.join(root, "src/custom-app/modules/settings/WallpaperSettings.tsx"), "utf8");
  assert.match(wallpaper, /<details/);
  assert.match(wallpaper, /showModeToggle=\{false\}/);
});

test("Cover-URLs akzeptieren nur offizielle Spotify-Bilder", () => {
  const { spotifyArtworkUrl } = loadArtwork();
  const id = "a".repeat(40);
  assert.equal(spotifyArtworkUrl(`spotify:image:${id}`), `https://i.scdn.co/image/${id}`);
  assert.equal(spotifyArtworkUrl(`https://i.scdn.co/image/${id}`), `https://i.scdn.co/image/${id}`);
  assert.equal(spotifyArtworkUrl(`https://i.scdn.co.evil.test/image/${id}`), null);
  assert.equal(spotifyArtworkUrl("javascript:alert(1)"), null);
});
