// =============================================================================
// Datei: audio-performance-v138.test.mjs
// Zweck: Reale Policy-Funktionen und Quellen-Vertraege der Ressourcen-Optimierung.
// Keine Spotify-Zugangsdaten, keine Audiofreigabe und kein Electron erforderlich.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const rules = await read("../src/custom-app/modules/visualizer/audio-performance.ts");
const policy = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(rules, { mode: "strip" }))}`);
const hook = await read("../src/custom-app/modules/visualizer/useMicrophoneSpectrum.ts");
const session = await read("../src/custom-app/modules/visualizer/audio-session.ts");
const scene = await read("../src/custom-app/modules/visualizer/SceneBackdrop.tsx");
const app = await read("../src/custom-app/modules/visualizer/Visualizer.tsx");

test("Canvas stoppt bei Pause, ausgeschaltetem Overlay und Hintergrund-Tab", () => {
  assert.equal(policy.shouldDrawSpectrum("ring", true, false), true);
  assert.equal(policy.shouldDrawSpectrum("bars", false, false), false);
  assert.equal(policy.shouldDrawSpectrum("wave", true, true), false);
  assert.equal(policy.shouldDrawSpectrum("off", true, false), false);
});

test("Nur eine spielende Audiofreigabe benoetigt 20-Hz-Polling", () => {
  assert.equal(policy.shouldPollWallpaperAudio(true, true), true);
  assert.equal(policy.shouldPollWallpaperAudio(true, false), false);
  assert.equal(policy.shouldPollWallpaperAudio(false, true), false);
  assert.equal(policy.shouldPollWallpaperAudio(false, false), false);
});

test("Große Vollbildbühnen begrenzen Canvas-Pixel und Zeichentakt", () => {
  assert.equal(policy.spectrumCanvasScale(320, 180, 2), 2);
  assert.equal(policy.spectrumCanvasScale(1920, 1080, 1), 5 / 6);
  assert.equal(policy.spectrumCanvasScale(3840, 2160, 2), 5 / 12);
  assert.equal(policy.spectrumFrameIntervalMs(3840, 2160), 1000 / 30);
  assert.equal(policy.spectrumFrameIntervalMs(320, 180), 1000 / 60);
});

test("Audio-Buffer bleiben ueber Animation, Signalpruefung und Wallpaper hinweg wiederverwendbar", () => {
  assert.match(session, /frequencyBytes: new Uint8Array\(analyser\.frequencyBinCount\)/);
  assert.match(session, /waveformBytes: new Uint8Array\(analyser\.fftSize\)/);
  assert.match(hook, /getByteFrequencyData\(resource\.frequencyBytes\)/);
  assert.match(hook, /return spectrum64FromByteBins\(resource\.frequencyBytes\)/);
  assert.doesNotMatch(hook, /const bytes = new Uint8Array\(resource\.analyser\.frequencyBinCount\)/);
});

test("RAF folgt der sichtbaren Bühne in Spotify oder im Desktop-Popup", () => {
  assert.match(hook, /document\.addEventListener\("visibilitychange", resumeVisible\)/);
  assert.match(hook, /document\.removeEventListener\("visibilitychange", resumeVisible\)/);
  assert.match(hook, /if \(visualizerHostHidden\(canvasRef\.current\)\) \{[\s\S]*?cancelFrame\(\)/);
  assert.match(hook, /frameHostRef\.current !== host/);
  assert.match(hook, /VISUALIZER_HOST_CHANGED_EVENT/);
  assert.match(hook, /if \(!canDraw && frameRef\.current !== null\) \{/);
  assert.match(hook, /scheduleFrame\(draw\)/);
});

test("HTML-Wallpaper bekommt bei Stille den letzten Frame, aber keinen Dauertimer", () => {
  assert.match(scene, /send\(\);\s*if \(!shouldPollWallpaperAudio\(playing, audioActive\)\) return;/);
  assert.match(scene, /host\.setInterval\(send, WALLPAPER_AUDIO_INTERVAL_MS\)/);
  assert.match(scene, /playing, audioActive, hostRevision\]\)/);
  assert.match(app, /audioActive=\{spectrum\.active\}/);
});
