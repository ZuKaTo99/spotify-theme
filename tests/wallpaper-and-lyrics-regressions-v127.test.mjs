// =============================================================================
// Datei: tests/wallpaper-and-lyrics-regressions-v127.test.mjs
// Zweck: Race-Conditions und echte Fehler der vorhandenen Funktionen belegen.
// Verwendet die produktiven reinen Funktionen, keine kopierte Testimplementierung.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

async function loadSource(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(source, { mode: "strip" }))}`);
}
const frames = await loadSource("../src/custom-app/modules/visualizer/current-wallpaper.ts");
const lyrics = await loadSource("../src/custom-app/modules/visualizer/automatic-lyrics.ts");
const canvas = await loadSource("../src/custom-app/modules/visualizer/spotify-canvas.ts");

test("Visualizer: Ein verzögertes Wallpaper des vorherigen Songlaufs wird nicht gerendert", () => {
  const old = { key: "4:scene-old", html: "OLD", assets: [new Blob(["private project"]) ] };
  assert.equal(frames.currentWallpaper(old, "5:scene-new", "key"), null);
  assert.equal(frames.currentWallpaper(old, "4:scene-old", "key"), old);
  assert.equal(frames.currentWallpaper(null, "5:scene-new", "key"), null);
});

test("Wallpaper-Manager: Alte Preview-Assets landen nie im neuen iframe", () => {
  const old = { id: "scene-old", html: "OLD", runtime: { assets: [new Blob(["image"]) ] } };
  assert.equal(frames.currentWallpaper(old, "scene-new", "id"), null);
  assert.equal(frames.currentWallpaper(old, "scene-old", "id"), old);
});

test("Auto-Lyrics: Gleich klingende Künstler-Teile sind KEINE sicheren Treffer", () => {
  const track = { uri: "spotify:track:ABCDEFG", title: "Moon", artist: "Joanna", durationMs: 180_000 };
  const row = { id: 7, trackName: "Moon", artistName: "Anna", duration: 180 };
  assert.equal(lyrics.matchesLyricsRecord(track, row), false);
  assert.equal(lyrics.matchesLyricsRecord({ ...track, artist: "Anna" }, { ...row, artistName: "Joanna" }), false);
  assert.equal(lyrics.matchesLyricsRecord({ ...track, artist: "Anna & Bob" }, { ...row, artistName: "Anna" }), true);
  assert.equal(lyrics.matchesLyricsRecord({ ...track, artist: "Alice Wonderland" }, { ...row, artistName: "Alice" }), true);
  assert.equal(lyrics.matchesLyricsRecord(track, { ...row, artistName: "Joanna" }), true);
});

test("Canvas: eine alte Songregion wird nicht mit neuem Künstler kombiniert", () => {
  const video = { currentSrc: "https://example.test/video.mp4", closest: () => null };
  const region = { textContent: "Moon - Anna", closest: () => null, querySelectorAll: () => [video] };
  const root = { querySelectorAll: () => [region] };
  assert.equal(canvas.inspectNativeCanvas(root, "Moon", "Joanna").kind, "different-track");
  assert.equal(canvas.inspectNativeCanvas(root, "Moon", "Anna").kind, "ready");
});

// JSX-Code wird hier NICHT nachgebaut. Diese Quelle-Checks stellen sicher,
// dass die getestete reine Frame-Regel in BEIDEN realen React-Ansichten hängt.
test("Integration: Bühne/Vorschau filtern alte Payloads und Videos verwenden kein native autoplay", async () => {
  const preview = await readFile(new URL("../src/custom-app/modules/visualizer/ScenePreview.tsx", import.meta.url), "utf8");
  const stage = await readFile(new URL("../src/custom-app/modules/visualizer/SceneBackdrop.tsx", import.meta.url), "utf8");
  const native = await readFile(new URL("../src/custom-app/modules/visualizer/SpotifyCanvasBackdrop.tsx", import.meta.url), "utf8");
  assert.match(preview, /currentWallpaper\(preview, id, "id"\)/);
  assert.match(stage, /currentWallpaper\(content, key, "key"\)/);
  assert.match(native, /sourceState\?\.trackUri === trackUri/);
  assert.doesNotMatch(native, /\bautoPlay\b/);
  assert.doesNotMatch(stage.replace(/\/\/[^\n]*\n/g, ""), /\bautoPlay\b/);
});
