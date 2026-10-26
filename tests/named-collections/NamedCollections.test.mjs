/** Testpaket zur benannten Sammlungsverwaltung; keine Spotify-API erforderlich. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

// Dieses Repository nutzt CommonJS. Das reine TS-Modul wird deshalb ohne
// Ausgabedatei mit demselben Bundler geladen, den auch der Produktbuild nutzt.
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../../src/extension/modules/playlist-tools/named-collections/NamedCollections.ts');
const code = esbuild.buildSync({ entryPoints: [source], bundle: true, platform: 'node',
  format: 'cjs', write: false }).outputFiles[0].text;
const compiled = { exports: {} };
new Function('module', 'exports', code)(compiled, compiled.exports);
const { NamedCollectionsStore, CollectionError, CollectionStorageError, normalizeTrackUri } = compiled.exports;

/** Reproduzierbarer In-Memory-Speicher mit simulierbaren Speicherfehlern. */
function memoryStorage() {
  const values = new Map();
  let failWrite = false;
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { if (failWrite) throw Error('quota'); values.set(key, value); },
    breakWrites() { failWrite = true; },
  };
}

/** Verwendet deterministische IDs, damit die Tests unter allen Plattformen stabil sind. */
function newStore(storage = memoryStorage()) {
  let count = 0;
  return new NamedCollectionsStore(storage, {newId: () => `id-${++count}`, now: () => 123456});
}

/** Erzeugt gültige 22-stellige Spotify-Track-IDs als Testdaten. */
const uri = (n) => `spotify:track:${String(n).padStart(22, '0')}`;

// Prüft: Erzeugt bei Erststart eine Standard-Sammlung.
test('erzeugt bei Erststart eine Standard-Sammlung', () => {
  const store = newStore();
  const doc = store.load();
  assert.equal(doc.collections[0].name, 'Meine Sammlung');
  assert.equal(doc.activeCollectionId, doc.collections[0].id);
  assert.deepEqual(doc.collections[0].trackUris, []);
});

// Prüft: Übernimmt v1.75-Arbeitsliste einmalig ohne Duplikate.
test('übernimmt v1.75-Arbeitsliste einmalig ohne Duplikate', () => {
  const storage = memoryStorage();
  const old = [uri(1), uri(1), uri(2)];
  const one = newStore(storage);
  assert.deepEqual(one.load(old).collections[0].trackUris, [uri(1), uri(2)]);
  assert.deepEqual(newStore(storage).load([uri(99)]).collections[0].trackUris, [uri(1), uri(2)]);
});

// Prüft: Belässt alte fremde Speicherwerte unverändert.
test('belässt alte fremde Speicherwerte unverändert', () => {
  const storage = memoryStorage();
  storage.values.set('legacy-v175-worklist', 'safe');
  newStore(storage).load([uri(1)]);
  assert.equal(storage.values.get('legacy-v175-worklist'), 'safe');
});

// Prüft: Erstellt, wechselt und dupliziert benannte Sammlungen.
test('erstellt, wechselt und dupliziert benannte Sammlungen', () => {
  const store = newStore();
  const first = store.load([uri(1)]).activeCollectionId;
  const created = store.create('Workout', true);
  assert.deepEqual(created.collections[1].trackUris, [uri(1)]);
  assert.notEqual(created.activeCollectionId, first);
  assert.equal(store.setActive(first).activeCollectionId, first);
});

// Prüft: Verhindert doppelte Namen unabhängig von Schreibweise.
test('verhindert doppelte Namen unabhängig von Schreibweise', () => {
  const store = newStore();
  store.load();
  store.create('Work Out');
  assert.throws(() => store.create(' work   out '), CollectionError);
});

// Prüft: Benennt Sammlungen um und persistiert den Namen.
test('benennt Sammlungen um und persistiert den Namen', () => {
  const storage = memoryStorage();
  const store = newStore(storage);
  const id = store.load().activeCollectionId;
  store.rename(id, '  Meine Hits  ');
  assert.equal(newStore(storage).load().collections[0].name, 'Meine Hits');
});

// Prüft: Löscht keine letzte Sammlung und greift Spotify nicht an.
test('löscht keine letzte Sammlung und greift Spotify nicht an', () => {
  const store = newStore();
  const id = store.load().activeCollectionId;
  assert.throws(() => store.remove(id), CollectionError);
  const another = store.create('Zweite').activeCollectionId;
  store.remove(another);
  assert.equal(store.getSnapshot().activeCollectionId, id);
});

// Prüft: Fügt Titel ohne Duplikate hinzu und entfernt nur lokal.
test('fügt Titel ohne Duplikate hinzu und entfernt nur lokal', () => {
  const store = newStore();
  const id = store.load([uri(1)]).activeCollectionId;
  store.addTracks(id, [uri(1), uri(2)]);
  assert.deepEqual(store.removeTracks(id, [uri(1)]).collections[0].trackUris, [uri(2)]);
});

// Prüft: Verschiebt einen Titel und respektiert die Listenränder.
test('verschiebt einen Titel und respektiert die Listenränder', () => {
  const store = newStore();
  const id = store.load([uri(1), uri(2)]).activeCollectionId;
  assert.deepEqual(store.moveTrack(id, uri(2), 'up').collections[0].trackUris, [uri(2), uri(1)]);
  assert.deepEqual(store.moveTrack(id, uri(2), 'up').collections[0].trackUris, [uri(2), uri(1)]);
});

// Prüft: Kopiert nur vorhandene ausgewählte Titel in Originalreihenfolge.
test('kopiert nur vorhandene ausgewählte Titel in Originalreihenfolge', () => {
  const store = newStore();
  const from = store.load([uri(1), uri(2)]).activeCollectionId;
  const to = store.create('Zweite').activeCollectionId;
  const result = store.copyTracks(from, to, [uri(2), uri(99), uri(1)]);
  assert.deepEqual(result.collections[1].trackUris, [uri(1), uri(2)]);
});

// Prüft: Erlaubt bis zu 500 Songs je Sammlung, aber keine 501.
test('erlaubt bis zu 500 Songs je Sammlung, aber keine 501', () => {
  const store = newStore();
  const id = store.load().activeCollectionId;
  store.addTracks(id, Array.from({length: 500}, (_, i) => uri(i)));
  assert.throws(() => store.addTracks(id, [uri(501)]), CollectionError);
  assert.equal(store.getSnapshot().collections[0].trackUris.length, 500);
});

// Prüft: Begrenzt auf 40 Sammlungen.
test('begrenzt auf 40 Sammlungen', () => {
  const store = newStore();
  store.load();
  for (let i = 1; i < 40; i += 1) store.create(`C${i}`);
  assert.throws(() => store.create('Eine zu viel'), CollectionError);
});

// Prüft: Bricht beim Speicherfehler ab ohne RAM oder gespeicherte Daten zu beschädigen.
test('bricht beim Speicherfehler ab ohne RAM oder gespeicherte Daten zu beschädigen', () => {
  const storage = memoryStorage();
  const store = newStore(storage);
  const original = store.load();
  const persisted = [...storage.values.values()][0];
  storage.breakWrites();
  assert.throws(() => store.create('Nicht gespeichert'), CollectionStorageError);
  assert.deepEqual(store.getSnapshot(), original);
  assert.equal([...storage.values.values()][0], persisted);
});

// Prüft: Meldet defekte oder unbekannte Speicherstände ohne Überschreiben.
test('meldet defekte oder unbekannte Speicherstände ohne Überschreiben', () => {
  const storage = memoryStorage();
  const store = newStore(storage);
  const key = 'zukato:playlist-workspace:named-collections:v1';
  storage.values.set(key, '{defekt');
  assert.throws(() => store.load(), CollectionStorageError);
  assert.equal(storage.values.get(key), '{defekt');
});

// Prüft: Rückgabewerte sind Kopien und können intern nichts ändern.
test('Rückgabewerte sind Kopien und können intern nichts ändern', () => {
  const store = newStore();
  const id = store.load([uri(1)]).activeCollectionId;
  const snapshot = store.getSnapshot();
  snapshot.collections[0].trackUris.push(uri(99));
  assert.deepEqual(store.preparePlaylistExport(id).trackUris, [uri(1)]);
});

// Prüft: Export bereitet nur einen Plan vor, ohne Spotify-Schreibaktion.
test('Export bereitet nur einen Plan vor, ohne Spotify-Schreibaktion', () => {
  const store = newStore();
  const id = store.load([uri(1)]).activeCollectionId;
  const plan = store.preparePlaylistExport(id);
  assert.equal(plan.name, 'Meine Sammlung');
  assert.deepEqual(plan.trackUris, [uri(1)]);
  plan.trackUris.push(uri(99));
  assert.deepEqual(store.getSnapshot().collections[0].trackUris, [uri(1)]);
});

// Prüft: Leere Sammlungen lassen sich nicht als Playlist exportieren.
test('leere Sammlungen lassen sich nicht als Playlist exportieren', () => {
  const store = newStore();
  const id = store.load().activeCollectionId;
  assert.throws(() => store.preparePlaylistExport(id), CollectionError);
});

// Prüft: Normalisiert Spotify Track-IDs und Web-URLs.
test('normalisiert Spotify Track-IDs und Web-URLs', () => {
  assert.equal(normalizeTrackUri('https://open.spotify.com/track/0000000000000000000001?si=foo'), uri(1));
  assert.equal(normalizeTrackUri('0000000000000000000001'), uri(1));
  assert.throws(() => normalizeTrackUri('https://evil.example/track/0000000000000000000001'), CollectionError);
});

// Songdaten bleiben unabhängig von der Quellbibliothek erhalten und ein
// fehlgeschlagener gemeinsamer Schreibvorgang verändert keinen RAM-Stand.
test('merkt Songtitel dauerhaft in derselben Sammlungsdatei', () => {
  const storage = memoryStorage();
  const store = newStore(storage);
  const id = store.load().activeCollectionId;
  store.addTrackInfos(id, [{uri: uri(1), title: 'Testlied', artist: 'Künstler', album: 'Album'}]);
  const again = newStore(storage).load();
  assert.deepEqual(again.collections[0].trackUris, [uri(1)]);
  assert.equal(again.trackDetails[uri(1)].title, 'Testlied');
});

test('beschädigte Songdaten werden vor einer Änderung erkannt', () => {
  const storage = memoryStorage();
  const key = 'zukato:playlist-workspace:named-collections:v1';
  const store = newStore(storage);
  const id = store.load().activeCollectionId;
  const raw = JSON.parse(storage.values.get(key));
  raw.trackDetails = {[uri(1)]: {title: '', artist: 'A', album: ''}};
  storage.values.set(key, JSON.stringify(raw));
  assert.throws(() => newStore(storage).load(), CollectionStorageError);
  assert.equal(storage.values.get(key), JSON.stringify(raw));
});
