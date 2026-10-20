// =============================================================================
// Datei: tests/wallpaper-bootstrap-v136.test.mjs
// Zweck: Quellcode-Regression für verlorene Sandbox-Listener bei document.open().
// Hintergrund: Chromium entfernt Window-Listener nach document.open(). Eine
// laufende HTML-Szene muss StorageSync nach dem Neuaufbau wieder empfangen.
// Für einen echten Browser-Gegentest: tools/test-wallpaper-browser.py.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const src = await readFile(new URL("../src/custom-app/modules/visualizer/wallpaper-project.ts", import.meta.url), "utf8");

test("Projekt-Sandbox bindet StorageSync nach document.open()/close() wieder an", () => {
  const begin = src.indexOf("export const PROJECT_BOOTSTRAP =");
  const open = src.indexOf("document.open();", begin);
  const close = src.indexOf("document.close();", open);
  const ending = src.indexOf("zukatoProjectMounted:true", close);
  assert.ok(begin >= 0 && open > begin && close > open && ending > close);
  const bootstrap = src.slice(begin, ending);
  assert.match(bootstrap, /function synchronizeProjectStorage\(update\)/);
  assert.match(bootstrap, /window\.addEventListener\('message',synchronizeProjectStorage\)/);
  const afterClose = bootstrap.slice(bootstrap.indexOf("document.close();") + "document.close();".length);
  assert.match(afterClose, /window\.removeEventListener\('message',synchronizeProjectStorage\)/);
  assert.match(afterClose, /window\.addEventListener\('message',synchronizeProjectStorage\)/);
  assert.match(afterClose, /window\.addEventListener\('error',reportResourceError,true\)/);
  assert.match(afterClose, /window\.addEventListener\('unhandledrejection',reportUnhandledRejection\)/);
});

test("Sandbox synchronisiert lokale und Session-Einstellungen ohne falschen StorageEvent", () => {
  assert.match(src, /storageScopes=\{local:copyPrefs\(data\.storage\),session:copyPrefs\(data\.sessionStorage\)\}/);
  assert.match(src, /storageToken!==storageToken\)return/);
  assert.match(src, /storageArea:null/);
  assert.doesNotMatch(src, /storageArea:scope==='local'\?createLocal:createSession/);
  assert.match(src, /publishStorage\(scope,'set',key,value\)/);
});
