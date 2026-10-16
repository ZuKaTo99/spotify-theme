// =============================================================================
// Datei: tests/spotify-canvas.test.mjs
// Zweck: Den Original-Canvas-Adapter OHNE echtes Spotify-Fenster testen.
// Keine Canvas-URL wird aus dem Internet geladen oder extrahiert.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  return import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source, { mode: "strip" }))}`);
}
const canvas = await load("../src/custom-app/modules/visualizer/spotify-canvas.ts");
const nativeLyrics = await load("../src/custom-app/modules/visualizer/spotify-lyrics-preview.ts");

test("Canvas: Nur HTTPS oder blob-URLs für HTML5-Video akzeptieren", () => {
  assert.equal(canvas.validCanvasUrl("https://example.test/canvas.mp4"), true);
  assert.equal(canvas.validCanvasUrl("blob:https://open.spotify.com/abcd"), true);
  for (const value of ["javascript:alert(1)", "data:video/mp4;base64,AAAA", "http://site.test/a.mp4", "file:///C:/video.mp4", ""]) {
    assert.equal(canvas.validCanvasUrl(value), false);
  }
});

test("Canvas: Nur für zum Song passende Now-Playing-Region übernehmen", () => {
  const video = { currentSrc: "https://cdn.test/canvas.mp4", closest: () => null };
  const region = {
    textContent: "BUSTER – $atori Zoom",
    closest: () => null,
    querySelectorAll: () => [video],
  };
  const root = { querySelectorAll: () => [region] };
  assert.equal(canvas.findNativeCanvas(root, "BUSTER")?.src, video.currentSrc);
  assert.equal(canvas.findNativeCanvas(root, "Unrelated Song"), null);
  assert.equal(canvas.findNativeCanvas({querySelectorAll: () => [{...region, closest: () => ({})}]}, "BUSTER"), null);
});

test("Spotify-Lyrics: eine native Vorschau ist keine synchronisierte Full-Lyrics-Quelle", () => {
  assert.equal(nativeLyrics.isLyricsPreviewLabel("Vorschau der Lyrics"), true);
  assert.equal(nativeLyrics.isLyricsPreviewLabel("Lyrics preview"), true);
  assert.equal(nativeLyrics.isLyricsPreviewLabel("Aktueller Song"), false);
  assert.deepEqual(nativeLyrics.readSpotifyLyricsPreview({ querySelectorAll: () => [] }), []);
});

const nativeProvider = await load("../src/custom-app/modules/visualizer/spotify-lyrics.ts");

test("Native Spotify Lyrics: synchronisierte Originalzeilen präzise formatieren", async () => {
  const payload = { lyrics: { syncType: "LINE_SYNCED", lines: [
    { startTimeMs: "1200", words: "Hello" }, { startTimeMs: "64420", words: "Second" },
  ] } };
  const result = nativeProvider.parseSpotifyLyricsPayload(payload);
  assert.deepEqual(result, { kind: "synced", text: "[00:01.200]Hello\n[01:04.420]Second" });
  const requests = [];
  const lookup = await nativeProvider.lookupSpotifyLyrics("spotify:track:ABC123", async (url) => {
    requests.push(url); return payload;
  });
  assert.deepEqual(lookup, result);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^https:\/\/spclient\.wg\.spotify\.com\/color-lyrics\/v2\/track\/ABC123/);
});

test("Native Spotify Lyrics: Fehler, ungetimte Lyrics und fremde Datensätze", async () => {
  assert.deepEqual(nativeProvider.parseSpotifyLyricsPayload({ lyrics: { syncType: "UNSYNCED", lines: [
    { words: "One" }, { words: "Two" },
  ] } }), { kind: "plain", lines: ["One", "Two"] });
  assert.equal(nativeProvider.parseSpotifyLyricsPayload({ lyrics: { lines: "bad" } }).kind, "unavailable");
  assert.equal((await nativeProvider.lookupSpotifyLyrics("https://site.test", async () => ({}))).kind, "unavailable");
  assert.equal((await nativeProvider.lookupSpotifyLyrics("spotify:track:ABC123", async () => { throw Error("blocked"); })).kind, "unavailable");
});

// Clientversionen liefern Cosmos-JSON manchmal unter `body` oder als String.
test("Spotify-Lyrics: begrenzte Cosmos-Wrapper auspacken, ohne Synchronisierung zu erfinden", () => {
  const inner = { lyrics: { syncType: "LINE_SYNCED", lines: [{ startTimeMs: "3000", words: "Hello" }] } };
  assert.deepEqual(nativeProvider.parseSpotifyLyricsPayload({ body: inner }), { kind: "synced", text: "[00:03.000]Hello" });
  assert.deepEqual(nativeProvider.parseSpotifyLyricsPayload({ data: JSON.stringify(inner) }), { kind: "synced", text: "[00:03.000]Hello" });
  assert.equal(nativeProvider.parseSpotifyLyricsPayload("x".repeat(400_001)).kind, "unavailable");
  assert.equal(nativeProvider.parseSpotifyLyricsPayload({ body: { body: { body: inner } } }).kind, "unavailable");
});
