// =============================================================================
// Datei: tests/large-collections-v148.test.mjs
// Zweck: Suche/Seitenlogik und vollständiger Backup-Import realer Shared-Module.
// Reine Tests ohne Spotify-API: keine Änderungen an Nutzer-Daten oder Wallpapers.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { collectionPage, COLLECTION_PAGE_SIZE } = loadPureSharedModule(root, "src/shared/collection-view.ts");
const { normalizeLibrary } = loadPureSharedModule(root, "src/shared/library.ts");
const track = (i, title = `Song ${i}`) => ({
  uri: `spotify:track:${String(i).padStart(22, "0")}`,
  title, artist: `Artist ${i % 5}`, album: `Album ${i % 11}`,
});
const tracks = Array.from({ length: 500 }, (_, i) => track(i));

test("Konstante Seitengröße bleibt bei 40 Einträgen", () => {
  assert.equal(COLLECTION_PAGE_SIZE, 40);
});

test("Alle 500 Einträge sind über 13 Seiten erreichbar, unveränderte Reihenfolge", () => {
  const complete = [];
  for (let p = 0; p < 13; p++) {
    const view = collectionPage(tracks, "", p);
    assert.equal(view.page, p);
    assert.equal(view.pages, 13);
    assert.equal(view.total, 500);
    complete.push(...view.items.map((item) => item.uri));
  }
  assert.deepEqual(complete, tracks.map((item) => item.uri));
  assert.equal(collectionPage(tracks, "", 12).items.length, 20);
});

test("Suchen nach Titel, Künstler und Album, inklusive Teilbegriffen", () => {
  assert.deepEqual(collectionPage(tracks, "Song 419").items.map((item) => item.title), ["Song 419"]);
  assert.ok(collectionPage(tracks, "artist 3").total >= 100);
  assert.equal(collectionPage(tracks, "ALBUM 4").total > 0, true);
  assert.equal(collectionPage(tracks, "Artist 4 Album 2").total > 0, true);
});

test("Akzente, Leerzeichen und Großbuchstaben behindern die Suche nicht", () => {
  const sample = [track(1, "Beyoncé"), track(2, "Música"), track(3, "Anderes Lied")];
  assert.equal(collectionPage(sample, "  BEYONCE  ").items[0].title, "Beyoncé");
  assert.equal(collectionPage(sample, "musica").items[0].title, "Música");
  assert.equal(collectionPage(sample, "kein ergebnis").total, 0);
});

test("Eine leere Sammlung hat null Seiten und keine Ergebnisse", () => {
  const view = collectionPage([], "", 20);
  assert.equal(view.pages, 0);
  assert.equal(view.page, 0);
  assert.equal(view.items.length, 0);
});

test("Seitennummer wird nach Löschungen sofort korrigiert", () => {
  const previous = collectionPage(tracks, "", 12);
  assert.equal(previous.page, 12);
  const after = collectionPage(tracks.slice(0, 21), "", 12);
  assert.equal(after.page, 0);
  assert.equal(after.total, 21);
  assert.equal(after.items.length, 21);
});

test("Negative, ungültige und unendliche Seitenindizes zerstören keine Einträge", () => {
  for (const page of [-20, NaN, Infinity, -Infinity, 0.5]) {
    const result = collectionPage(tracks, "", page);
    assert.equal(result.page, 0);
    assert.deepEqual(result.items.map((item) => item.uri), tracks.slice(0, 40).map((item) => item.uri));
  }
  assert.equal(collectionPage(tracks, "", 3000).page, 12);
  assert.equal(collectionPage(tracks, "", 0, 0).items.length, 40);
});

test("Suchfilter und Seitenwechsel ändern weder Einträge noch Originalarray", () => {
  const before = JSON.stringify(tracks);
  const selected = collectionPage(tracks, "artist 2", 1);
  assert.equal(selected.items.length, 40);
  assert.equal(JSON.stringify(tracks), before);
  assert.ok(selected.total >= 100);
});

test("Beim Import zählen nur gültige Favoriten bis zur Speichergrenze", () => {
  const data = normalizeLibrary({ favorites: [...Array(300).fill({ uri: "falsch" }), ...tracks.slice(0, 260)] });
  assert.equal(data.favorites.length, 250);
  assert.equal(data.favorites[0].uri, tracks[0].uri);
  assert.equal(data.favorites[249].uri, tracks[249].uri);
});

test("Bei History und Notizen werden ungültige Einträge vor den gültigen ignoriert", () => {
  const data = normalizeLibrary({
    history: [{ playedAt: -1 }, ...tracks.slice(0, 500).map((entry, i) => ({ ...entry, playedAt: i }))],
    notes: [{}, ...tracks.slice(0, 251).map((entry, i) => ({ ...entry, text: `Notiz ${i}` }))],
  });
  assert.equal(data.history.length, 500);
  assert.equal(data.history[499].playedAt, 499);
  assert.equal(data.notes.length, 250);
  assert.equal(data.notes[0].text, "Notiz 0");
});

test("React-Module benutzen dieselbe Seitenlogik und lokalisierte Labels", () => {
  for (const file of [
    "src/custom-app/modules/favorites/Favorites.tsx",
    "src/custom-app/modules/listening-history/ListeningHistory.tsx",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /collectionPage\(/);
    assert.match(source, /view\.items/);
    assert.match(source, /collection\.previous/);
    assert.match(source, /collection\.next/);
    assert.match(source, /setRequestedPage\(0\)/);
  }
});
