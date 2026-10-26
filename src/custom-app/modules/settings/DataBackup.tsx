// =============================================================================
// Datei: src/custom-app/modules/settings/DataBackup.tsx
// Zweck: Manuelles Backup/Restore von Einstellungen und lokalen ZuKaTo-Daten.
// =============================================================================
import type { ChangeEvent, ReactElement } from "react";
import { MAX_BACKUP_BYTES, backupSummary, validateToolkitBackup } from "../../../shared/backup-validation";
import { loadPalette, savePalette, normalizePalette } from "../../../shared/appearance";
import { loadLibraryStrict, normalizeLibrary, saveLibrary } from "../../../shared/library";
import { loadSettings, normalizeSettings, saveSettings } from "../../../shared/settings";
import {
  loadVisualizerConfig, loadVisualizerPresets, loadTrackVisualizerScenes, normalizeVisualizerConfig,
  replaceVisualizerPresets, replaceTrackVisualizerScenes, saveVisualizerConfig,
} from "../../../shared/visualizer-config";
import type { Translator } from "../../../shared/i18n";
import { loadScenePreferences, saveScenePreferences, normalizeScenePreferences } from "../../../shared/scene-playlists";
import {
  NAMED_COLLECTIONS_STORAGE_KEY, parseCollectionsDocument, type CollectionsDocument,
} from "../../../extension/modules/playlist-tools/named-collections/NamedCollections";
const ReactRuntime = Spicetify.React as typeof import("react");

/** Liest den neuen Bereich ohne Initialisierung oder stillen Leer-Fallback.
 * Ein beschädigter Stand darf nicht als vollständiges Backup ausgegeben werden. */
function readNamedCollections(): CollectionsDocument | undefined {
  const raw = window.localStorage.getItem(NAMED_COLLECTIONS_STORAGE_KEY);
  return raw === null ? undefined : parseCollectionsDocument(raw);
}

/** Nutzer exportiert freiwillig eine JSON-Datei; es gibt keinen Cloud-Upload. */
export function exportBackup(): void {
  const namedCollections = readNamedCollections();
  const backup = { format: "zukato-toolkit-backup", version: 1, createdAt: new Date().toISOString(),
    settings: loadSettings(), library: loadLibraryStrict(), palette: loadPalette(),
    visualizer: loadVisualizerConfig(), visualizerPresets: loadVisualizerPresets(),
    trackVisualizerScenes: loadTrackVisualizerScenes(), scenePreferences: loadScenePreferences(),
    ...(namedCollections === undefined ? {} : { namedCollections }) };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  // Derselbe Grenzwert gilt beim Einlesen. Ein zu großes Backup darf nicht
  // heruntergeladen werden, wenn es sich später nicht wiederherstellen lässt.
  if (blob.size > MAX_BACKUP_BYTES) throw new Error("Backup überschreitet 10 MB.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `zukato-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Import validiert alle Blöcke, bevor vorhandene Daten ersetzt werden. */
export async function importBackup(file: File): Promise<void> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error("Datei zu groß (max. 10 MB).");
  // Abgebrochene oder manipulierte JSON-Dateien VOR allen Storage-Zugriffen
  // verwerfen. Tolerante Laufzeit-Normalisierung darf nicht heimlich Daten löschen.
  const data = validateToolkitBackup(JSON.parse(await file.text()) as unknown);
  // Das Sammlungsformat vollständig prüfen, bevor Einstellungen oder andere
  // lokale Daten auch nur einmal geändert werden. Alte Backups lassen es aus.
  const namedCollections = data.namedCollections === undefined ? undefined
    : parseCollectionsDocument(JSON.stringify(data.namedCollections));
  // Auch eine unbekannte Palette darf nicht unbemerkt zur Standardfarbe werden.
  if (data.palette !== undefined && normalizePalette(data.palette).toLowerCase() !== data.palette.toLowerCase()) {
    throw new Error("Backup beschädigt: Unbekannte Farbpalette. Es wurden keine Daten überschrieben.");
  }
  // Vor der ersten Änderung ALLE optionalen Blöcke normalisieren. Damit
  // löst ein fehlerhaftes Zusatzfeld keine halbfertige Wiederherstellung aus.
  const next = {
    settings: normalizeSettings(data.settings),
    library: normalizeLibrary(data.library),
    // Alte Backups ohne Palette dürfen die derzeitige Farbe NICHT zurücksetzen.
    palette: data.palette === undefined ? undefined : normalizePalette(data.palette),
    visualizer: data.visualizer === undefined ? undefined : normalizeVisualizerConfig(data.visualizer),
    presets: data.visualizerPresets,
    trackScenes: data.trackVisualizerScenes,
    scenePreferences: data.scenePreferences === undefined ? undefined : normalizeScenePreferences(data.scenePreferences),
    namedCollections,
  };
  // Alte Backups enthalten nicht jeden heutigen Abschnitt. In der Vorschau
  // "bleibt erhalten" zeigen, statt fälschlich "0" (wird gelöscht) anzudeuten.
  // Die aktuellen Werte zugleich für einen möglichen Rollback sichern.
  const counts = backupSummary(data);
  const previousCollectionsRaw = namedCollections === undefined ? undefined
    : window.localStorage.getItem(NAMED_COLLECTIONS_STORAGE_KEY);
  let previousCollectionsCount = "0";
  if (previousCollectionsRaw) {
    try { previousCollectionsCount = String(parseCollectionsDocument(previousCollectionsRaw).collections.length); }
    catch { previousCollectionsCount = "beschädigte Daten"; }
  }
  const previous = {
    settings: loadSettings(), library: loadLibraryStrict(), palette: loadPalette(),
    visualizer: loadVisualizerConfig(), presets: loadVisualizerPresets(),
    trackScenes: loadTrackVisualizerScenes(), scenePreferences: loadScenePreferences(),
  };
  const description = [
    "Backup importieren? Vorhandene Daten werden ersetzt, soweit im Backup enthalten.",
    `Hörverlauf: ${previous.library.history.length} → ${counts.history}`,
    `Favoriten: ${previous.library.favorites.length} → ${counts.favorites}`,
    `Notizen: ${previous.library.notes.length} → ${counts.notes}`,
    `Benannte Sammlungen: ${namedCollections === undefined ? "bleiben erhalten"
      : `${previousCollectionsCount} → ${namedCollections.collections.length}`}`,
    `Visualizer-Presets: ${data.visualizerPresets === undefined ? "bleiben erhalten" : `${previous.presets.length} → ${counts.presets}`}`,
    `Song-Szenen: ${data.trackVisualizerScenes === undefined ? "bleiben erhalten" : `${previous.trackScenes.length} → ${counts.songScenes}`}`,
    `Farbpalette: ${data.palette === undefined ? "bleibt erhalten" : "wird ersetzt"}`,
    `Wallpaper-Zuordnungen: ${data.scenePreferences === undefined ? "bleiben erhalten" : "werden ersetzt"}`,
    "HTML-Wallpapers, Videos und LRC-Dateien sind nicht im JSON-Backup enthalten.",
    "Bitte vor dem Import zuerst einen Export deines aktuellen Stands erstellen.",
  ].join("\n");
  if (!window.confirm(description)) return;
  let collectionsWritten = false;
  try {
    saveSettings(next.settings);
    saveLibrary(next.library);
    if (next.palette !== undefined) savePalette(next.palette);
    if (next.visualizer !== undefined) saveVisualizerConfig(next.visualizer);
    // Bei älteren Backups ohne Presets oder individuelle Song-Szenen keine
    // bestehenden Einstellungen löschen.
    if (next.presets !== undefined) replaceVisualizerPresets(next.presets);
    if (next.trackScenes !== undefined) replaceTrackVisualizerScenes(next.trackScenes);
    if (next.scenePreferences !== undefined) saveScenePreferences(next.scenePreferences);
    // Sammlungen zuletzt schreiben. Misslingt dieser Schritt, können die
    // vorherigen Bereiche mit dem bereits gelesenen Zustand zurückrollen.
    if (next.namedCollections !== undefined) {
      window.localStorage.setItem(NAMED_COLLECTIONS_STORAGE_KEY, JSON.stringify(next.namedCollections));
      collectionsWritten = true;
    }
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
      ...(collectionsWritten ? [() => {
        if (previousCollectionsRaw === null) window.localStorage.removeItem(NAMED_COLLECTIONS_STORAGE_KEY);
        else if (previousCollectionsRaw !== undefined)
          window.localStorage.setItem(NAMED_COLLECTIONS_STORAGE_KEY, previousCollectionsRaw);
      }] : []),
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
  const [busy, setBusy] = ReactRuntime.useState(false);
  // Ein Ref sperrt bereits den ersten schnellen Doppelklick, bevor React rendert.
  const importing = ReactRuntime.useRef(false);
  const en = t("settings.heading") === "Settings";
  /** Exportfehler sichtbar melden, statt eine unvollständige Sicherung anzubieten. */
  function onExport(): void {
    setError("");
    try { exportBackup(); }
    catch (cause) {
      console.error("[ZuKaTo] Backup-Export fehlgeschlagen", cause);
      setError(en ? "Backup export failed. Your stored data was not modified."
        : "Backup-Export fehlgeschlagen. Deine gespeicherten Daten wurden nicht verändert.");
    }
  }
  async function onFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || importing.current) return;
    importing.current = true;
    setBusy(true);
    setError("");
    try { await importBackup(file); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Backup ungültig."); }
    finally { event.target.value = ""; importing.current = false; setBusy(false); }
  }
  return <section className="zukato-data-backup" aria-labelledby="zukato-backup-label">
    <h2 id="zukato-backup-label">{en ? "Backup and restore" : "Datensicherung & Wiederherstellung"}</h2>
    <p>{en ? "Export and restore settings, history, favorites, named collections, notes, visualizer controls, presets and song-specific scenes. Videos, HTML files and imported LRC files stay in IndexedDB and are NOT included in the JSON backup. No upload." : "Einstellungen, Hörverlauf, Favoriten, benannte Sammlungen, Notizen, Visualizer-Regler, Presets und Song-Szenen sichern. Videos, HTML-Wallpapers und importierte LRC-Dateien liegen in IndexedDB und sind NICHT im JSON-Backup enthalten. Kein Cloud-Upload."}</p>
    <div className="zukato-toolbar">
      <button type="button" onClick={onExport} disabled={busy}>{en ? "Export backup (.json)" : "Backup exportieren (.json)"}</button>
      <label>{en ? "Import backup" : "Backup importieren"}
        <input type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { void onFileSelected(event); }} />
      </label>
    </div>
    {error && <p role="alert" className="zukato-error">{error}</p>}
  </section>;
}
