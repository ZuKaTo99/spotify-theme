// =============================================================================
// Datei: src/custom-app/modules/settings/DataBackup.tsx
// Zweck: Manuelles Backup/Restore von Einstellungen und lokalen ZuKaTo-Daten.
// =============================================================================
import type { ChangeEvent, ReactElement } from "react";
import { loadPalette, savePalette, PALETTES, type PaletteId } from "../../../shared/appearance";
import { loadLibrary, normalizeLibrary, saveLibrary } from "../../../shared/library";
import { loadSettings, normalizeSettings, saveSettings } from "../../../shared/settings";
import {
  loadVisualizerConfig, loadVisualizerPresets, loadTrackVisualizerScenes, normalizeVisualizerConfig,
  replaceVisualizerPresets, replaceTrackVisualizerScenes, saveVisualizerConfig,
} from "../../../shared/visualizer-config";
import type { Translator } from "../../../shared/i18n";
import { loadScenePreferences, saveScenePreferences, normalizeScenePreferences } from "../../../shared/scene-playlists";
const ReactRuntime = Spicetify.React as typeof import("react");

/** Nutzer exportiert freiwillig eine JSON-Datei; es gibt keinen Cloud-Upload. */
function exportBackup(): void {
  const backup = { format: "zukato-toolkit-backup", version: 1, createdAt: new Date().toISOString(),
    settings: loadSettings(), library: loadLibrary(), palette: loadPalette(),
    visualizer: loadVisualizerConfig(), visualizerPresets: loadVisualizerPresets(),
    trackVisualizerScenes: loadTrackVisualizerScenes(), scenePreferences: loadScenePreferences() };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `zukato-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Import validiert alle Blöcke, bevor vorhandene Daten ersetzt werden. */
async function importBackup(file: File): Promise<void> {
  if (file.size > 2_000_000) throw new Error("Datei zu groß (max. 2 MB).");
  const raw: unknown = JSON.parse(await file.text());
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Ungültiges Format.");
  const data = raw as Record<string, unknown>;
  if (data.format !== "zukato-toolkit-backup" || data.version !== 1 ||
      !data.settings || !data.library) throw new Error("Keine ZuKaTo-Backupdatei (Version 1).");
  const settings = normalizeSettings(data.settings);
  const library = normalizeLibrary(data.library);
  const palette = typeof data.palette === "string" && Object.prototype.hasOwnProperty.call(PALETTES, data.palette)
    ? data.palette as PaletteId : "emerald";
  // Bestätigung vor allen destruktiven Ersetzungen; keine automatische Import-Aktion.
  if (!window.confirm("Alle aktuellen ZuKaTo-Einstellungen, Favoriten, Notizen und den Hörverlauf durch dieses Backup ersetzen?")) return;
  saveSettings(settings);
  saveLibrary(library);
  savePalette(palette);
  // Alte Backups ohne Visualizer-Bereich behalten die lokal gespeicherten Regler.
  if (data.visualizer !== undefined) saveVisualizerConfig(normalizeVisualizerConfig(data.visualizer));
  // Bei v1.2-Backups ohne Presets die aktuellen Szenen nicht versehentlich löschen.
  if (data.visualizerPresets !== undefined) replaceVisualizerPresets(data.visualizerPresets);
  // Nur neue Backups enthalten individuelle Song-Styles; ältere überschreiben sie nicht.
  if (data.trackVisualizerScenes !== undefined) replaceTrackVisualizerScenes(data.trackVisualizerScenes);
  // Eigene HTML/Videodateien werden bewusst NICHT im JSON-Backup mitgesichert.
  // Nur ihre Szene-IDs, Reihenfolge und vom Nutzer hinterlegte Original-URLs.
  if (data.scenePreferences !== undefined) saveScenePreferences(normalizeScenePreferences(data.scenePreferences));
  Spicetify.showNotification("ZuKaTo-Backup wiederhergestellt.");
}

export function DataBackup({ t }: { t: Translator }): ReactElement {
  const [error, setError] = ReactRuntime.useState("");
  const en = t("settings.heading") === "Settings";
  async function onFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try { await importBackup(file); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Backup ungültig."); }
    finally { event.target.value = ""; }
  }
  return <section className="zukato-data-backup" aria-labelledby="zukato-backup-label">
    <h2 id="zukato-backup-label">{en ? "Backup and restore" : "Datensicherung & Wiederherstellung"}</h2>
    <p>{en ? "Export and restore settings, history, favorites, notes, visualizer controls, presets and song-specific scenes. Videos, HTML files and imported LRC files stay in IndexedDB and are NOT included in the JSON backup. No upload." : "Einstellungen, Hörverlauf, Favoriten, Notizen, Visualizer-Regler, Presets und Song-Szenen sichern. Videos, HTML-Wallpapers und importierte LRC-Dateien liegen in IndexedDB und sind NICHT im JSON-Backup enthalten. Kein Cloud-Upload."}</p>
    <div className="zukato-toolbar">
      <button type="button" onClick={exportBackup}>{en ? "Export backup (.json)" : "Backup exportieren (.json)"}</button>
      <label>{en ? "Import backup" : "Backup importieren"}
        <input type="file" accept=".json,application/json" onChange={(event) => { void onFileSelected(event); }} />
      </label>
    </div>
    {error && <p role="alert" className="zukato-error">{error}</p>}
  </section>;
}
