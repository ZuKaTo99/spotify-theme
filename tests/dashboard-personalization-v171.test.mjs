// =============================================================================
// Datei: tests/dashboard-personalization-v171.test.mjs
// Zweck: Neue Dashboard-Anpassung als reine Logik UND mit echten TSX-Klicks testen.
// Keine Spotify-Schreiboperation und keine echte lokale Storage-Veränderung.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const modulePath = "src/shared/dashboard-preferences.ts";
const enabled = ["dashboard", "favorites", "playlist-tools", "visualizer", "statistics", "listening-history", "song-notes", "theme-studio", "settings"];

function preferences(storage = new Map(), block = false) {
  const window = { localStorage: {
    getItem: key => { if (block) throw Error("Blocked"); return storage.get(key) ?? null; },
    setItem: (key, data) => { if (block) throw Error("Blocked"); storage.set(key, data); },
  } };
  return { mod: loadPureSharedModule(root, modulePath, { window }), storage, window };
}
const jsArray = collection => Array.from(collection);

test("Neue Dashboard-Installation hat vier sinnvolle Schnellzugriffe und alle Bereiche", () => {
  const { mod } = preferences();
  assert.deepEqual(jsArray(mod.defaultDashboardPreferences().shortcuts), ["favorites", "playlist-tools", "visualizer", "theme-studio"]);
  assert.deepEqual(jsArray(mod.defaultDashboardPreferences().hiddenSections), []);
  assert.equal(mod.defaultDashboardPreferences().period, "7d");
});

test("Storage-Normalisierung verwirft unbekannte, Extension- und doppelte Module", () => {
  const { mod } = preferences();
  assert.deepEqual(jsArray(mod.normalizeDashboardPreferences({
    shortcuts: ["favorites", "volume-scroll", "favorites", "spoof", "statistics", "song-notes"],
  }).shortcuts), ["favorites", "statistics", "song-notes"]);
});

test("Mehr als sechs gewünschte Schnellzugriffe werden begrenzt", () => {
  const { mod } = preferences();
  const all = [...mod.DASHBOARD_SHORTCUT_IDS, "dashboard"];
  const prefs = mod.normalizeDashboardPreferences({ shortcuts: all });
  assert.equal(prefs.shortcuts.length, 6);
  assert.ok(!prefs.shortcuts.includes("dashboard"));
  assert.equal(mod.toggleDashboardShortcut(prefs, "settings").shortcuts.length, 6);
});

test("Entfernen eines Schnellzugriffs bleibt am Limit möglich", () => {
  const { mod } = preferences();
  const six = mod.normalizeDashboardPreferences({ shortcuts: mod.DASHBOARD_SHORTCUT_IDS });
  const smaller = mod.toggleDashboardShortcut(six, six.shortcuts[1]);
  assert.equal(smaller.shortcuts.length, 5);
  assert.ok(!smaller.shortcuts.includes(six.shortcuts[1]));
  assert.equal(mod.toggleDashboardShortcut(smaller, "settings").shortcuts.length, 6);
});

test("Unzulässige Dashboard-Ziele werden nicht hinzugefügt", () => {
  const { mod } = preferences();
  const before = mod.defaultDashboardPreferences();
  assert.deepEqual(jsArray(mod.toggleDashboardShortcut(before, "mini-player").shortcuts), jsArray(before.shortcuts));
});

test("Verschieben ist stabil und ändert die ursprüngliche Liste nicht", () => {
  const { mod } = preferences();
  const before = mod.defaultDashboardPreferences();
  const result = mod.moveDashboardShortcut(before, "visualizer", -1);
  assert.deepEqual(jsArray(result.shortcuts), ["favorites", "visualizer", "playlist-tools", "theme-studio"]);
  assert.deepEqual(jsArray(before.shortcuts), ["favorites", "playlist-tools", "visualizer", "theme-studio"]);
});

test("Verschieben über die Listengrenze oder mit fremden IDs bleibt wirkungslos", () => {
  const { mod } = preferences();
  const before = mod.defaultDashboardPreferences();
  for (const [id, direction] of [["favorites", -1], ["theme-studio", 1], ["mini-player", 1]]) {
    assert.deepEqual(jsArray(mod.moveDashboardShortcut(before, id, direction).shortcuts), jsArray(before.shortcuts));
  }
});

test("Verborgene Dashboard-Bereiche sind dedupliziert und nur bekannte IDs", () => {
  const { mod } = preferences();
  const result = mod.normalizeDashboardPreferences({ hiddenSections: ["recent", "unknown", "recent", "activity"], period: "bad" });
  assert.deepEqual(jsArray(result.hiddenSections), ["recent", "activity"]);
  assert.equal(result.period, "7d");
});

test("Bereiche können ein- und ausgeblendet werden, ohne anderes zu verändern", () => {
  const { mod } = preferences();
  const base = mod.defaultDashboardPreferences();
  const hidden = mod.toggleDashboardSection(base, "recent");
  assert.deepEqual(jsArray(hidden.hiddenSections), ["recent"]);
  assert.deepEqual(jsArray(mod.toggleDashboardSection(hidden, "recent").hiddenSections), []);
  assert.deepEqual(jsArray(base.hiddenSections), []);
});

test("Zeitraum 7d/30d/all lässt nur gültige Werte zu", () => {
  const { mod } = preferences();
  const base = mod.defaultDashboardPreferences();
  assert.equal(mod.setDashboardPeriod(base, "30d").period, "30d");
  assert.equal(mod.setDashboardPeriod(base, "all").period, "all");
  assert.equal(mod.setDashboardPeriod(base, "illegal").period, "7d");
});

test("Einstellungen überstehen erneutes Lesen, auch wenn alle Schnellzugriffe entfernt werden", () => {
  const { mod, storage } = preferences();
  const config = mod.normalizeDashboardPreferences({ shortcuts: [], hiddenSections: ["overview"], period: "all" });
  mod.rememberDashboardPreferences(config);
  const reloaded = preferences(storage).mod.readDashboardPreferences();
  assert.deepEqual(jsArray(reloaded.shortcuts), []);
  assert.deepEqual(jsArray(reloaded.hiddenSections), ["overview"]);
  assert.equal(reloaded.period, "all");
});

test("Kaputte, zu große und gesperrte Speicherwerte blockieren die Startseite nicht", () => {
  const { mod, storage } = preferences();
  storage.set(mod.DASHBOARD_STORAGE_KEY, "{");
  assert.equal(mod.readDashboardPreferences().shortcuts.length, 4);
  storage.set(mod.DASHBOARD_STORAGE_KEY, "x".repeat(5000));
  assert.equal(mod.readDashboardPreferences().period, "7d");
  const blocked = preferences(storage, true).mod;
  blocked.rememberDashboardPreferences(blocked.defaultDashboardPreferences());
  assert.equal(blocked.readDashboardPreferences().shortcuts.length, 4);
});

test("Fehlerhafte Werte und fehlende Felder erhalten Defaults", () => {
  const { mod } = preferences();
  assert.equal(mod.normalizeDashboardPreferences(9).shortcuts.length, 4);
  assert.equal(mod.normalizeDashboardPreferences({ hiddenSections: "activity" }).shortcuts.length, 4);
  assert.deepEqual(jsArray(mod.normalizeDashboardPreferences({ shortcuts: "bad" }).shortcuts),
    jsArray(mod.defaultDashboardPreferences().shortcuts));
});

function flatten(node, output = []) {
  if (Array.isArray(node)) node.forEach(n => flatten(n, output));
  else if (node && typeof node === "object") {
    output.push(node);
    flatten(node.props?.children, output);
  }
  return output;
}

/** Reelle Dashboard-Handler aus TSX, aber React und Spotify vollständig isoliert. */
function ui({ blocked = false, active = enabled, saved } = {}) {
  const store = new Map();
  const { mod, window } = preferences(store, blocked);
  if (saved) store.set(mod.DASHBOARD_STORAGE_KEY, JSON.stringify(saved));
    let index = 0;
  const states = [];
  const refs = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: Symbol("Fragment"),
    useState(initial) {
      const id = index++;
      if (!(id in states)) states[id] = typeof initial === "function" ? initial() : initial;
      return [states[id], next => { states[id] = typeof next === "function" ? next(states[id]) : next; }];
    },
    useRef(value) {
      const id = index++;
      if (!(id in refs)) refs[id] = { current: value };
      return refs[id];
    },
    useMemo: fn => fn(),
    useEffect: () => {},
  };
  const mockSpicetify = { React, Player: {
    data: null, isPlaying: () => false, getProgress: () => 0, getDuration: () => 0,
    togglePlay() {}, next() {}, addEventListener() {}, removeEventListener() {},
  } };
  const output = {};
  runInNewContext(compileTsxForTest(root, "src/custom-app/modules/dashboard/Dashboard.tsx"), {
    exports: output, Spicetify: mockSpicetify, window, document: { hidden: false },
    console,
    require(name) {
      if (name.includes("dashboard-preferences")) return mod;
      if (name.includes("feature-titles")) return { getFeatureTitle: id => id };
      if (name.includes("features")) return { getEnabledFeaturesBySurface: surface =>
        surface === "custom-app" ? active.map(id => ({ id })) : [] };
      if (name.includes("library")) return { currentTrack: () => null, toggleFavorite: () => false };
      if (name.includes("dashboard-summary")) return { summarizeDashboard: () =>
        ({ changes: 1, distinct: 1, topArtist: null, latest: [] }) };
      if (name.includes("listening-insights")) return { analyzeListeningHistory: (_history, period) =>
        ({ events: period === "all" ? 123 : period === "30d" ? 30 : 7, unique: 3,
           daily: [], artists: [], tracks: [], today: 0, activeDays: 0 }) };
      if (name.includes("ListeningActivity")) return { ListeningActivity: () => null };
      if (name.includes("artwork")) return { spotifyArtworkUrl: () => null };
      if (name.includes("player-progress")) return { normalizedPlayerProgress: () =>
        ({ percent: 0, elapsed: "0:00", total: "0:00" }) };
      if (name.includes("useToolkitData")) return { useToolkitData: () =>
        ({ favorites: [], history: [], notes: [] }) };
      if (name.includes("TrackList")) return { TrackList: () => null };
      if (name.includes("dashboard-polling")) return { dashboardProgressDelayMs: () => 1000, sameDashboardProgress: () => true };
      throw Error(`Unexpected import ${name}`);
    },
  }, { timeout: 5000 });
  const navigate = [];
  const features = Object.fromEntries(enabled.map(id => [id, { customTitle: "", enabled: true }]));
  const render = () => {
    index = 0;
    return flatten(output.Dashboard({ features,
      t: (key, args) => args?.title ? `${key}:${args.title}` : key,
      onNavigate: id => navigate.push(id), onOpenQuick: () => navigate.push("quick") }));
  };
  const button = label => render().find(n => n.type === "button" && n.props?.["aria-label"] === label);
  const textButton = label => render().find(n => n.type === "button" && n.props?.children?.includes(label));
  return { mod, render, button, textButton, storage: store, navigate };
}

test("Dashboard: eigene Schnellzugriffe bearbeiten und in neuer Reihenfolge verwenden", () => {
  const app = ui();
  app.textButton("dashboard.customize").props.onClick();
  app.button("dashboard.moveDown:favorites").props.onClick();
  const next = app.render().find(n => n.props?.className === "zukato-dashboard__shortcut-grid");
  const buttons = flatten(next).filter(n => n.type === "button");
  const ids = buttons.map(n => n.props.children[1].props.children.flat().join(""));
  assert.deepEqual(ids.slice(0, 2), ["playlist-tools", "favorites"]);
  buttons[0].props.onClick();
  assert.deepEqual(app.navigate, ["playlist-tools"]);
});

test("Dashboard: schnelle Änderungen an zwei Schnellzugriffen verlieren keine Auswahl", () => {
  const app = ui();
  app.textButton("dashboard.customize").props.onClick();
  const remove1 = app.button("dashboard.removeShortcut:favorites");
  const remove2 = app.button("dashboard.removeShortcut:visualizer");
  remove1.props.onClick();
  remove2.props.onClick();
  assert.deepEqual(JSON.parse(app.storage.get(app.mod.DASHBOARD_STORAGE_KEY)).shortcuts,
    ["playlist-tools", "theme-studio"]);
});

test("Dashboard: deaktivierte Module bleiben auch bei gespeicherten Links unerreichbar", () => {
  const app = ui({ active: ["dashboard", "favorites", "statistics", "settings"] });
  const grid = app.render().find(n => n.props?.className === "zukato-dashboard__shortcut-grid");
  const buttons = flatten(grid).filter(n => n.type === "button");
  assert.equal(buttons.length, 1);
  buttons[0].props.onClick();
  assert.deepEqual(app.navigate, ["favorites"]);
});

test("Dashboard: ausgeblendete Bereiche verschwinden, gerade laufender Player bleibt", () => {
  const app = ui();
  app.textButton("dashboard.customize").props.onClick();
  const checkbox = app.render().find(n => n.type === "input" && n.props?.type === "checkbox" && n.props?.checked);
  checkbox.props.onChange();
  const tree = app.render();
  assert.ok(!tree.some(n => n.props?.className === "zukato-dashboard__activity"));
  assert.ok(tree.some(n => n.props?.className === "zukato-dashboard__now"));
});

test("Dashboard: eigener Statistikzeitraum aktualisiert Kennzahlen und wird gespeichert", () => {
  const app = ui();
  const findPeriod = name => app.render().find(n => n.type === "button" &&
    n.props?.children?.includes(`stats.period.${name}`));
  assert.equal(findPeriod("7d").props["aria-pressed"], true);
  findPeriod("all").props.onClick();
  assert.equal(findPeriod("all").props["aria-pressed"], true);
  assert.equal(JSON.parse(app.storage.get(app.mod.DASHBOARD_STORAGE_KEY)).period, "all");
  assert.ok(app.render().some(n => n.type === "strong" && n.props?.children?.includes(123)));
});

test("Dashboard: Reset stellt auch nach Änderungen alle drei Vorgaben wieder her", () => {
  const app = ui();
  app.textButton("dashboard.customize").props.onClick();
  app.button("dashboard.removeShortcut:favorites").props.onClick();
  // v1.72: die erste Karte sind Kennzahlen; andere Karte ausblenden,
  // damit der Zeitraumfilter im selben Test erreichbar bleibt.
  app.render().filter(n => n.type === "input" && n.props?.type === "checkbox")[1].props.onChange();
  app.render().find(n => n.type === "button" && n.props?.children?.includes("stats.period.all")).props.onClick();
  app.textButton("dashboard.reset").props.onClick();
  const current = JSON.parse(app.storage.get(app.mod.DASHBOARD_STORAGE_KEY));
  assert.deepEqual(current.shortcuts, ["favorites", "playlist-tools", "visualizer", "theme-studio"]);
  assert.deepEqual(current.hiddenSections, []);
  assert.equal(current.period, "7d");
});

// v1.72: Echte TSX-Callbacks statt ausschließlich Normalisierungsprüfungen.
test("Dashboard v1.72: Informationskarten folgen gespeicherter Reihenfolge", () => {
  const app = ui();
  app.textButton("dashboard.customize").props.onClick();
  app.button("dashboard.moveUp:dashboard.section.activity").props.onClick();
  const order = app.render().filter(n => n.props?.className?.startsWith("zukato-dashboard__card ")).map(n => n.props.className);
  assert.ok(order[0].includes("activity"));
  assert.ok(order[1].includes("metrics"));
});
test("Dashboard v1.72: schnelle Kartenklicks speichern beide Änderungen", () => {
  const app = ui();
  app.textButton("dashboard.customize").props.onClick();
  const moveNotes = app.button("dashboard.moveUp:dashboard.section.notes");
  const moveStats = app.button("dashboard.moveDown:dashboard.section.stats");
  moveNotes.props.onClick(); moveStats.props.onClick();
  assert.deepEqual(JSON.parse(app.storage.get(app.mod.DASHBOARD_STORAGE_KEY)).cardOrder,
    ["activity","stats","recent","overview","notes","favorites"]);
});
test("Dashboard v1.72: deaktivierte Favoriten- und Notizmodule verbergen Vorschauen", () => {
  const app = ui({ active: ["dashboard","statistics","settings"] });
  const classes = app.render().filter(n => typeof n.props?.className === "string").map(n => n.props.className);
  assert.ok(!classes.some(n => n.includes("zukato-dashboard__notes")));
  assert.equal(classes.filter(n => n === "zukato-dashboard__card zukato-dashboard__recent").length,1);
});
test("Dashboard v1.72: Notizvorschau verlinkt auf vorhandenes Notizmodul", () => {
  const app=ui();
  const cards=app.render().filter(n => n.props?.className?.startsWith("zukato-dashboard__card "));
  assert.equal(cards.length,6);
  app.textButton("dashboard.openNotes").props.onClick();
  assert.deepEqual(app.navigate,["song-notes"]);
});
