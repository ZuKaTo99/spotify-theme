// =============================================================================
// Datei: tests/context-queue-v147.test.mjs
// Zweck: Echte Ausführung der Quick-Playlist-Kontextmenülogik mit Mock-Spotify.
// Testet neben der Batch-Hilfe insbesondere Doppelklicks und Teilfehler im Menü.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { QueueBatchError, enqueueQueueBatches } = loadPureSharedModule(root, "src/shared/queue-batches.ts");
const { createSingleFlight } = loadPureSharedModule(root, "src/shared/single-flight.ts");
const { parseSpotifyTrackInput } = loadPureSharedModule(root, "src/shared/track-search.ts");
const track = (index) => `spotify:track:${String(index).padStart(22, "0")}`;

/** Lädt ausschließlich das Modul in eine isolierte Laufzeit, ohne echtes Spotify. */
function createModule(submit = async () => {}) {
  const messages = [];
  const batches = [];
  const logs = [];
  let contextItem = null;
  const spicetify = {
    ContextMenu: {
      Item: class {
        constructor(label, callback, visible) {
          this.label = label;
          this.callback = callback;
          this.visible = visible;
          this.registered = false;
          contextItem = this;
        }
        register() { this.registered = true; }
        deregister() { this.registered = false; }
      },
    },
    async addToQueue(items) {
      batches.push(items.map(({ uri }) => uri));
      await submit(items);
    },
    showNotification(value, error = false) { messages.push({ value, error }); },
  };
  const file = path.join(root, "src/extension/modules/quick-playlist/QuickPlaylistModule.ts");
  let source = stripTypeScriptTypes(readFileSync(file, "utf8"), { mode: "strip" });
  // Zur isolierten Verhaltensprüfung ersetzen wir nur die Importgrenzen durch
  // die gleichen, bereits separat geprüften Shared-Funktionen.
  source = source.replace(/^import\s+.*?;\s*$/gm, "");
  source = source.replace(/\bexport\s+const\s+quickPlaylistModule\b/, "const quickPlaylistModule");
  source += "\nexports.module = quickPlaylistModule; exports.queue = queueSelection;\n";
  const exports = {};
  runInNewContext(source, {
    exports, Spicetify: spicetify, createSingleFlight, QueueBatchError,
    enqueueQueueBatches, parseSpotifyTrackInput,
    runtimeText: (key, values = {}) => `${key}:${JSON.stringify(values)}`,
    console: { error: (...args) => logs.push(args) },
  }, { filename: file, timeout: 1000 });
  exports.module.start();
  return { ...exports, messages, batches, logs, get item() { return contextItem; } };
}

test("Große Kontextmenü-Auswahl wird in 25er-Blöcke aufgeteilt und geordnet gesendet", async () => {
  const runtime = createModule();
  const selection = Array.from({ length: 54 }, (_, index) => track(index));
  await runtime.queue(selection);
  assert.deepEqual(runtime.batches.map((batch) => batch.length), [25, 25, 4]);
  assert.deepEqual(runtime.batches.flat(), selection);
  assert.equal(runtime.messages.length, 1);
  assert.match(runtime.messages[0].value, /^runtime\.queued:/);
  assert.match(runtime.messages[0].value, /"count":54/);
});

test("Kontextmenü ist nur bei Titeln/Episoden verfügbar und normalisiert Spotify-Links", async () => {
  const runtime = createModule();
  const ep = `spotify:episode:${"A".repeat(22)}`;
  assert.equal(runtime.item.registered, true);
  assert.equal(runtime.item.visible(["spotify:album:123", "spotify:playlist:123"]), false);
  assert.equal(runtime.item.visible(["spotify:album:123", ep]), true);
  await runtime.queue(["spotify:album:123", `https://open.spotify.com/track/${"z".repeat(22)}?si=abc`, ep]);
  assert.deepEqual(runtime.batches.flat(), [`spotify:track:${"z".repeat(22)}`, ep]);
  assert.equal(runtime.messages.length, 2);
  assert.match(runtime.messages[1].value, /playlist\.skipped/);
  runtime.module.stop();
  assert.equal(runtime.item.registered, false);
});

test("Keine gültigen Einträge: kein API-Aufruf und kein falscher Erfolg", async () => {
  const runtime = createModule();
  await runtime.queue(["spotify:album:123", "invalid"]);
  assert.equal(runtime.batches.length, 0);
  assert.equal(runtime.messages.length, 1);
  assert.match(runtime.messages[0].value, /playlist\.noValid/);
  assert.equal(runtime.messages[0].error, true);
});

test("Zwei schnelle Kontextmenü-Aufrufe versenden nur eine Auswahl", async () => {
  let release;
  const runtime = createModule(() => new Promise((resolve) => { release = resolve; }));
  const first = runtime.queue([track(1)]);
  const second = runtime.queue([track(1)]);
  assert.equal(runtime.batches.length, 1);
  await second;
  release();
  await first;
  assert.equal(runtime.batches.length, 1);
  assert.equal(runtime.messages.length, 1);
});

test("Fehler im zweiten Batch meldet Teilmenge und sendet keinen dritten Batch", async () => {
  let calls = 0;
  const runtime = createModule(async () => {
    if (++calls === 2) throw new Error("Spotify 503");
  });
  await runtime.queue(Array.from({ length: 60 }, (_, index) => track(index)));
  assert.deepEqual(runtime.batches.map((batch) => batch.length), [25, 25]);
  assert.equal(runtime.messages.length, 1);
  assert.equal(runtime.messages[0].error, true);
  assert.match(runtime.messages[0].value, /playlist\.partial/);
  assert.match(runtime.messages[0].value, /"count":25/);
  assert.match(runtime.messages[0].value, /"total":60/);
});

test("Fehler im ersten Batch meldet Misserfolg statt Teilerfolg", async () => {
  const runtime = createModule(async () => { throw new Error("Spotify offline"); });
  await runtime.queue([track(1)]);
  assert.equal(runtime.messages.length, 1);
  assert.match(runtime.messages[0].value, /runtime\.queueFailed/);
  assert.equal(runtime.messages[0].error, true);
});

test("Nach einem Spotify-Fehler bleibt die Queue-Sperre nicht hängen", async () => {
  let fail = true;
  const runtime = createModule(async () => {
    if (fail) throw new Error("temporär");
  });
  await runtime.queue([track(1)]);
  fail = false;
  await runtime.queue([track(2)]);
  assert.equal(runtime.batches.length, 2);
  assert.match(runtime.messages[1].value, /runtime\.queued/);
});
