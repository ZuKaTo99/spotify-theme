// =============================================================================
// Datei: tests/wallpaper-frame-lifecycle.test.mjs
// Zweck: Die echte Sandbox-Startseite im JS-VM ausführen statt nur Regex-Tests.
// Prüft effiziente Blob-Verwendung, vollständigen Markeraustausch und die
// erneute Übertragung nach einem echten iframe-Neustart (ohne Dopplungen).
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { Script, runInNewContext } from "node:vm";

async function loadSource(filename, transform = (value) => value) {
  const code = transform(await readFile(new URL(filename, import.meta.url), "utf8"));
  return import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(code, { mode: "strip" }))}`);
}
const gateModule = await loadSource("../src/custom-app/modules/visualizer/wallpaper-frame-gate.ts");
const projectModule = await loadSource("../src/custom-app/modules/visualizer/wallpaper-project.ts", (code) =>
  code.replace('from "./web-wallpaper"',
    'from "data:text/javascript,' + encodeURIComponent('export const WEB_WALLPAPER_CSP = "default-src \'none\'; img-src data: blob:; font-src data:; connect-src \'none\'; script-src \'unsafe-inline\'";') + '"'));

test("iframe: erstes Load/Ready überträgt nur einmal, neuer Dokumentstart erneut", () => {
  const gate = new gateModule.WallpaperFrameGate();
  assert.equal(gate.onLoad("song:1"), true);
  assert.equal(gate.onLoad("song:1"), false);
  assert.equal(gate.onReady("song:1", "browser:alpha"), false);
  assert.equal(gate.onReady("song:1", "browser:alpha"), false);
  assert.equal(gate.onReady("song:1", "browser:beta"), true);
  assert.equal(gate.onLoad("song:1"), false);
  assert.equal(gate.onReady("song:1", "browser:gamma"), true);
  // Sandbox-Code ist nicht vertrauenswürdig: unbegrenzte Ready-Nachrichten
  // dürfen nicht alle 256 MiB beliebig häufig übertragen.
  assert.equal(gate.onReady("song:1", "browser:delta"), false);
  assert.equal(gate.onReady("song:1", "a".repeat(200)), false);
  assert.equal(gate.onLoad("song:2"), true);
});

test("iframe: Ready vor Load und misslungene Übergabe werden korrekt behandelt", () => {
  const gate = new gateModule.WallpaperFrameGate();
  assert.equal(gate.onReady("preview:1", "doc:one"), true);
  assert.equal(gate.onLoad("preview:1"), false);
  gate.failed("preview:1");
  assert.equal(gate.onReady("preview:1", "doc:two"), true);
  assert.equal(gate.onLoad("preview:1"), false);
});

test("Sandbox: 100 Assets werden nur einmal ersetzt; bereits typisierte Blobs werden wiederverwendet", () => {
  const bootstrap = projectModule.PROJECT_BOOTSTRAP.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap);
  assert.doesNotThrow(() => new Script(bootstrap));
  const listeners = new Map();
  const sent = [];
  const objects = [];
  // Ein echter Browser entfernt bei document.open() ALLE Window-Listener.
  // Der Test emuliert das: Der Bootstrap muss StorageSync danach neu anbinden.
  const document = { html: "", open() { listeners.clear(); }, write(value) { this.html = value; }, close() {} };
  const parent = { postMessage(message) { sent.push(message); } };
  class Image { }
  class Media { }
  class Source { }
  class Element { setAttribute() { } }
  class Request { }
  class XHR { open() { } }
  const sandbox = {
    window: {
      parent, addEventListener(type, handler) { listeners.set(type, handler); },
      removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
      fetch() { return Promise.resolve({ ok: true }); },
    },
    document, URL: { createObjectURL(blob) { objects.push(blob); return `blob:local/${objects.length}`; },
      revokeObjectURL() { } },
    Blob, HTMLElement: Element, Element,
    HTMLImageElement: Image, HTMLMediaElement: Media, HTMLSourceElement: Source,
    XMLHttpRequest: XHR, Date, Math, Object, String, Array, Promise,
  };
  runInNewContext(bootstrap, sandbox);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].zukatoProjectReady, true);
  const files = Array.from({ length: 100 }, (_, i) => ({
    marker: `zukato-asset:${i}:`, path: `images/${i}.png`,
    mime: "image/png", blob: new Blob([new Uint8Array([i])], { type: "image/png" }),
  }));
  const html = `<html>${files.map((file) => `<img src="${file.marker}">`).join("")}</html>`;
  listeners.get("message")({ source: parent, data: { zukatoProjectInit: true, html,
    entry: "index.html", assets: files, modules: [] } });
  assert.equal(objects.length, 100);
  assert.equal(objects[0], files[0].blob);
  assert.equal(objects[99], files[99].blob);
  assert.doesNotMatch(document.html, /zukato-asset:/);
  assert.match(document.html, /blob:local\/100/);
  assert.equal(sent.some((message) => message.zukatoProjectError), false);
});
