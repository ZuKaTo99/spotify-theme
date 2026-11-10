import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const source = await readFile(new URL("../src/custom-app/modules/visualizer/visualizer-host.ts", import.meta.url), "utf8");
const host = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source, { mode: "strip" }))}`);

test("sichtbares PiP bleibt aktiv, wenn das Spotify-Hauptfenster minimiert ist", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const mainWindow = {};
  const pipWindow = {};
  globalThis.window = mainWindow;
  globalThis.document = { hidden: true, defaultView: mainWindow };
  try {
    const canvas = { ownerDocument: { hidden: false, defaultView: pipWindow } };
    assert.equal(host.visualizerHostWindow(canvas), pipWindow);
    assert.equal(host.visualizerHostHidden(canvas), false);
    assert.equal(host.visualizerHostWindow(null), mainWindow);
    assert.equal(host.visualizerHostHidden(null), true);
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});
