// =============================================================================
// Datei: tests/remaining-extension-actions-v157.test.mjs
// Zweck: Tatsächliche Spotify-Kontextmenüs, Clipboard-Fallback und Wheel-Events
//        in einer isolierten Laufzeit prüfen. Kein Kontakt zu Spotify-Servern.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { parseSpotifyTrackInput } = loadPureSharedModule(root, "src/shared/track-search.ts");
const track = (character = "T") => `spotify:track:${character.repeat(22)}`;
const episode = (character = "E") => `spotify:episode:${character.repeat(22)}`;

/** Führt dieselben Funktionen wie im Bundle aus, nur die Spotify-API wird gemockt. */
function moduleFixture(filename, exportName, extras = {}) {
  const source = stripTypeScriptTypes(readFileSync(path.join(root, filename), "utf8"), { mode: "strip" })
    .replace(/^import\s+.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "");
  const captured = { menus: [], notices: [], favorites: [], copied: [], warnings: [] };
  class MenuItem {
    constructor(_title, callback, predicate) {
      this.callback = callback;
      this.predicate = predicate;
      captured.menus.push(this);
    }
    register() { this.registered = true; }
    deregister() { this.registered = false; }
  }
  const globals = {
    Spicetify: {
      ContextMenu: { Item: MenuItem },
      Menu: { Item: MenuItem },
      Player: extras.Player ?? {},
      showNotification: (message, error = false) => captured.notices.push({ message, error }),
    },
    console: { warn: (...args) => captured.warnings.push(args), error: (...args) => captured.warnings.push(args) },
    runtimeText: key => key,
    parseSpotifyTrackInput,
    currentTrack: () => extras.currentTrack ?? null,
    toggleFavorite: info => { captured.favorites.push(info); return true; },
    navigator: extras.navigator ?? { clipboard: { writeText: async value => { captured.copied.push(value); } } },
    document: extras.document,
    Element: extras.Element,
    HTMLElement: extras.HTMLElement,
  };
  const instance = runInNewContext(`${source}\n${exportName};`, globals, { filename, timeout: 1500 });
  instance.start();
  return { instance, ...captured };
}

test("Lesezeichen: kurzformatige oder fremde URIs werden nicht mehr angenommen", () => {
  const runtime = moduleFixture("src/extension/modules/context-actions/ContextActionsModule.ts", "contextActionsModule");
  const menu = runtime.menus[0];
  assert.equal(menu.predicate(["spotify:track:123", "spotify:album:XYZ"]), false);
  assert.equal(menu.predicate([`https://open.spotify.com/track/${"T".repeat(22)}?si=x`]), true);
  menu.callback(["spotify:playlist:BAD", track()]);
  assert.equal(runtime.favorites.length, 1);
  assert.equal(runtime.favorites[0].uri, track());
  menu.callback(["spotify:track:123"]);
  assert.equal(runtime.favorites.length, 1);
  runtime.instance.stop();
  assert.ok(runtime.menus.every(item => item.registered === false));
});

test("Kopieren: akzeptiert nur echte Titel-/Episoden-IDs und normalisiert Links", async () => {
  const runtime = moduleFixture("src/extension/modules/copy-track-info/CopyTrackInfoModule.ts", "copyTrackInfoModule");
  const menu = runtime.menus[0];
  assert.equal(menu.predicate(["spotify:episode:123"]), false);
  assert.equal(menu.predicate([episode()]), true);
  menu.callback(["spotify:album:ABC", `https://open.spotify.com/episode/${"E".repeat(22)}?si=xyz`]);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(runtime.copied, [episode()]);
  assert.deepEqual(runtime.notices, [{ message: "runtime.copied", error: false }]);
  runtime.instance.stop();
});

/** Kleine DOM-Simulation: wir kontrollieren sowohl den Aufräumpfad als auch Fokus. */
function clipboardDom({ copySucceeds = true, throws = false } = {}) {
  const children = [];
  let selected = false;
  class ElementMock { constructor() { this.isConnected = true; this.focused = false; } focus() { this.focused = true; } }
  const previous = new ElementMock();
  return {
    HTMLElement: ElementMock,
    document: {
      body: { appendChild: item => { children.push(item); } },
      activeElement: previous,
      createElement: () => ({ value: "", style: {}, setAttribute() {}, select() { selected = true; }, remove() { children.pop(); } }),
      execCommand: () => { if (throws) throw Error("DOM copy denied"); return copySucceeds; },
    },
    children, previous, get selected() { return selected; },
  };
}

test("Zwischenablage: verweigerte Async API nutzt DOM-Fallback und räumt auf", async () => {
  const dom = clipboardDom();
  const runtime = moduleFixture("src/extension/modules/copy-track-info/CopyTrackInfoModule.ts", "copyTrackInfoModule", {
    ...dom,
    navigator: { clipboard: { writeText: async () => { throw Error("NotAllowedError"); } } },
  });
  runtime.menus[0].callback([track()]);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(runtime.notices, [{ message: "runtime.copied", error: false }]);
  assert.equal(dom.children.length, 0);
  assert.equal(dom.selected, true);
  assert.equal(dom.previous.focused, true);
});

test("Zwischenablage: wenn beide APIs scheitern, niemals Erfolg melden", async () => {
  const dom = clipboardDom({ copySucceeds: false });
  const runtime = moduleFixture("src/extension/modules/copy-track-info/CopyTrackInfoModule.ts", "copyTrackInfoModule", {
    ...dom, navigator: {},
  });
  runtime.menus[0].callback([track()]);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(runtime.notices, [{ message: "runtime.clipboardError", error: true }]);
  assert.equal(dom.children.length, 0);
});

function volumeFixture(currentValue = .5, fail = false) {
  const listeners = new Map();
  const adjusted = [];
  let current = currentValue;
  class ElementMock {
    constructor(hovering = true) { this.hovering = hovering; }
    closest() { return this.hovering ? this : null; }
  }
  const runtime = moduleFixture("src/extension/modules/volume-scroll/VolumeScrollModule.ts", "volumeScrollModule", {
    Element: ElementMock,
    document: {
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
    },
    Player: {
      getVolume() { if (fail) throw Error("API unavailable"); return current; },
      setVolume(value) { if (fail) throw Error("API unavailable"); adjusted.push(value); current = value; },
    },
  });
  function wheel({ deltaY = -100, hovering = true, ctrlKey = false, metaKey = false, cancelable = true, defaultPrevented = false } = {}) {
    let prevented = false;
    const event = {
      target: new ElementMock(hovering), deltaY, ctrlKey, metaKey, cancelable, defaultPrevented,
      preventDefault() { prevented = true; },
    };
    listeners.get("wheel")?.(event);
    return prevented;
  }
  return { ...runtime, listeners, adjusted, wheel };
}

test("Lautstärke: nur über dem echten Regler, nicht bei Zoom oder Fremdscroll", () => {
  const runtime = volumeFixture(.5);
  assert.equal(runtime.wheel({ hovering: false }), false);
  assert.equal(runtime.wheel({ ctrlKey: true }), false);
  assert.equal(runtime.wheel({ metaKey: true }), false);
  assert.equal(runtime.wheel({ deltaY: Number.NaN }), false);
  assert.equal(runtime.wheel({ cancelable: false }), false);
  assert.deepEqual(runtime.adjusted, []);
  assert.equal(runtime.wheel(), true);
  assert.equal(runtime.adjusted.length, 1);
  assert.ok(Math.abs(runtime.adjusted[0] - .55) < 1e-10);
  runtime.instance.stop();
  assert.equal(runtime.listeners.size, 0);
});

test("Lautstärke: ungültige Playerwerte dürfen niemals NaN setzen", () => {
  const runtime = volumeFixture(Number.NaN);
  assert.equal(runtime.wheel(), false);
  assert.deepEqual(runtime.adjusted, []);
  runtime.instance.stop();
});

test("Lautstärke: API-Ausfall wird abgefangen und unterdrückt das Scrollen nicht", () => {
  const runtime = volumeFixture(.5, true);
  assert.doesNotThrow(() => runtime.wheel());
  assert.equal(runtime.wheel(), false);
  assert.deepEqual(runtime.adjusted, []);
  runtime.instance.stop();
});

test("Lautstärke: Min-/Max-Grenzen ohne überflüssige API-Aufrufe", () => {
  const min = volumeFixture(0);
  assert.equal(min.wheel({ deltaY: 80 }), true);
  assert.deepEqual(min.adjusted, []);
  min.instance.stop();
  const max = volumeFixture(1);
  assert.equal(max.wheel({ deltaY: -80 }), true);
  assert.deepEqual(max.adjusted, []);
  max.instance.stop();
});
