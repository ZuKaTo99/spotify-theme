// =============================================================================
// Datei: tests/lyrics-selection-v116.test.mjs
// Zweck: Anbieterwechsel ohne Datenverlust und ohne erfundene Zeitmarken.
// Importiert die echte Auswahlfunktion direkt aus dem TypeScript-Quellcode.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const code = await readFile(new URL("../src/custom-app/modules/visualizer/lyrics-source-selection.ts", import.meta.url), "utf8");
const { chooseLyricsSource } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(code, { mode: "strip" }))}`);

test("Lyrics-Priorität: Spotify synchronized schlägt LRCLIB", () => {
  const result = chooseLyricsSource({ kind: "synced", text: "[00:01.00]Spotify" },
    { kind: "synced", text: "[00:01.00]Community", sourceId: 5 });
  assert.deepEqual(result, { kind: "synced", source: "spotify", text: "[00:01.00]Spotify" });
});

test("Lyrics-Priorität: synchronisierte LRCLIB vor Spotify-Text ohne Zeitmarken", () => {
  const result = chooseLyricsSource({ kind: "plain", lines: ["Spotify plain"] },
    { kind: "synced", text: "[00:02.00]Community timed", sourceId: 7 });
  assert.deepEqual(result, { kind: "synced", source: "lrclib", text: "[00:02.00]Community timed" });
});

test("Lyrics-Priorität: Spotify-Text bei nicht verfügbarer LRCLIB-Antwort behalten", () => {
  for (const remote of [null, { kind: "not-found" }, { kind: "error", reason: "network" }, { kind: "rate-limited", retryAfterMs: 500 }]) {
    assert.deepEqual(chooseLyricsSource({ kind: "plain", lines: ["Existing"] }, remote),
      { kind: "plain", source: "spotify", lines: ["Existing"] });
  }
});

test("Lyrics-Priorität: LRCLIB-Text und fehlende Anbieter korrekt unterscheiden", () => {
  assert.deepEqual(chooseLyricsSource({ kind: "unavailable" }, { kind: "plain", lines: ["Plain"], sourceId: 9 }),
    { kind: "plain", source: "lrclib", lines: ["Plain"] });
  assert.deepEqual(chooseLyricsSource({ kind: "unavailable" }, { kind: "not-found" }), { kind: "missing" });
});
