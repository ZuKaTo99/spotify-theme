// =============================================================================
// Datei: tests/notes-and-library-v149.test.mjs
// Zweck: Reproduzierbare Regressionen für Entwurfserhalt, Datenimport und
//        Notiz-Suche. Keiner dieser Tests verändert reale Spotify-Daten.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const KEY = "zukato-toolkit.song-note-drafts.v1";
const A = "spotify:track:4iV5W9uYEdYUVa79Axb7Rh";
const B = "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp";
const track = (index, text = "") => ({
  uri: `spotify:track:${String(index).padStart(22, "0")}`,
  title: `Titel ${index}`, artist: `Künstler ${index}`, album: `Album ${index}`, text,
});
const load = (sessionStorage) => loadPureSharedModule(root, "src/shared/song-note-drafts.ts", { sessionStorage });
const { normalizeLibrary } = loadPureSharedModule(root, "src/shared/library.ts");
const { collectionPage } = loadPureSharedModule(root, "src/shared/collection-view.ts");

function storage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
  };
}

test("QuotaExceeded darf jüngeren Entwurf nicht durch den alten sessionStorage überschreiben", () => {
  const store = storage();
  store.setItem(KEY, JSON.stringify({ [A]: { text: "Alt", savedVersion: 1 } }));
  let fail = true;
  const session = {
    getItem: store.getItem,
    setItem(key, value) { if (fail) throw new Error("QuotaExceededError"); store.setItem(key, value); },
  };
  const api = load(session);
  api.rememberSongNoteDraft(A, "Neu und noch nicht gespeichert", "Original", 1);
  assert.match(store.getItem(KEY), /Alt/);
  assert.equal(api.readSongNoteDraft(A, "Original", 1), "Neu und noch nicht gespeichert");
  fail = false;
  api.rememberSongNoteDraft(B, "Zweiter", "", 0);
  assert.equal(api.readSongNoteDraft(A, "Original", 1), "Neu und noch nicht gespeichert");
  assert.equal(load(store).readSongNoteDraft(B, "", 0), "Zweiter");
  assert.match(store.getItem(KEY), /Neu und noch nicht gespeichert/);
});

test("Externer Import mit gleichem Timestamp überschreibt keinen anderen Notiztext", () => {
  const api = load(storage());
  api.rememberSongNoteDraft(A, "Nicht gespeichert", "Original", 0);
  assert.equal(api.readSongNoteDraft(A, "Original", 0), "Nicht gespeichert");
  assert.equal(api.readSongNoteDraft(A, "Aus Backup importiert", 0), "Aus Backup importiert");
});

test("Alte Entwurfsdaten ohne gespeicherten Basistekst bleiben lesbar", () => {
  const store = storage();
  store.setItem(KEY, JSON.stringify({ [A]: { text: "Legacy", savedVersion: 7 } }));
  assert.equal(load(store).readSongNoteDraft(A, "Original", 7), "Legacy");
});

test("Beschädigte Einträge verdrängen beim Import keine gültigen Entwürfe", () => {
  const store = storage();
  const invalid = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [
    `invalid:${i}`, { text: "junk", savedVersion: 0 },
  ]));
  store.setItem(KEY, JSON.stringify({ [A]: { text: "Wichtig", savedVersion: 0 }, ...invalid }));
  assert.equal(load(store).readSongNoteDraft(A, "", 0), "Wichtig");
});

test("Gespeicherte Notizen werden bei gleicher URI zusammengeführt, neuester Zeitstempel gewinnt", () => {
  const base = track(1);
  const db = normalizeLibrary({ notes: [
    { ...base, text: "alt", updatedAt: 12 },
    { ...base, text: "neu", updatedAt: 18 },
    { ...base, text: "nicht neuer", updatedAt: 10 },
  ] });
  assert.equal(db.notes.length, 1);
  assert.equal(db.notes[0].text, "neu");
  assert.equal(db.notes[0].updatedAt, 18);
});

test("Gültige Einträge nach doppelten Favoriten werden trotzdem übernommen", () => {
  const first = track(1);
  const db = normalizeLibrary({ favorites: [
    ...Array.from({ length: 300 }, () => first), track(2), track(3),
  ] });
  assert.deepEqual(Array.from(db.favorites, (entry) => entry.uri), [first.uri, track(2).uri, track(3).uri]);
});

test("History kann denselben Song weiterhin bei verschiedenen Wiedergaben enthalten", () => {
  const song = track(1);
  const db = normalizeLibrary({ history: [
    { ...song, playedAt: 1 }, { ...song, playedAt: 2 },
  ] });
  assert.equal(db.history.length, 2);
});

test("Notizen lassen sich über Metadaten und Text durchsuchen und paginieren", () => {
  const notes = Array.from({ length: 100 }, (_, index) => track(index, index === 78 ? "Mein Gitarren-Riff" : "Text"));
  const byBody = collectionPage(notes, "gitarren riff", 0, undefined, (item) => item.text);
  assert.equal(byBody.total, 1);
  assert.equal(byBody.items[0].uri, notes[78].uri);
  assert.equal(collectionPage(notes, "Künstler 50", 0, undefined, (item) => item.text).total, 1);
  const all = [0, 1, 2].flatMap((page) => collectionPage(notes, "", page, undefined, (item) => item.text).items);
  assert.deepEqual(all.map((item) => item.uri), notes.map((item) => item.uri));
});

test("Notiz-UI verwendet Suchfeld, Seitenlogik und selbstständigen Editor", () => {
  const ui = readFileSync(path.join(root, "src/custom-app/modules/song-notes/SongNotes.tsx"), "utf8");
  assert.match(ui, /collectionPage\(data\.notes, filter, requestedPage/);
  assert.match(ui, /view\.items\.map/);
  assert.match(ui, /setRequestedPage\(0\)/);
  assert.match(ui, /<NoteEditor key=\{selected\.uri\}/);
  assert.match(ui, /notes\.searchPlaceholder/);
});
