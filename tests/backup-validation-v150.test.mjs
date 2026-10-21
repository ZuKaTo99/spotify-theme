// =============================================================================
// Datei: tests/backup-validation-v150.test.mjs
// Zweck: Defekte Backup-Blöcke dürfen keinen stillen Datenverlust auslösen.
// Ausführung: npm test – ohne Eingriff in eine reale Spotify-Installation.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { validateToolkitBackup, backupSummary, MAX_BACKUP_BYTES } =
  loadPureSharedModule(root, "src/shared/backup-validation.ts");

function fixture() {
  return {
    format: "zukato-toolkit-backup", version: 1, createdAt: "2026-10-21T09:00:00.000Z",
    settings: { schemaVersion: 3, workspaceTitle: "Mein Spotify" },
    library: { version: 1, history: [], favorites: [], notes: [] },
    palette: "emerald", visualizer: { version: 1, spectrum: "off" },
    visualizerPresets: [], trackVisualizerScenes: [],
    scenePreferences: { mode: "wallpapers", playlists: {}, starts: {}, originals: {}, originalRanges: {} },
  };
}

test("Vollständiges Exportformat akzeptieren und Mengen anzeigen", () => {
  const value = fixture();
  value.library.notes.push({ uri: "spotify:track:4iV5W9uYEdYUVa79Axb7Rh", text: "Wichtig" });
  const validated = validateToolkitBackup(value);
  assert.equal(validated, value);
  assert.equal(backupSummary(validated).notes, 1);
  assert.equal(backupSummary(validated).presets, 0);
  assert.ok(MAX_BACKUP_BYTES >= 2_000_000);
});

test("Alte Backups ohne optionale Visualizer- und Wallpaper-Felder sind erlaubt", () => {
  const { format, version, settings, library } = fixture();
  const value = validateToolkitBackup({ format, version, settings, library });
  assert.equal(value.visualizerPresets, undefined);
  assert.equal(backupSummary(value).songScenes, 0);
});

test("Fehlende oder beschädigte Sammlungen werden VOR dem Import verworfen", () => {
  for (const library of [{}, { history: null, favorites: [], notes: [] },
    { history: [], favorites: "leer", notes: [] }, { history: [], favorites: [], notes: {} }]) {
    assert.throws(() => validateToolkitBackup({ ...fixture(), library }), /Hörverlauf, Favoriten oder Notizen fehlen/);
  }
});

test("Ungültige Elemente innerhalb formal korrekter Arrays sicher ablehnen", () => {
  for (const library of [
    { history: [null], favorites: [], notes: [] },
    { history: [{ uri: "spotify:track:abc", playedAt: "gestern" }], favorites: [], notes: [] },
    { history: [], favorites: [{ uri: "https://example.invalid" }], notes: [] },
    { history: [], favorites: [], notes: [{ uri: "spotify:track:abc", text: 123 }] },
  ]) assert.throws(() => validateToolkitBackup({ ...fixture(), library }), /ungültige Einträge|Favoriten enthalten|Notizen enthalten/);
});

test("Nicht vorhandene Einstellungen und Fremdformate sicher ablehnen", () => {
  assert.throws(() => validateToolkitBackup({ ...fixture(), settings: {} }), /Einstellungen fehlen/);
  assert.throws(() => validateToolkitBackup({ ...fixture(), version: 99 }), /Keine unterstützte/);
  assert.throws(() => validateToolkitBackup([]), /Keine unterstützte/);
  assert.throws(() => validateToolkitBackup({ ...fixture(), settings: [] }), /Einstellungen fehlen/);
});

test("Kaputte optionale Blöcke dürfen bestehende Presets/Szenen nicht leeren", () => {
  for (const change of [
    { visualizerPresets: {} },
    { visualizerPresets: [{ id: "custom-test", name: "Test" }] },
    { trackVisualizerScenes: "kaputt" },
    { trackVisualizerScenes: [{ uri: "spotify:track:test" }] },
    { visualizer: [] },
    { scenePreferences: { playlists: ["defekt"] } },
    { scenePreferences: { playlists: { default: "kein array" } } },
  ]) assert.throws(() => validateToolkitBackup({ ...fixture(), ...change }), /Backup beschädigt/);
});

test("Vor dem Anwenden zeigt Import die Mengen und sperrt parallele Auswahl", () => {
  const code = readFileSync(path.join(root, "src/custom-app/modules/settings/DataBackup.tsx"), "utf8");
  assert.match(code, /validateToolkitBackup\(JSON\.parse\(/);
  assert.match(code, /backupSummary\(data\)/);
  assert.match(code, /window\.confirm\(description\)/);
  assert.match(code, /importing\.current = true/);
  assert.match(code, /importing\.current = false/);
  assert.match(code, /disabled=\{busy\}/);
});
