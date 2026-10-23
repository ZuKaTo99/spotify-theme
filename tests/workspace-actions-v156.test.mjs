// =============================================================================
// Datei: tests/workspace-actions-v156.test.mjs
// Zweck: Echte Klick-Callbacks schützen lokale Sammlungen vor Datenverlust und
//        zeigen Fehler korrekt an. Es werden keine Spotify-Daten geschrieben.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { parseSpotifyTrackInput } = loadPureSharedModule(root, "src/shared/track-search.ts");
const song = { uri: "spotify:track:4iV5W9uYEdYUVa79Axb7Rh", title: "Song", artist: "Singer", album: "Album", playedAt: 123 };

/** Komponente mit echten Eventhandlern statt Quelltext-RegEx ausführen. */
function component(file, imports = {}, extra = {}) {
  const exports = {};
  const notices = [];
  const runtime = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => [typeof initial === "function" ? initial() : initial, () => {}],
    useEffect() {},
    useMemo: fn => fn(),
  };
  runInNewContext(compileTsxForTest(root, file), {
    exports, Spicetify: { React: runtime, showNotification: (msg, error = false) => notices.push({ msg, error }) },
    console: { error() {} }, window: { confirm: () => true },
    require: spec => {
      const entry = Object.entries(imports).find(([key]) => spec.includes(key));
      if (!entry) throw Error(`Unbekannter Mock: ${spec}`);
      return entry[1];
    }, ...extra,
  }, { timeout: 2000 });
  return { exports, notices };
}
function nodes(value, predicate, found = []) {
  if (Array.isArray(value)) { value.forEach(item => nodes(item, predicate, found)); return found; }
  if (!value || typeof value !== "object") return found;
  if (predicate(value)) found.push(value);
  nodes(value.props?.children, predicate, found);
  return found;
}

test("Hörverlauf: Merken fügt hinzu, statt vorhandene Favoriten umzuschalten", () => {
  let added = 0;
  const addFavorite = () => { added++; return false; };
  const h = component("src/custom-app/modules/listening-history/ListeningHistory.tsx", {
    "shared/library": { addFavorite, changeLibrary() {} },
    "collection-view": { collectionPage: entries => ({ items: entries, page: 0, pages: 1, total: entries.length }), filterCollection: entries => entries },
    "bulk-selection": { toggleTrackSelection: (current) => current },
    "BulkTrackActions": { BulkTrackActions: () => null },
    "CollectionControls": { CollectionControls: () => null },
    "collection-display": {
      orderCollection: tracks => tracks,
      readCollectionDisplay: () => ({ sort: "original", compact: false }),
      rememberCollectionDisplay() {},
    },
    "TrackList": { TrackList: () => null },
    "useToolkitData": { useToolkitData: () => ({ history: [song] }) },
  });
  const tree = h.exports.ListeningHistory({ t: key => key });
  const list = nodes(tree, node => node.type?.name === "TrackList");
  assert.equal(list.length, 1);
  list[0].props.action(song);
  assert.equal(added, 1);
  assert.equal(list[0].props.actionErrorLabel, "library.actionFailed");
});

test("Hörverlauf: Löschfehler meldet Fehler statt die Navigation zu verändern", () => {
  const h = component("src/custom-app/modules/listening-history/ListeningHistory.tsx", {
    "shared/library": { addFavorite() {}, changeLibrary() { throw Error("Storage nicht erreichbar"); } },
    "collection-view": { collectionPage: entries => ({ items: entries, page: 0, pages: 1, total: entries.length }), filterCollection: entries => entries },
    "bulk-selection": { toggleTrackSelection: (current) => current },
    "BulkTrackActions": { BulkTrackActions: () => null },
    "CollectionControls": { CollectionControls: () => null },
    "collection-display": {
      orderCollection: tracks => tracks,
      readCollectionDisplay: () => ({ sort: "original", compact: false }),
      rememberCollectionDisplay() {},
    },
    "TrackList": { TrackList: () => null },
    "useToolkitData": { useToolkitData: () => ({ history: [song] }) },
  });
  const tree = h.exports.ListeningHistory({ t: key => key });
  const clear = nodes(tree, node => node.type === "button" && node.props?.children?.includes("history.clear"))[0];
  clear.props.onClick();
  assert.deepEqual(h.notices, [{ msg: "library.actionFailed", error: true }]);
});

test("Favoriten-Suchaktion: Schreibfehler meldet nur den Fehler", () => {
  const h = component("src/custom-app/modules/favorites/Favorites.tsx", {
    "shared/library": { currentTrack: () => song, toggleFavorite: () => true,
      addFavorite() { throw Error("QuotaExceededError"); } },
    "collection-view": { collectionPage: entries => ({ items: entries, page: 0, pages: 1, total: entries.length }), filterCollection: entries => entries },
    "bulk-selection": { toggleTrackSelection: (current) => current },
    "BulkTrackActions": { BulkTrackActions: () => null },
    "CollectionControls": { CollectionControls: () => null },
    "collection-display": {
      orderCollection: tracks => tracks,
      readCollectionDisplay: () => ({ sort: "original", compact: false }),
      rememberCollectionDisplay() {},
    },
    "TrackList": { TrackList: () => null },
    "TrackSearch": { TrackSearch: () => null },
    "useToolkitData": { useToolkitData: () => ({ favorites: [] }) },
  });
  const tree = h.exports.Favorites({ t: key => key });
  const search = nodes(tree, node => node.type?.name === "TrackSearch")[0];
  assert.ok(search);
  assert.doesNotThrow(() => search.props.onChoose(song));
  assert.deepEqual(h.notices, [{ msg: "library.actionFailed", error: true }]);
});

test("Titelliste: synchroner Storage-Fehler wird sichtbar abgefangen", () => {
  const h = component("src/custom-app/components/TrackList.tsx", {
    "shared/library": { playTrack: async () => {} },
  });
  const tree = h.exports.TrackList({ tracks: [song], emptyText: "leer", action: () => { throw Error("Storage"); }, actionErrorLabel: "Fehlgeschlagen" });
  const buttons = nodes(tree, node => node.type === "button");
  assert.equal(buttons.length, 2);
  assert.doesNotThrow(() => buttons[1].props.onClick());
  assert.deepEqual(h.notices, [{ msg: "Fehlgeschlagen", error: true }]);
});

test("Titelliste: asynchrone Aktion meldet Fehler ohne unhandled rejection", async () => {
  const h = component("src/custom-app/components/TrackList.tsx", { "shared/library": { playTrack: async () => {} } });
  const tree = h.exports.TrackList({ tracks: [song], emptyText: "leer", action: async () => { throw Error("async"); }, actionErrorLabel: "Storagefehler" });
  nodes(tree, node => node.type === "button")[1].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.notices, [{ msg: "Storagefehler", error: true }]);
});

test("Kontextmenü: Storagefehler erzeugt nur Fehlermeldung, keinen falschen Erfolg", () => {
  const filename = "src/extension/modules/context-actions/ContextActionsModule.ts";
  let source = stripTypeScriptTypes(readFileSync(path.join(root, filename), "utf8"), { mode: "strip" });
  source = source.replace(/^import\s+.*?;\s*$/gm, "").replace(/\bexport\s+const\s+contextActionsModule\b/, "const contextActionsModule");
  source += "\nexports.module = contextActionsModule;";
  const notices = [];
  let toggle = () => { throw Error("Storage defekt"); };
  let action;
  // Spicetify erzeugt zusätzlich einen Profilmenüeintrag. Nur das ContextMenu
  // darf den geprüften Mehrfachauswahl-Callback ersetzen.
  const contextClass = class { constructor(_name, cb) { action = cb; } register() {} deregister() {} };
  const profileClass = class { constructor(_name, _disabled, cb) { this.callback = cb; } register() {} deregister() {} };
  const exports = {};
  runInNewContext(source, {
    exports, Spicetify: { ContextMenu: { Item: contextClass }, Menu: { Item: profileClass }, showNotification: (msg, error = false) => notices.push({ msg, error }) },
    currentTrack: () => song, toggleFavorite: (...args) => toggle(...args), runtimeText: key => key, parseSpotifyTrackInput,
    console: { error() {} },
  }, { timeout: 1000 });
  exports.module.start();
  assert.doesNotThrow(() => action([song.uri]));
  assert.deepEqual(notices, [{ msg: "library.actionFailed", error: true }]);
  toggle = () => true;
  action([song.uri]);
  assert.deepEqual(notices[1], { msg: "runtime.bookmarkAdded", error: false });
});

test("Extension-Übersetzung: Ausfall des Settings-Speichers blockiert Fehlermeldungen nicht", () => {
  const filename = "src/shared/runtime-i18n.ts";
  let source = stripTypeScriptTypes(readFileSync(path.join(root, filename), "utf8"), { mode: "strip" });
  source = source.replace(/^import\s+.*?;\s*$/gm, "").replace(/\bexport\s+function\s+runtimeText\b/, "function runtimeText");
  source += "\nexports.runtimeText = runtimeText;";
  const exports = {};
  runInNewContext(source, {
    exports, console: { warn() {} },
    loadSettings: () => { throw Error("Storage down"); },
    createTranslator: locale => key => `${locale}/${key}`,
    resolveLocale: locale => locale,
  }, { timeout: 1000 });
  assert.equal(exports.runtimeText("library.actionFailed"), "auto/library.actionFailed");
});
