// =============================================================================
// Datei: tests/visualizer-workspace.test.mjs
// Zweck: Neue Visualizer-Bedienung unabhängig vom echten Spotify testen.
// Wo ändern? Registerkarten, Zustand, Beschriftungen und Kinomodus.
// Medienfiles werden bei diesen Tests weder generiert noch überschrieben.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const src = await readFile(new URL("../src/shared/visualizer-workspace.ts", import.meta.url), "utf8");
const panel = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(src, { mode: "strip" }))}`);

/** Fake-SessionStorage simuliert gesperrte und gewöhnliche Spotify-Webviews. */
function withWindow(value, callback) {
  const previous = globalThis.window;
  globalThis.window = value;
  try { callback(); }
  finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
}

test("Visualizer: vier stabile Registerkarten und sicheres Standardpanel", () => {
  assert.deepEqual(panel.VISUALIZER_PANELS, ["wallpapers", "lyrics", "audio", "advanced"]);
  assert.equal(panel.normalizeVisualizerPanel("lyrics"), "lyrics");
  assert.equal(panel.normalizeVisualizerPanel("legacy"), "wallpapers");
  assert.equal(panel.normalizeVisualizerPanel("__proto__"), "wallpapers");
  assert.equal(panel.normalizeVisualizerPanel(null), "wallpapers");
});

test("Visualizer: letzter Tab bleibt für eine Sitzung erhalten", () => {
  const values = new Map();
  withWindow({ sessionStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } }, () => {
    assert.equal(panel.readVisualizerPanel(), "wallpapers");
    panel.rememberVisualizerPanel("audio");
    assert.equal(panel.readVisualizerPanel(), "audio");
  });
});

test("Visualizer: blockierter Sitzungsspeicher stört die Wiedergabe nicht", () => {
  withWindow({ get sessionStorage() { throw new Error("Storage denied"); } }, () => {
    assert.equal(panel.readVisualizerPanel(), "wallpapers");
    assert.doesNotThrow(() => panel.rememberVisualizerPanel("lyrics"));
  });
});

test("Visualizer: Quelle zeigt nur tatsächlich konfigurierte Medien", () => {
  assert.equal(panel.sourceStatus("scene", false), "wallpaper");
  assert.equal(panel.sourceStatus("original", false), "video");
  assert.equal(panel.sourceStatus("missing-original", true), "missing");
  assert.equal(panel.sourceStatus("legacy", true), "video");
  assert.equal(panel.sourceStatus("legacy", false), "empty");
});

test("Visualizer: Steuerung besitzt Quellschalter, Kinoansicht und Panels", async () => {
  const tsx = await readFile(new URL("../src/custom-app/modules/visualizer/Visualizer.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/custom-app/app.scss", import.meta.url), "utf8");
  const translations = await readFile(new URL("../src/shared/i18n.ts", import.meta.url), "utf8");
  assert.match(tsx, /setSceneSettings\(saveScenePreferences\(\{ \.\.\.loadScenePreferences\(\), mode \}\)\)/);
  assert.match(tsx, /VISUALIZER_PANELS\.map/);
  assert.match(tsx, /aria-pressed=\{cinemaMode\}/);
  assert.match(tsx, /activePanel === "wallpapers" && <>/);
  assert.match(tsx, /showModeToggle=\{false\}/);
  assert.match(css, /zukato-viz__panel-tabs/);
  for (const key of ["viz.cinemaEnter", "viz.cinemaExit", "viz.panel.lyrics", "viz.status.missing", "viz.switchToOriginals"]) {
    assert.equal(translations.split(`'${key}'`).length - 1, 2, `German and English: ${key}`);
  }
});
