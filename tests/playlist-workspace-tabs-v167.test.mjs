// =============================================================================
// Datei: tests/playlist-workspace-tabs-v167.test.mjs
// Zweck: Tab-Navigation mit tatsächlichen UI-Handlern prüfen; kein Spotify-Zugriff.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const tabs = loadPureSharedModule(root, "src/shared/playlist-workspace-tabs.ts");
const order = ["queue", "import", "manage", "transfer", "collections"];

function walk(node, result = []) {
  if (Array.isArray(node)) for (const child of node) walk(child, result);
  else if (node && typeof node === "object") {
    result.push(node);
    walk(node.props?.children, result);
  }
  return result;
}

// React render() ist hier absichtlich eine Simulation: Props und onClick-/
// onKeyDown-Callbacks werden tatsächlich aus dem kompilierten TSX ausgeführt.
function harness({ blocked = false, stored = null, count = 3 } = {}) {
  const values = [];
  const writes = [];
  const state = [];
  let index = 0;
  const exports = {};
  const components = {
    TrackSearch: () => null,
    PlaylistDestination: () => null,
    BulkLinkImporter: () => null,
    PlaylistManager: () => null,
    CollectionWorkbench: () => null,
  };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const n = index++;
      if (state[n] === undefined) state[n] = typeof initial === "function" ? initial() : initial;
      return [state[n], next => { state[n] = typeof next === "function" ? next(state[n]) : next; }];
    },
    useRef: initial => ({ current: initial }),
  };
  const local = { getItem: () => { if (blocked) throw Error("blocked"); return stored; },
    setItem: (key, value) => { if (blocked) throw Error("blocked"); writes.push([key, value]); } };
  runInNewContext(compileTsxForTest(root, "src/custom-app/modules/playlist-tools/PlaylistTools.tsx"), {
    exports, window: { sessionStorage: local },
    Spicetify: { React: react, showNotification() {}, addToQueue: async () => {} },
    console: { error() {} },
    require: name => {
      if (name.includes("playlist-workspace-tabs")) return tabs;
      if (name.includes("useToolkitData")) return { useToolkitData: () => ({ favorites: Array.from({ length: count }, (_, i) => ({ uri: `spotify:track:${String(i).padStart(22, "0")}` })) }) };
      if (name.includes("shared/library")) return { currentTrack: () => null };
      if (name.includes("queue-batches")) return { QueueBatchError: class extends Error {}, enqueueQueueBatches: async () => ({ queued: 0, skipped: 0 }) };
      if (name.includes("track-search")) return { parseSpotifyTrackInput: x => x };
      for (const [component, implementation] of Object.entries(components))
        if (name.includes(component)) return { [component]: implementation };
      throw Error(`Unexpected import: ${name}`);
    },
  }, { timeout: 4000 });
  function render() { index = 0; return walk(exports.PlaylistTools({ t: (key) => key })); }
  function tab(name) { return render().find(n => n.type === "button" && n.props?.["data-playlist-tab"] === name); }
  function panel(name) { return render().find(n => n.type === "section" && n.props?.id === `zukato-playlist-panel-${name}`); }
  function keyboard(name, key) {
    let prevented = 0, focused = null;
    const container = render().find(n => n.props?.role === "tablist");
    container.props.onKeyDown({ key, target: { getAttribute: () => name },
      preventDefault() { prevented++; },
      currentTarget: { querySelector() { return { focus() { focused = true; } }; } } });
    return { prevented, focused };
  }
  return { render, tab, panel, keyboard, writes, values };
}

test("Nur erlaubte Tabs aus dem Sitzungsspeicher öffnen", () => {
  assert.deepEqual(order.map(x => tabs.normalizePlaylistWorkspaceTab(x)), order);
  for (const value of ["unknown", "", null, [], 12, "MANAGE"])
    assert.equal(tabs.normalizePlaylistWorkspaceTab(value), "queue");
});

test("Pfeiltasten navigieren zyklisch und Home/End springen zu den Rändern", () => {
  assert.equal(tabs.nextPlaylistWorkspaceTab("queue", "ArrowLeft"), "collections");
  assert.equal(tabs.nextPlaylistWorkspaceTab("collections", "ArrowRight"), "queue");
  assert.equal(tabs.nextPlaylistWorkspaceTab("import", "Home"), "queue");
  assert.equal(tabs.nextPlaylistWorkspaceTab("import", "End"), "collections");
  assert.equal(tabs.nextPlaylistWorkspaceTab("import", "Enter"), null);
});

test("Nur das aktive Panel ist sichtbar; die Sammlung startet erst bei Bedarf", () => {
  const ui = harness();
  assert.deepEqual(order.map(x => ui.panel(x).props.hidden), [false, true, true, true, true]);
  assert.equal(ui.render().filter(n => typeof n.type === "function").length, 4);
  for (const name of order) {
    const target = ui.tab(name).props;
    assert.equal(target.role, "tab");
    assert.equal(target["aria-controls"], `zukato-playlist-panel-${name}`);
    assert.equal(ui.panel(name).props["aria-labelledby"], `zukato-playlist-tab-${name}`);
  }
  ui.tab("collections").props.onClick();
  assert.equal(ui.render().filter(n => typeof n.type === "function").length, 5);
  ui.tab("queue").props.onClick();
  assert.equal(ui.render().filter(n => typeof n.type === "function").length, 5);
});

test("Klick öffnet nur Zielpanel und merkt Tab für die Sitzung", () => {
  const ui = harness();
  ui.tab("manage").props.onClick();
  assert.deepEqual(order.map(x => ui.panel(x).props.hidden), [true,true,false,true,true]);
  assert.deepEqual(ui.writes, [[tabs.PLAYLIST_WORKSPACE_TAB_STORAGE_KEY, "manage"]]);
  assert.equal(ui.tab("manage").props["aria-selected"], true);
  assert.equal(ui.tab("manage").props.tabIndex, 0);
  assert.equal(ui.tab("queue").props.tabIndex, -1);
});

test("Gespeicherten Bereich wieder öffnen, statt immer zum Anfang zu springen", () => {
  const ui = harness({ stored: "import" });
  assert.equal(ui.panel("import").props.hidden, false);
  assert.equal(ui.panel("queue").props.hidden, true);
  const collections = harness({ stored: "collections" });
  assert.equal(collections.panel("collections").props.hidden, false);
  assert.equal(collections.render().filter(n => typeof n.type === "function").length, 5);
});

test("Gesperrter Sitzungsspeicher verhindert weder Start noch Tabwechsel", () => {
  const ui = harness({ blocked: true });
  assert.equal(ui.panel("queue").props.hidden, false);
  ui.tab("transfer").props.onClick();
  assert.equal(ui.panel("transfer").props.hidden, false);
});

test("ArrowRight verschiebt Tab und Tastaturfokus gemeinsam", () => {
  const ui = harness();
  assert.deepEqual(ui.keyboard("queue", "ArrowRight"), { prevented: 1, focused: true });
  assert.equal(ui.panel("import").props.hidden, false);
});

test("Fremde Tastaturereignisse im Suchfeld werden nicht abgefangen", () => {
  const ui = harness();
  assert.deepEqual(ui.keyboard(null, "ArrowRight"), { prevented: 0, focused: null });
  assert.deepEqual(ui.keyboard("queue", "Tab"), { prevented: 0, focused: null });
  assert.equal(ui.panel("queue").props.hidden, false);
});

test("Favoriten-Anzahl wird am Übertragungs-Tab angezeigt", () => {
  const ui = harness({ count: 12 });
  const contents = ui.tab("transfer").props.children;
  assert.ok(contents.some(node => node?.type === "small" && node.props.children.includes(12)));
});
