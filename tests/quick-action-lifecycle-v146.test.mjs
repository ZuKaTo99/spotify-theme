// =============================================================================
// Datei: tests/quick-action-lifecycle-v146.test.mjs
// Zweck: Schnellaktionen bei Doppelklicks und Fehlern nur einmal ausführen;
// zusätzlich die Integration der Sperre in beide React-Komponenten absichern.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { createSingleFlight } = loadPureSharedModule(root, "src/shared/single-flight.ts");
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("Schneller Doppelklick löst nur einen asynchronen Auftrag aus", async () => {
  const gate = createSingleFlight();
  let complete;
  let requests = 0;
  const action = () => {
    requests++;
    return new Promise((resolve) => { complete = resolve; });
  };
  const first = gate.run(action);
  const second = gate.run(action);
  assert.equal(gate.isBusy(), true);
  assert.equal(await second, false);
  assert.equal(requests, 1);
  complete();
  assert.equal(await first, true);
  assert.equal(gate.isBusy(), false);
});

test("Während einer Spotify-Antwort wird auch eine andere Aktion blockiert", async () => {
  const gate = createSingleFlight();
  let complete;
  const events = [];
  const first = gate.run(() => new Promise((resolve) => {
    events.push("queue");
    complete = resolve;
  }));
  const second = gate.run(() => { events.push("favorite"); });
  assert.equal(await second, false);
  complete();
  await first;
  assert.deepEqual(events, ["queue"]);
});

test("Nach erfolgreichem Abschluss ist die Sperre wieder frei", async () => {
  const gate = createSingleFlight();
  let calls = 0;
  assert.equal(await gate.run(() => { calls++; }), true);
  assert.equal(await gate.run(async () => { calls++; }), true);
  assert.equal(calls, 2);
});

test("API-Fehler wird durchgereicht, die Sperre bleibt nicht hängen", async () => {
  const gate = createSingleFlight();
  await assert.rejects(gate.run(async () => { throw new Error("Spotify 503"); }), /Spotify 503/);
  assert.equal(gate.isBusy(), false);
  assert.equal(await gate.run(() => {}), true);
});

test("Synchroner Fehler in einer Aktion wird ebenfalls bereinigt", async () => {
  const gate = createSingleFlight();
  await assert.rejects(gate.run(() => { throw new TypeError("kaputt"); }), /kaputt/);
  assert.equal(gate.isBusy(), false);
});

test("Zwei unterschiedliche Komponenten besitzen unabhängige Sperren", async () => {
  const a = createSingleFlight();
  const b = createSingleFlight();
  let release;
  const first = a.run(() => new Promise((resolve) => { release = resolve; }));
  assert.equal(await b.run(() => {}), true);
  assert.equal(a.isBusy(), true);
  release();
  await first;
});

test("Schnellsuche nutzt den Schutz unmittelbar beim Klicken", () => {
  const quick = source("src/custom-app/components/QuickTrackPanel.tsx");
  assert.match(quick, /const actionGate = ReactRuntime\.useRef\(createSingleFlight\(\)\)/);
  assert.match(quick, /await actionGate\.current\.run\(async \(\) =>/);
  assert.match(quick, /<TrackSearch t=\{t\} actionLabel=\{t\("quick\.save"\)\} disabled=\{working\}/);
  assert.match(quick, /disabled=\{working\}/);
});

test("Titelsuche schützt Resultat-Aktionen und verwirft Antworten nach Unmount", () => {
  const search = source("src/custom-app/components/TrackSearch.tsx");
  assert.match(search, /const actionGate = ReactRuntime\.useRef\(createSingleFlight\(\)\)/);
  assert.match(search, /await actionGate\.current\.run\(async \(\) =>/);
  assert.match(search, /ReactRuntime\.useEffect\(\(\) => \(\) => \{ requestNumber\.current\+\+; \}, \[\]\)/);
  assert.match(search, /if \(request === requestNumber\.current\)/);
});
