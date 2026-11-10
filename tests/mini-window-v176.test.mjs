import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = esbuild.buildSync({ entryPoints: [path.join(root,
  "src/custom-app/modules/visualizer/mini-window.ts")], bundle: true,
  platform: "node", format: "esm", write: false }).outputFiles[0].text;
const mini = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`);

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = new Map(); this.parentNode = null;
    this.style = {};
    this.classList = { toggle() {} }; }
  get nextSibling() {
    if (!this.parentNode) return null;
    return this.parentNode.children[this.parentNode.children.indexOf(this) + 1] ?? null;
  }
  append(...children) { for (const child of children) this.insertBefore(child, null); }
  insertBefore(child, before) {
    if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child), 1);
    child.parentNode = this;
    const index = before ? this.children.indexOf(before) : -1;
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
  }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  setAttribute(name, value) { this[name] = value; }
  cloneNode() { return new Element(this.tag); }
  querySelector() { return this.frame ?? null; }
  querySelectorAll() { return []; }
  play() { this.played = true; return Promise.resolve(); }
  pause() { this.paused = true; }
  click() { this.listeners.get("click")?.(); }
}

function makePopup() {
  const listeners = new Map();
  const document = { head: new Element("head"), body: new Element("body"),
    createElement: (tag) => new Element(tag) };
  const popup = { document, listeners, closed: false, focused: false,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); },
    focus() { this.focused = true; },
    close() { this.closed = true; listeners.get("pagehide")?.(); } };
  document.defaultView = popup;
  return popup;
}

test("Desktop-Popup zeigt dieselbe Wallpaper-Bühne, steuert Musik und bringt Spotify zurück", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousSpicetify = globalThis.Spicetify;
  const previousMessageEvent = globalThis.MessageEvent;
  let popup = makePopup();
  const origin = new Element("section");
  const stage = new Element("stage");
  const nextElement = new Element("after-stage");
  origin.append(stage, nextElement);
  const listeners = new Map();
  let requests = 0; let previous = 0; let next = 0; let toggles = 0; let sought = -1;
  let shuffle = false; let repeat = 0;
  let playing = true; let mainFocused = false; let relayed = null; let relocated = null;
  globalThis.document = { head: new Element("head") };
  globalThis.MessageEvent = class { constructor(type, options) { this.type = type; Object.assign(this, options); } };
  globalThis.window = { __zukatoCustomAppCss: ".zukato-viz__stage{display:block}",
    location: { origin: "https://xpui.app.spotify.com" },
    setInterval() { return 1; }, clearInterval() {}, focus() { mainFocused = true; },
    dispatchEvent(event) {
      if (event.type === "zukato-toolkit:wallpaper-relocated") relocated = event.detail;
      else relayed = event.data;
    },
    documentPictureInPicture: { requestWindow(options) {
      requests++; assert.deepEqual(options, { width: 520, height: 400 });
      return Promise.resolve(popup);
    } } };
  globalThis.Spicetify = { Player: {
    data: { item: { uri: `spotify:track:${"A".repeat(22)}`, name: "Testtitel",
      album: { name: "Album" }, artists: [{ name: "Künstlerin" }], metadata: {} } },
    isPlaying: () => playing,
    getProgress: () => 30000, getDuration: () => 120000,
    seek(value) { sought = value; },
    getShuffle: () => shuffle, getRepeat: () => repeat,
    toggleShuffle() { shuffle = !shuffle; }, toggleRepeat() { repeat = (repeat + 1) % 3; },
    back() { previous++; }, next() { next++; }, togglePlay() { toggles++; },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); },
  } };
  try {
    assert.equal(mini.miniWindowSupported(), true);
    const opening = mini.openVisualizerMiniWindow(stage);
    assert.equal(requests, 1, "PiP wird synchron aus der Nutzergeste angefordert");
    assert.equal(await opening, true);
    const shell = popup.document.body.children[0];
    assert.equal(shell.children[0].children[0], stage, "Das Wallpaper wird nicht durch ein Cover ersetzt");
    const frame = { contentWindow: { postMessage() {} },
      ownerDocument: popup.document };
    stage.frame = frame;
    popup.listeners.get("message")({ source: frame.contentWindow,
      data: { zukatoProjectReady: true }, origin: "null" });
    assert.equal(relocated, frame, "Projektstart meldet den versetzten Frame");
    popup.listeners.get("message")({ source: frame.contentWindow,
      data: { zukatoProjectMounted: true }, origin: "null" });
    assert.deepEqual(relayed, { zukatoProjectMounted: true }, "Projektbestätigung erreicht Spotify");
    assert.match(popup.document.head.children[0].textContent, /zukato-viz__stage/);
    const bar = shell.children[2];
    const seek = bar.children[1].children[1];
    assert.equal(seek.max, "120000");
    seek.value = "45000"; seek.listeners.get("input")();
    assert.equal(sought, 45000, "Im Popup kann direkt gespult werden");
    const actions = bar.children[2].children;
    assert.equal(bar.children[0].children[0].textContent, "Testtitel");
    actions[1].click(); actions[2].click(); actions[3].click();
    assert.deepEqual([previous, toggles, next], [1, 1, 1]);
    actions[0].click(); actions[4].click();
    assert.equal(shuffle, true); assert.equal(repeat, 1);
    playing = false; listeners.get("onplaypause")();
    assert.equal(actions[2].title, "Wiedergeben");
    actions[5].click();
    assert.equal(shell.children[0].hidden, true, "Cover/Video ersetzt die Wallpaper-Ansicht");
    assert.equal(shell.children[1].hidden, false);
    actions[5].click();
    assert.equal(shell.children[0].hidden, false, "Wallpaper kann ohne Neustart zurückgeschaltet werden");
    actions[6].click();
    assert.equal(mainFocused, true);
    assert.equal(popup.closed, true);
    assert.deepEqual(origin.children, [stage, nextElement], "Beim Schließen kehrt dieselbe Bühne zurück");
    assert.equal(listeners.size, 0);
    popup = makePopup();
    assert.equal(await mini.openVisualizerMiniWindow(stage, { automatic: true }), true);
    mini.closeAutomaticVisualizerMiniWindow();
    assert.equal(popup.closed, true, "Automatisches Fenster schließt bei Rückkehr zu Spotify");
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousSpicetify === undefined) delete globalThis.Spicetify; else globalThis.Spicetify = previousSpicetify;
    globalThis.MessageEvent = previousMessageEvent;
  }
});
