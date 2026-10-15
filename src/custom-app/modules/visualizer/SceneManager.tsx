// =============================================================================
// Datei: SceneManager.tsx
// Zweck: Eigene HTML-/Video-Wallpapers importieren und pro Song als Diashow ordnen.
// Wo ändern? Bedienoberfläche für Reihenfolge, Import, URL und Quellenmodus hier.
// Alte Einzelvideo-Zuordnungen werden separat im bestehenden Manager verwaltet.
// =============================================================================
import type { ChangeEvent, ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import {
  saveScenePreferences, validateOriginalVideoUrl, withoutScene,
  MAX_PLAYLIST_ITEMS, MAX_PLAYLIST_SCOPES, validateOriginalRange, parseOriginalClipManifest, type ScenePreferences,
} from "../../../shared/scene-playlists";
import { deleteScene, importScene, importSceneFolder, listScenes, loadScene, type SceneEntry } from "./scene-store";
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
}

/** Lokaler Verwaltungsdialog: ändert keine Datei, die du in Wallpaper Engine bearbeitest. */
export function SceneManager({ t, trackUri, settings, onChange, onError }: Props): ReactElement {
  const [scope, setScope] = ReactRuntime.useState("default");
  const [scenes, setScenes] = ReactRuntime.useState<SceneEntry[]>([]);
  const [selected, setSelected] = ReactRuntime.useState("");
  const [previewId, setPreviewId] = ReactRuntime.useState("");
  const [loaded, setLoaded] = ReactRuntime.useState(false);
  const [urlDraft, setUrlDraft] = ReactRuntime.useState("");
  const [rangeStart, setRangeStart] = ReactRuntime.useState("0");
  const [rangeEnd, setRangeEnd] = ReactRuntime.useState("");
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

  ReactRuntime.useEffect(() => {
    setUrlDraft(settings.originals[effectiveScope] ?? "");
    const range = settings.originalRanges[effectiveScope];
    setRangeStart(String(range?.start ?? 0));
    setRangeEnd(range?.end === null || range?.end === undefined ? "" : String(range.end));
  }, [effectiveScope, settings.originals, settings.originalRanges]);

  /** Persistenz zuerst, React-State erst nach erfolgreichem Schreibvorgang. */
  function persist(changes: Partial<ScenePreferences>): void {
    try { onChange(saveScenePreferences({ ...settings, ...changes })); }
    catch (cause) { onError(String(cause)); }
  }

  function changePlaylist(next: string[]): void {
    if (next.length > MAX_PLAYLIST_ITEMS) { onError(t("viz.sceneListFull")); return; }
    const playlists = { ...settings.playlists };
    if (!playlists[effectiveScope] && Object.keys(playlists).length >= MAX_PLAYLIST_SCOPES) {
      onError(t("viz.sceneScopesFull")); return;
    }
    const starts = { ...settings.starts };
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

  /** Einzelnes Projekt/video in die Bibliothek; manuelle Zuordnung möglich. */
  async function importFiles(files: readonly File[]): Promise<void> {
    if (!files.length) return;
    setBusy(true);
    setImportStatus("");
    try {
      const result = await importScene(files);
      setRevision((value) => value + 1);
      setSelected(result.id);
      setImportStatus(t("viz.sceneImported", { count: "1" }));
    } catch (cause) { onError(String(cause)); }
    finally { setBusy(false); }
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
      if (playlist.length + projects.length > MAX_PLAYLIST_ITEMS)
        throw new Error(t("viz.sceneListFull"));
      if (!settings.playlists[effectiveScope] && Object.keys(settings.playlists).length >= MAX_PLAYLIST_SCOPES)
        throw new Error(t("viz.sceneScopesFull"));
      const imported = await importSceneFolder(files);
      const playlists = { ...settings.playlists,
        [effectiveScope]: [...playlist, ...imported.map((entry) => entry.id)] };
      const starts = { ...settings.starts, [effectiveScope]: (loadSongSession()?.index ?? -1) + 1 };
      onChange(saveScenePreferences({ ...settings, playlists, starts }));
      setRevision((value) => value + 1);
      setSelected(imported[0]?.id ?? "");
      setImportStatus(t("viz.sceneImported", { count: String(imported.length) }));
    } catch (cause) { onError(String(cause)); }
    finally { setBusy(false); }
  }

  function onImport(event: ChangeEvent<HTMLInputElement>, folder: boolean): void {
    // FileList vor input.value="" kopieren, sonst verliert Chromium die Daten.
    const copied = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
    event.currentTarget.value = "";
    if (folder) void importFolder(copied);
    else void importFiles(copied);
  }

  async function removeScene(): Promise<void> {
    if (!selected) return;
    // Nutzer selbst erstellte Szenen niemals ohne explizite Bestätigung
    // dauerhaft löschen. Die Quelldatei auf der Festplatte bleibt erhalten.
    if (!window.confirm(t("viz.sceneDeleteConfirm"))) return;
    setBusy(true);
    try {
      await deleteScene(selected);
      const next = withoutScene(settings, selected);
      onChange(saveScenePreferences(next));
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
      const url = URL.createObjectURL(asset.blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = asset.kind === "html" ? `${asset.name.replace(/\.html?$/i, "")}.html` : asset.name;
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

  /**
   * JSON-Liste erlaubt viele manuelle Originalclip-Zuordnungen auf einmal.
   * Eine URL ist nur eine externe Quelle; wir laden keine Videos herunter.
   */
  async function onOriginalManifest(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 100_000) throw new Error(t("viz.manifestTooLarge"));
      const imported = parseOriginalClipManifest(JSON.parse(await file.text()) as unknown);
      const originals = { ...settings.originals, ...imported.originals };
      if (Object.keys(originals).length > MAX_PLAYLIST_SCOPES)
        throw new Error(t("viz.sceneScopesFull"));
      persist({ originals, originalRanges: { ...settings.originalRanges, ...imported.originalRanges } });
      setImportStatus(t("viz.manifestImported", { count: String(Object.keys(imported.originals).length) }));
    } catch (cause) { onError(String(cause)); }
    finally { setBusy(false); }
  }

  function saveOriginal(): void {
    try {
      const url = validateOriginalVideoUrl(urlDraft);
      const originals = { ...settings.originals };
      const originalRanges = { ...settings.originalRanges };
      if (url) {
        originals[effectiveScope] = url;
        originalRanges[effectiveScope] = validateOriginalRange(Number(rangeStart),
          rangeEnd.trim() ? Number(rangeEnd) : null);
      } else {
        delete originals[effectiveScope];
        delete originalRanges[effectiveScope];
      }
      persist({ originals, originalRanges });
    } catch (cause) { onError(String(cause)); }
  }

  const totalMiB = (scenes.reduce((sum, item) => sum + item.bytes, 0) / 1048576).toFixed(1);
  const missingCount = loaded ? new Set(Object.values(settings.playlists).flat()
    .filter((id) => !scenes.some((entry) => entry.id === id))).size : 0;

  return <section className="zukato-viz__controls zukato-viz__scene-manager">
    <h3>{t("viz.sceneHeading")}</h3>
    <p>{t("viz.sceneHelp")}</p>
    <div className="zukato-viz__scene-row">
      <label className="zukato-viz__checkbox">
        <input type="checkbox" checked={settings.mode === "wallpapers"}
          onChange={(event) => persist({ mode: event.currentTarget.checked ? "wallpapers" : "original" })} />
        {t("viz.wallpapersEnabled")}
      </label>
      <label>{t("viz.sceneScope")}
        <select value={scope} onChange={(event) => setScope(event.currentTarget.value)}>
          <option value="default">{t("viz.default")}</option>
          <option value="track" disabled={!trackUri}>{t("viz.forTrack")}</option>
        </select>
      </label>
    </div>
    <div className="zukato-viz__scene-row">
      <label className="zukato-viz__upload">{t("viz.sceneImportFile")}
        <input type="file" accept=".html,.htm,.mp4,.webm,.ogv" disabled={busy}
          onChange={(event) => onImport(event, false)} />
      </label>
      <label className="zukato-viz__upload">{t("viz.sceneImportFolder")}
        <input type="file" disabled={busy} multiple ref={(element) => {
          // HTMLInputElement hat je nach TypeScript-DOM-Version keine Property
          // 'webkitdirectory'. Das echte Chromium-Attribut ist dennoch stabil.
          if (element) element.setAttribute("webkitdirectory", "");
        }} onChange={(event) => onImport(event, true)} />
      </label>
    </div>
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
    {previewId && <ScenePreview id={previewId} onError={onError} />}
    <p className="zukato-viz__hint">{t("viz.sceneUsage", { count: String(scenes.length), size: totalMiB })}</p>
    {missingCount > 0 && <p role="alert" className="zukato-error">{t("viz.libraryMissing", { count: String(missingCount) })}</p>}
    <h4>{t("viz.scenePlaylist")} ({playlist.length})</h4>
    {playlist.length ? <ol className="zukato-viz__scene-list">{playlist.map((id, index) => <li key={id}>
      <span>{scenes.find((scene) => scene.id === id)?.name ?? t("viz.sceneMissing")}</span>
      <button type="button" title={t("viz.sceneUp")} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
      <button type="button" title={t("viz.sceneDown")} disabled={index === playlist.length - 1} onClick={() => move(index, 1)}>↓</button>
      <button type="button" title={t("viz.sceneRemove")} onClick={() => changePlaylist(playlist.filter((entry) => entry !== id))}>×</button>
    </li>)}</ol> : <p className="zukato-viz__hint">{t("viz.sceneEmpty")}</p>}
    <label>{t("viz.sceneOriginalUrl")}
      <input type="url" value={urlDraft} placeholder="https://example.org/clip.webm"
        onChange={(event) => setUrlDraft(event.currentTarget.value)} />
    </label>
    <div className="zukato-viz__scene-row">
      <label>{t("viz.sceneClipStart")}<input type="number" min={0} max={14400} step="0.1"
        value={rangeStart} onChange={(event) => setRangeStart(event.currentTarget.value)} /></label>
      <label>{t("viz.sceneClipEnd")}<input type="number" min={0} max={14400} step="0.1"
        placeholder={t("viz.sceneClipFull")} value={rangeEnd} onChange={(event) => setRangeEnd(event.currentTarget.value)} /></label>
    </div>
    <button type="button" onClick={saveOriginal}>{t("viz.sceneSaveUrl")}</button>
    <label className="zukato-viz__upload">{t("viz.manifestUpload")}
      <input type="file" accept=".json,application/json" disabled={busy}
        onChange={(event) => { void onOriginalManifest(event); }} />
    </label>
    <p className="zukato-viz__hint">{t("viz.sceneOnlineHelp")}</p>
  </section>;
}
