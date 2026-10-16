// =============================================================================
// Datei: SceneBackdrop.tsx
// Zweck: Diashow-HTML, eigene Videos und direkte Onlineclips als Szenenlayer.
// Wo ändern? Sandbox/URL-Lifecycle und Wiedergabe/Pause hier.
// Eigenes HTML ist NIEMALS ein React-Fragment im Spotify-Hauptdokument:
// sandbox="allow-scripts" OHNE allow-same-origin, mit expliziter CSP.
// =============================================================================
import type { CSSProperties, ReactElement } from "react";
import { loadScene, loadSceneProject } from "./scene-store";
import { renderWallpaperProject, type WallpaperRuntimeAsset } from "./wallpaper-project";
import type { OriginalRange } from "../../../shared/scene-playlists";
import { ensureWallpaperCsp } from "./web-wallpaper";

const ReactRuntime = Spicetify.React as typeof import("react");
export type ChosenScene = { kind: "scene"; id: string } | { kind: "original"; url: string; range: OriginalRange } | { kind: "legacy" };

interface Props {
  choice: Exclude<ChosenScene, { kind: "legacy" }>;
  /** Neuer Song inklusive Repeat derselben URI -> dieselbe HTML-Animation neu beginnen. */
  songRun: number;
  playing: boolean;
  fit: "cover" | "contain";
  speed: number;
  /** Aktueller Zeitwert für die selbst programmierte HTML-Szenensteuerung. */
  progressMs: number;
  durationMs: number;
  onError: (message: string) => void;
}
interface Content {
  key: string;
  kind: "html" | "video";
  url: string;
  srcDoc: string;
  /** Nur project-v2: Sandbox-Bootstrap und dort lokal erzeugte Blob-URLs. */
  runtime?: { html: string; assets: WallpaperRuntimeAsset[] };
}

/** Bei jedem Wechsel alte Object-URL sauber freigeben und Lade-Rennen meiden. */
export function SceneBackdrop({ choice, songRun, playing, fit, speed, progressMs, durationMs, onError }: Props): ReactElement {
  const [content, setContent] = ReactRuntime.useState<Content | null>(null);
  const frameRef = ReactRuntime.useRef<HTMLIFrameElement>(null);
  const videoRef = ReactRuntime.useRef<HTMLVideoElement>(null);
  const initializedFrame = ReactRuntime.useRef("");
  const callback = ReactRuntime.useRef(onError);
  callback.current = onError;
  // Auch Fehler innerhalb der isolierten HTML-Sandbox sichtbar machen. Das
  // Wallpaper darf keine Spotify-Daten lesen; nur ein neutraler Status geht
  // in Gegenrichtung an die React-Oberfläche.
  ReactRuntime.useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (event.source === frameRef.current?.contentWindow &&
          event.data?.zukatoProjectError === true) {
        callback.current("HTML-Wallpaper konnte in der Sandbox nicht geladen werden.");
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  // Wichtig: Ein Trackwechsel beginnt auch bei gleichem Wallpaper/URL eine
  // neue Wiedergabe. Bei Pause/Seek bleibt der Schlüssel unverändert.
  const key = `${songRun}:${choice.kind === "scene" ? choice.id : choice.url}`;
  const range = choice.kind === "original" ? choice.range : { start: 0, end: null };

  ReactRuntime.useEffect(() => {
    let cancelled = false;
    let createdUrl = "";
    let disposeProject: (() => void) | undefined;
    setContent(null);
    if (choice.kind === "original") {
      setContent({ key, kind: "video", url: choice.url, srcDoc: "" });
    } else {
      void loadScene(choice.id).then(async (scene) => {
        if (cancelled) return;
        if (!scene) { callback.current("Wallpaper-Szene wurde nicht gefunden."); return; }
        let srcDoc = "";
        let runtime: Content["runtime"];
        if (scene.kind === "html") {
          if (scene.format === "project-v2") {
            const project = await loadSceneProject(scene.id);
            if (!project) throw new Error("HTML-Projektdateien wurden nicht gefunden.");
            const rendered = await renderWallpaperProject(project);
            disposeProject = rendered.dispose;
            srcDoc = rendered.html;
          } else {
            srcDoc = ensureWallpaperCsp(await scene.blob.text());
          }
        }
        if (cancelled) { disposeProject?.(); return; }
        const url = scene.kind === "video" ? URL.createObjectURL(scene.blob) : "";
        createdUrl = url;
        setContent({ key, kind: scene.kind, url, srcDoc, runtime });
      }).catch((cause: unknown) => { if (!cancelled) callback.current(String(cause)); });
    }
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      disposeProject?.();
    };
  }, [key]);

  // Audiolose Videos folgen der Spotify-Pause. Eigene HTML-Wallpapers erhalten
  // bewusst nur ein opt-in-Pause-Signal, da JS-Schleifen nicht erzwingbar sind.
  ReactRuntime.useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
      if (!playing) video.pause();
      else void video.play().catch(() => callback.current("Videowiedergabe durch Browser blockiert."));
    }
  }, [content?.key, content?.kind, playing, speed]);

  // An selbst erstellte HTML-Wallpapers ausschließlich nichtprivate Playerwerte
  // übermitteln. Sie erhalten weder direkten Spotify-API-Zugriff noch Zugriff
  // auf Einstellungen/Dateien. Der Sandbox-Origin ist absichtlich opaque.
  // HTML-Projekte können zukato:player für CSS/Canvas-Animationen nutzen.
  ReactRuntime.useEffect(() => {
    if (content?.kind !== "html") return;
    frameRef.current?.contentWindow?.postMessage({
      zukatoWallpaper: true, playing, run: songRun,
      positionMs: Math.max(0, progressMs), durationMs: Math.max(0, durationMs),
    }, "*");
  }, [content?.key, content?.kind, playing, songRun, progressMs, durationMs]);

  const style = { objectFit: fit } as CSSProperties;
  return <div className="zukato-viz__backdrop zukato-viz__scene-backdrop" aria-hidden="true">
    {content?.kind === "html" && <iframe key={content.key} ref={frameRef}
      className="zukato-viz__web-frame" title="Isoliertes HTML-Wallpaper"
      sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={content.srcDoc}
      onLoad={() => {
        const frame = frameRef.current?.contentWindow;
        if (!frame) return;
        // Die Sandbox löst nach document.write() ein zweites load aus.
        // Assets daher nur EINMAL übertragen; sonst würden 100+ Blobs erneut
        // initialisiert. Danach lediglich den aktuellen Playerstand senden.
        if (content.runtime && initializedFrame.current !== content.key) {
          initializedFrame.current = content.key;
          try { frame.postMessage({
            zukatoProjectInit: true, html: content.runtime.html, assets: content.runtime.assets,
          }, "*"); } catch { callback.current("HTML-Wallpaper-Dateien konnten nicht an die Sandbox übertragen werden."); }
        } else {
          frame.postMessage({
            zukatoWallpaper: true, playing, run: songRun,
            positionMs: Math.max(0, progressMs), durationMs: Math.max(0, durationMs),
          }, "*");
        }
      }} />}
    {content?.kind === "video" && <video key={content.key} ref={videoRef}
      className="zukato-viz__video" src={content.url} style={style}
      muted playsInline loop={range.start === 0 && range.end === null} autoPlay preload="auto"
      onLoadedMetadata={(event) => {
        if (range.start > 0 && Number.isFinite(event.currentTarget.duration) &&
          event.currentTarget.duration > range.start) event.currentTarget.currentTime = range.start;
      }}
      onTimeUpdate={(event) => {
        const player = event.currentTarget;
        if (range.end !== null && !player.seeking && player.currentTime >= range.end - 0.04) {
          player.currentTime = range.start;
        }
      }}
      onEnded={(event) => {
        event.currentTarget.currentTime = range.start;
        if (playing) void event.currentTarget.play().catch(() => callback.current("Videowiedergabe blockiert."));
      }}
      onError={() => callback.current("Videoquelle nicht verfügbar oder im Spotify-Client blockiert.")} />}
  </div>;
}
