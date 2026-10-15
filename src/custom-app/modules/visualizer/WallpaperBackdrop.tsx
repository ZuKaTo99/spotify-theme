// =============================================================================
// Datei: src/custom-app/modules/visualizer/WallpaperBackdrop.tsx
// Zweck: Unterbrechungsfreie, überblendete Videolayer statt harter Songwechsel.
// Wo ändern? Alle Crossfade-, Abspiel- und Blob-URL-Lifecycle-Regeln sind hier.
// Sicherheit: URLs gehören nur diesem Component und werden immer freigegeben.
// =============================================================================
import type { CSSProperties, ReactElement } from "react";
import { DEFAULT_WALLPAPER_KEY, FULL_VIDEO_CLIP, loadWallpaper, type VideoClip } from "./media-store";
import { shouldSyncVideo, syncedVideoTime } from "./video-sync";

const ReactRuntime = Spicetify.React as typeof import("react");

/** Ein Layer kann ein Video oder die animierte CSS-Fallback-Szene enthalten. */
interface Layer {
  id: number;
  key: string;
  filename: string;
  revision: number;
  url: string;
  clip: VideoClip;
}
interface Layers {
  active: Layer | null;
  outgoing: Layer | null;
  revealed: boolean;
}

export interface WallpaperInfo { filename: string; key: string }
interface BackdropProps {
  uri: string;
  revision: number;
  playing: boolean;
  videoSpeed: number;
  videoSync: "free" | "song";
  progressMs: number;
  wallpaperFit: "cover" | "contain";
  transitionMs: number;
  onInfo: (info: WallpaperInfo) => void;
  onError: (message: string) => void;
  onAutoplayBlocked: () => void;
}

/**
 * Behält das alte Video, bis das neue sein erstes Bild geliefert hat. Gleiches
 * Standardvideo wird beim nächsten Spotify-Titel weder neu geladen noch gespult.
 * Bei einem Decoderfehler bleibt die bisherige Szene erhalten.
 */
export function WallpaperBackdrop(props: BackdropProps): ReactElement {
  const [layers, setLayers] = ReactRuntime.useState<Layers>({ active: null, outgoing: null, revealed: true });
  const currentRef = ReactRuntime.useRef(layers);
  const urlsRef = ReactRuntime.useRef(new Set<string>());
  const serialRef = ReactRuntime.useRef(0);
  const playbackRoot = ReactRuntime.useRef<HTMLDivElement>(null);
  const callbacks = ReactRuntime.useRef(props);
  callbacks.current = props;
  currentRef.current = layers;

  // Songwechsel können beim Laden einer großen Datei eintreffen. Nur die
  // jüngste Antwort ist dann noch gültig; ältere erzeugen keine Object-URL.
  ReactRuntime.useEffect(() => {
    let cancelled = false;
    void loadWallpaper(props.uri || DEFAULT_WALLPAPER_KEY).then((wallpaper) => {
      if (cancelled) return;
      const key = wallpaper?.key ?? "fallback";
      callbacks.current.onInfo({ filename: wallpaper?.filename ?? "", key: wallpaper?.key ?? "" });
      const previous = currentRef.current;
      // Der Default-Hintergrund wird bei Songwechseln nicht neu gestartet.
      if (previous.active?.key === key && previous.active.revision === props.revision) return;
      const url = wallpaper ? URL.createObjectURL(wallpaper.blob) : "";
      if (url) urlsRef.current.add(url);
      const incoming: Layer = { id: ++serialRef.current, key, filename: wallpaper?.filename ?? "", revision: props.revision, url, clip: wallpaper?.clip ?? { ...FULL_VIDEO_CLIP } };
      setLayers((state) => ({
        active: incoming,
        outgoing: state.revealed ? state.active : (state.outgoing ?? state.active),
        // Der CSS-Fallback hat keine Ladezeit; Videos warten auf loadeddata.
        revealed: !url,
      }));
    }).catch((cause: unknown) => {
      if (!cancelled) callbacks.current.onError(String(cause));
    });
    return () => { cancelled = true; };
  }, [props.uri, props.revision]);

  // Beim Abschluss einer Überblendung alten Layer mitsamt Object-URL entfernen.
  ReactRuntime.useEffect(() => {
    if (!layers.revealed || !layers.outgoing) return;
    const activeId = layers.active?.id;
    const timer = window.setTimeout(() => {
      setLayers((state) => state.revealed && state.active?.id === activeId
        ? { ...state, outgoing: null } : state);
    }, props.transitionMs + 70);
    return () => window.clearTimeout(timer);
  }, [layers.active?.id, layers.revealed, layers.outgoing?.id, props.transitionMs]);

  // Object-URLs erst freigeben, wenn wirklich kein Layer mehr darauf verweist.
  ReactRuntime.useEffect(() => {
    const stillUsed = new Set([layers.active?.url, layers.outgoing?.url]);
    for (const url of urlsRef.current) {
      if (!stillUsed.has(url)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(url);
      }
    }
  }, [layers.active?.url, layers.outgoing?.url]);
  ReactRuntime.useEffect(() => () => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current.clear();
  }, []);

  // Play/Pause und Video-Tempo auf beide Layer anwenden, damit auch ein
  // ausblendendes Video nicht plötzlich stehenbleibt. Videos bleiben stumm.
  ReactRuntime.useEffect(() => {
    playbackRoot.current?.querySelectorAll("video").forEach((video) => {
      video.playbackRate = props.videoSpeed;
      if (!props.playing) video.pause();
      else if (video.paused) void video.play().catch(() => callbacks.current.onAutoplayBlocked());
    });
  }, [layers.active?.id, layers.outgoing?.id, layers.revealed, props.playing, props.videoSpeed]);

  // Ein Seek im Spotify-Player bewegt nur das aktuelle Szenenvideo; ein
  // ausblendender Layer wird NICHT noch einmal unnötig gespult.
  // Die 800-ms-Schwelle vermeidet Suchoperationen bei normalem Video-Frame-Jitter.
  ReactRuntime.useEffect(() => {
    if (props.videoSync !== "song" || !props.playing && props.progressMs <= 0) return;
    const activeId = layers.active?.id;
    if (!activeId || !layers.active?.url) return;
    const currentVideo = Array.from(playbackRoot.current?.querySelectorAll("video") ?? [])
      .find((item) => item.dataset.layerId === String(activeId));
    if (!currentVideo || currentVideo.seeking || currentVideo.readyState < 1) return;
    const expected = syncedVideoTime(layers.active.clip, currentVideo.duration, props.progressMs, props.videoSpeed);
    // Kurz vor einem Clip-Ende darf der Browser bereits auf den Anfang
    // zurückkehren. Sonst würde diese Effect-Schleife ihn sofort wieder ans
    // Ende spulen und im Grenzbereich zwischen zwei Frames oszillieren.
    const end = layers.active.clip.end === null ? currentVideo.duration
      : Math.min(layers.active.clip.end, currentVideo.duration);
    const start = boundedStart(layers.active, currentVideo);
    const isWrapping = expected !== null && expected >= end - 0.3 &&
      currentVideo.currentTime <= start + 0.5;
    if (!isWrapping && shouldSyncVideo(currentVideo.currentTime, expected)) {
      try { currentVideo.currentTime = expected!; } catch { /* Decoder kann gerade schließen. */ }
    }
  }, [props.progressMs, props.videoSync, props.videoSpeed, props.playing, layers.active?.id, layers.revealed]);

  /** Ein Decoderfehler der neuen Datei verwirft nur den defekten Layer. */
  function failed(layer: Layer): void {
    if (currentRef.current.active?.id !== layer.id) return;
    const previous = currentRef.current.outgoing;
    callbacks.current.onInfo({ filename: previous?.filename ?? "", key: previous?.key === "fallback" ? "" : previous?.key ?? "" });
    callbacks.current.onError("VIDEO_UNSUPPORTED");
    setLayers((state) => state.active?.id === layer.id ? {
      active: state.outgoing ?? { id: ++serialRef.current, key: "fallback", filename: "", revision: props.revision, url: "", clip: { ...FULL_VIDEO_CLIP } },
      outgoing: null, revealed: true,
    } : state);
  }

  /** Empfang des ersten Videoframes gibt den Crossfade frei. */
  function ready(layer: Layer): void {
    setLayers((state) => state.active?.id === layer.id && !state.revealed
      ? { ...state, revealed: true } : state);
  }

  /**
   * Clip-Anfang nach dem Laden der Metadaten anspringen. `currentTime` wird
   * browserseitig gesucht, die Datei aber NICHT zugeschnitten oder neu kodiert.
   * Die Sichtbarkeit des neuen Layers folgt erst nach einem gültigen Frame.
   */
  function boundedStart(layer: Layer, video: HTMLVideoElement): number {
    return Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(layer.clip.start, Math.max(0, video.duration - 0.1)) : 0;
  }

  function initializeClip(layer: Layer, video: HTMLVideoElement): void {
    const start = boundedStart(layer, video);
    const initial = callbacks.current.videoSync === "song"
      ? syncedVideoTime(layer.clip, video.duration, callbacks.current.progressMs, callbacks.current.videoSpeed)
      : null;
    const target = initial ?? start;
    if (Math.abs(video.currentTime - target) > 0.05) video.currentTime = target;
  }

  /**
   * Browser-`loop` kann nur die ganze Datei wiederholen. Bei eigenen Grenzen
   * überwachen wir `timeupdate`, bei Videos bis zum Dateiende auch `ended`.
   */
  function advanceClip(layer: Layer, video: HTMLVideoElement): void {
    const end = layer.clip.end;
    const start = boundedStart(layer, video);
    const targetEnd = end === null ? null : Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(end, video.duration) : end;
    // Keine Seek-Stürme bei defekten Video-Metadaten oder laufender Seek-Operation.
    if (!video.seeking && targetEnd !== null && targetEnd > start + 0.2 && video.currentTime >= targetEnd - 0.04) {
      // Bei Song-Sync verwendet der Effekt die Playerzeit, aber der Clip muss
      // unmittelbar an seiner Grenze bleiben statt bis zum Dateiende zu laufen.
      const desired = callbacks.current.videoSync === "song"
        ? syncedVideoTime(layer.clip, video.duration, callbacks.current.progressMs, callbacks.current.videoSpeed)
        : null;
      video.currentTime = desired !== null && desired < targetEnd - 0.3 ? desired : start;
    }
  }

  function endedClip(layer: Layer, video: HTMLVideoElement): void {
    video.currentTime = callbacks.current.videoSync === "song"
      ? syncedVideoTime(layer.clip, video.duration, callbacks.current.progressMs, callbacks.current.videoSpeed) ?? boundedStart(layer, video)
      : boundedStart(layer, video);
    if (callbacks.current.playing) void video.play().catch(() => callbacks.current.onAutoplayBlocked());
  }

  /** Opacity statt DOM-Tausch; CSS respektiert prefers-reduced-motion. */
  function renderLayer(layer: Layer | null, visible: boolean, kind: string): ReactElement | null {
    if (!layer) return null;
    const style = {
      opacity: visible ? 1 : 0,
      transitionDuration: `${props.transitionMs}ms`,
      objectFit: props.wallpaperFit,
    } as CSSProperties;
    return layer.url
      ? <video key={layer.id} className={`zukato-viz__video zukato-viz__layer--${kind}`}
        src={layer.url} style={style} data-layer-id={layer.id} muted
        loop={layer.clip.start === 0 && layer.clip.end === null} playsInline preload="auto" aria-hidden="true"
        onLoadedMetadata={(event) => initializeClip(layer, event.currentTarget)}
        onLoadedData={(event) => {
          // Erst nach dem Seek auf den gewählten Anfang einblenden.
          if (!event.currentTarget.seeking && event.currentTarget.currentTime >= boundedStart(layer, event.currentTarget) - 0.05) ready(layer);
        }}
        onSeeked={(event) => {
          if (!event.currentTarget.seeking && event.currentTarget.currentTime >= boundedStart(layer, event.currentTarget) - 0.05) ready(layer);
        }}
        onTimeUpdate={(event) => advanceClip(layer, event.currentTarget)}
        onEnded={(event) => endedClip(layer, event.currentTarget)}
        onError={() => failed(layer)} />
      : <div key={layer.id} className="zukato-viz__fallback" style={style} aria-hidden="true" />;
  }

  return <div className="zukato-viz__backdrop" ref={playbackRoot} aria-hidden="true">
    {renderLayer(layers.outgoing, !layers.revealed, "outgoing")}
    {renderLayer(layers.active, layers.revealed, "active")}
    {!layers.active && <div className="zukato-viz__fallback" />}
  </div>;
}
