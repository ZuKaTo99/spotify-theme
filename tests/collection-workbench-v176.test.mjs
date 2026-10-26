// =============================================================================
// Datei: tests/collection-workbench-v176.test.mjs
// Zweck: React-Anschluss, gemeinsame Speicherquelle und Auswahl über Seiten.
// Spotify und Browser werden nur simuliert; echte Client-Aktionen bleiben offen.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import esbuild from "esbuild";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const collectionView = loadPureSharedModule(root, "src/shared/collection-view.ts");
const storeCode = esbuild.buildSync({entryPoints: [path.join(root,
  "src/extension/modules/playlist-tools/named-collections/NamedCollections.ts")],
  bundle: true, platform: "node", format: "cjs", write: false}).outputFiles[0].text;
const storeModule = {exports: {}};
new Function("module", "exports", storeCode)(storeModule, storeModule.exports);
const uri = (n) => `spotify:track:${String(n).padStart(22, "0")}`;
const track = (n) => ({uri: uri(n), title: `Lied ${n}`, artist: "Künstler", album: "Album"});

function walk(node, result = []) {
  if (Array.isArray(node)) for (const child of node) walk(child, result);
  else if (node && typeof node === "object") {
    result.push(node);
    walk(node.props?.children, result);
  }
  return result;
}

/** Führt echte TSX-Callbacks mit lokalem Storage und einem Panel-Anschluss aus. */
function harness(sourceCount = 2) {
  const values = new Map();
  const state = [];
  const effects = [];
  const exports = {};
  let index = 0;
  let refreshes = 0;
  let exportAction;
  let creations = 0;
  let transfers = 0;
  let failTransfer = false;
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    useRef(initial) { const n = index++; return state[n] ??= {current: initial}; },
    useState(initial) {
      const n = index++;
      if (state[n] === undefined) state[n] = typeof initial === "function" ? initial() : initial;
      return [state[n], next => { state[n] = typeof next === "function" ? next(state[n]) : next; }];
    },
    useEffect(effect) { const n = index++; if (!state[n]) { state[n] = true; effects.push(effect); } },
  };
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  const collections = {useToolkitData: () => ({favorites: Array.from({length: sourceCount}, (_, n) => track(n)), history: []})};
  const panel = {mountNamedCollectionsPanel: (_host, options) => {
    exportAction = options.onExportConfirmed;
    options.onCollectionChanged(options.store.load(options.legacyTrackUris()));
    return {refresh() { refreshes++; }, destroy() {}};
  }};
  const components = {PlaylistDestination: () => null};
  runInNewContext(compileTsxForTest(root, "src/custom-app/modules/playlist-tools/CollectionWorkbench.tsx"), {
    exports, window: {localStorage: storage}, Set, Map, Object,
    Spicetify: {React: react, addToQueue: async () => {}, CosmosAsync: {post: async () => ({})}},
    require: name => {
      if (name.includes("useToolkitData")) return collections;
      if (name.includes("collection-view")) return collectionView;
      if (name.includes("queue-batches")) return {QueueBatchError: class extends Error {}, enqueueQueueBatches: async () => ({queued: 0})};
      if (name.includes("spotify-playlist-transfer")) return {
        addItemsToSpotifyPlaylist: async () => { transfers++; if (failTransfer) throw Error("network"); },
        createSpotifyPlaylist: async () => { creations++; return "spotify:playlist:0000000000000000000001"; },
      };
      if (name.includes("NamedCollectionsPanel")) return panel;
      if (name.includes("NamedCollections")) return storeModule.exports;
      if (name.includes("PlaylistDestination")) return components;
      throw Error(`Unexpected import: ${name}`);
    },
  }, {timeout: 4000});
  function render() { index = 0; return walk(exports.CollectionWorkbench({t: key => key})); }
  const first = render();
  first.find(node => node.props?.ref && node.type === "div").props.ref.current = {};
  for (const effect of effects.splice(0)) effect();
  function button(label) { return render().find(node => node.type === "button" && node.props?.children?.includes(label)); }
  return {render, button, values, exportPlan: plan => exportAction(plan),
    failTransfers: () => { failTransfer = true; },
    get refreshes() { return refreshes; },
    get creations() { return creations; }, get transfers() { return transfers; }};
}

test("Quellenauswahl schreibt in die aktive benannte Sammlung und aktualisiert das Panel", () => {
  const ui = harness();
  const source = ui.render().find(node => node.props?.["aria-label"] === "Quellen");
  const checkbox = walk(source).find(node => node.type === "input" && node.props?.type === "checkbox");
  checkbox.props.onChange();
  ui.button("Zur Sammlung hinzufügen").props.onClick();
  const saved = JSON.parse(ui.values.get("zukato:playlist-workspace:named-collections:v1"));
  assert.deepEqual(saved.collections[0].trackUris, [uri(0)]);
  assert.equal(saved.trackDetails[uri(0)].title, "Lied 0");
  assert.equal(ui.refreshes, 1);
  assert.ok(ui.render().some(node => node.props?.["aria-label"] === "Aktive Sammlung"));
});

test("Alle Suchtreffer wählt auch Songs außerhalb der ersten 40 Zeilen", () => {
  const ui = harness(45);
  const source = ui.render().find(node => node.props?.["aria-label"] === "Quellen");
  assert.equal(walk(source).filter(node => node.type === "input" && node.props?.type === "checkbox").length, 40);
  ui.button("Alle Suchtreffer auswählen").props.onClick();
  ui.button("Zur Sammlung hinzufügen").props.onClick();
  const saved = JSON.parse(ui.values.get("zukato:playlist-workspace:named-collections:v1"));
  assert.equal(saved.collections[0].trackUris.length, 45);
});

test("unklarer Spotify-Export erzeugt beim erneuten Klick keine zweite Playlist", async () => {
  const ui = harness();
  const plan = {collectionId: "id-1", name: "Meine Sammlung", trackUris: [uri(0)]};
  ui.failTransfers();
  await assert.rejects(() => ui.exportPlan(plan), /bitte in Spotify prüfen/);
  await assert.rejects(() => ui.exportPlan(plan), /bereits gestartet/);
  assert.equal(ui.creations, 1);
  assert.equal(ui.transfers, 1);
});
