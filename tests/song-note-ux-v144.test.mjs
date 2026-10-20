// =============================================================================
// Datei: tests/song-note-ux-v144.test.mjs
// Zweck: Regressionstests für den Schutz ungespeicherter Song-Notizen und die
// Aktualisierung des aktuellen Songs in der Schnellsuche.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const TRACK_A = "spotify:track:4iV5W9uYEdYUVa79Axb7Rh";
const TRACK_B = "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp";

/** Isolierte Browser-Sitzung mit les-/schreibbarem sessionStorage. */
function session() {
  const entries = new Map();
  const storage = {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, val) { entries.set(key, val); },
    removeItem(key) { entries.delete(key); },
  };
  const load = () => loadPureSharedModule(root, "src/shared/song-note-drafts.ts", { sessionStorage: storage });
  return { entries, storage, load };
}

test("Ein neuer Entwurf überlebt Modulwechsel und erneutes Mounten", () => {
  const browser = session();
  browser.load().rememberSongNoteDraft(TRACK_A, "Noch nicht gespeichert", "", 0);
  const reopened = browser.load(); // Neues Modul = neuer JS-Speicher, gleiche Tab-Sitzung.
  assert.equal(reopened.readSongNoteDraft(TRACK_A, "", 0), "Noch nicht gespeichert");
  assert.equal(reopened.readSongNoteDraft(TRACK_B, "anderer Text", 0), "anderer Text");
});

test("Songwechsel behält zwei unterschiedliche Entwürfe", () => {
  const api = session().load();
  api.rememberSongNoteDraft(TRACK_A, "Entwurf A", "gespeichert A", 12);
  api.rememberSongNoteDraft(TRACK_B, "Entwurf B", "gespeichert B", 18);
  assert.equal(api.readSongNoteDraft(TRACK_B, "gespeichert B", 18), "Entwurf B");
  assert.equal(api.readSongNoteDraft(TRACK_A, "gespeichert A", 12), "Entwurf A");
});

test("Verwerfen und explizites Speichern löschen nur den betroffenen Entwurf", () => {
  const api = session().load();
  api.rememberSongNoteDraft(TRACK_A, "A", "", 0);
  api.rememberSongNoteDraft(TRACK_B, "B", "", 0);
  api.clearSongNoteDraft(TRACK_A);
  assert.equal(api.readSongNoteDraft(TRACK_A, "", 0), "");
  assert.equal(api.readSongNoteDraft(TRACK_B, "", 0), "B");
});

test("Rückkehr zum gespeicherten Wert entfernt automatisch den Entwurf", () => {
  const browser = session();
  const api = browser.load();
  api.rememberSongNoteDraft(TRACK_A, "Änderung", "Original", 5);
  api.rememberSongNoteDraft(TRACK_A, "Original", "Original", 5);
  assert.equal(browser.load().readSongNoteDraft(TRACK_A, "Original", 5), "Original");
  assert.doesNotMatch([...browser.entries.values()][0], /Änderung/);
});

test("Externe Bearbeitung/Backup darf nicht von veraltetem Entwurf verdeckt werden", () => {
  const api = session().load();
  api.rememberSongNoteDraft(TRACK_A, "alter Entwurf", "alte Notiz", 42);
  assert.equal(api.readSongNoteDraft(TRACK_A, "neuer Import", 43), "neuer Import");
});

test("Beschädigte Daten, fremde URIs und zu lange Werte werden verworfen", () => {
  const browser = session();
  browser.storage.setItem("zukato-toolkit.song-note-drafts.v1", "{invalid json");
  assert.equal(browser.load().readSongNoteDraft(TRACK_A, "Fallback", 0), "Fallback");
  browser.storage.setItem("zukato-toolkit.song-note-drafts.v1", JSON.stringify({
    [TRACK_A]: { text: "x".repeat(4001), savedVersion: 0 },
    "https://evil.invalid": { text: "fremd", savedVersion: 0 },
  }));
  assert.equal(browser.load().readSongNoteDraft(TRACK_A, "Fallback", 0), "Fallback");
});

test("Gesperrter Sitzungsspeicher blockiert das Tippen nicht", () => {
  const api = loadPureSharedModule(root, "src/shared/song-note-drafts.ts", {
    sessionStorage: {
      getItem() { throw new Error("SecurityError"); },
      setItem() { throw new Error("QuotaExceededError"); },
    },
  });
  assert.doesNotThrow(() => api.rememberSongNoteDraft(TRACK_A, "Wichtig", "", 0));
  assert.equal(api.readSongNoteDraft(TRACK_A, "", 0), "Wichtig");
});

test("Dauerhafte Begrenzung auf 4000 Zeichen und maximal 30 Einträge", () => {
  const browser = session();
  const api = browser.load();
  api.rememberSongNoteDraft(TRACK_A, "a".repeat(5000), "", 0);
  assert.equal(api.readSongNoteDraft(TRACK_A, "", 0).length, 4000);
  for (let i = 0; i < 40; i++) {
    api.rememberSongNoteDraft(`spotify:track:${String(i).padStart(22, '0')}`, `Notiz ${i}`, "", 0);
  }
  const all = JSON.parse([...browser.entries.values()][0]);
  assert.equal(Object.keys(all).length, 30);
});

test("Editor wird pro URI neu erstellt und bietet Speichern, Verwerfen und Fehleranzeige", () => {
  const source = readFileSync(path.join(root, "src/custom-app/modules/song-notes/SongNotes.tsx"), "utf8");
  assert.match(source, /<NoteEditor key=\{selected\.uri\}/);
  assert.match(source, /rememberSongNoteDraft\(selected\.uri/);
  assert.match(source, /clearSongNoteDraft\(selected\.uri\)/);
  assert.match(source, /notes\.saveFailed/);
  assert.match(source, /notes\.discard/);
});

test("Schnellsuche aktualisiert aktuellen Song und räumt Songwechsel-Listener auf", () => {
  const source = readFileSync(path.join(root, "src/custom-app/components/QuickTrackPanel.tsx"), "utf8");
  assert.match(source, /addEventListener\("songchange", syncCurrentTrack\)/);
  assert.match(source, /removeEventListener\("songchange", syncCurrentTrack\)/);
  assert.match(source, /setNowPlaying\(currentTrack\(\)\)/);
});
