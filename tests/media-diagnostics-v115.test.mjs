// =============================================================================
// Datei: tests/media-diagnostics-v115.test.mjs
// Zweck: Späte Spotify-Metadaten, echte Audioenergie und private Diagnose.
// Testet echte pure TypeScript-Module aus src/ (KEINE nachgebauten Funktionen).
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const js = stripTypeScriptTypes(source, { mode: "strip" });
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`);
}
const metadata = await load("../src/custom-app/modules/visualizer/lyrics-identity.ts");
const audio = await load("../src/custom-app/modules/visualizer/audio-capture.ts");
const diagnostics = await load("../src/custom-app/modules/visualizer/visualizer-diagnostics.ts");
const track = {
  uri: "spotify:track:TEST123", title: "BUSTER", artist: "$atori Zoom",
  album: "Test", duration: 141_000, progress: 10_000, playing: true,
};

test("Lyrics: späte Metadaten werden erkannt, Platzhalter nicht abgefragt", () => {
  assert.equal(metadata.lyricsMetadataReady(track), true);
  assert.equal(metadata.lyricsMetadataReady({ ...track, title: "Unbekannter Titel" }), false);
  assert.equal(metadata.lyricsMetadataReady({ ...track, artist: "Unbekannter Künstler" }), false);
  assert.equal(metadata.lyricsMetadataReady({ ...track, artist: "" }), false);
  assert.equal(metadata.lyricsMetadataReady({ ...track, uri: "spotify:episode:TEST" }), false);
});

test("Lyrics: Fortschritt, Pause und kleine Daueränderungen lösen keine neue Suche aus", () => {
  const initial = metadata.lyricsLookupSignature(track);
  assert.equal(initial, metadata.lyricsLookupSignature({ ...track, progress: 99_000, playing: false }));
  assert.equal(initial, metadata.lyricsLookupSignature({ ...track, duration: 141_100 }));
  assert.notEqual(initial, metadata.lyricsLookupSignature({ ...track, artist: "Another artist" }));
  assert.notEqual(initial, metadata.lyricsLookupSignature({ ...track, title: "BUSTER (Live)" }));
  assert.notEqual(initial, metadata.lyricsLookupSignature({ ...track, album: "Deluxe" }));
});

test("Audio: freigegebene, aber stumme Tonspur wird nicht als Signal ausgegeben", () => {
  assert.equal(audio.hasMeasuredAudioSignal(new Uint8Array(1024)), false);
  assert.equal(audio.hasMeasuredAudioSignal(new Uint8Array([11, 4, 8, 1, 0])), false);
  assert.equal(audio.hasMeasuredAudioSignal(new Uint8Array([12, 13, 14])), false);
  assert.equal(audio.hasMeasuredAudioSignal(new Uint8Array([1, 12, 13, 14, 15])), true);
  assert.equal(audio.hasMeasuredAudioSignal(new Uint8Array()), false);
});

const status = {
  hasTrack: true, metadataReady: true, originalMode: true,
  canvas: "unavailable", canvasReason: "unreadable-source",
  lyricsEnabled: true, lyrics: "waiting-metadata", spectrumEnabled: true,
  audioSource: "system", audioSignal: "silent",
  displayCaptureSupported: true, microphoneSupported: true,
};

test("Diagnose: unterscheidet Canvas-Fallback, Metadata-Warten und Stille", () => {
  const messages = diagnostics.diagnosticSummary(status).join("\n");
  assert.match(messages, /Albumcover/);
  assert.match(messages, /vollständige Songdaten/);
  assert.match(messages, /kein Signal messbar/);
  assert.match(diagnostics.diagnosticSummary({ ...status, audioSignal: "detected" }).join(" "), /Signal messbar/);
});

test("Diagnose: kopierbarer Bericht enthält weder Song-/Kontodaten noch URLs", () => {
  const report = diagnostics.buildSafeDiagnosticReport({ ...status, uri: "secret", title: "SECRET SONG", token: "secret-token" });
  assert.match(report, /ZuKaTo Visualizer/);
  assert.doesNotMatch(report, /SECRET SONG|secret-token|spotify:track:|https?:\/\//);
  assert.ok(report.length < 1000);
});
