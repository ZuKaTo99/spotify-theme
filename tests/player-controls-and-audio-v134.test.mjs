// =============================================================================
// Datei: player-controls-and-audio-v134.test.mjs
// Zweck: Regressionstest für SVG-Buttons, Audiofreigabe und Nebula-Status.
// Tests lesen nur Quelltext / reine Hilfsfunktionen, benötigen keinen
// Spotify-Account und installieren keine Browser-Erweiterung.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const app = await read("../src/custom-app/modules/visualizer/Visualizer.tsx");
const controls = await read("../src/custom-app/modules/visualizer/PlayerControls.tsx");
const css = await read("../src/custom-app/app.scss");
const hook = await read("../src/custom-app/modules/visualizer/useMicrophoneSpectrum.ts");
const mini = await read("../src/extension/modules/mini-player/MiniPlayerModule.ts");
const captureSrc = await read("../src/custom-app/modules/visualizer/audio-capture.ts");
const capture = await import("data:text/javascript," + encodeURIComponent(stripTypeScriptTypes(captureSrc, { mode: "strip" })));

test("Player-Buttons verwenden SVG statt Emoji und besitzen sprechende Namen", () => {
  assert.match(app, /<PlayerControls playing=\{player\.playing\}/);
  assert.doesNotMatch(app, /[⏭⏮]/);
  assert.match(controls, /<svg/);
  assert.match(controls, /aria-label="Vorheriger Titel"/);
  assert.match(controls, /aria-label="Nächster Titel"/);
  assert.match(controls, /onToggle/);
  assert.match(css, /zukato-player-monitor__control--primary/);
  assert.match(mini, /createElementNS\("http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(mini, /[⏭⏮]/);
});

test("Ohne explizite Freigabe erscheinen klare Audiohinweise und Aktionen", () => {
  assert.match(app, /Visualizer wartet auf eine Audioquelle/);
  assert.match(app, /Spotify gibt keine FFT-Daten direkt frei/);
  assert.match(app, /Audiofreigabe aktiv, aber kein Ton erkannt/);
  assert.match(app, /spectrum\.startSystem\(\)/);
  assert.match(app, /spectrum\.start\(\)/);
  assert.match(app, /disabled=\{spectrum\.starting\}/);
  assert.match(hook, /setStarting\(true\)/);
  assert.match(hook, /setStarting\(false\)/);
  assert.match(app, /config\.spectrum === "off" \? "Spotify-Wallpaper empfängt Audio/);
});

test("Audiofehler werden präzise und ohne fremde Interna erklärt", () => {
  const rejected = new Error("Permission denied");
  rejected.name = "NotAllowedError";
  assert.match(capture.explainCaptureError(rejected, "system"), /Berechtigung wurde abgelehnt/);
  const missing = new Error("No device");
  missing.name = "NotFoundError";
  assert.match(capture.explainCaptureError(missing, "microphone"), /keine verfügbare Audioquelle/);
  const unsupported = new TypeError("invalid constraints");
  assert.match(capture.explainCaptureError(unsupported, "system"), /Mikrofon verwenden/);
  assert.equal(capture.explainCaptureError(new Error("Keine Tonspur"), "system"), "Keine Tonspur");
});

test("Projektversion bleibt auch bei einer Vorabversion in allen Dateien synchron", async () => {
  const pkg = JSON.parse(await read("../package.json"));
  const lock = JSON.parse(await read("../package-lock.json"));
  const readme = await read("../README.md");
  // Bis zur Prüfung im echten Spotify-Client kann ein Release Candidate stehen.
  // Die numerische Version und ein optionales rc-Suffix bleiben streng geprüft.
  assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-rc\.\d+)?$/);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.ok(readme.includes(`**v${pkg.version}**`));
});
