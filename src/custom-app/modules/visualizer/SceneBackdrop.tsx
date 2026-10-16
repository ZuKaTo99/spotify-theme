// =============================================================================
// Datei: SceneBackdrop.tsx
// Zweck: Diashow-HTML, eigene Videos und direkte Onlineclips als Szenenlayer.
// Wo ändern? Sandbox/URL-Lifecycle und Wiedergabe/Pause hier.
// Eigenes HTML ist NIEMALS ein React-Fragment im Spotify-Hauptdokument:
// sandbox="allow-scripts" OHNE allow-same-origin, mit expliziter CSP.
// =============================================================================
import type { CSSProperties, ReactElement } from "react";
import { loadScene, loadSceneProject } from "./scene-store";
import { renderWallpaperProject, sceneFramePayload, type WallpaperRuntimeAsset, type WallpaperRuntimeModule } from "./wallpaper-project";
import type { OriginalRange } from "../../../shared/scene-playlists";
import { ensureWallpaperCsp } from "./web-wallpaper";
import { WallpaperFrameGate } from "./wallpaper-frame-gate";

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
  runtime?: { html: string; entry: string; assets: WallpaperRuntimeAsset[]; modules: WallpaperRuntimeModule[] };
}

/** Bei jedem Wechsel alte Object-URL sauber freigeben und Lade-Rennen meiden. */
export function SceneBackdrop({ choice, songRun, playing, fit, speed, progressMs, durationMs, onError }: Props): ReactElement {
  const [content, setContent] = ReactRuntime.useState<Content | null>(null);
  const frameRef = ReactRuntime.useRef<HTMLIFrameElement>(null);
  const videoRef = ReactRuntime.useRef<HTMLVideoElement>(null);
  // Ein iframe kann ohne Songwechsel neu laden. Der Gate erkennt neue
  // Dokumente, verhindert aber doppelte 256-MiB-Transfers bei document.write().
  const frameGate = ReactRuntime.useRef(new WallpaperFrameGate());
  const contentRef = ReactRuntime.useRef<Content | null>(content);
  contentRef.current = content;
  const callback = ReactRuntime.useRef(onError);
  callback.current = onError;
  // Auch Fehler innerhalb der isolierten HTML-Sandbox sichtbar machen. Das
  // Wallpaper darf keine Spotify-Daten lesen; nur ein neutraler Status geht
  // in Gegenrichtung an die React-Oberfläche.
  ReactRuntime.useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.zukatoProjectReady === true) {
        const current = contentRef.current;
        const frame = frameRef.current?.contentWindow;
        if (!current?.runtime || !frame || !frameGate.current.onReady(current.key, event.data.documentId)) return;
        try {
          frame.postMessage({ zukatoProjectInit: true, ...current.runtime }, "*");
        } catch {
          frameGate.current.failed(current.key);
          callback.current("HTML-Wallpaper-Dateien konnten nicht erneut übertragen werden.");
        }
        return;
      }
      if (event.data?.zukatoProjectError === true) {
        // Fehlertypen statt lokaler Dateipfade melden: Keine privaten Inhalte
        // aus einem Wallpaper an andere Module oder Diagnoseberichte geben.
        const errors: Record<string, string> = {
          PROJECT_ASSET_MISSING: "Eine dynamisch geladene Wallpaper-Datei fehlt.",
          PROJECT_RESOURCE_ERROR: "Ein Wallpaper-Bild oder anderes Asset konnte nicht geladen werden.",
          PROJECT_SCRIPT_ERROR: "Eine JavaScript-Animation des Wallpapers ist fehlgeschlagen.",
          PROJECT_INITIALIZATION_FAILED: "HTML-Wallpaper konnte in der Sandbox nicht gestartet werden.",
          PROJECT_MODULE_ERROR: "Ein JavaScript-Modul des Wallpapers konnte nicht geladen werden.",
        };
        callback.current(errors[event.data?.code] ?? "HTML-Wallpaper meldet einen Laufzeitfehler.");
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
            // WICHTIG: Große Projekte benötigen zunächst die isolierte
            // Bootstrap-Seite. Sie empfängt Blobs per postMessage und erzeugt
            // die Objekt-URLs IN der Sandbox. Direktes srcDoc=rendered.html
            // würde die Asset-Platzhalter niemals auflösen.
            const frame = sceneFramePayload(rendered);
            srcDoc = frame.srcDoc;
            runtime = frame.runtime;
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
        if (content.runtime) {
          if (frameGate.current.onLoad(content.key)) {
            try { frame.postMessage({ zukatoProjectInit: true, ...content.runtime }, "*"); }
            catch {
              frameGate.current.failed(content.key);
              callback.current("HTML-Wallpaper-Dateien konnten nicht an die Sandbox übertragen werden.");
            }
          }
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
