// =============================================================================
// Datei: tests/backup-integrity-v151.test.mjs
// Zweck: Keine stillen Datenverluste beim Wiederherstellen älterer/zu großer
//        Backups. Die Produkt-Normalisierer kürzen bewusst; der Import darf das
//        nie heimlich tun und muss vor dem ersten Schreibvorgang abbrechen.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { validateToolkitBackup, BACKUP_COLLECTION_LIMITS: limits } =
  loadPureSharedModule(root, "src/shared/backup-validation.ts");
const uri = "spotify:track:4iV5W9uYEdYUVa79Axb7Rh";
const track = (id) => ({ uri: `spotify:track:${String(id).padStart(22, "0")}`, title: "Titel", artist: "Künstler", album: "Album" });
const fixture = () => ({
  format: "zukato-toolkit-backup", version: 1,
  settings: { schemaVersion: 3, workspaceTitle: "ZuKaTo" },
  library: { history: [], favorites: [], notes: [] },
});

/** Jeder Ablehnungsfall benötigt einen konkreten Hinweis für den Nutzer. */
function rejects(value, reason) {
  assert.throws(() => validateToolkitBackup(value), (error) =>
    typeof error?.message === "string" && reason.test(error.message) && error.message.includes("keine Daten überschrieben"));
}

test("Grenzen entsprechen den tatsächlichen lokalen Speicherkapazitäten", () => {
  // Damit neue Storage-Limits niemals unbemerkt von der Import-Prüfung abweichen.
  const library = readFileSync(path.join(root, "src/shared/library.ts"), "utf8");
  const visualizer = readFileSync(path.join(root, "src/shared/visualizer-config.ts"), "utf8");
  const playlists = readFileSync(path.join(root, "src/shared/scene-playlists.ts"), "utf8");
  for (const [constant, value] of [["MAX_HISTORY", limits.history], ["MAX_FAVORITES", limits.favorites], ["MAX_NOTES", limits.notes]]) {
    assert.match(library, new RegExp(`const ${constant} = ${value};`));
  }
  assert.match(visualizer, new RegExp(`MAX_VISUALIZER_PRESETS = ${limits.visualizerPresets}`));
  assert.match(visualizer, new RegExp(`MAX_TRACK_SCENES = ${limits.trackVisualizerScenes}`));
  assert.match(playlists, new RegExp(`MAX_PLAYLIST_ITEMS = ${limits.scenePlaylistItems}`));
  assert.match(playlists, new RegExp(`MAX_PLAYLIST_SCOPES = ${limits.scenePlaylistScopes}`));
});

test("Hörverlauf und Favoriten werden nicht über den Grenzen abgeschnitten", () => {
  const value = fixture();
  value.library.history = Array.from({ length: limits.history }, (_, id) => ({ ...track(id), playedAt: id }));
  value.library.favorites = Array.from({ length: limits.favorites }, (_, id) => track(id));
  assert.doesNotThrow(() => validateToolkitBackup(value));
  value.library.history.push({ ...track(900), playedAt: 900 });
  rejects(value, /Hörverlauf.*maximale Anzahl/);
  value.library.history.pop();
  value.library.favorites.push(track(900));
  rejects(value, /Favoriten.*maximale Anzahl/);
});

test("Mehr als 250 Song-Notizen und überlange Notiztexte werden vor dem Import abgelehnt", () => {
  const value = fixture();
  value.library.notes = Array.from({ length: limits.notes }, (_, id) => ({ ...track(id), text: "OK", updatedAt: id }));
  assert.doesNotThrow(() => validateToolkitBackup(value));
  value.library.notes.push({ ...track(900), text: "wichtig", updatedAt: 900 });
  rejects(value, /Notizen.*maximale Anzahl/);
  value.library.notes.pop();
  value.library.notes[0].text = "x".repeat(4001);
  rejects(value, /Notizen.*ungültige Einträge/);
});

test("Überlange Spotify-URIs und Metadaten dürfen nicht zu ungültigen Titeln mutieren", () => {
  const value = fixture();
  value.library.favorites = [{ uri: `spotify:track:${"x".repeat(250)}`, title: "OK" }];
  rejects(value, /Favoriten enthalten/);
  value.library.favorites = [{ uri, title: "x".repeat(181) }];
  rejects(value, /Favoriten enthalten/);
  value.library.history = [{ uri, playedAt: -1 }];
  value.library.favorites = [];
  rejects(value, /Hörverlauf enthält/);
});

test("Zu viele oder doppelte Visualizer-Presets werden nicht still verworfen", () => {
  const value = fixture();
  value.visualizerPresets = Array.from({ length: limits.visualizerPresets }, (_, id) =>
    ({ id: `custom-${id}`, name: `Preset ${id}`, config: { version: 1 } }));
  assert.doesNotThrow(() => validateToolkitBackup(value));
  value.visualizerPresets.push({ id: "custom-extra", name: "Extra", config: {} });
  rejects(value, /Zu viele Visualizer-Presets/);
  value.visualizerPresets.pop();
  value.visualizerPresets[1].id = value.visualizerPresets[0].id;
  rejects(value, /Doppelte Visualizer-Preset-ID/);
});

test("Zu viele oder doppelte songbezogene Szenen werden vor dem Restore abgelehnt", () => {
  const value = fixture();
  value.trackVisualizerScenes = Array.from({ length: limits.trackVisualizerScenes }, (_, id) =>
    ({ uri: track(id).uri, config: { version: 1 } }));
  assert.doesNotThrow(() => validateToolkitBackup(value));
  value.trackVisualizerScenes.push({ uri, config: {} });
  rejects(value, /Zu viele Song-Szenen/);
  value.trackVisualizerScenes.pop();
  value.trackVisualizerScenes[1].uri = value.trackVisualizerScenes[0].uri;
  rejects(value, /Doppelte Song-Szene/);
});

test("Überfüllte, doppelte und fehlerhafte Wallpaper-Playlists werden vor dem Schreiben erkannt", () => {
  const value = fixture();
  const scene = (id) => `scene-${String(id).padStart(8, "0")}`;
  value.scenePreferences = { playlists: { default: Array.from({ length: limits.scenePlaylistItems }, (_, id) => scene(id)) } };
  assert.doesNotThrow(() => validateToolkitBackup(value));
  value.scenePreferences.playlists.default.push(scene(999));
  rejects(value, /Wallpaper-Playlist beschädigt oder zu groß/);
  value.scenePreferences.playlists.default.pop();
  value.scenePreferences.playlists.default[0] = value.scenePreferences.playlists.default[1];
  rejects(value, /Wallpaper-Playlist beschädigt oder zu groß/);
});

test("Alte Backups ohne Farbangabe dürfen bei der Wiederherstellung das Design nicht zurücksetzen", () => {
  // Die optionale Palette wird im Wiederherstellungsplan ausdrücklich übersprungen.
  const component = readFileSync(path.join(root, "src/custom-app/modules/settings/DataBackup.tsx"), "utf8");
  assert.match(component, /palette: data\.palette === undefined \? undefined : normalizePalette\(data\.palette\)/);
  assert.match(component, /if \(next\.palette !== undefined\) savePalette\(next\.palette\)/);
  assert.match(component, /Farbpalette:.*bleibt erhalten/);
  assert.match(component, /if \(!window\.confirm\(description\)\) return/);
  assert.doesNotThrow(() => validateToolkitBackup(fixture()));
});
