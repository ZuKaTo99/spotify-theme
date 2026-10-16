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
  const [src, setSrc] = ReactRuntime.useState("");
  const [ready, setReady] = ReactRuntime.useState(false);
  const videoRef = ReactRuntime.useRef<HTMLVideoElement>(null);
  const callback = ReactRuntime.useRef(onAvailability);
  const diagnosticCallback = ReactRuntime.useRef(onDiagnostic);
  callback.current = onAvailability;
  diagnosticCallback.current = onDiagnostic;
  const lastSource = ReactRuntime.useRef("");

  ReactRuntime.useEffect(() => {
    let stopped = false;
    setSrc("");
    setReady(false);
    lastSource.current = "";
    callback.current("searching");
    const update = (): void => {
      if (stopped) return;
      const result = inspectNativeCanvas(document, title, artist);
      diagnosticCallback.current?.(result.kind);
      const nextSource = result.kind === "ready" ? result.source.src : "";
      if (!nextSource) callback.current("unavailable");
      if (lastSource.current !== nextSource) {
        lastSource.current = nextSource;
        setReady(false);
        setSrc(nextSource);
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
      if (scheduled !== undefined) return;
      scheduled = setTimeout(() => { scheduled = undefined; update(); }, 120);
    };
    const observer = typeof MutationObserver !== "undefined"
      ? new MutationObserver(schedule) : null;
    const observed = new Set<Element>();
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
    const poller = window.setInterval(() => { connectRegions(); update(); }, 2500);
    return () => {
      stopped = true;
      observer?.disconnect();
      if (scheduled !== undefined) clearTimeout(scheduled);
      window.clearInterval(poller);
    };
  }, [title, artist, trackUri, retryToken]);

  ReactRuntime.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!playing) video.pause();
    else void video.play().catch(() => {
      setReady(false);
      callback.current("unsupported");
      diagnosticCallback.current?.("unsupported");
    });
  }, [src, playing]);

  return <div className="zukato-viz__backdrop zukato-viz__native-canvas" aria-hidden="true">
    {artwork && <img className="zukato-viz__native-poster" src={artwork} alt="" />}
    {src && <video key={src} ref={videoRef} className="zukato-viz__video"
      style={{ objectFit: fit, visibility: ready ? "visible" : "hidden" }}
      src={src} autoPlay muted playsInline loop preload="metadata"
      onCanPlay={() => { setReady(true); callback.current("available"); }}
      onError={() => { setReady(false); callback.current("unsupported"); diagnosticCallback.current?.("unsupported"); }} />}
    {!src && !artwork && <div className="zukato-viz__native-neutral" />}
  </div>;
}
