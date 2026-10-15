// =============================================================================
// Datei: tests/automatic-lyrics.test.mjs
// Zweck: LRCLIB-Integration OHNE echte Netzwerkanfrage regressionstesten.
// Jeder Test prüft den Originalquellcode; keine geklonte Testimplementierung.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/custom-app/modules/visualizer/automatic-lyrics.ts", import.meta.url), "utf8");
const api = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(source, { mode: "strip" }))}`);

const track = (suffix) => ({
  uri: `spotify:track:TESTAUTO${suffix}`, title: "My Test Song", artist: "Alice, Bob",
  album: "Example Album", durationMs: 200_000,
});
const record = (extra = {}) => ({
  id: 1234, trackName: "My Test Song", artistName: "Alice", albumName: "Example Album",
  duration: 201, instrumental: false,
  syncedLyrics: "[00:01.20]Hello\n[00:02.40]World", plainLyrics: "Hello\nWorld", ...extra,
});
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

/** Die Spotify-Metadaten schützen vor Lyrics anderer Songs / Live-Versionen. */
test("Auto-Lyrics: Song-/Künstler-/Dauer-Abgleich ist strikt", () => {
  assert.equal(api.matchesLyricsRecord(track("MATCH"), record()), true);
  assert.equal(api.matchesLyricsRecord(track("MATCH"), record({ trackName: "Wrong Track" })), false);
  assert.equal(api.matchesLyricsRecord(track("MATCH"), record({ artistName: "Completely Other" })), false);
  assert.equal(api.matchesLyricsRecord(track("MATCH"), record({ duration: 260 })), false);
  assert.equal(api.matchesLyricsRecord(track("MATCH"), record({ trackName: "My Test Song (Remastered)" })), true);
});

/** Die API kann LRC, reine Lyrics, leere Songs oder kaputte Records zurückgeben. */
test("Auto-Lyrics: Typen und Inhaltsgrenzen werden normalisiert", () => {
  assert.equal(api.parseLyricsRecord(record()).kind, "synced");
  assert.deepEqual(api.parseLyricsRecord(record({ syncedLyrics: null })).lines, ["Hello", "World"]);
  assert.equal(api.parseLyricsRecord(record({ instrumental: true })).kind, "instrumental");
  assert.equal(api.parseLyricsRecord(record({ syncedLyrics: null, plainLyrics: null })), null);
  assert.equal(api.parseLyricsRecord(record({ id: "evil" })), null);
  assert.equal(api.parseLyricsRecord(record({ syncedLyrics: null, plainLyrics: "ab\n".repeat(300) })).lines.length, 250);
});

/** Erst /get mit Album+Dauer; Treffer sofort verwenden und Quelle nachweisen. */
test("Auto-Lyrics: synchronisierte Zeilen per genauer Signatur laden", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return response(record());
  };
  const result = await api.lookupAutomaticLyrics(track("EXACT"), { fetcher, sleep: async () => {} });
  assert.equal(result.kind, "synced");
  assert.equal(result.sourceId, 1234);
  assert.match(result.text, /\[00:01.20\]Hello/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, "/api/get");
  assert.equal(calls[0].url.searchParams.get("album_name"), "Example Album");
  assert.equal(calls[0].url.searchParams.get("duration"), "200");
  assert.ok(calls[0].init.headers["Lrclib-Client"].includes("ZuKaTo"));
  // Der zweite Aufruf zur selben Song-URI ist ein RAM-Cache-Treffer.
  await api.lookupAutomaticLyrics(track("EXACT"), { fetcher, sleep: async () => {} });
  assert.equal(calls.length, 1);
});

/** Ein falscher direkter Treffer darf nicht als Liedtext des Users erscheinen. */
test("Auto-Lyrics: bei 404 oder falschen Treffern genau eine Suche nachschalten", async () => {
  const requests = [];
  const fetcher = async (url) => {
    const path = new URL(url).pathname;
    requests.push(path);
    return path === "/api/get" ? response({ error: "not found" }, 404)
      : response([record({ trackName: "Wrong Song" }), record({ syncedLyrics: null })]);
  };
  const result = await api.lookupAutomaticLyrics(track("FALLBACK"), { fetcher, sleep: async () => {} });
  assert.equal(result.kind, "plain");
  assert.deepEqual(requests, ["/api/get", "/api/search"]);
});

/** Keine UI-Sperre bei einem instrumental markierten Titel; saubere Statusanzeige. */
test("Auto-Lyrics: instrumental und nicht gefundene Titel als Status", async () => {
  const instrumental = await api.lookupAutomaticLyrics(track("INSTRUMENTAL"), {
    fetcher: async () => response(record({ instrumental: true })), sleep: async () => {},
  });
  assert.deepEqual(instrumental, { kind: "instrumental" });
  const missing = await api.lookupAutomaticLyrics(track("NOTFOUND"), {
    fetcher: async () => response({ error: "not found" }, 404), sleep: async () => {},
  });
  assert.deepEqual(missing, { kind: "not-found" });
  assert.equal((await api.lookupAutomaticLyrics({ ...track("INVALID"), uri: "spotify:episode:1" })).kind, "not-found");
});

/** Ein abgebrochener Request darf nicht die Lyrics des neuen Titels überschreiben. */
test("Auto-Lyrics: abgebrochene Requests werden nicht fortgesetzt", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.lookupAutomaticLyrics(track("ABORT"), { signal: controller.signal }), /Abgebrochen/);
});

/** 429 ist kein 404: Respekt vor LRCLIB-Rate-Limit statt weiterer Suchanfragen. */
test("Auto-Lyrics: Retry-After begrenzen und nach HTTP 429 nicht weiter suchen", async () => {
  assert.equal(api.parseRetryAfter("9", 1000), 9000);
  assert.equal(api.parseRetryAfter("99999", 1000), 3_600_000);
  assert.equal(api.parseRetryAfter("garbage", 1000), 60000);
  let calls = 0;
  const result = await api.lookupAutomaticLyrics(track("RATELIMIT"), {
    fetcher: async () => { calls += 1; return response({ error: "busy" }, 429, { "Retry-After": "12" }); },
    sleep: async () => {},
  });
  assert.equal(result.kind, "rate-limited");
  assert.equal(calls, 1);
});
