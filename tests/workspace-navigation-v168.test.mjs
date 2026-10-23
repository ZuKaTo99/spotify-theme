// =============================================================================
// Datei: tests/workspace-navigation-v168.test.mjs
// Zweck: v1.68-Suche, angeheftete Module und echte TSX-Eventhandler testen.
// Keine Spotify-Requests; lokaler Speicher und React werden isoliert simuliert.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const src = "src/shared/workspace-navigation.ts";
const items = [
  { id: "dashboard", title: "Übersicht" },
  { id: "listening-history", title: "Hörverlauf" },
  { id: "favorites", title: "Favoriten" },
  { id: "playlist-tools", title: "Playlist-Werkzeuge" },
  { id: "visualizer", title: "Visualizer" },
  { id: "settings", title: "Einstellungen" },
];

function api(storage = new Map(), blocked = false) {
  const mockWindow = { localStorage: {
    getItem: key => { if (blocked) throw new Error("SecurityError"); return storage.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw new Error("SecurityError"); storage.set(key, value); },
  } };
  return { mod: loadPureSharedModule(root, src, { window: mockWindow }), storage, window: mockWindow };
}

function nodes(tree, result = []) {
  if (Array.isArray(tree)) for (const child of tree) nodes(child, result);
  else if (tree && typeof tree === "object") {
    result.push(tree);
    nodes(tree.props?.children, result);
  }
  return result;
}

function ui({ blocked = false, initial = null, available = items } = {}) {
  const storage = new Map();
  const visited = [];
  const helpers = api(storage, blocked).mod;
  if (initial != null) storage.set(helpers.WORKSPACE_PINS_STORAGE_KEY, initial);
  let index = 0;
  const state = [];
  const refs = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initialState) {
      const slot = index++;
      if (!(slot in state)) state[slot] = typeof initialState === "function" ? initialState() : initialState;
      return [state[slot], next => { state[slot] = typeof next === "function" ? next(state[slot]) : next; }];
    },
    useRef(initialValue) {
      const slot = index++;
      if (!(slot in refs)) refs[slot] = { current: initialValue };
      return refs[slot];
    },
  };
  const exported = {};
  runInNewContext(compileTsxForTest(root, "src/custom-app/components/AppNavigation.tsx"), {
    exports: exported,
    Spicetify: { React: react },
    require(name) {
      if (name.includes("workspace-navigation")) return helpers;
      throw Error(`Unexpected import ${name}`);
    },
  }, { timeout: 5000 });
  let currentItems = available;
  const render = () => {
    index = 0;
    return nodes(exported.AppNavigation({ items: currentItems,
      activeFeatureId: "dashboard", ariaLabel: "ZuKaTo",
      t: (key, args) => args?.title ? `${key}/${args.title}` : key,
      onSelect: id => visited.push(id), }));
  };
  const button = label => render().find(node => node.type === "button" && node.props?.["aria-label"] === label);
  const input = () => render().find(node => node.type === "input" && node.props?.type === "search");
  return { render, button, input, visited, storage, helpers, setAvailable: value => { currentItems = value; } };
}

test("Modulsuche: Umlaute und Groß-/Kleinschreibung spielen keine Rolle", () => {
  const m = api().mod;
  assert.deepEqual(Array.from(m.filterWorkspaceNavigation(items, "hor"), x => x.id), ["listening-history"]);
  assert.deepEqual(Array.from(m.filterWorkspaceNavigation(items, "ÜBER"), x => x.id), ["dashboard"]);
  assert.deepEqual(Array.from(m.filterWorkspaceNavigation(items, "playlist"), x => x.id), ["playlist-tools"]);
  assert.deepEqual(Array.from(m.filterWorkspaceNavigation(items, "Musik", () => "Musik & Sammlung"), x => x.id), items.map(x => x.id));
  assert.equal(m.filterWorkspaceNavigation(items, "keine Treffer").length, 0);
  assert.deepEqual(Array.from(m.filterWorkspaceNavigation(items, ""), x => x.id), items.map(x => x.id));
});

test("Speicher: unbekannte, doppelte und Extension-IDs werden nicht angeheftet", () => {
  const m = api().mod;
  assert.deepEqual(Array.from(m.normalizeWorkspacePins([
    "favorites", "favorites", "volume-scroll", "unknown", "visualizer", "dashboard",
  ])), ["favorites", "visualizer", "dashboard"]);
  assert.deepEqual(Array.from(m.normalizeWorkspacePins("favorites")), []);
  assert.deepEqual(Array.from(m.normalizeWorkspacePins(null)), []);
});

test("Pin-Limit: maximal fünf, aber Entfernen bleibt jederzeit möglich", () => {
  const m = api().mod;
  const pins = ["dashboard", "favorites", "visualizer", "playlist-tools", "settings"];
  assert.deepEqual(Array.from(m.toggleWorkspacePin(pins, "song-notes")), pins);
  assert.deepEqual(Array.from(m.toggleWorkspacePin(pins, "settings")), pins.slice(0, 4));
  assert.deepEqual(Array.from(m.toggleWorkspacePin([], "sleep-timer")), []);
});

test("Persistenz: fünf angeheftete Ziele überstehen erneutes Laden", () => {
  const { mod, storage } = api();
  const pinned = ["favorites", "visualizer", "playlist-tools"];
  mod.rememberWorkspacePins(pinned);
  assert.deepEqual(Array.from(mod.readWorkspacePins()), pinned);
  assert.deepEqual(Array.from(api(storage).mod.readWorkspacePins()), pinned);
});

test("Kaputter, übergroßer oder blockierter Speicher verhindert die Navigation nicht", () => {
  const { mod, storage } = api();
  storage.set(mod.WORKSPACE_PINS_STORAGE_KEY, "{garbage");
  assert.deepEqual(Array.from(mod.readWorkspacePins()), []);
  storage.set(mod.WORKSPACE_PINS_STORAGE_KEY, "a".repeat(3000));
  assert.deepEqual(Array.from(mod.readWorkspacePins()), []);
  const blocked = api(new Map(), true).mod;
  assert.deepEqual(Array.from(blocked.readWorkspacePins()), []);
  assert.doesNotThrow(() => blocked.rememberWorkspacePins(["favorites"]));
});

test("UI: Pin-Klick merkt Ziel und zeigt es sofort im Schnellzugriff", () => {
  const h = ui();
  h.button("navigation.pin/Favoriten").props.onClick();
  assert.equal(h.button("navigation.unpin/Favoriten").props["aria-pressed"], true);
  assert.equal(h.render().filter(node => node.props?.className === "spotify-toolkit-navigation__pinned-list").length, 1);
  assert.deepEqual(JSON.parse(h.storage.get(h.helpers.WORKSPACE_PINS_STORAGE_KEY)), ["favorites"]);
});

test("UI: zwei schnelle Pin-Klicks behalten beide Ziele", () => {
  const h = ui();
  // Absichtlich ohne dazwischen neu zu rendern: React hat Props noch nicht aktualisiert.
  const first = h.button("navigation.pin/Favoriten");
  const second = h.button("navigation.pin/Visualizer");
  first.props.onClick(); second.props.onClick();
  assert.deepEqual(JSON.parse(h.storage.get(h.helpers.WORKSPACE_PINS_STORAGE_KEY)), ["favorites", "visualizer"]);
});

test("UI: deaktivierte Ziele dürfen auch mit gespeichertem Pin nicht geöffnet werden", () => {
  const h = ui({ initial: '["visualizer","favorites"]' });
  assert.equal(nodes(h.render().find(node => node.props?.className === "spotify-toolkit-navigation__pinned-list")?.props.children).filter(node => node.type === "button").length, 2);
  h.setAvailable(items.filter(item => item.id !== "visualizer"));
  const buttons = h.render().filter(node => node.type === "button" && node.props?.children?.includes?.("Visualizer"));
  assert.equal(buttons.length, 0);
  assert.deepEqual(h.visited, []);
  assert.deepEqual(JSON.parse(h.storage.get(h.helpers.WORKSPACE_PINS_STORAGE_KEY)), ["visualizer", "favorites"]);
});

test("UI: Schnellzugriff navigiert ohne eine zweite Modulinstanz zu erzeugen", () => {
  const h = ui({ initial: '["favorites"]' });
  const pinnedContainer = h.render().find(node => node.props?.className === "spotify-toolkit-navigation__pinned-list");
  nodes(pinnedContainer.props.children).find(node => node.type === "button").props.onClick();
  assert.deepEqual(h.visited, ["favorites"]);
});

test("UI: Suche öffnet eingeklappte Navigation und Escape löscht nur Suchtext", () => {
  const h = ui();
  h.render().find(node => node.type === "button" && node.props?.["aria-expanded"] !== undefined).props.onClick();
  assert.equal(h.render().find(node => node.props?.id === "zukato-workspace-navigation-groups"), undefined);
  h.input().props.onChange({ target: { value: "visual" } });
  assert.ok(h.render().find(node => node.props?.id === "zukato-workspace-navigation-groups"));
  assert.equal(h.button("navigation.pin/Favoriten"), undefined);
  let prevented = false;
  h.input().props.onKeyDown({ key: "Escape", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.input().props.value, "");
});

test("UI: unbekannte Suche zeigt verständlichen Leerstaat ohne Navigationseffekt", () => {
  const h = ui();
  h.input().props.onChange({ target: { value: "kein-modul-123" } });
  const status = h.render().find(node => node.type === "p" && node.props?.role === "status");
  assert.ok(status);
  assert.equal(status.props.children[0], "navigation.noResults");
  assert.deepEqual(h.visited, []);
});

test("UI: das sechste Modul lässt sich nicht still anheften", () => {
  const h = ui({ initial: '["dashboard","listening-history","favorites","playlist-tools","visualizer"]' });
  const pin = h.button("navigation.pin/Einstellungen");
  assert.equal(pin.props.disabled, true);
  h.button("navigation.unpin/Visualizer").props.onClick();
  assert.equal(h.button("navigation.pin/Einstellungen").props.disabled, false);
});


test("UI: Enter öffnet genau einen Suchtreffer ohne Spotify-Suchshortcut", () => {
  const h = ui();
  h.input().props.onChange({ target: { value: "Visualizer" } });
  let prevented = 0;
  h.input().props.onKeyDown({ key: "Enter", preventDefault() { prevented++; } });
  assert.deepEqual(h.visited, ["visualizer"]);
  assert.equal(prevented, 1);
});

test("UI: ArrowDown setzt Fokus nur bei vorhandener Treffer-Schaltfläche", () => {
  const h = ui();
  let focusCount = 0, prevented = 0;
  h.input().props.onKeyDown({ key: "ArrowDown", preventDefault() { prevented++; },
    currentTarget: { closest: () => ({ querySelector: () => ({ focus() { focusCount++; } }) }) } });
  assert.equal(focusCount, 1);
  assert.equal(prevented, 1);
  h.input().props.onChange({ target: { value: "keine-treffer" } });
  h.input().props.onKeyDown({ key: "ArrowDown", preventDefault() { prevented++; },
    currentTarget: { closest: () => ({ querySelector: () => { throw Error("should not query"); } }) } });
  assert.equal(prevented, 1);
});
