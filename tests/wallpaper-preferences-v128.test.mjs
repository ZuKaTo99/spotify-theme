// =============================================================================
// Datei: wallpaper-preferences-v128.test.mjs
// Zweck: Nebula-Engine-Presets bleiben bei jedem Songwechsel erhalten, obwohl
// das HTML-Wallpaper in einer frisch gestarteten, origin-isolierten Sandbox
// läuft und niemals Spotifys localStorage lesen darf.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { Script, runInNewContext } from "node:vm";
import { stripTypeScriptTypes } from "node:module";

const prefsCode = await readFile(new URL("../src/custom-app/modules/visualizer/wallpaper-preferences.ts", import.meta.url), "utf8");
const prefs = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(prefsCode, { mode: "strip" }))}`);
const projectCode = (await readFile(new URL("../src/custom-app/modules/visualizer/wallpaper-project.ts", import.meta.url), "utf8"))
  .replace('from "./web-wallpaper"', 'from "data:text/javascript,' + encodeURIComponent('export const WEB_WALLPAPER_CSP = "default-src \'none\'; img-src data: blob:; font-src data:; connect-src \'none\'; script-src \'unsafe-inline\'";') + '"');
const project = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(projectCode, { mode: "strip" }))}`);
const bootstrap = project.PROJECT_BOOTSTRAP.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(bootstrap);

// Speichervorrat simulieren, ohne reale Spotify-/Browserdaten anzufassen.
function newHost() {
  const raw = new Map();
  globalThis.localStorage = {
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => raw.set(key, value),
    removeItem: (key) => raw.delete(key),
  };
  const events = [];
  globalThis.window = { dispatchEvent(event) { events.push(event.type); } };
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
  return { raw, events };
}
function newSandbox(host, sceneId, token = "song:alpha") {
  const listeners = new Map();
  const messages = [];
  const parent = { postMessage(message) {
    messages.push(message);
    if (message.zukatoProjectStorage) {
      if (message.storageToken !== token) return;
      const action = prefs.parseWallpaperPrefsOperation(message);
      if (action) prefs.applyWallpaperPrefsOperation(sceneId, action);
    }
  } };
  class Image {}
  class Media {}
  class Source {}
  class Element { setAttribute() {} }
  class XHR { open() {} }
  const frameWindow = {
    parent, fetch: () => Promise.resolve({ ok: true }),
    addEventListener(type, fn) { listeners.set(type, fn); },
  };
  // Wie in echten 'sandbox=allow-scripts'-Frames: Lesen wirft SecurityError.
  Object.defineProperty(frameWindow, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
  const document = { open() {}, write(value) { this.html = value; }, close() {} };
  runInNewContext(bootstrap, { window: frameWindow, document, Blob, DOMException,
    URL: { createObjectURL: () => "blob:local/test", revokeObjectURL() {} },
    HTMLImageElement: Image, HTMLMediaElement: Media, HTMLSourceElement: Source,
    Element, XMLHttpRequest: XHR, Date, Math, Object, String, Promise, Proxy });
  listeners.get("message")({ source: parent, data: {
    zukatoProjectInit: true, storageToken: token,
    storage: prefs.loadWallpaperPrefs(sceneId),
    sessionStorage: prefs.loadWallpaperPrefs(sceneId, "session"),
    html: "<html><body>Wallpaper</body></html>",
    entry: "index.html", assets: [], modules: [],
  }});
  return { frameWindow, document, messages, send(data) { listeners.get("message")({ source: parent, data }); } };
}

test("Sandbox: lokale Presets, Akzentfarbe und Regler überstehen einen neuen Songlauf", () => {
  const { raw } = newHost();
  const first = newSandbox(raw, "scene-nebula", "song:1");
  assert.equal(first.frameWindow.localStorage.length, 0);
  first.frameWindow.localStorage.setItem("nebula-preset", "Electric Storm");
  first.frameWindow.localStorage.setItem("nebula-color", "#d82cd7");
  const writes = first.messages.filter((message) => message.zukatoProjectStorage).length;
  first.frameWindow.localStorage.setItem("nebula-color", "#d82cd7");
  assert.equal(first.messages.filter((message) => message.zukatoProjectStorage).length, writes,
    "ein unveränderter Reglerwert darf nicht jede Animation eine neue Nachricht auslösen");
  first.frameWindow.localStorage["particles"] = "165";
  assert.equal(first.frameWindow.localStorage.getItem("particles"), "165");
  assert.deepEqual(Object.keys(first.frameWindow.localStorage).sort(), ["nebula-color", "nebula-preset", "particles"]);
  const second = newSandbox(raw, "scene-nebula", "song:2");
  assert.equal(second.frameWindow.localStorage.getItem("nebula-preset"), "Electric Storm");
  assert.equal(second.frameWindow.localStorage.getItem("nebula-color"), "#d82cd7");
  assert.equal(second.frameWindow.localStorage.particles, "165");
  assert.equal(second.frameWindow.localStorage.length, 3);
  assert.match(second.document.html, /Wallpaper/);
});

test("Projekt-Isolierung, Storage-Synchronisierung und remove/clear", () => {
  newHost();
  const a = newSandbox(null, "scene-alpha", "run:a");
  const b = newSandbox(null, "scene-beta", "run:b");
  a.frameWindow.localStorage.setItem("theme", "purple");
  assert.equal(b.frameWindow.localStorage.getItem("theme"), null);
  const a2 = newSandbox(null, "scene-alpha", "run:a2");
  assert.equal(a2.frameWindow.localStorage.getItem("theme"), "purple");
  a2.send({ zukatoProjectStorageSync: true, storageToken: "bad", storage: { theme: "wrong" } });
  assert.equal(a2.frameWindow.localStorage.getItem("theme"), "purple");
  a2.send({ zukatoProjectStorageSync: true, storageToken: "run:a2", storage: { theme: "green" } });
  assert.equal(a2.frameWindow.localStorage.getItem("theme"), "green");
  a2.frameWindow.localStorage.removeItem("theme");
  assert.equal(prefs.loadWallpaperPrefs("scene-alpha").theme, undefined);
  a2.frameWindow.localStorage.setItem("x", "a");
  a2.frameWindow.localStorage.clear();
  assert.equal(a2.frameWindow.localStorage.length, 0);
  assert.equal(Object.keys(prefs.loadWallpaperPrefs("scene-alpha")).length, 0);
});

test("Host: zu große oder manipulierte Speicherversuche bleiben wirkungslos", () => {
  const { raw } = newHost();
  assert.equal(prefs.parseWallpaperPrefsOperation({ zukatoProjectStorage:true,action:"set",key:"x",value:2 }), null);
  assert.equal(prefs.parseWallpaperPrefsOperation({ zukatoProjectStorage:true,action:"set",key:"x",value:"a".repeat(17000) }), null);
  assert.equal(prefs.applyWallpaperPrefsOperation("scene-a", { action:"set",key:"ok",value:"safe" }), true);
  assert.equal(prefs.applyWallpaperPrefsOperation("scene-a", { action:"set",key:"huge",value:"x".repeat(50000) }), false);
  assert.equal(prefs.loadWallpaperPrefs("scene-a").ok, "safe");
  assert.equal(prefs.loadWallpaperPrefs("scene-a").huge, undefined);
  assert.equal(prefs.applyWallpaperPrefsOperation("bad/name",{ action:"clear" }), false);
  assert.equal(raw.size, 1);
  prefs.deleteWallpaperPrefs("scene-a");
  assert.equal(raw.size, 0);
  // ID-Fallback ohne crypto.randomUUID enthält einen Punkt (Math.random).
  assert.equal(prefs.applyWallpaperPrefsOperation("scene-123-0-0.abcd", { action:"set", key:"a", value:"b" }), true);
  assert.equal(prefs.loadWallpaperPrefs("scene-123-0-0.abcd").a, "b");
});

// -----------------------------------------------------------------------------
// Reparatur v1.29: Der Browser löscht sein normales sessionStorage bei jedem
// neuen isolierten iframe. Viele HTML-Wallpapers speichern ihre UI-Presets
// jedoch dort statt in localStorage. Beides bleibt PRO SZENE getrennt.
// -----------------------------------------------------------------------------
test("sessionStorage: Preset und Regler bleiben über mehrere Songstarts erhalten", () => {
  newHost();
  const first = newSandbox(null, "scene-nebula", "song:1");
  first.frameWindow.sessionStorage.setItem("nebula-preset", "Electric Storm");
  first.frameWindow.sessionStorage.setItem("nebula-intensity", "96");
  first.frameWindow.localStorage.setItem("nebula-preset", "Nebula Blue");
  assert.equal(first.frameWindow.sessionStorage.length, 2);
  assert.equal(first.frameWindow.localStorage.length, 1);
  assert.equal(prefs.loadWallpaperPrefs("scene-nebula", "session")["nebula-preset"], "Electric Storm");
  assert.equal(prefs.loadWallpaperPrefs("scene-nebula")["nebula-preset"], "Nebula Blue");
  const nextSong = newSandbox(null, "scene-nebula", "song:2");
  assert.equal(nextSong.frameWindow.sessionStorage.getItem("nebula-preset"), "Electric Storm");
  assert.equal(nextSong.frameWindow.sessionStorage.getItem("nebula-intensity"), "96");
  assert.equal(nextSong.frameWindow.localStorage.getItem("nebula-preset"), "Nebula Blue");
  assert.equal(newSandbox(null, "scene-other", "song:3").frameWindow.sessionStorage.length, 0);
});

test("sessionStorage: Synchronisierung über Ansichten und rückstandsfreies Löschen", () => {
  const {raw} = newHost();
  const preview = newSandbox(null, "scene-nebula", "preview");
  const stage = newSandbox(null, "scene-nebula", "stage");
  preview.frameWindow.sessionStorage.setItem("color", "magenta");
  stage.send({zukatoProjectStorageSync: true, storageToken: "stage",
    storage: prefs.loadWallpaperPrefs("scene-nebula"),
    sessionStorage: prefs.loadWallpaperPrefs("scene-nebula", "session")});
  assert.equal(stage.frameWindow.sessionStorage.getItem("color"), "magenta");
  assert.equal(stage.frameWindow.localStorage.getItem("color"), null);
  assert.equal(stage.messages.filter(m => m.zukatoProjectStorage).length, 0,
    "eine Sync-Nachricht darf keine zusätzliche Rückkopplung erzeugen");
  stage.frameWindow.sessionStorage.clear();
  assert.equal(prefs.loadWallpaperPrefs("scene-nebula", "session").color, undefined);
  preview.frameWindow.sessionStorage.setItem("preset", "Final");
  preview.frameWindow.localStorage.setItem("volume", "0.8");
  assert.equal(raw.size, 2, "beide Speicherbereiche erhalten getrennte Host-Schlüssel");
  prefs.deleteWallpaperPrefs("scene-nebula");
  assert.equal(raw.size, 0, "beide Bereiche werden mit dem Projekt entfernt");
});

test("sessionStorage: unbekannte Scope-Namen und Limits werden abgelehnt", () => {
  const {raw} = newHost();
  assert.equal(prefs.parseWallpaperPrefsOperation({zukatoProjectStorage:true,scope:"spotify",
    action:"set",key:"preset",value:"unsafe"}), null);
  assert.equal(prefs.applyWallpaperPrefsOperation("scene", {scope:"spotify",action:"set",key:"x",value:"1"}), false);
  assert.equal(raw.size, 0);
  const valid = prefs.parseWallpaperPrefsOperation({zukatoProjectStorage:true,scope:"session",
    action:"set",key:"preset",value:"Blue"});
  assert.ok(valid);
  assert.equal(prefs.applyWallpaperPrefsOperation("scene", valid), true);
  assert.equal(prefs.loadWallpaperPrefs("scene", "session").preset, "Blue");
  assert.equal(prefs.loadWallpaperPrefs("scene").preset, undefined);
  assert.equal(prefs.applyWallpaperPrefsOperation("scene", {
    scope:"session", action:"set",key:"too-long",value:"!".repeat(20000)
  }),false);
  assert.equal(prefs.loadWallpaperPrefs("scene", "session").preset, "Blue");
});
