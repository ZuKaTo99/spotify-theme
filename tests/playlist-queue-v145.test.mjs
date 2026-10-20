// =============================================================================
// Datei: tests/playlist-queue-v145.test.mjs
// Zweck: Queue-Blöcke, Reihenfolge, fehlende Spotify-Antworten und Teilfehler.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const queue = loadPureSharedModule(root, "src/shared/queue-batches.ts");
const track = (i) => `spotify:track:${String(i).padStart(22, "0")}`;

test("65 Einträge gehen geordnet in drei kleine Queue-Blöcke", async () => {
  const source = Array.from({ length: 65 }, (_, i) => track(i));
  const blocks = [];
  const result = await queue.enqueueQueueBatches(source, async (batch) => { blocks.push(batch); });
  assert.deepEqual(blocks.map((items) => items.length), [25, 25, 15]);
  assert.deepEqual(blocks.flat(), source);
  assert.equal(result.queued, 65);
  assert.equal(result.skipped, 0);
});

test("Nur gültige Titel und Episoden werden gesendet", async () => {
  const sent = [];
  const uriEpisode = `spotify:episode:${"x".repeat(22)}`;
  const result = await queue.enqueueQueueBatches(
    [track(1), "spotify:track:123", "https://evil.invalid", uriEpisode, ""],
    async (batch) => sent.push(...batch),
  );
  assert.deepEqual(sent, [track(1), uriEpisode]);
  assert.equal(result.queued, 2);
  assert.equal(result.skipped, 3);
});

test("Leere oder vollständig ungültige Auswahl schickt keinen Request", async () => {
  let called = 0;
  const result = await queue.enqueueQueueBatches(["broken"], async () => { called++; });
  assert.equal(called, 0);
  assert.equal(result.queued, 0);
  assert.equal(result.skipped, 1);
});

test("Spotify-Fehler nach erstem Block führt nicht zu doppelten Requests", async () => {
  const calls = [];
  await assert.rejects(
    queue.enqueueQueueBatches(Array.from({ length: 65 }, (_, i) => track(i)), async (batch) => {
      calls.push(batch);
      if (calls.length === 2) throw new Error("Spotify nicht erreichbar");
    }),
    (error) => error.name === "QueueBatchError" && error.queued === 25 && error.totalValid === 65,
  );
  assert.equal(calls.length, 2);
});

test("Fehler im ersten Block meldet null bestätigte Titel", async () => {
  await assert.rejects(
    queue.enqueueQueueBatches([track(1)], async () => { throw new Error("Timeout"); }),
    (error) => error.name === "QueueBatchError" && error.queued === 0,
  );
});

test("Wiederholte Titel bleiben auf Nutzerwunsch in der Queue", async () => {
  const sent = [];
  await queue.enqueueQueueBatches([track(1), track(1)], async (batch) => sent.push(...batch));
  assert.deepEqual(sent, [track(1), track(1)]);
});

test("React-Queue sperrt Doppelklicks sofort und meldet Teilfehler", () => {
  const src = readFileSync(path.join(root, "src/custom-app/modules/playlist-tools/PlaylistTools.tsx"), "utf8");
  assert.match(src, /if \(queueBusy\.current\) return;/);
  assert.match(src, /queueBusy\.current = true/);
  assert.match(src, /queueBusy\.current = false/);
  assert.match(src, /error instanceof QueueBatchError && error\.queued > 0/);
  assert.match(src, /disabled=\{working\}/);
  assert.match(src, /t\("playlist\.partial"/);
});

test("Titel-Listen haben lokalisierte und titelbezogene Play-Beschriftungen", () => {
  const list = readFileSync(path.join(root, "src/custom-app/components/TrackList.tsx"), "utf8");
  assert.match(list, /aria-label=\{`\$\{playLabel\}: \$\{track\.title\}/);
  for (const file of [
    "src/custom-app/modules/favorites/Favorites.tsx",
    "src/custom-app/modules/listening-history/ListeningHistory.tsx",
    "src/custom-app/modules/dashboard/Dashboard.tsx",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /<TrackList playLabel=\{t\("common\.play"\)\}/);
  }
});
