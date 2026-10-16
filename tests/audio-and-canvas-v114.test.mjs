// =============================================================================
// Datei: tests/audio-and-canvas-v114.test.mjs
// Zweck: Neue optionale Systemtonfreigabe und Canvas-Fallback offline prüfen.
// Testdaten sind rein künstlich; es werden keine Audio-/Videodateien erfasst.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";

async function load(path) {
  const code = await readFile(new URL(path, import.meta.url), "utf8");
  return import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(code, { mode: "strip" }))}`);
}
const audio = await load("../src/custom-app/modules/visualizer/audio-capture.ts");
const canvas = await load("../src/custom-app/modules/visualizer/spotify-canvas.ts");
const preview = await load("../src/custom-app/modules/visualizer/spotify-lyrics-preview.ts");

test("Bildschirmfreigabe fordert Audio an, ohne es fälschlich zu garantieren", () => {
  const options = audio.displayCaptureOptions();
  assert.equal(options.video, true);
  assert.equal(options.audio, true);
  assert.equal(options.systemAudio, "include");
});

test("Audiofreigabe ohne LIVE-Tonspur wird abgelehnt", () => {
  assert.throws(() => audio.requireLiveAudioTrack({ getAudioTracks: () => [] }), /keine aktive Tonspur/);
  assert.throws(() => audio.requireLiveAudioTrack({ getAudioTracks: () => [{ readyState: "ended" }] }), /keine aktive Tonspur/);
  const good = { kind: "audio", readyState: "live" };
  assert.equal(audio.requireLiveAudioTrack({ getAudioTracks: () => [{ readyState: "ended" }, good] }), good);
});

test("Beim Stoppen werden Audio UND Bildschirmvideo freigegeben", () => {
  let stopped = 0;
  const track = () => ({ stop() { stopped++; } });
  audio.releaseCapturedStream({ getTracks: () => [track(), track()] });
  audio.releaseCapturedStream(null);
  assert.equal(stopped, 2);
});

test("Canvas meldet den konkreten Grund, wenn kein Clip kopiert werden kann", () => {
  const region = (title, videos) => ({
    textContent: title, closest: () => null, querySelectorAll: () => videos,
  });
  const root = (regions) => ({ querySelectorAll: () => regions });
  assert.equal(canvas.inspectNativeCanvas(root([]), "BUSTER").kind, "no-sidebar");
  assert.equal(canvas.inspectNativeCanvas(root([region("Different Track", [])]), "BUSTER").kind, "different-track");
  assert.equal(canvas.inspectNativeCanvas(root([region("BUSTER", [])]), "BUSTER").kind, "no-video");
  const video = (src) => ({
    currentSrc: src, getAttribute: () => null, querySelector: () => null,
    closest: () => null, className: "",
  });
  assert.equal(canvas.inspectNativeCanvas(root([region("BUSTER", [video("media:unknown")])]), "BUSTER").kind, "unreadable-source");
  assert.deepEqual(canvas.findNativeCanvas(root([region("BUSTER", [video("https://video.test/canvas.mp4")])]), "BUSTER"), {
    src: "https://video.test/canvas.mp4",
  });
});

test("Teiltreffer eines Songtitels dürfen keinen falschen Clip übernehmen", () => {
  assert.equal(canvas.belongsToTrack("BUSTERS (Extended)", "BUSTER"), false);
  assert.equal(canvas.belongsToTrack("BUSTER · $atori Zoom", "BUSTER"), true);
  assert.equal(canvas.belongsToTrack("BUSTER", ""), false);
});

test("Fremde Lyrics-Vorschau bei Songwechsel erkennen", () => {
  assert.equal(preview.previewBelongsToTrack("BUSTER $atori Zoom Vorschau der Lyrics", "BUSTER"), true);
  assert.equal(preview.previewBelongsToTrack("BUSTERS – Another artist", "BUSTER"), false);
  assert.equal(preview.previewBelongsToTrack("Different Song Lyrics preview", "BUSTER"), false);
});
