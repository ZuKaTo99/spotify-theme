// =============================================================================
// Datei: src/custom-app/modules/settings/DataBackup.tsx
// Zweck: Manuelles Backup/Restore von Einstellungen und lokalen ZuKaTo-Daten.
// =============================================================================
import type { ChangeEvent, ReactElement } from "react";
import { loadPalette, savePalette, normalizePalette } from "../../../shared/appearance";
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
  // Vor der ersten Änderung ALLE optionalen Blöcke normalisieren. Damit
  // löst ein fehlerhaftes Zusatzfeld keine halbfertige Wiederherstellung aus.
  const next = {
    settings: normalizeSettings(data.settings),
    library: normalizeLibrary(data.library),
    palette: normalizePalette(data.palette),
    visualizer: data.visualizer === undefined ? undefined : normalizeVisualizerConfig(data.visualizer),
    presets: data.visualizerPresets,
    trackScenes: data.trackVisualizerScenes,
    scenePreferences: data.scenePreferences === undefined ? undefined : normalizeScenePreferences(data.scenePreferences),
  };
  // Vor der Bestätigung alle aktuellen Werte als kleine Sicherung im Speicher
  // behalten. Die großen HTML-/Video-Blobs sind hiervon nicht betroffen.
  if (!window.confirm("Alle aktuellen ZuKaTo-Einstellungen, Favoriten, Notizen und den Hörverlauf durch dieses Backup ersetzen?")) return;
  const previous = {
    settings: loadSettings(), library: loadLibrary(), palette: loadPalette(),
    visualizer: loadVisualizerConfig(), presets: loadVisualizerPresets(),
    trackScenes: loadTrackVisualizerScenes(), scenePreferences: loadScenePreferences(),
  };
  try {
    saveSettings(next.settings);
    saveLibrary(next.library);
    savePalette(next.palette);
    if (next.visualizer !== undefined) saveVisualizerConfig(next.visualizer);
    // Bei älteren Backups ohne Presets oder individuelle Song-Szenen keine
    // bestehenden Einstellungen löschen.
    if (next.presets !== undefined) replaceVisualizerPresets(next.presets);
    if (next.trackScenes !== undefined) replaceTrackVisualizerScenes(next.trackScenes);
    if (next.scenePreferences !== undefined) saveScenePreferences(next.scenePreferences);
  } catch (cause) {
    // Browser-Storage ist nicht transaktional. Bei Schreibfehlern versuchen
    // wir daher jeden bereits bearbeiteten Bereich auf den alten Zustand
    // zurückzusetzen. Die Original-Wallpaper-Dateien werden nie angerührt.
    const rollback = [
      () => saveSettings(previous.settings),
      () => saveLibrary(previous.library),
      () => savePalette(previous.palette),
      () => saveVisualizerConfig(previous.visualizer),
      () => replaceVisualizerPresets(previous.presets),
      () => replaceTrackVisualizerScenes(previous.trackScenes),
      () => saveScenePreferences(previous.scenePreferences),
    ];
    const results = rollback.map((restore) => {
      try { restore(); return true; } catch { return false; }
    });
    const detail = results.every(Boolean) ? "Vorheriger Zustand wiederhergestellt."
      : "Einige Daten konnten wegen des Speicherfehlers nicht zurückgesetzt werden. Bitte den aktuellen Stand prüfen.";
    throw new Error(`Backup konnte nicht vollständig importiert werden. ${detail} Ursache: ${String(cause)}`);
  }
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
