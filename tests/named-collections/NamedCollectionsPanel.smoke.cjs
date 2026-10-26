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
const source = path.resolve(__dirname, '../../src/extension/modules/playlist-tools/named-collections/NamedCollectionsPanel.ts');
const code = esbuild.buildSync({ entryPoints: [source], bundle: true, platform: 'node',
  format: 'cjs', write: false }).outputFiles[0].text;
const compiled = { exports: {} };
new Function('module', 'exports', code)(compiled, compiled.exports);
const { mountNamedCollectionsPanel } = compiled.exports;
const storeSource = path.resolve(__dirname, '../../src/extension/modules/playlist-tools/named-collections/NamedCollections.ts');
const storeCode = esbuild.buildSync({ entryPoints: [storeSource], bundle: true, platform: 'node',
  format: 'cjs', write: false }).outputFiles[0].text;
const storeModule = { exports: {} };
new Function('module', 'exports', storeCode)(storeModule, storeModule.exports);
const { NamedCollectionsStore } = storeModule.exports;

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
const controller = mountNamedCollectionsPanel(host, {
  store,
  legacyTrackUris: () => [uri],
  onCollectionChanged: (state) => updates.push(state.activeCollectionId),
  onExportConfirmed: async (plan) => { exportCalls.push(plan); },
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
Promise.resolve().then(() => {
  assert.equal(exportCalls.length, 1);
  assert.equal(exportCalls[0].name, 'Workout (Kopie 2)');
  assert.deepEqual(exportCalls[0].trackUris, [uri]);
  assert.ok(updates.length >= 3);
  controller.destroy();
  assert.equal(host.children.length, 0);
  console.log('UI-Smoke-Test: OK');
}).catch((error) => { console.error(error); process.exitCode = 1; });
