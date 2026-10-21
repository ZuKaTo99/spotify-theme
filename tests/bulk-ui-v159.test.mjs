// =============================================================================
// Datei: tests/bulk-ui-v159.test.mjs
// Zweck: Echte TSX-Eventhandler der neuen Mehrfachaktionen durchspielen.
// Keine Verbindung zu Spotify und keine Benutzerbibliotheken.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const pure = file => loadPureSharedModule(root, `src/shared/${file}.ts`);
const selection = pure("bulk-selection");
const queue = pure("queue-batches");
const song = n => ({ uri: `spotify:track:${String(n).padStart(22, "0")}`, title: `Song ${n}`, artist: "Artist", album: "Album" });

function nodes(node, condition, result = []) {
  if (Array.isArray(node)) { node.forEach(entry => nodes(entry, condition, result)); return result; }
  if (!node || typeof node !== "object") return result;
  if (condition(node)) result.push(node);
  nodes(node.props?.children, condition, result);
  return result;
}

/** Kompilierte TSX-Komponente mit einer minimalen React-/Spotify-Runtime laden. */
function mount(file, overrides = {}) {
  const exports = {};
  const apiCalls = [];
  const stores = [];
  let confirm = true;
  const runtime = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => [typeof initial === "function" ? initial() : initial, next => stores.push(next)],
    useRef: initial => ({ current: initial }),
    useEffect() {},
  };
  const library = { addFavoritesBatch: tracks => ({ added: tracks.length, skipped: 0 }), removeFavoritesBatch: uris => uris.length };
  const imports = {
    "bulk-selection": selection,
    "queue-batches": queue,
    "shared/library": library,
    "PlaylistDestination": { PlaylistDestination: () => null },
  };
  runInNewContext(compileTsxForTest(root, file), {
    exports,
    Spicetify: { React: runtime, addToQueue: async tracks => { apiCalls.push(tracks.map(t => t.uri)); } },
    window: { confirm: () => confirm },
    console: { error() {} },
    require: spec => {
      const match = Object.entries(imports).find(([key]) => spec.includes(key));
      if (!match) throw Error(`Fehlender UI-Test-Import ${spec}`);
      return match[1];
    },
  }, { timeout: 2000 });
  return { exports, apiCalls, stores, library, setConfirm: value => { confirm = value; } };
}

const t = (key, values = {}) => key + (Object.keys(values).length ? ":" + Object.values(values).join(",") : "");
const treeFor = (h, props) => h.exports.BulkTrackActions({ t, ...props });
const button = (tree, label) => nodes(tree, e => e.type === "button" && e.props?.children?.includes(label))[0];
const propsFor = (tracks, selectedUris = new Set(), extra = {}) => ({
  sourceTracks: tracks, filteredTracks: tracks, pageTracks: tracks.slice(0, 40),
  selectedUris, onSelectionChange() {}, mode: "favorites", ...extra,
});

test("UI: Nicht gewählte Titel können weder gelöscht noch eingereiht werden", () => {
  const h = mount("src/custom-app/components/BulkTrackActions.tsx");
  const tree = treeFor(h, propsFor([song(1)]));
  assert.equal(button(tree, "bulk.queue").props.disabled, true);
  assert.equal(button(tree, "bulk.remove").props.disabled, true);
});

test("UI: 'Alle Treffer' wählt gefilterte Titel, keine unsichtbaren", () => {
  const h = mount("src/custom-app/components/BulkTrackActions.tsx");
  const all = Array.from({ length: 90 }, (_, n) => song(n));
  let updated;
  const tree = treeFor(h, propsFor(all, new Set(), {
    filteredTracks: all.slice(10, 65), onSelectionChange: x => { updated = x; },
  }));
  button(tree, "bulk.selectResults").props.onClick();
  assert.equal(updated.size, 55);
  assert.equal(updated.has(song(0).uri), false);
  assert.equal(updated.has(song(64).uri), true);
});

test("UI: 'Seite auswählen' nimmt höchstens die dargestellten 40 Titel", () => {
  const h = mount("src/custom-app/components/BulkTrackActions.tsx");
  const all = Array.from({ length: 99 }, (_, n) => song(n));
  let updated;
  const tree = treeFor(h, propsFor(all, new Set(), { onSelectionChange: x => { updated = x; } }));
  button(tree, "bulk.selectPage").props.onClick();
  assert.equal(updated.size, 40);
});

test("UI: Doppelklick während laufender Queue-Aktion führt nicht zu doppeltem Versand", async () => {
  const h = mount("src/custom-app/components/BulkTrackActions.tsx");
  let unblock;
  h.apiCalls.length = 0;
  const gate = new Promise(resolve => { unblock = resolve; });
  // Der erste Callback wird absichtlich blockiert; zweiter Klick muss wegfallen.
  const tree = treeFor(h, propsFor([song(1)], new Set([song(1).uri])));
  const queueButton = button(tree, "bulk.queue");
  queueButton.props.onClick();
  queueButton.props.onClick();
  await Promise.resolve();
  assert.equal(h.apiCalls.length, 1);
  unblock();
  await gate;
});

test("UI: Entfernen erfordert Bestätigung und gibt Auswahl erst nach Erfolg frei", () => {
  const h = mount("src/custom-app/components/BulkTrackActions.tsx");
  let removed = 0; let cleared = null;
  h.library.removeFavoritesBatch = uris => { removed += uris.length; return uris.length; };
  const tree = treeFor(h, propsFor([song(1), song(2)], new Set([song(1).uri]), {
    onSelectionChange: next => { cleared = next; },
  }));
  h.setConfirm(false);
  button(tree, "bulk.remove").props.onClick();
  assert.equal(removed, 0);
  h.setConfirm(true);
  button(tree, "bulk.remove").props.onClick();
  assert.equal(removed, 1);
  assert.equal(cleared.size, 0);
});

test("UI: History-Modus zeigt Speichern statt Entfernen", () => {
  const h = mount("src/custom-app/components/BulkTrackActions.tsx");
  const tree = treeFor(h, propsFor([song(1)], new Set([song(1).uri]), { mode: "history" }));
  assert.equal(button(tree, "bulk.remove"), undefined);
  assert.ok(button(tree, "bulk.save"));
});
