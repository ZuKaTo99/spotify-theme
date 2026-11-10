import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = esbuild.buildSync({ entryPoints: [path.join(root,
  "src/custom-app/modules/visualizer/native-mini-player.ts")], bundle: true,
  platform: "node", format: "esm", write: false }).outputFiles[0].text;
const { spotifyMiniPlayerButton } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`);

test("Spotifys Mini-Player-Knopf öffnet ZuKaTo nur im Workspace", () => {
  const oldElement = globalThis.Element;
  const oldButton = globalThis.HTMLButtonElement;
  class Element {
    constructor(parent = null) { this.parent = parent; }
    closest(selector) { return selector === "button" ? this.parent : null; }
  }
  class Button extends Element {
    constructor(label, inApp = false) { super(); this.label = label; this.inApp = inApp; }
    closest(selector) { return selector === "button" ? this :
      selector === ".zukato-app" && this.inApp ? {} : null; }
    getAttribute(name) { return name === "aria-label" ? this.label : null; }
  }
  globalThis.Element = Element;
  globalThis.HTMLButtonElement = Button;
  try {
    const spotify = new Button("Miniplayer öffnen");
    assert.equal(spotifyMiniPlayerButton(new Element(spotify)), spotify);
    assert.equal(spotifyMiniPlayerButton(new Button("Open Mini player")) instanceof Button, true);
    assert.equal(spotifyMiniPlayerButton(new Button("Miniplayer schließen")), null);
    assert.equal(spotifyMiniPlayerButton(new Button("Miniplayer öffnen", true)), null);
    assert.equal(spotifyMiniPlayerButton(null), null);
  } finally {
    if (oldElement === undefined) delete globalThis.Element; else globalThis.Element = oldElement;
    if (oldButton === undefined) delete globalThis.HTMLButtonElement; else globalThis.HTMLButtonElement = oldButton;
  }
});
