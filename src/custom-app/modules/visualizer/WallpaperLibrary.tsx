// =============================================================================
// Datei: src/custom-app/modules/visualizer/WallpaperLibrary.tsx
// Zweck: Browser der lokal gespeicherten Videozuordnungen mit Einzelvorschau.
// Wo ändern? Sortierung, Bedienknöpfe und Dateiexport der Bibliothek stehen hier.
// Datenschutz: keine Netzwerkanfrage, ausschließlich lokale IndexedDB/Blob-URLs.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import {
  assignStoredWallpaper, deleteWallpaper, listWallpaperEntries,
  loadExactWallpaper, loadWallpaperThumbnail, saveWallpaperThumbnail, saveWallpaperClip,
  validateVideoClip, MAX_TOTAL_WALLPAPER_BYTES, MAX_WALLPAPERS,
  type WallpaperEntry,
} from "./media-store";

import { createVideoThumbnail } from "./video-thumbnail";

const ReactRuntime = Spicetify.React as typeof import("react");

interface LibraryProps {
  t: Translator;
  trackUri: string;
  revision: number;
  onUpdated: () => void;
  onError: (message: string) => void;
}

/** Dateigrößen statt riesigen Objektlisten rendern. */
function readableBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/**
 * Eine einzige Videovorschau zur Zeit verhindert bis zu zwölf gleichzeitig
 * decodierende Videos. Ihre Object-URL wird beim Auswahlwechsel freigegeben.
 */
export function WallpaperLibrary({ t, trackUri, revision, onUpdated, onError }: LibraryProps): ReactElement {
  const [entries, setEntries] = ReactRuntime.useState<WallpaperEntry[]>([]);
  const [selected, setSelected] = ReactRuntime.useState("");
  const [preview, setPreview] = ReactRuntime.useState("");
  const [thumbnails, setThumbnails] = ReactRuntime.useState<Record<string, string>>({});
  const [busy, setBusy] = ReactRuntime.useState(false);
  const [sort, setSort] = ReactRuntime.useState<"date" | "name" | "size">("date");
  const [clipStart, setClipStart] = ReactRuntime.useState("0");
  const [clipEnd, setClipEnd] = ReactRuntime.useState("");
  const [videoDuration, setVideoDuration] = ReactRuntime.useState<number | null>(null);
  const previewRef = ReactRuntime.useRef<HTMLVideoElement>(null);

  // Nach jedem Import/Löschen bzw. nach einer neuen Zuordnung neu listen.
  ReactRuntime.useEffect(() => {
    let alive = true;
    void listWallpaperEntries().then((list) => { if (alive) setEntries(list); })
      .catch((cause: unknown) => { if (alive) onError(String(cause)); });
    return () => { alive = false; };
  }, [revision]);

  // Die Miniaturbilder sind kleine eigene IndexedDB-Einträge. Keine Videos
  // decodieren, wenn die Galerie geöffnet wird; erzeugte URLs immer freigeben.
  ReactRuntime.useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    setThumbnails({});
    void listWallpaperEntries().then(async (list) => {
      const pairs = await Promise.all(list.map(async (entry): Promise<[string, string]> => {
        const blob = await loadWallpaperThumbnail(entry.scope);
        if (!alive || !blob) return [entry.scope, ""];
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return [entry.scope, url];
      }));
      if (alive) setThumbnails(Object.fromEntries(pairs));
    }).catch((cause: unknown) => { if (alive) onError(String(cause)); });
    return () => { alive = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [revision]);

  // Bei Auswahl oder Speichern werden die nicht-destruktiven Abspielgrenzen
  // geladen. Leeres Ende heißt: bis zum tatsächlichen Dateiende spielen.
  ReactRuntime.useEffect(() => {
    const active = entries.find((entry) => entry.scope === selected);
    setClipStart(String(active?.clip.start ?? 0));
    setClipEnd(active?.clip.end === null || !active ? "" : String(active.clip.end));
    setVideoDuration(null);
  }, [selected, entries]);

  /** Sekunden aus den Eingabefeldern validieren und separat zum Blob speichern. */
  function draftClip() {
    const start = clipStart.trim() === "" ? NaN : Number(clipStart);
    const end = clipEnd.trim() === "" ? null : Number(clipEnd);
    return validateVideoClip(start, end, videoDuration ?? undefined);
  }

  /** Vorschaubild auf den gewünschten Zeitpunkt setzen, ohne die Datei zu ändern. */
  function jumpToStart(): void {
    try {
      const clip = draftClip();
      if (previewRef.current) previewRef.current.currentTime = clip.start;
    } catch (cause) { onError(cause instanceof Error ? cause.message : String(cause)); }
  }

  /** Clip-Bereich im Browser wiederholen (auch in der lokalen Vorschau). */
  function loopPreview(video: HTMLVideoElement): void {
    const start = Number(clipStart);
    const end = clipEnd.trim() === "" ? video.duration : Number(clipEnd);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start + 0.24 && video.currentTime >= end - 0.04) {
      video.currentTime = start;
    }
  }

  // Anstelle von zwölf Objekt-URLs genau eine Vorschau öffnen.
  ReactRuntime.useEffect(() => {
    let alive = true;
    let url = "";
    setPreview("");
    if (selected) void loadExactWallpaper(selected).then((item) => {
      if (!alive || !item) return;
      url = URL.createObjectURL(item.blob);
      setPreview(url);
    }).catch((cause: unknown) => { if (alive) onError(String(cause)); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [selected, revision]);

  /** Aktionen absichern und das Hauptvideo nach erfolgreichem Schreiben erneuern. */
  async function perform(task: () => Promise<void>): Promise<void> {
    setBusy(true);
    try { await task(); onUpdated(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  /** Export nur auf expliziten Nutzerklick und mit dem Originaldateinamen. */
  async function exportFile(scope: string): Promise<void> {
    setBusy(true);
    let url = "";
    try {
      const video = await loadExactWallpaper(scope);
      if (!video) throw new Error(t("viz.libraryGone"));
      url = URL.createObjectURL(video.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = video.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } catch (cause) { onError(cause instanceof Error ? cause.message : String(cause)); }
    finally {
      // Erst nach dem Download-Start freigeben, sonst verliert Chromium die URL.
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setBusy(false);
    }
  }

  const occupied = entries.reduce((total, item) => total + item.bytes, 0);
  const sorted = [...entries].sort((a, b) => sort === "name"
    ? a.filename.localeCompare(b.filename) : sort === "size"
      ? b.bytes - a.bytes : b.savedAt - a.savedAt);

  return <section className="zukato-viz__controls zukato-viz__library">
    <h3>{t("viz.libraryHeading")}</h3>
    <p>{t("viz.libraryUsage", {
      count: String(entries.length), limit: String(MAX_WALLPAPERS),
      used: readableBytes(occupied), total: readableBytes(MAX_TOTAL_WALLPAPER_BYTES),
    })}</p>
    <label>{t("viz.librarySort")}
      <select value={sort} onChange={(event) => setSort(event.currentTarget.value as typeof sort)}>
        <option value="date">{t("viz.sortRecent")}</option>
        <option value="name">{t("viz.sortName")}</option>
        <option value="size">{t("viz.sortSize")}</option>
      </select>
    </label>
    {!sorted.length && <p className="zukato-viz__hint">{t("viz.libraryEmpty")}</p>}
    <div className="zukato-viz__library-list">
      {sorted.map((entry) => <button type="button" key={entry.scope} disabled={busy}
        className={selected === entry.scope ? "is-selected" : ""} onClick={() => setSelected(entry.scope)}>
        {thumbnails[entry.scope] ? <img className="zukato-viz__thumbnail" alt="" src={thumbnails[entry.scope]} />
          : <span className="zukato-viz__thumbnail zukato-viz__thumbnail--empty" aria-hidden="true">▶</span>}
        <strong title={entry.filename}>{entry.filename}</strong>
        <small>{entry.scope === "default" ? t("viz.default") : entry.scope} · {readableBytes(entry.bytes)}</small>
      </button>)}
    </div>
    {preview && <video ref={previewRef} className="zukato-viz__preview" controls muted playsInline preload="metadata"
      src={preview} aria-label={t("viz.libraryPreview")}
      onLoadedMetadata={(event) => {
        const duration = event.currentTarget.duration;
        setVideoDuration(Number.isFinite(duration) && duration > 0 ? duration : null);
        const start = Number(clipStart);
        if (Number.isFinite(start) && start > 0 && start < duration) event.currentTarget.currentTime = start;
      }}
      onTimeUpdate={(event) => loopPreview(event.currentTarget)}
      onEnded={(event) => {
        const start = Number(clipStart);
        // Auch unbeschnittene Videos in der Vorschau endlos abspielen.
        event.currentTarget.currentTime = Number.isFinite(start) && start >= 0 ? start : 0;
        void event.currentTarget.play().catch(() => {});
      }} />}
    {selected && entries.some((entry) => entry.scope === selected) && <div className="zukato-viz__clip-editor">
      <h4>{t("viz.clipHeading")}</h4>
      <p>{t("viz.clipHelp")}</p>
      <div className="zukato-viz__clip-inputs">
        <label>{t("viz.clipStart")}
          <input type="number" inputMode="decimal" min="0" step="0.1" value={clipStart}
            disabled={busy} onChange={(event) => setClipStart(event.currentTarget.value)} />
        </label>
        <label>{t("viz.clipEnd")}
          <input type="number" inputMode="decimal" min="0" step="0.1" value={clipEnd}
            disabled={busy} placeholder={t("viz.clipToEnd")} onChange={(event) => setClipEnd(event.currentTarget.value)} />
        </label>
      </div>
      <small>{videoDuration === null ? t("viz.clipDurationUnknown") :
        t("viz.clipDuration", { seconds: videoDuration.toFixed(1) })}</small>
      <div className="zukato-viz__library-actions">
        <button type="button" disabled={busy || !preview} onClick={jumpToStart}>{t("viz.clipPreview")}</button>
        <button type="button" disabled={busy} onClick={() => void perform(() => saveWallpaperClip(selected, draftClip(), videoDuration ?? undefined))}>{t("viz.clipSave")}</button>
        <button type="button" disabled={busy} onClick={() => void perform(() => saveWallpaperClip(selected, { start: 0, end: null }))}>{t("viz.clipReset")}</button>
      </div>
    </div>}
    {selected && entries.some((entry) => entry.scope === selected) && <div className="zukato-viz__library-actions">
      <button type="button" disabled={busy || selected === "default"} onClick={() => void perform(() => assignStoredWallpaper(selected, "default"))}>{t("viz.makeDefault")}</button>
      <button type="button" disabled={busy || !trackUri || selected === trackUri} onClick={() => void perform(() => assignStoredWallpaper(selected, trackUri))}>{t("viz.useForTrack")}</button>
      {!thumbnails[selected] && <button type="button" disabled={busy} onClick={() => void perform(async () => {
        // Migration alter v1.2-Videos erfolgt erst nach explizitem Klick.
        const video = await loadExactWallpaper(selected);
        if (!video) throw new Error(t("viz.libraryGone"));
        const image = await createVideoThumbnail(video.blob);
        if (!image) throw new Error(t("viz.thumbnailFailed"));
        await saveWallpaperThumbnail(selected, image);
      })}>{t("viz.generateThumbnail")}</button>}
      <button type="button" disabled={busy} onClick={() => void exportFile(selected)}>{t("viz.exportVideo")}</button>
      <button type="button" disabled={busy} onClick={() => {
        if (window.confirm(t("viz.confirmDelete"))) void perform(async () => { await deleteWallpaper(selected); setSelected(""); });
      }}>{t("viz.deleteVideo")}</button>
    </div>}
  </section>;
}
