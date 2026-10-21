// =============================================================================
// Datei: tests/bulk-workspace-v159.test.mjs
// Zweck: Große Titelsammlungen über mehrere Seiten sicher bearbeiten.
// Hier werden echte Bibliotheksfunktionen mit isoliertem Storage ausgeführt;
// Spotify und die persönlichen Nutzerdaten werden niemals angesprochen.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { filterCollection, collectionPage } = loadPureSharedModule(root, "src/shared/collection-view.ts");
const { extendTrackSelection, toggleTrackSelection, resolveSelectedTracks } =
  loadPureSharedModule(root, "src/shared/bulk-selection.ts");
const { enqueueQueueBatches, QueueBatchError } =
  loadPureSharedModule(root, "src/shared/queue-batches.ts");
const track = (n, title = `Song ${n}`) => ({
  uri: `spotify:track:${String(n).padStart(22, "0")}`,
  title, artist: `Artist ${n % 4}`, album: `Album ${n % 7}`,
});
const many = Array.from({ length: 250 }, (_, n) => track(n));

/** Minimaler Spotify-Storage: wir zählen die tatsächlich erfolgreichen Writes. */
function libraryFixture(favorites = [], history = []) {
  let stored = { version: 1, favorites, history, notes: [] };
  let writes = 0;
  let denyRead = false;
  let denyWrite = false;
  const storage = {
    getItem() { if (denyRead) throw Error("Storage read unavailable"); return stored; },
    setItem(_, value) { if (denyWrite) throw Error("Storage write unavailable"); stored = value; writes++; },
  };
  const library = loadPureSharedModule(root, "src/shared/library.ts", {
    Spicetify: { Platform: { LocalStorageAPI: storage } },
    window: { dispatchEvent() {} }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    console: { warn() {} },
  });
  return { library, storage, snapshot: () => structuredClone(stored), writes: () => writes,
    denyRead: flag => { denyRead = flag; }, denyWrite: flag => { denyWrite = flag; } };
}

test("Filter über 250 Titel funktioniert unabhängig von Seiten inklusive Akzenten", () => {
  const source = [track(501, "Beyoncé Live"), ...many];
  assert.equal(filterCollection(source, "beyonce").length, 1);
  assert.ok(filterCollection(source, "ARTIST 2").length >= 62);
  assert.equal(collectionPage(source, "", 6).items.length, 11);
});

test("Auswahl bleibt über sieben Seiten erhalten, ohne Quellen zu verändern", () => {
  const before = JSON.stringify(many);
  const first = collectionPage(many, "", 0).items;
  const last = collectionPage(many, "", 6).items;
  const selection = extendTrackSelection(extendTrackSelection(new Set(), first), last);
  assert.equal(selection.size, 50);
  assert.deepEqual(resolveSelectedTracks(many, selection).map(t => t.uri), [...first, ...last].map(t => t.uri));
  assert.equal(JSON.stringify(many), before);
});

test("Checkbox-Auswahl darf React-Set nicht in-place mutieren", () => {
  const a = new Set([track(1).uri]);
  const b = toggleTrackSelection(a, track(2).uri, true);
  const c = toggleTrackSelection(b, track(1).uri, false);
  assert.notEqual(a, b);
  assert.deepEqual([...a], [track(1).uri]);
  assert.deepEqual([...c], [track(2).uri]);
});

test("Alle Suchtreffer werden gewählt, niemals ungefilterte Titel", () => {
  const onlyArtist = filterCollection(many, "artist 3");
  const selection = extendTrackSelection(new Set(), onlyArtist);
  assert.equal(selection.size, onlyArtist.length);
  assert.deepEqual(resolveSelectedTracks(many, selection).map(t => t.uri), onlyArtist.map(t => t.uri));
});

test("Hörverlauf mit mehrfach gespielten Liedern wird bei Sammelaktionen dedupliziert", () => {
  const history = [track(2), track(1), track(2), track(1), track(3)];
  const selection = extendTrackSelection(new Set(), history);
  assert.deepEqual(resolveSelectedTracks(history, selection).map(t => t.uri),
    [track(2), track(1), track(3)].map(t => t.uri));
});

test("Entfernte oder fremde URIs aus altem UI-State lösen keine Aktion aus", () => {
  const selection = new Set([track(1).uri, track(999).uri]);
  assert.deepEqual(resolveSelectedTracks([track(1)], selection).map(t => t.uri), [track(1).uri]);
});

test("Ausgewählte Favoriten werden in EINEM Storage-Write entfernt", () => {
  const fixture = libraryFixture(many);
  assert.equal(fixture.library.removeFavoritesBatch([track(2).uri, track(99).uri, track(99).uri]), 2);
  assert.equal(fixture.writes(), 1);
  assert.equal(fixture.snapshot().favorites.length, 248);
  assert.equal(fixture.library.removeFavoritesBatch([track(999).uri]), 0);
  assert.equal(fixture.writes(), 1);
});

test("Bulk-Hinzufügen erhält bestehende Favoriten auch an Kapazitätsgrenze", () => {
  const fixture = libraryFixture(many.slice(0, 249));
  const result = fixture.library.addFavoritesBatch([track(249), track(250), track(250), track(5)]);
  assert.deepEqual({ added: result.added, skipped: result.skipped }, { added: 1, skipped: 3 });
  assert.equal(fixture.snapshot().favorites.length, 250);
  assert.equal(fixture.snapshot().favorites[0].uri, track(0).uri);
  assert.equal(fixture.snapshot().favorites[249].uri, track(249).uri);
  assert.equal(fixture.writes(), 1);
});

test("Bulk-Hinzufügen ignoriert ungültige und doppelte Einträge ohne Writes", () => {
  const fixture = libraryFixture([track(1)]);
  const result = fixture.library.addFavoritesBatch([track(1), { ...track(4), uri: "invalid" }, track(1)]);
  assert.equal(result.added, 0);
  assert.equal(result.skipped, 3);
  assert.equal(fixture.writes(), 0);
});

test("Storage-Lesefehler löschen keine Favoriten, weder bei Add noch Remove", () => {
  const fixture = libraryFixture(many.slice(0, 3));
  const before = fixture.snapshot();
  fixture.denyRead(true);
  assert.throws(() => fixture.library.removeFavoritesBatch([track(1).uri]), /read unavailable/);
  assert.throws(() => fixture.library.addFavoritesBatch([track(9)]), /read unavailable/);
  assert.deepEqual(fixture.snapshot(), before);
  assert.equal(fixture.writes(), 0);
});

test("Storage-Schreibfehler geben keinen falschen Bulk-Erfolg zurück", () => {
  const fixture = libraryFixture(many.slice(0, 3));
  const before = fixture.snapshot();
  fixture.denyWrite(true);
  assert.throws(() => fixture.library.removeFavoritesBatch([track(1).uri]), /write unavailable/);
  assert.throws(() => fixture.library.addFavoritesBatch([track(9)]), /write unavailable/);
  assert.deepEqual(fixture.snapshot(), before);
  assert.equal(fixture.writes(), 0);
});

test("Queue-Auswahl mit 90 Titeln schickt 25er-Blöcke in Reihenfolge", async () => {
  const source = many.slice(0, 90);
  const selected = resolveSelectedTracks(source, extendTrackSelection(new Set(), source));
  const batches = [];
  const result = await enqueueQueueBatches(selected.map(t => t.uri), async uris => batches.push([...uris]));
  assert.deepEqual(batches.map(b => b.length), [25, 25, 25, 15]);
  assert.deepEqual(batches.flat(), source.map(t => t.uri));
  assert.equal(result.queued, 90);
});

test("Spotify-Queue-Fehler meldet Teilerfolg und dupliziert nie bestätigte Blöcke", async () => {
  let calls = 0;
  await assert.rejects(enqueueQueueBatches(many.slice(0, 80).map(t => t.uri), async () => {
    if (++calls === 3) throw Error("API failed");
  }), err => err instanceof QueueBatchError && err.queued === 50 && err.totalValid === 80);
  assert.equal(calls, 3);
});
