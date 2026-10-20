// =============================================================================
// Datei: SpotifyCanvasBackdrop.tsx
// Zweck: Die im Spotify-Client schon sichtbare Canvas-URL in ZuKaTo darstellen.
// Keine Netzwerk-Suche, kein Scraping fremder Seiten, kein Kopieren von Tokens.
//
// WICHTIG: Ein HTML5-Canvas kann von Spotify als geschützte Videopipeline
// ausgegeben werden. Ist die Quelle nicht les-/abspielbar, bleibt das
// ALBUMCOVER sichtbar; die Bühne wird nicht schwarz.
// Wo ändern? DOM-Adapter in spotify-canvas.ts, Video-Lifecycle hier.
// =============================================================================
import type { ReactElement } from "react";
import { inspectNativeCanvas, type CanvasLookup } from "./spotify-canvas";
import { syncCanvasVideoPlayback } from "./canvas-playback";

const ReactRuntime = Spicetify.React as typeof import("react");

export type CanvasAvailability = "searching" | "available" | "unavailable" | "unsupported";
export type CanvasDiagnostic = CanvasLookup["kind"] | "unsupported";

export function SpotifyCanvasBackdrop({ title, artist, trackUri, playing, artwork, fit, retryToken = 0, onAvailability, onDiagnostic }: {
  title: string;
  artist: string;
  trackUri: string;
  playing: boolean;
  artwork: string | null;
  fit: "cover" | "contain";
  retryToken?: number;
  onAvailability: (state: CanvasAvailability) => void;
  onDiagnostic?: (state: CanvasDiagnostic) => void;
}): ReactElement {
  // Den Canvas-Link an seine Song-URI binden. Sonst würde beim schnellen
  // Trackwechsel für einen Render-Takt noch das vorherige Video erscheinen.
  const [sourceState, setSourceState] = ReactRuntime.useState<{ trackUri: string; src: string } | null>(null);
  const src = sourceState?.trackUri === trackUri ? sourceState.src : "";
  // Bereitschaft ist an die konkrete Video-URL gebunden: beim schnellen
  // Song-/Canvas-Wechsel darf ein altes onCanPlay die neue Quelle nicht zeigen.
  const [readySource, setReadySource] = ReactRuntime.useState("");
  const videoRef = ReactRuntime.useRef<HTMLVideoElement>(null);
  const callback = ReactRuntime.useRef(onAvailability);
  const diagnosticCallback = ReactRuntime.useRef(onDiagnostic);
  callback.current = onAvailability;
  diagnosticCallback.current = onDiagnostic;
  const lastSource = ReactRuntime.useRef("");
  // Playback-Callbacks aus Media-Events müssen den AKTUELLEN Pausenstand
  // sehen. Sonst startet ein verzögertes onCanPlay das Video nach Pause neu.
  const playingRef = ReactRuntime.useRef(playing);
  playingRef.current = playing;

  /** Eine Quelle nur nach tatsächlich verfügbaren Mediendaten abspielen. */
  const synchronizeVideo = ReactRuntime.useCallback((video: HTMLVideoElement): void => {
    syncCanvasVideoPlayback(video, playingRef.current, () => {
      // play() kann erst nach einem Songwechsel scheitern. Veraltete Promises
      // dürfen weder den Poster der neuen Quelle ausblenden noch die
      // Diagnose des aktuellen Songs auf "unsupported" zurücksetzen.
      if (video !== videoRef.current || !playingRef.current) return;
      setReadySource("");
      callback.current("unsupported");
      diagnosticCallback.current?.("unsupported");
    });
  }, []);

  ReactRuntime.useEffect(() => {
    let stopped = false;
    setSourceState(null);
    setReadySource("");
    lastSource.current = "";
    callback.current("searching");
    const update = (): void => {
      // Spotify-Sidebar nicht dauernd inspizieren, solange die Webview
      // versteckt ist. Eine Sichtbarkeitsaenderung triggert sofort neu.
      if (stopped || document.hidden) return;
      const result = inspectNativeCanvas(document, title, artist);
      diagnosticCallback.current?.(result.kind);
      const nextSource = result.kind === "ready" ? result.source.src : "";
      if (!nextSource) callback.current("unavailable");
      if (lastSource.current !== nextSource) {
        lastSource.current = nextSource;
        setReadySource("");
        setSourceState(nextSource ? { trackUri, src: nextSource } : null);
        if (nextSource) callback.current("searching");
      }
    };
    update();
    // Spotify erstellt den rechten Player beim Songwechsel häufig neu. Reagiere
    // direkt auf DOM-Änderungen, statt bis zum nächsten Poll zu warten. Nur
    // die eigentliche Seitenleiste beobachten: ZuKaTos eigene Video-Renders
    // dürfen keine rekursiven Beobachter-Updates auslösen.
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      if (stopped || document.hidden || scheduled !== undefined) return;
      scheduled = setTimeout(() => { scheduled = undefined; update(); }, 120);
    };
    const observer = typeof MutationObserver !== "undefined"
      ? new MutationObserver(schedule) : null;
    // Schwache Referenzen: Ersetzte Spotify-Sidebars dürfen nicht von dieser
    // eigenen Merkliste bis zum Schließen des Visualizers gehalten werden.
    const observed = new WeakSet<Element>();
    const connectRegions = (): void => {
      const regions = document.querySelectorAll(
        '[data-testid="now-playing-view"], [data-testid="right-sidebar"], ' +
        '[data-testid="now-playing-widget"], [class*="nowPlayingView"], [class*="NowPlayingView"]',
      );
      for (const region of regions) {
        if (region.closest(".zukato-app") || observed.has(region)) continue;
        observer?.observe(region, { subtree: true, childList: true, attributes: true,
          attributeFilter: ["src", "data-testid", "class"] });
        observed.add(region);
      }
    };
    connectRegions();
    // Spotify kann die Sidebar komplett ersetzen. Beim Poll neue Container
    // ergänzen und auch bei Clients ohne MutationObserver weiter reagieren.
    const poller = window.setInterval(() => {
      if (document.hidden) return;
      connectRegions();
      update();
    }, 2500);
    const onVisibility = (): void => {
      if (document.hidden) {
        if (scheduled !== undefined) clearTimeout(scheduled);
        scheduled = undefined;
        return;
      }
      connectRegions();
      update();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      if (scheduled !== undefined) clearTimeout(scheduled);
      window.clearInterval(poller);
    };
  }, [title, artist, trackUri, retryToken]);

  ReactRuntime.useEffect(() => {
    const video = videoRef.current;
    if (video) synchronizeVideo(video);
  }, [src, playing, synchronizeVideo]);

  return <div className="zukato-viz__backdrop zukato-viz__native-canvas" aria-hidden="true">
    {artwork && <img className="zukato-viz__native-poster" src={artwork} alt="" />}
    {src && <video key={src} ref={videoRef} className="zukato-viz__video"
      style={{ objectFit: fit, visibility: readySource === src ? "visible" : "hidden" }}
      src={src} muted playsInline loop preload="metadata"
      onCanPlay={(event) => {
        if (event.currentTarget !== videoRef.current) return;
        setReadySource(src);
        callback.current("available");
        // Die anfängliche useEffect-Ausführung findet häufig vor dem Laden
        // der Videodaten statt. Erst das echte canplay startet die Wiedergabe.
        synchronizeVideo(event.currentTarget);
      }}
      onError={(event) => {
        if (event.currentTarget !== videoRef.current) return;
        setReadySource(""); callback.current("unsupported");
        diagnosticCallback.current?.("unsupported");
      }} />}
    {!src && !artwork && <div className="zukato-viz__native-neutral" />}
  </div>;
}
