// =============================================================================
// Datei: tests/library-storage-safety-v155.test.mjs
// Zweck: Prüft echte Bibliotheks-Laufzeitlogik bei Spotify-Storage-Ausfällen.
// Keine realen Nutzer- oder Spotify-Daten werden verändert.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const KEY = "zukato-toolkit.library.v1";
const song = { uri: "spotify:track:4iV5W9uYEdYUVa79Axb7Rh", title: "Sicher", artist: "Artist", album: "Album" };

/** Eine neue VM pro Test vermeidet Zustand aus fremden Tests. */
function setup(initial = undefined) {
  const data = new Map(initial === undefined ? [] : [[KEY, initial]]);
  const stats = { reads: 0, writes: 0, events: 0, failRead: false, failWrite: false };
  const spicetify = { Platform: { LocalStorageAPI: {
    getItem(key) {
      stats.reads++;
      if (stats.failRead) throw Error("Spotify Storage temporär nicht erreichbar");
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      stats.writes++;
      if (stats.failWrite) throw Error("QuotaExceededError");
      data.set(key, value);
    },
  } } };
  const win = { dispatchEvent() { stats.events++; } };
  const EventClass = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  const api = loadPureSharedModule(root, "src/shared/library.ts", {
    Spicetify: spicetify, window: win, CustomEvent: EventClass, console,
  });
  return { api, data, stats };
}

test("v1.55: kurzer Lesefehler darf Verlauf, Favoriten und Notizen nicht löschen", () => {
  const ctx = setup();
  ctx.api.addFavorite(song);
  ctx.api.setSongNote(song, "Unersetzliche Notiz");
  ctx.api.recordTrack(song);
  const original = JSON.stringify(ctx.data.get(KEY));
  const before = ctx.stats.writes;
  ctx.stats.failRead = true;
  assert.throws(() => ctx.api.recordTrack(song), /temporär/);
  assert.throws(() => ctx.api.toggleFavorite(song), /temporär/);
  assert.throws(() => ctx.api.setSongNote(song, "neu"), /temporär/);
  assert.equal(ctx.stats.writes, before, "Fehlgeschlagene Reads dürfen niemals schreibtätig sein");
  assert.equal(JSON.stringify(ctx.data.get(KEY)), original);
  ctx.stats.failRead = false;
  assert.equal(ctx.api.loadLibrary().favorites.length, 1);
  assert.equal(ctx.api.loadLibrary().history.length, 1);
  assert.equal(ctx.api.loadLibrary().notes[0].text, "Unersetzliche Notiz");
});

test("v1.55: kaputtes JSON blockiert Mutationen und sichere Backup-Snapshots", () => {
  const ctx = setup('{"history": [');
  assert.equal(ctx.api.loadLibrary().history.length, 0, "UI darf ersatzweise leer bleiben");
  assert.throws(() => ctx.api.loadLibraryStrict(), /Unexpected end/);
  assert.throws(() => ctx.api.addFavorite(song), /Unexpected end/);
  assert.equal(ctx.stats.writes, 0);
  assert.equal(ctx.data.get(KEY), '{"history": [');
});

test("v1.55: JSON-Primitiv darf nicht als leere Bibliothek überschrieben werden", () => {
  for (const invalid of ['null', '12', '"falsch"', '[]']) {
    const ctx = setup(invalid);
    assert.throws(() => ctx.api.changeLibrary((db) => db), /beschädigt/);
    assert.equal(ctx.data.get(KEY), invalid);
    assert.equal(ctx.stats.writes, 0);
  }
});

test("v1.55: unvollständige Bibliothek wird nicht beim Songwechsel überschrieben", () => {
  for (const value of [
    { version: 1, history: [], favorites: [] },
    { version: 1, history: [], favorites: [], notes: null },
    { version: 1, history: {}, favorites: [], notes: [] },
  ]) {
    const ctx = setup(value);
    assert.throws(() => ctx.api.recordTrack(song), /beschädigt/);
    assert.equal(ctx.stats.writes, 0);
    assert.equal(ctx.data.get(KEY), value);
  }
});

test("v1.55: erste Installation ohne Daten darf normale Titel erfassen", () => {
  const ctx = setup();
  assert.equal(ctx.api.addFavorite(song), true);
  assert.equal(ctx.api.addFavorite(song), false);
  assert.equal(ctx.api.toggleFavorite(song), false);
  assert.equal(ctx.api.toggleFavorite(song), true);
  assert.equal(ctx.api.loadLibrary().favorites.length, 1);
  assert.equal(ctx.stats.events, 3, "Doppeltes Hinzufügen darf kein Event auslösen");
});

test("v1.55: jede Favoriten-Aktion liest genau den einen aktualisierten Zustand", () => {
  const ctx = setup();
  ctx.api.addFavorite(song);
  assert.equal(ctx.stats.reads, 1);
  const previousWrites = ctx.stats.writes;
  assert.equal(ctx.api.addFavorite(song), false);
  assert.equal(ctx.stats.reads, 2);
  assert.equal(ctx.stats.writes, previousWrites, "Idempotenter Aufruf darf nicht schreiben");
  ctx.api.toggleFavorite(song);
  assert.equal(ctx.stats.reads, 3);
});

test("v1.55: ein Schreibfehler erzeugt weder Erfolgsevent noch Erfolgsmeldung", () => {
  const ctx = setup();
  ctx.stats.failWrite = true;
  assert.throws(() => ctx.api.addFavorite(song), /QuotaExceededError/);
  assert.equal(ctx.stats.events, 0);
  assert.equal(ctx.data.has(KEY), false);
});

test("v1.55: Backup-Export und Import-Snapshot benutzen streng geprüfte Daten", () => {
  const source = readFileSync(path.join(root, "src/custom-app/modules/settings/DataBackup.tsx"), "utf8");
  assert.match(source, /settings: loadSettings\(\), library: loadLibraryStrict\(\)/);
  assert.equal((source.match(/library: loadLibraryStrict\(\)/g) ?? []).length, 2);
  assert.match(source, /onClick=\{onExport\}/);
  assert.match(source, /Backup-Export fehlgeschlagen/);
});
