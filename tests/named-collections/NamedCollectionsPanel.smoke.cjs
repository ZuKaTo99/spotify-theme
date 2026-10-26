/**
 * Einfacher DOM-Smoke-Test ohne Browser oder externe Test-Bibliothek.
 * Er prüft die Formular- und Bestätigungslogik, ersetzt aber KEINEN
 * Integrationstest im tatsächlichen Spotify-Client.
 *
 * TypeScript wird im Speicher gebündelt; es entstehen keine Testartefakte.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
// Panel und Store gemeinsam bündeln: Nur so teilen sie sich auch im Test
// dieselbe Fehlerklasse, genau wie im tatsächlichen App-Bundle.
const root = path.resolve(__dirname, '../..');
const code = esbuild.buildSync({
  stdin: {
    contents: "export { mountNamedCollectionsPanel, PlaylistExportReviewError } from './src/extension/modules/playlist-tools/named-collections/NamedCollectionsPanel'; export { NamedCollectionsStore } from './src/extension/modules/playlist-tools/named-collections/NamedCollections';",
    resolveDir: root,
    sourcefile: 'named-collections-smoke.ts',
    loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
}).outputFiles[0].text;
const compiled = { exports: {} };
new Function('module', 'exports', code)(compiled, compiled.exports);
const { mountNamedCollectionsPanel, PlaylistExportReviewError, NamedCollectionsStore } = compiled.exports;

/** Minimaler DOM-Knoten zur Simulation der benötigten Standardmethoden. */
class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.parent = null;
    this.textContent = '';
    this.className = '';
    this.disabled = false;
    this.attributes = new Map();
  }
  append(...nodes) {
    for (const node of nodes) { node.parent = this; this.children.push(node); }
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...nodes);
  }
  addEventListener(event, fn) { this.listeners.set(event, fn); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
  trigger(event) {
    const handler = this.listeners.get(event);
    if (!handler) throw Error(`Missing ${event} listener`);
    return handler({preventDefault() {}});
  }
}

/** Sucht untergeordnete Elemente nach Tag oder Text. */
function find(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children) {
    const result = find(child, predicate);
    if (result) return result;
  }
  return null;
}

/** Erzeugt gültige Track-URIs und einen vollständig lokalen Speicher. */
const uri = 'spotify:track:0000000000000000000001';
const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};

// Abschnitt 1: Spotify und den Browser nur durch lokale Testobjekte ersetzen.
global.document = {createElement: (tag) => new FakeElement(tag)};
const host = new FakeElement('div');
const store = new NamedCollectionsStore(storage, {newId: (() => { let id = 0; return () => `id-${++id}`; })()});
const updates = [];
const exportCalls = [];
const resetCalls = [];
let failNextExport = false;
const controller = mountNamedCollectionsPanel(host, {
  store,
  legacyTrackUris: () => [uri],
  onCollectionChanged: (state) => updates.push(state.activeCollectionId),
  onExportConfirmed: async (plan) => {
    exportCalls.push(plan);
    if (failNextExport) throw new PlaylistExportReviewError('Spotify-Antwort unklar.');
  },
  onExportGuardReset: (plan) => { resetCalls.push(plan); },
});

/** Abschnitt 2: Startansicht, Formular, Speicherung und Auswahl prüfen. */
assert.ok(find(host, (el) => el.textContent === 'Meine Sammlungen'));
find(host, (el) => el.textContent === 'Neue Sammlung').trigger('click');
find(host, (el) => el.tagName === 'input').value = 'Workout';
find(host, (el) => el.tagName === 'form').trigger('submit');
assert.equal(store.getSnapshot().collections.length, 2);
assert.equal(store.getSnapshot().collections[1].name, 'Workout');

/** Abschnitt 3: Auch mehrere Kopien behalten eindeutige Namen. */
find(host, (el) => el.textContent === 'Aktuelle duplizieren').trigger('click');
find(host, (el) => el.textContent === 'Aktuelle duplizieren').trigger('click');
assert.equal(store.getSnapshot().collections.at(-1).name, 'Workout (Kopie 2)');

/** Abschnitt 4: Export erst nach der zweiten Bestätigung auslösen. */
const activeId = store.getSnapshot().activeCollectionId;
store.addTracks(activeId, [uri]);
controller.refresh();
find(host, (el) => el.textContent === 'Als Spotify-Playlist exportieren').trigger('click');
assert.equal(exportCalls.length, 0);
find(host, (el) => el.textContent === 'Playlist jetzt erstellen').trigger('click');
Promise.resolve().then(async () => {
  assert.equal(exportCalls.length, 1);
  assert.equal(exportCalls[0].name, 'Workout (Kopie 2)');
  assert.deepEqual(exportCalls[0].trackUris, [uri]);
  /** Abschnitt 5: Eine unklare Antwort verlangt Prüfung und zwei Freigabeklicks. */
  failNextExport = true;
  find(host, (el) => el.textContent === 'Als Spotify-Playlist exportieren').trigger('click');
  find(host, (el) => el.textContent === 'Playlist jetzt erstellen').trigger('click');
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(find(host, (el) => el.textContent === 'Nach Prüfung erneut erlauben'));
  assert.equal(resetCalls.length, 0);
  find(host, (el) => el.textContent === 'Nach Prüfung erneut erlauben').trigger('click');
  assert.equal(resetCalls.length, 0);
  find(host, (el) => el.textContent === 'Exportstatus freigeben').trigger('click');
  assert.equal(resetCalls.length, 1);
  assert.equal(resetCalls[0].collectionId, activeId);
  assert.ok(updates.length >= 3);
  /** Abschnitt 6: Ein extern umbenannter Stand darf nicht überschrieben werden. */
  const external = new NamedCollectionsStore(storage);
  external.load();
  external.rename(activeId, 'Extern umbenannt');
  const priorCount = store.getSnapshot().collections.length;
  find(host, (el) => el.textContent === 'Neue Sammlung').trigger('click');
  find(host, (el) => el.tagName === 'input').value = 'Veralteter Entwurf';
  find(host, (el) => el.tagName === 'form').trigger('submit');
  assert.equal(store.getSnapshot().collections.length, priorCount);
  assert.equal(store.getSnapshot().collections.find((entry) => entry.id === activeId).name, 'Extern umbenannt');
  assert.ok(find(host, (el) => el.textContent.includes('an anderer Stelle geändert')));
  controller.destroy();
  assert.equal(host.children.length, 0);
  console.log('UI-Smoke-Test: OK');
}).catch((error) => { console.error(error); process.exitCode = 1; });
