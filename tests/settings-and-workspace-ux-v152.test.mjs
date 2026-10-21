// =============================================================================
// Datei: tests/settings-and-workspace-ux-v152.test.mjs
// Zweck: Regressionen für Einstellungsnavigation und konfliktfreie Schnellsuche.
// Ohne echte Spotify-APIs ausführbar; geprüfte Logik stammt aus Produktcode.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const settings = loadPureSharedModule(root, "src/shared/settings-navigation.ts");
const settingsFor = (storage) => loadPureSharedModule(root, "src/shared/settings-navigation.ts", { window: { sessionStorage: storage } });
const shortcuts = loadPureSharedModule(root, "src/shared/workspace-shortcuts.ts");
const STORE_KEY = "zukato-toolkit.settings.last-section.v1";

test("Einstellungen: alle sechs sichtbaren Bereiche sind gültig", () => {
  assert.deepEqual(Array.from(settings.SETTINGS_SECTIONS), [
    "overview", "general", "wallpapers", "modules", "shortcuts", "data",
  ]);
  assert.equal(settings.validSettingsSection("data"), true);
  assert.equal(settings.validSettingsSection("__proto__"), false);
  assert.equal(settings.validSettingsSection("old-tab"), false);
  assert.equal(settings.validSettingsSection(null), false);
});

test("Einstellungen: zuletzt besuchter Bereich übersteht Modulwechsel", () => {
  const items = new Map();
  const api = settingsFor({ getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) });
  api.rememberSettingsSection("wallpapers");
  assert.equal(items.get(STORE_KEY), "wallpapers");
  assert.equal(api.readSettingsSection(), "wallpapers");
  // Ein neuer gültiger Wert aus einem anderen Settings-Fenster wird erkannt.
  items.set(STORE_KEY, "data");
  assert.equal(api.readSettingsSection(), "data");
});

test("Einstellungen: kaputter oder gesperrter Session-Speicher darf nicht abstürzen", () => {
  const api = settingsFor({ getItem: () => "invalid", setItem: () => { throw new Error("SecurityError"); } });
  assert.doesNotThrow(() => api.rememberSettingsSection("shortcuts"));
  assert.equal(api.readSettingsSection(), "shortcuts");
  api.rememberSettingsSection("unknown");
  assert.equal(api.readSettingsSection(), "shortcuts");
  const blocked = settingsFor({ get getItem() { throw Error("SecurityError"); } });
  assert.equal(blocked.readSettingsSection(), "overview");
});

test("Einstellungen: Pfeiltasten springen zyklisch, Home/End an die Ränder", () => {
  assert.equal(settings.nextSettingsSection("overview", "ArrowUp"), "data");
  assert.equal(settings.nextSettingsSection("data", "ArrowDown"), "overview");
  assert.equal(settings.nextSettingsSection("general", "ArrowRight"), "wallpapers");
  assert.equal(settings.nextSettingsSection("general", "ArrowLeft"), "overview");
  assert.equal(settings.nextSettingsSection("modules", "Home"), "overview");
  assert.equal(settings.nextSettingsSection("overview", "End"), "data");
  assert.equal(settings.nextSettingsSection("overview", "Enter"), null);
});

const baseEvent = { code: "KeyF", ctrlKey: true, shiftKey: true, altKey: false,
  metaKey: false, repeat: false, defaultPrevented: false, isComposing: false, target: null };

test("Schnellsuche: genaues Ctrl+Shift+F löst die Aktion aus", () => {
  assert.equal(shortcuts.shouldToggleQuickTrackPanel(baseEvent), true);
  for (const patch of [{ code: "KeyD" }, { ctrlKey: false }, { shiftKey: false },
    { altKey: true }, { metaKey: true }, { repeat: true }, { defaultPrevented: true },
    { isComposing: true }]) {
    assert.equal(shortcuts.shouldToggleQuickTrackPanel({ ...baseEvent, ...patch }), false);
  }
});

test("Schnellsuche: Schreibfelder, contenteditable und Fremddialoge bleiben unberührt", () => {
  for (const kind of ["input", "textarea", "select", "contenteditable", "textbox", "dialog"]) {
    const target = { closest: () => ({ kind }) };
    assert.equal(shortcuts.shouldToggleQuickTrackPanel({ ...baseEvent, target }), false, kind);
  }
  assert.equal(shortcuts.shouldToggleQuickTrackPanel({ ...baseEvent, target: { closest: () => null } }), true);
});

test("UI: Settings-Tabs und Übersicht benutzen ausschließlich den gesicherten Wechselpfad", () => {
  const ui = readFileSync(path.join(root, "src/custom-app/modules/settings/SettingsModule.tsx"), "utf8");
  assert.match(ui, /useState<SettingsView>\(readSettingsSection\)/);
  assert.match(ui, /rememberSettingsSection\(next\)/);
  assert.match(ui, /onClick=\{\(\) => selectView\(item\.id\)\}/);
  assert.match(ui, /onKeyDown=\{\(event\) => onTabKey\(event, item\.id\)\}/);
  assert.match(ui, /onBack=\{\(\) => selectView\("general"\)\}/);
});

test("UI: globale Schnellsuche prüft Konflikte vor preventDefault", () => {
  const ui = readFileSync(path.join(root, "src/custom-app/App.tsx"), "utf8");
  assert.match(ui, /if \(!shouldToggleQuickTrackPanel\(event\)\) return;/);
  assert.match(ui, /event\.preventDefault\(\);\s*setQuickOpen/);
});
