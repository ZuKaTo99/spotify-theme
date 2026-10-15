// =============================================================================
// Datei: tests/smoke.test.mjs
// Zweck: Node-Smoke-Tests der tatsächlich ausgelieferten Spicetify-Bundles.
// Reale Spotify-Integration ist zusätzlich vor Ort zu testen.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

/** Simuliert nur die von ZuKaTo angesprochenen Spicetify-Schnittstellen. */
function makeMockEnvironment() {
  const storage = new Map();
  const listeners = new Map();
  const menus = [];
  const contexts = [];
  const events = new Map();
  const notifications = [];
  const queued = [];
  const intervals = new Map();
  let lastInterval = 0;
  class CustomEventMock { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  const window = {
    addEventListener(type, callback) { events.set(type, [...(events.get(type) ?? []), callback]); },
    removeEventListener(type, callback) { events.set(type, (events.get(type) ?? []).filter((item) => item !== callback)); },
    dispatchEvent(event) { for (const callback of events.get(event.type) ?? []) callback(event); },
    setTimeout() { return 123; }, clearTimeout() {},
    setInterval(callback) { intervals.set(++lastInterval, callback); return lastInterval; },
    clearInterval(id) { intervals.delete(id); },
  };
  const document = {
    addEventListener() {}, removeEventListener() {},
    body: { append() {} },
    createElement() { return { style: {}, dataset: {}, setAttribute() {}, append() {}, addEventListener() {}, remove() {} }; },
  };
  class FakeMenu {
    constructor(name, state, onClick) { this.name = name; this.isEnabled = state; this.onClick = onClick; this.registered = false; menus.push(this); }
    register() { this.registered = true; } deregister() { this.registered = false; }
    setName(name) { this.name = name; } setState(value) { this.isEnabled = value; }
  }
  class FakeSubMenu extends FakeMenu {
    constructor(name, items) { super(name, false, () => {}); this.items = items; }
  }
  class FakeContext {
    constructor(name, onClick, shouldAdd) { this.name = name; this.onClick = onClick; this.shouldAdd = shouldAdd; this.registered = false; contexts.push(this); }
    register() { this.registered = true; } deregister() { this.registered = false; }
  }
  const player = {
    data: { playbackId: "id-1", item: { uri: "spotify:track:ABC123", name: "Test Song", album: { name: "Album" }, artists: [{ name: "Artist" }] } },
    addEventListener(type, callback) { listeners.set(type, [...(listeners.get(type) ?? []), callback]); },
    removeEventListener(type, callback) { listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== callback)); },
    emit(type) { for (const callback of listeners.get(type) ?? []) callback(); },
    getDuration: () => 180000, getProgress: () => 30000,
    isPlaying: () => true, getVolume: () => .5,
    formatTime: (value) => `${Math.floor(value / 1000)}s`,
    pause() {}, play() {}, next() {}, back() {}, togglePlay() {},
  };
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    Fragment: "Fragment",
    useState(initial) { return [typeof initial === "function" ? initial() : initial, () => {}]; },
    useEffect() {}, useCallback(value) { return value; },
    useRef(value) { return { current: value }; },
  };
  const Spicetify = {
    React, Player: player,
    Platform: { LocalStorageAPI: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) } },
    Menu: { Item: FakeMenu, SubMenu: FakeSubMenu },
    ContextMenu: { Item: FakeContext },
    showNotification(value) { notifications.push(value); },
    async addToQueue(tracks) { queued.push(...tracks); },
  };
  const context = vm.createContext({ Spicetify, window, document, CustomEvent: CustomEventMock,
    console: { info() {}, warn() {}, error() {} }, navigator: { languages: ["de-DE"], language: "de-DE", clipboard: { async writeText() {} } },
    setTimeout() {}, HTMLElement: class {}, Element: class {} });
  return { context, storage, player, listeners, menus, contexts, notifications, intervals, window, queued };
}

/** Ist der Bundle-Einstieg global erreichbar und wirft er zur Laufzeit keine Fehler? */
test("Custom App: render() existiert und gibt eine React-Komponente zurück", async () => {
  const mock = makeMockEnvironment();
  const code = await readFile(new URL("../dist/custom-app/index.js", import.meta.url), "utf8");
  vm.runInContext(code, mock.context, { timeout: 3000 });
  const root = vm.runInContext("render()", mock.context, { timeout: 3000 });
  assert.equal(typeof root.type, "function");
  assert.equal(root.type.name, "App");
});

test("Extension: Titelwechsel werden einmal aufgezeichnet, Cleanup funktioniert", async () => {
  const mock = makeMockEnvironment();
  const code = await readFile(new URL("../dist/extension/zukato-extension.js", import.meta.url), "utf8");
  vm.runInContext(code, mock.context, { timeout: 3000 });
  const key = "zukato-toolkit.library.v1";
  assert.equal(mock.storage.get(key).history.length, 1);
  assert.equal(mock.storage.get(key).history[0].title, "Test Song");
  mock.player.emit("songchange");
  assert.equal(mock.storage.get(key).history.length, 1, "Doppeltes Event darf nicht doppelt zählen");
  mock.player.data = { ...mock.player.data, playbackId: "id-2", item: { ...mock.player.data.item, uri: "spotify:track:DEF456", name: "Another Song" } };
  mock.player.emit("songchange");
  assert.equal(mock.storage.get(key).history.length, 2);
  assert.ok(mock.context.Spicetify.Menu);
  assert.ok(mock.menus.some((entry) => entry.registered && entry.name === "ZuKaTo Sleep-Timer"));
  assert.ok(mock.contexts.some((entry) => entry.registered && entry.name.includes("Warteschlange")));
  mock.window.dispatchEvent({ type: "beforeunload" });
  assert.ok(mock.menus.every((entry) => !entry.registered));
  assert.ok(mock.contexts.every((entry) => !entry.registered));
  assert.equal(mock.intervals.size, 0);
});

/** Die Erweiterungen greifen nur nach expliziter Nutzeraktion auf Queue/Favoriten zu. */
test("Kontextaktionen: Queue, Favoriten und Sleep-Timer sind nutzbar", async () => {
  const mock = makeMockEnvironment();
  const code = await readFile(new URL("../dist/extension/zukato-extension.js", import.meta.url), "utf8");
  vm.runInContext(code, mock.context, { timeout: 3000 });
  const queueItem = mock.contexts.find((item) => item.name.includes("Warteschlange"));
  const bookmarkItem = mock.contexts.find((item) => item.name.includes("Lesezeichen"));
  assert.ok(queueItem?.shouldAdd(["spotify:track:ABC123"]));
  assert.equal(queueItem?.shouldAdd(["https://example.org/evil"]), false);
  queueItem.onClick(["spotify:track:ABC123"]);
  // Das Promise wird erst im nächsten Microtask abgeschlossen.
  await Promise.resolve();
  assert.equal(mock.queued.length, 1);
  bookmarkItem.onClick(["spotify:track:ABC123"]);
  assert.equal(mock.storage.get("zukato-toolkit.library.v1").favorites.length, 1);
  bookmarkItem.onClick(["spotify:track:ABC123"]);
  assert.equal(mock.storage.get("zukato-toolkit.library.v1").favorites.length, 0);
  const sleep = mock.menus.find((item) => item.name === "ZuKaTo Sleep-Timer");
  assert.ok(sleep);
  sleep.items[0].onClick();
  assert.ok(mock.storage.get("zukato-toolkit.sleep-until") > Date.now());
});

/** Einstellungsänderungen dürfen Module im laufenden Betrieb an- und ausschalten. */
test("Feature-Toggles: Aktivierung und Deregistrierung zur Laufzeit", async () => {
  const mock = makeMockEnvironment();
  const code = await readFile(new URL("../dist/extension/zukato-extension.js", import.meta.url), "utf8");
  vm.runInContext(code, mock.context, { timeout: 3000 });
  assert.ok(!mock.menus.some((item) => item.name === "ZuKaTo Mini-Player"));
  const EventConstructor = vm.runInContext("CustomEvent", mock.context);
  mock.window.dispatchEvent(new EventConstructor("spotify-toolkit:settings-changed", {
    detail: { features: { "mini-player": { enabled: true }, "context-actions": { enabled: false } } },
  }));
  assert.ok(mock.menus.some((item) => item.name === "ZuKaTo Mini-Player" && item.registered));
  assert.ok(!mock.contexts.some((item) => item.name.includes("Lesezeichen") && item.registered));
});

/** Die neue Video-Bühne muss über den bestehenden Feature-Router erreichbar sein. */
test("Visualizer: Workspace-Router rendert Video-Bühne und Import-Controls", async () => {
  const mock = makeMockEnvironment();
  const bundle = await readFile(new URL("../dist/custom-app/index.js", import.meta.url), "utf8");
  vm.runInContext(bundle, mock.context, { timeout: 3000 });
  const appElement = vm.runInContext("render()", mock.context);
  const appTree = appElement.type();
  function find(node, predicate) {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const child of node) { const result = find(child, predicate); if (result) return result; }
      return null;
    }
    if (predicate(node)) return node;
    return find(node.props?.children, predicate);
  }
  const module = find(appTree, (node) => node.type?.name === "ModuleContent");
  assert.ok(module, "Feature-Router muss in der App liegen");
  const visualizer = module.type({ ...module.props, featureId: "visualizer" });
  assert.equal(visualizer.type.name, "Visualizer");
  const stage = visualizer.type(visualizer.props);
  assert.ok(find(stage, (node) => node.props?.className === "zukato-viz__stage"));
  const fileInputs = [];
  function collect(node) {
    if (Array.isArray(node)) { node.forEach(collect); return; }
    if (!node) return;
    if (node.type === "input" && node.props?.type === "file") fileInputs.push(node);
    collect(node.props?.children);
  }
  collect(stage);
  assert.equal(fileInputs.length, 2, "Video- und LRC-Dateiimport müssen vorhanden sein");
  assert.ok(find(stage, (node) => node.type?.name === "WallpaperBackdrop"),
    "Der Workspace nutzt die eigenständige Crossfade-Bühne.");
  assert.ok(find(stage, (node) => node.type?.name === "WallpaperLibrary"),
    "Die Wallpaper-Bibliothek muss im Workspace erreichbar sein.");
});

/**
 * v1.7-Abnahme: Der Counter muss in der Extension selbst mitlaufen.
 * Die Visualizer-Seite wird absichtlich NICHT gerendert, während neue Titel
 * eintreffen; die gespeicherte Nummer ist anschließend sofort verfügbar.
 */
test("Extension-Kern: Wallpaper-Cursor zählt außerhalb des Workspace und überlebt Neustart", async () => {
  const mock = makeMockEnvironment();
  const code = await readFile(new URL("../dist/extension/zukato-extension.js", import.meta.url), "utf8");
  vm.runInContext(code, mock.context, { timeout: 3000 });
  const key = "zukato-toolkit.song-session.v1";
  assert.equal(mock.storage.get(key).index, 0);
  mock.player.data = { ...mock.player.data, playbackId: "id-2",
    item: { ...mock.player.data.item, uri: "spotify:track:DEF456" } };
  mock.player.emit("songchange");
  mock.player.emit("songchange");
  assert.equal(mock.storage.get(key).index, 1, "Doppelte Events müssen idempotent sein");
  mock.window.dispatchEvent({ type: "beforeunload" });
  assert.equal(mock.intervals.size, 0, "Keine Timer nach Extension-Stop");
  // Neue Instanz mit identischem lokalen Speicher – der Zähler wird nicht auf 0
  // gesetzt. Dieses Verhalten ist die Grundlage für die Playlist-Fortsetzung.
  const reopened = makeMockEnvironment();
  reopened.storage.set(key, mock.storage.get(key));
  reopened.player.data = mock.player.data;
  vm.runInContext(code, reopened.context, { timeout: 3000 });
  assert.equal(reopened.storage.get(key).index, 1);
  reopened.window.dispatchEvent({ type: "beforeunload" });
});
