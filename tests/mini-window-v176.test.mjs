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
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = new Map(); this.parentNode = null; }
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
  querySelectorAll() { return []; }
  click() { this.listeners.get("click")?.(); }
}

function makePopup() {
  const listeners = new Map();
  const document = { head: new Element("head"), body: new Element("body"),
    createElement: (tag) => new Element(tag) };
  return { document, listeners, closed: false, focused: false,
    addEventListener: (name, callback) => listeners.set(name, callback),
    focus() { this.focused = true; },
    close() { this.closed = true; listeners.get("pagehide")?.(); } };
}

test("Desktop-Popup zeigt dieselbe Wallpaper-Bühne, steuert Musik und bringt Spotify zurück", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousSpicetify = globalThis.Spicetify;
  const popup = makePopup();
  const origin = new Element("section");
  const stage = new Element("stage");
  const nextElement = new Element("after-stage");
  origin.append(stage, nextElement);
  const listeners = new Map();
  let requests = 0; let previous = 0; let next = 0; let toggles = 0;
  let playing = true; let mainFocused = false;
  globalThis.document = { head: new Element("head") };
  globalThis.window = { focus() { mainFocused = true; },
    documentPictureInPicture: { requestWindow(options) {
      requests++; assert.deepEqual(options, { width: 440, height: 310 });
      return Promise.resolve(popup);
    } } };
  globalThis.Spicetify = { Player: {
    data: { item: { uri: `spotify:track:${"A".repeat(22)}`, name: "Testtitel",
      album: { name: "Album" }, artists: [{ name: "Künstlerin" }], metadata: {} } },
    isPlaying: () => playing,
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
    const actions = shell.children[1].children;
    assert.equal(actions[0].children[0].textContent, "Testtitel");
    actions[1].click(); actions[2].click(); actions[3].click();
    assert.deepEqual([previous, toggles, next], [1, 1, 1]);
    playing = false; listeners.get("onplaypause")();
    assert.equal(actions[2].title, "Wiedergeben");
    actions[4].click();
    assert.equal(mainFocused, true);
    assert.equal(popup.closed, true);
    assert.deepEqual(origin.children, [stage, nextElement], "Beim Schließen kehrt dieselbe Bühne zurück");
    assert.equal(listeners.size, 0);
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousSpicetify === undefined) delete globalThis.Spicetify; else globalThis.Spicetify = previousSpicetify;
  }
});
