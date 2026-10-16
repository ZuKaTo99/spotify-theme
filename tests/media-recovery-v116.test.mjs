// =============================================================================
// Datei: tests/media-recovery-v116.test.mjs
// Zweck: Regression für blockierte Lyrics-Body-Streams und Canvas-Neuladen.
// Diese Tests verwenden echte TypeScript-Quellen, aber keine Spotify-Anmeldung.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

/** TypeScript-Modul ohne Runtime-Imports im Testprozess ausführen. */
async function sourceModule(path) {
  const text = await readFile(new URL(path, import.meta.url), "utf8");
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(text, { mode: "strip" }))}`);
}
const lrclib = await sourceModule("../src/custom-app/modules/visualizer/automatic-lyrics.ts");
const spotifyCanvas = await sourceModule("../src/custom-app/modules/visualizer/spotify-canvas.ts");

/** Response-Headers allein beenden keinen Netzrequest: der Body kann hängen. */
test("Lyrics: hängender HTTP-Body wird nach Frist abgebrochen", async () => {
  const sample = { uri: "spotify:track:TIMEOUTBODY", title: "A Test Track", artist: "Tester", album: "Album", durationMs: 100_000 };
  let aborted = false;
  const fetcher = async (_url, init) => ({
    ok: true, status: 200, headers: { get: () => null },
    text: () => new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("body read cancelled"));
      }, { once: true });
    }),
  });
  const start = performance.now();
  const result = await lrclib.lookupAutomaticLyrics(sample, { fetcher, sleep: async () => {}, requestTimeoutMs: 35 });
  assert.equal(result.kind, "error");
  assert.equal(result.reason, "invalid-response");
  assert.equal(aborted, true, "Die Frist muss den Response-Body tatsächlich abbrechen.");
  assert.ok(performance.now() - start < 2_000, "Keine unendliche Ladeanzeige.");
});

/** Auch ein defekter Client, der Abort ignoriert, darf keinen endlosen Spinner erzeugen. */
test("Lyrics: selbst ein nicht abbrechbarer Antwortkörper wird begrenzt", async () => {
  const sample = { uri: "spotify:track:IGNORESIGNAL", title: "Test", artist: "Tester", durationMs: 100_000 };
  const fetcher = async () => ({ ok: true, status: 200, headers: { get: () => null },
    text: () => new Promise(() => {}) });
  const start = performance.now();
  const result = await lrclib.lookupAutomaticLyrics(sample, { fetcher, sleep: async () => {}, requestTimeoutMs: 30 });
  assert.equal(result.kind, "error");
  assert.ok(performance.now() - start < 2_000);
});

/** Abbruch beim Titelwechsel muss als Abbruch signalisiert werden, nicht gecacht. */
test("Lyrics: Titelwechsel bricht auch laufende Body-Übertragung ab", async () => {
  const controller = new AbortController();
  const track = { uri: "spotify:track:BODYABORT", title: "Example", artist: "Tester", durationMs: 80_000 };
  const fetcher = async (_url, init) => ({
    ok: true, status: 200, headers: { get: () => null },
    text: () => new Promise((_, reject) => {
      queueMicrotask(() => controller.abort());
      init.signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
    }),
  });
  await assert.rejects(
    lrclib.lookupAutomaticLyrics(track, { fetcher, signal: controller.signal, sleep: async () => {}, requestTimeoutMs: 500 }),
    /cancelled/,
  );
});

/** Canvas erkennt weiterhin nur gültige Videoquellen des aktuellen Titels. */
test("Canvas: Videowechsel und fehlende Quell-URL werden getrennt erkannt", () => {
  const video = { currentSrc: "https://cdn.test/track.mp4", closest: () => null,
    getAttribute: () => null, querySelector: () => null, className: "" };
  const region = { textContent: "Current Track von Artist", closest: () => null, querySelectorAll: () => [video] };
  const document = { querySelectorAll: () => [region] };
  assert.equal(spotifyCanvas.inspectNativeCanvas(document, "Current Track").kind, "ready");
  video.currentSrc = "";
  assert.equal(spotifyCanvas.inspectNativeCanvas(document, "Current Track").kind, "unreadable-source");
  assert.equal(spotifyCanvas.inspectNativeCanvas(document, "Other Track").kind, "different-track");
  // Derselbe Titel beim falschen Interpreten darf nie den alten Clip übernehmen.
  video.currentSrc = "https://cdn.test/track.mp4";
  assert.equal(spotifyCanvas.inspectNativeCanvas(document, "Current Track", "Artist").kind, "ready");
  assert.equal(spotifyCanvas.inspectNativeCanvas(document, "Current Track", "Other Artist").kind, "different-track");
});
