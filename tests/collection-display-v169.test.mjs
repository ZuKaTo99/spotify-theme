// =============================================================================
// Datei: tests/collection-display-v169.test.mjs
// Zweck: Gemeinsame Bibliotheks-Ansichten, UI-Callbacks, Browser-Speicher und
//        ESC-Entwurfsabbruch unabhängig vom echten Spotify-Client prüfen.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const module = loadPureSharedModule(root, "src/shared/collection-display.ts");
const { orderCollection, normalizeCollectionDisplay, readCollectionDisplay, rememberCollectionDisplay, COLLECTION_DISPLAY_KEY } = module;
const track = (title, artist, x = {}) => ({ title, artist, album: "Album", uri: `spotify:track:${String(title.length).padStart(22, "1")}`, ...x });

function fakeStorage(blocked = false) {
  const values = new Map();
  return {
    values,
    getItem: key => { if (blocked) throw Error("storage blocked"); return values.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw Error("storage blocked"); values.set(key, value); },
  };
}

/** Pure Module in VM with a DOM-free, mocked storage. */
function storageModule(storage) {
  return loadPureSharedModule(root, "src/shared/collection-display.ts", { window: { localStorage: storage } });
}

function elementRuntime() {
  return { Fragment: Symbol("Fragment"), createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
}
function nodes(tree, matcher, found = []) {
  if (Array.isArray(tree)) { tree.forEach(child => nodes(child, matcher, found)); return found; }
  if (!tree || typeof tree !== "object") return found;
  if (matcher(tree)) found.push(tree);
  nodes(tree.props?.children, matcher, found);
  return found;
}
function loadComponent(file, stubs = {}, runtime = elementRuntime()) {
  const exports = {};
  runInNewContext(compileTsxForTest(root, file), {
    exports, Spicetify: { React: runtime }, require: key => {
      const match = Object.keys(stubs).find(fragment => key.includes(fragment));
      if (!match) throw Error(`missing stub: ${key}`);
      return stubs[match];
    },
  });
  return exports;
}

test("Sortierungen liefern Kopien, original bleibt unverändert", () => {
  const list = [track("Zulu", "B"), track("Äpfel", "A"), track("alpha", "C")];
  const original = JSON.stringify(list);
  assert.deepEqual(orderCollection(list, "title").map(x => x.title), ["alpha", "Äpfel", "Zulu"]);
  assert.deepEqual(orderCollection(list, "artist").map(x => x.artist), ["A", "B", "C"]);
  assert.deepEqual(orderCollection(list, "original").map(x => x.title), ["Zulu", "Äpfel", "alpha"]);
  assert.equal(JSON.stringify(list), original);
});

test("Zeitstempel sortieren Verlauf und Notizen ohne Datumswert robust", () => {
  const history = [track("A", "X", { playedAt: 10 }), track("B", "X", { playedAt: 15 }), track("C", "X", { playedAt: 10 })];
  assert.deepEqual(orderCollection(history, "recent").map(x => x.title), ["B", "A", "C"]);
  assert.deepEqual(orderCollection(history, "oldest").map(x => x.title), ["A", "C", "B"]);
  const notes = [track("A", "X", { updatedAt: 5 }), track("B", "X", { updatedAt: 7 })];
  assert.deepEqual(orderCollection(notes, "recent").map(x => x.title), ["B", "A"]);
  const weird = [track("A", "X", { updatedAt: NaN }), track("B", "X", { updatedAt: 7 })];
  assert.deepEqual(orderCollection(weird, "recent").map(x => x.title), ["B", "A"]);
});

test("Korrupte Werte, unbekannte Sortierung und Datumsansicht für Favoriten werden abgelehnt", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeCollectionDisplay({ sort: "recent", compact: true }, "favorites"))), { sort: "original", compact: true });
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeCollectionDisplay({ sort: "recent", compact: true }, "notes"))), { sort: "recent", compact: true });
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeCollectionDisplay({ sort: "delete", compact: "yes" }, "history"))), { sort: "original", compact: false });
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeCollectionDisplay(null, "history"))), { sort: "original", compact: false });
});

test("Eine Sammlung speichert ihre Ansicht ohne die beiden anderen zu überschreiben", () => {
  const storage = fakeStorage();
  const view = storageModule(storage);
  view.rememberCollectionDisplay("favorites", { sort: "artist", compact: true });
  view.rememberCollectionDisplay("notes", { sort: "recent", compact: false });
  assert.deepEqual(JSON.parse(JSON.stringify(view.readCollectionDisplay("favorites"))), { sort: "artist", compact: true });
  assert.deepEqual(JSON.parse(JSON.stringify(view.readCollectionDisplay("notes"))), { sort: "recent", compact: false });
  assert.deepEqual(JSON.parse(JSON.stringify(view.readCollectionDisplay("history"))), { sort: "original", compact: false });
  assert.equal(Object.keys(JSON.parse(storage.values.get(COLLECTION_DISPLAY_KEY))).length, 3);
});

test("Blockierter Speicher und beschädigtes JSON verhindern keine Listennutzung", () => {
  const blocked = storageModule(fakeStorage(true));
  assert.deepEqual(JSON.parse(JSON.stringify(blocked.readCollectionDisplay("notes"))), { sort: "original", compact: false });
  assert.doesNotThrow(() => blocked.rememberCollectionDisplay("notes", { sort: "title", compact: true }));
  const corrupt = fakeStorage();
  corrupt.setItem(COLLECTION_DISPLAY_KEY, '{broken');
  assert.deepEqual(JSON.parse(JSON.stringify(storageModule(corrupt).readCollectionDisplay("favorites"))), { sort: "original", compact: false });
});

test("Controls: Suche löschen, Sortieren und Compact-Klick sind rein kontrollierte UI-Aktionen", () => {
  const { CollectionControls } = loadComponent("src/custom-app/components/CollectionControls.tsx");
  let search = "Song";
  let display = { sort: "original", compact: false };
  const tree = CollectionControls({ t: key => key, kind: "history", filter: search, results: 5,
    display, onSearch: value => { search = value; }, onDisplay: next => { display = next; } });
  const input = nodes(tree, n => n.type === "input")[0];
  assert.equal(input.props.id, "zukato-history-filter");
  input.props.onChange({ currentTarget: { value: "Alpha" } });
  assert.equal(search, "Alpha");
  const select = nodes(tree, n => n.type === "select")[0];
  select.props.onChange({ currentTarget: { value: "recent" } });
  assert.equal(display.sort, "recent");
  nodes(tree, n => n.type === "button")[0].props.onClick();
  assert.equal(search, "");
  nodes(tree, n => n.type === "button")[1].props.onClick();
  assert.equal(display.compact, true);
});

test("Controls: Favoriten erhalten keine Datums-Sortierung", () => {
  const { CollectionControls } = loadComponent("src/custom-app/components/CollectionControls.tsx");
  const tree = CollectionControls({ t: key => key, kind: "favorites", filter: "", results: 1,
    display: { sort: "original", compact: false }, onSearch() {}, onDisplay() {} });
  const options = nodes(tree, n => n.type === "option");
  assert.deepEqual(options.map(x => x.props.value), ["original", "title", "artist"]);
});

test("TrackList reduziert ausschließlich das Layout, nicht Zeilen oder Aktionen", () => {
  const { TrackList } = loadComponent("src/custom-app/components/TrackList.tsx", { "shared/library": { playTrack: () => Promise.resolve() } });
  const tracks = [track("A", "X"), track("B", "Y")];
  const list = TrackList({ tracks, compact: true, emptyText: "none" });
  assert.match(list.props.className, /zukato-track-list--compact/);
  assert.equal(nodes(list, n => n.type === "li").length, 2);
  assert.equal(nodes(list, n => n.type === "button").length, 2);
});

test("Settings-Escape verhindert Blur-Speicherung auch vor dem nächsten Render", () => {
  const runtime = { ...elementRuntime(), useState: initial => [initial, () => {}], useEffect() {}, useRef: value => ({ current: value }) };
  const { SettingsPanel } = loadComponent("src/custom-app/modules/settings/SettingsPanel.tsx", {}, runtime);
  const changes = [];
  const tree = SettingsPanel({ workspaceTitle: "Original", displayName: "Old", locale: "de",
    showGreeting: true, t: key => key, onChange: data => changes.push(data) });
  const title = nodes(tree, n => n.props?.id === "workspace-title")[0];
  const name = nodes(tree, n => n.props?.id === "display-name")[0];
  for (const input of [title, name]) {
    input.props.onKeyDown({ key: "Escape", currentTarget: { blur: () => input.props.onBlur() } });
  }
  assert.equal(changes.length, 0);
});
