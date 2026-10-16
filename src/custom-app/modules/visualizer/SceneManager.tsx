// =============================================================================
// Datei: SceneManager.tsx
// Zweck: Eigene HTML-/Video-Wallpapers importieren und pro Song als Diashow ordnen.
// Wo ändern? Ordnerimport, Reihenfolge und Bibliotheksbedienung hier.
// Alte Einzelvideo-Zuordnungen werden separat im bestehenden Manager verwaltet.
// =============================================================================
import type { ChangeEvent, ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import {
  loadScenePreferences, saveScenePreferences, withoutScene,
  MAX_PLAYLIST_ITEMS, MAX_PLAYLIST_SCOPES, type ScenePreferences,
} from "../../../shared/scene-playlists";
import { deleteScene, importSceneFolder, listScenes, loadScene, loadSceneProject, type SceneEntry } from "./scene-store";
import { zipWallpaperProject } from "./wallpaper-export";
import { groupWallpaperFolderFiles } from "./scene-folder";
import { loadSongSession } from "../../../shared/song-session";
import { ScenePreview } from "./ScenePreview";

const ReactRuntime = Spicetify.React as typeof import("react");

interface Props {
  t: Translator;
  trackUri: string;
  settings: ScenePreferences;
  onChange: (value: ScenePreferences) => void;
  onError: (message: string) => void;
  showModeToggle?: boolean;
}

/** Lokaler Verwaltungsdialog: ändert keine Datei, die du in Wallpaper Engine bearbeitest. */
export function SceneManager({ t, trackUri, settings, onChange, onError, showModeToggle = true }: Props): ReactElement {
  const [scope, setScope] = ReactRuntime.useState("default");
  const [scenes, setScenes] = ReactRuntime.useState<SceneEntry[]>([]);
  const [selected, setSelected] = ReactRuntime.useState("");
  const [previewId, setPreviewId] = ReactRuntime.useState("");
  const [loaded, setLoaded] = ReactRuntime.useState(false);
  const [revision, setRevision] = ReactRuntime.useState(0);
  const [busy, setBusy] = ReactRuntime.useState(false);
  const [importStatus, setImportStatus] = ReactRuntime.useState("");
  const effectiveScope = scope === "track" && trackUri ? trackUri : "default";
  const playlist = settings.playlists[effectiveScope] ?? [];

  ReactRuntime.useEffect(() => {
    let active = true;
    void listScenes().then((list) => { if (active) { setScenes(list); setLoaded(true); } })
      .catch((cause: unknown) => { if (active) onError(String(cause)); });
    return () => { active = false; };
  }, [revision]);

  /** Persistenz zuerst, React-State erst nach erfolgreichem Schreibvorgang. */
  function persist(changes: Partial<ScenePreferences>): void {
    // Immer vom aktuellen Storage-Stand ausgehen: andere Einstellungsseiten
    // können dieselbe Bibliothek zur gleichen Zeit bearbeiten.
    try { onChange(saveScenePreferences({ ...loadScenePreferences(), ...changes })); }
    catch (cause) { onError(String(cause)); }
  }

  function changePlaylist(next: string[]): void {
    if (next.length > MAX_PLAYLIST_ITEMS) { onError(t("viz.sceneListFull")); return; }
    const latest = loadScenePreferences();
    const playlists = { ...latest.playlists };
    if (!playlists[effectiveScope] && Object.keys(playlists).length >= MAX_PLAYLIST_SCOPES) {
      onError(t("viz.sceneScopesFull")); return;
    }
    const starts = { ...latest.starts };
    if (next.length) {
      playlists[effectiveScope] = next;
      // Nach einem neuen Import/Sortieren beginnt die ausgewählte Liste mit
      // Wallpaper #1 ab dem NÄCHSTEN Spotify-Songlauf.
      starts[effectiveScope] = (loadSongSession()?.index ?? -1) + 1;
    } else {
      delete playlists[effectiveScope];
      delete starts[effectiveScope];
    }
    persist({ playlists, starts });
  }

  /**
   * Ein ausgewählter Sammelordner mit 01/index.html, 02/index.html ...
   * wird automatisch in einzelne HTML-Wallpapers aufgeteilt UND der aktuell
   * gewählten Playlist (meist "Standard für alle Titel") hinzugefügt.
   * Originalordner und -dateien bleiben auf dem Rechner unverändert.
   */
  async function importFolder(files: readonly File[]): Promise<void> {
    if (!files.length) return;
    setBusy(true);
    setImportStatus("");
    try {
      // Vor dem kostenintensiven Import zuerst die Playlist-Grenze prüfen.
      const projects = groupWallpaperFolderFiles(files);
      setImportStatus(t("viz.sceneImportPreparing", {
        count: String(projects.length), files: String(files.length),
      }));
      if (playlist.length + projects.length > MAX_PLAYLIST_ITEMS)
        throw new Error(t("viz.sceneListFull"));
      if (!settings.playlists[effectiveScope] && Object.keys(settings.playlists).length >= MAX_PLAYLIST_SCOPES)
        throw new Error(t("viz.sceneScopesFull"));
      const imported = await importSceneFolder(files);
      // Nach langer IndexedDB-Verarbeitung aktuelle Einstellungen neu lesen.
      // Sonst könnten parallele Änderungen aus dem Einstellungen-Panel durch
      // den veralteten React-Snapshot zurückgesetzt werden.
      const freshSettings = loadScenePreferences();
      const currentList = freshSettings.playlists[effectiveScope] ?? [];
      // Ein eventueller Konflikt nach dem Import wird im folgenden try/catch
      // mit derselben Rollback-Logik behandelt wie ein Storage-Schreibfehler.
      const playlists = { ...freshSettings.playlists,
        [effectiveScope]: [...currentList, ...imported.map((entry) => entry.id)] };
      const starts = { ...freshSettings.starts, [effectiveScope]: (loadSongSession()?.index ?? -1) + 1 };
      // Wenn die Playlist-Einstellung nicht gespeichert werden kann, keine
      // verwaisten (unter Umständen mehrere 100 MiB großen) Projektkopien
      // in der IndexedDB zurücklassen. Die Originalordner bleiben unberührt.
      try {
        if (currentList.length + imported.length > MAX_PLAYLIST_ITEMS)
          throw new Error(t("viz.sceneListFull"));
        if (!freshSettings.playlists[effectiveScope] &&
            Object.keys(freshSettings.playlists).length >= MAX_PLAYLIST_SCOPES)
          throw new Error(t("viz.sceneScopesFull"));
        onChange(saveScenePreferences({ ...freshSettings, playlists, starts }));
      } catch (error) {
        const rolledBack = await Promise.allSettled(imported.map((entry) => deleteScene(entry.id)));
        if (rolledBack.some((result) => result.status === "rejected")) {
          throw new Error("Playlist konnte nicht gespeichert werden; bitte unzugeordnete Projekte in der Bibliothek prüfen.");
        }
        throw error;
      }
      setRevision((value) => value + 1);
      setSelected(imported[0]?.id ?? "");
      setImportStatus(t("viz.sceneImported", { count: String(imported.length) }));
    } catch (cause) { onError(String(cause)); }
    finally { setBusy(false); }
  }

  /**
   * Chromium liefert beim Ordner-Picker den Dateibaum als FileList mit
   * webkitRelativePath. Ein einzelnes index.html lässt sich hier absichtlich
   * NICHT mehr auswählen, weil CSS, JS, Fonts und Assets sonst fehlen.
   */
  function onImportFolder(event: ChangeEvent<HTMLInputElement>): void {
    const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
    event.currentTarget.value = "";
    void importFolder(files);
  }

  async function removeScene(): Promise<void> {
    if (!selected) return;
    // Nutzer selbst erstellte Szenen niemals ohne explizite Bestätigung
    // dauerhaft löschen. Die Quelldatei auf der Festplatte bleibt erhalten.
    if (!window.confirm(t("viz.sceneDeleteConfirm"))) return;
    setBusy(true);
    try {
      // Erst Playlist bereinigen, danach Binärdateien löschen. Scheitert die
      // Datenbanklöschung, restaurieren wir die alte Playlist unmittelbar.
      // So bleiben niemals Playlist-Einträge auf bereits gelöschte Dateien.
      // Eine andere Seite kann die Playlists während eines offenen
      // Bestätigungsdialogs verändert haben. Deshalb den letzten dauerhaften
      // Stand laden und nur die zu löschende Szene daraus entfernen.
      const previous = loadScenePreferences();
      onChange(saveScenePreferences(withoutScene(previous, selected)));
      try { await deleteScene(selected); }
      catch (cause) {
        // Der Benutzer darf seine andere Szenenreihenfolge behalten, wenn
        // IndexedDB die eigentliche Datei-Löschung verweigert.
        const latest = loadScenePreferences();
        const playlists = { ...latest.playlists };
        const starts = { ...latest.starts };
        for (const [scope, ids] of Object.entries(previous.playlists)) {
          if (ids.includes(selected)) {
            const updated = (playlists[scope] ?? []).filter((id) => id !== selected);
            // Ursprünglichen Platz wiederherstellen, aber neue Elemente,
            // die parallel hinzukamen, nicht zurücksetzen.
            updated.splice(Math.min(ids.indexOf(selected), updated.length), 0, selected);
            playlists[scope] = updated;
            // withoutScene() hat unter Umständen auch den gespeicherten
            // Listen-Start gelöscht. Bei einem Rollback diesen wiederherstellen,
            // solange keine andere Ansicht ihn zwischenzeitlich neu gesetzt hat.
            if (starts[scope] === undefined && previous.starts[scope] !== undefined)
              starts[scope] = previous.starts[scope];
          }
        }
        onChange(saveScenePreferences({ ...latest, playlists, starts }));
        throw cause;
      }
      setSelected("");
      setPreviewId("");
      setRevision((value) => value + 1);
    } catch (cause) { onError(String(cause)); }
    finally { setBusy(false); }
  }

  /** Der Export verändert keine Originaldatei und überträgt nichts ins Netz. */
  async function exportSelected(): Promise<void> {
    if (!selected) return;
    try {
      const asset = await loadScene(selected);
      if (!asset) throw new Error(t("viz.sceneMissing"));
      // Große HTML-Projekte als vollständige ZIP inklusive aller Originaldateien
      // exportieren. Ein HTML-Export allein würde JS/CSS/Fonts/3D-Assets verlieren.
      const project = asset.format === "project-v2" ? await loadSceneProject(asset.id) : null;
      if (asset.format === "project-v2" && !project) throw new Error("Projektdateien fehlen.");
      const exported = project ? await zipWallpaperProject(project.files) : asset.blob;
      const url = URL.createObjectURL(exported);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = project ? `${asset.name.replace(/\.html?$/i, "")}.zip`
          : asset.kind === "html" ? `${asset.name.replace(/\.html?$/i, "")}.html` : asset.name;
        document.body.append(link);
        link.click();
        link.remove();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1500); }
    } catch (cause) { onError(String(cause)); }
  }

  function move(index: number, direction: number): void {
    const next = playlist.slice();
    const neighbor = index + direction;
    if (neighbor < 0 || neighbor >= next.length) return;
    [next[index], next[neighbor]] = [next[neighbor], next[index]];
    changePlaylist(next);
  }

  const totalMiB = (scenes.reduce((sum, item) => sum + item.bytes, 0) / 1048576).toFixed(1);
  const missingCount = loaded ? new Set(Object.values(settings.playlists).flat()
    .filter((id) => !scenes.some((entry) => entry.id === id))).size : 0;

  return <section className="zukato-viz__controls zukato-viz__scene-manager">
    <h3>{t("viz.sceneHeadingSimplified")}</h3>
    <p>{t("viz.sceneHelp")}</p>
    <div className="zukato-viz__scene-row">
      {showModeToggle && <label className="zukato-viz__checkbox">
        <input type="checkbox" disabled={busy} checked={settings.mode === "original"}
          onChange={(event) => persist({ mode: event.currentTarget.checked ? "original" : "wallpapers" })} />
        {t("viz.originalToggle")}
      </label>}
      <label>{t("viz.sceneScope")}
        <select value={scope} disabled={busy} onChange={(event) => setScope(event.currentTarget.value)}>
          <option value="default">{t("viz.default")}</option>
          <option value="track" disabled={!trackUri}>{t("viz.forTrack")}</option>
        </select>
      </label>
    </div>
    <div className="zukato-viz__scene-row">
      {/* Dies ist absichtlich der EINZIGE HTML-Import. Der gesamte Ordner
          wird ausgewählt, niemals nur eine index.html ohne Referenzen. */}
      <label className="zukato-viz__upload">{t("viz.sceneImportFolder")}
        <input type="file" disabled={busy} multiple ref={(element) => {
          if (element) element.setAttribute("webkitdirectory", "");
        }} onChange={onImportFolder} />
      </label>
    </div>
    <p className="zukato-viz__hint" role="note">{t("viz.sceneFolderOnlyHelp")}</p>
    <p className="zukato-viz__hint">{t("viz.sceneSandboxHelp")}</p>
    {importStatus && <p role="status">{importStatus}</p>}
    <div className="zukato-viz__scene-row">
      <label>{t("viz.sceneLibrary")}
        <select value={selected} onChange={(event) => {
          setSelected(event.currentTarget.value);
          // Eine noch laufende Vorschau der alten Auswahl sofort entladen.
          setPreviewId("");
        }}>
          <option value="">{t("viz.sceneSelect")}</option>
          {scenes.map((scene) => <option key={scene.id} value={scene.id}>
            {scene.kind === "html" ? "HTML" : "VIDEO"} · {scene.name}
          </option>)}
        </select>
      </label>
      <button type="button" disabled={!selected || busy} onClick={() => setPreviewId((id) =>
        id === selected ? "" : selected)}>{previewId === selected ? t("viz.previewClose") : t("viz.previewOpen")}</button>
      <button type="button" disabled={!selected || busy || playlist.includes(selected)}
        onClick={() => changePlaylist([...playlist, selected])}>{t("viz.sceneAdd")}</button>
      <button type="button" disabled={!selected || busy} onClick={() => void exportSelected()}>{t("viz.sceneExport")}</button>
      <button type="button" disabled={!selected || busy} onClick={() => void removeScene()}>{t("viz.sceneDelete")}</button>
    </div>
    {selected && scenes.find((scene) => scene.id === selected)?.format === "project-v2" &&
      <p className="zukato-viz__hint" role="status">HTML-Webprojekt: {
        scenes.find((scene) => scene.id === selected)?.fileCount} Dateien · {
        ((scenes.find((scene) => scene.id === selected)?.bytes ?? 0) / 1048576).toFixed(1)} MiB
        · Export als vollständiges ZIP mit Ordnerstruktur</p>}
    {previewId && <ScenePreview id={previewId} onError={onError} />}
    <p className="zukato-viz__hint">{t("viz.sceneUsage", { count: String(scenes.length), size: totalMiB })}</p>
    {missingCount > 0 && <p role="alert" className="zukato-error">{t("viz.libraryMissing", { count: String(missingCount) })}</p>}
    <h4>{t("viz.scenePlaylist")} ({playlist.length})</h4>
    {playlist.length ? <ol className="zukato-viz__scene-list">{playlist.map((id, index) => <li key={id}>
      <span>{scenes.find((scene) => scene.id === id)?.name ?? t("viz.sceneMissing")}</span>
      <button type="button" title={t("viz.sceneUp")} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button>
      <button type="button" title={t("viz.sceneDown")} disabled={busy || index === playlist.length - 1} onClick={() => move(index, 1)}>↓</button>
      <button type="button" title={t("viz.sceneRemove")} disabled={busy} onClick={() => changePlaylist(playlist.filter((entry) => entry !== id))}>×</button>
    </li>)}</ol> : <p className="zukato-viz__hint">{t("viz.sceneEmpty")}</p>}
    <p className="zukato-viz__hint">{t("viz.originalAutoNote")}</p>
  </section>;
}
