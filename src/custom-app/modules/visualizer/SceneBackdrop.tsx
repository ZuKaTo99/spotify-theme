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
import { shouldPollWallpaperAudio } from "./audio-performance";
import { wallpaperPlayerPacket, WallpaperAudioGate } from "./wallpaper-host-bridge";
import { currentWallpaper } from "./current-wallpaper";
import { syncCanvasVideoPlayback } from "./canvas-playback";
import { loadWallpaperPrefs, applyWallpaperPrefsOperation, parseWallpaperPrefsOperation, WALLPAPER_PREFS_CHANGED } from "./wallpaper-preferences";

const ReactRuntime = Spicetify.React as typeof import("react");
/** 20 Hz statt 10 Hz: flüssigere Übertragung, ohne pro Animationsframe zu senden. */
export const WALLPAPER_AUDIO_INTERVAL_MS = 50;
export type ChosenScene = { kind: "scene"; id: string } | { kind: "original"; url: string; range: OriginalRange } | { kind: "legacy" };

interface Props {
  choice: Exclude<ChosenScene, { kind: "legacy" }>;
  /** Neuer Song inklusive Repeat derselben URI -> dieselbe HTML-Animation neu beginnen. */
  songRun: number;
  playing: boolean;
  /** Musikmetadaten nur für das jeweilige isolierte Wallpaper. */
  title: string;
  artist: string;
  /** Liefert nur bei aktiver, freigegebener Quelle 64 normierte Werte. */
  getSpectrum: () => number[] | null;
  /** React-State der Freigabe; beendet unnoetiges 20-Hz-Polling bei Stille. */
  audioActive: boolean;
  fit: "cover" | "contain";
  speed: number;
  /** Aktueller Zeitwert für die selbst programmierte HTML-Szenensteuerung. */
  progressMs: number;
  durationMs: number;
  onError: (message: string) => void;
}
interface Content {
  key: string;
  sceneId?: string;
  kind: "html" | "video";
  url: string;
  srcDoc: string;
  /** Nur project-v2: Sandbox-Bootstrap und dort lokal erzeugte Blob-URLs. */
  runtime?: { html: string; entry: string; assets: WallpaperRuntimeAsset[]; modules: WallpaperRuntimeModule[]; storageToken: string };
}

/** Bei jedem Wechsel alte Object-URL sauber freigeben und Lade-Rennen meiden. */
export function SceneBackdrop({ choice, songRun, playing, title, artist, getSpectrum, audioActive, fit, speed, progressMs, durationMs, onError }: Props): ReactElement {
  const [content, setContent] = ReactRuntime.useState<Content | null>(null);
  const frameRef = ReactRuntime.useRef<HTMLIFrameElement>(null);
  const videoRef = ReactRuntime.useRef<HTMLVideoElement>(null);
  // React-Callbacks können erst nach einem späteren "canplay" ausgeführt werden.
  // Dann muss der aktuelle Spotify-Pausenzustand statt des alten Props-Werts gelten.
  const playingRef = ReactRuntime.useRef(playing);
  playingRef.current = playing;
  // Ein iframe kann ohne Songwechsel neu laden. Der Gate erkennt neue
  // Dokumente, verhindert aber doppelte 256-MiB-Transfers bei document.write().
  const frameGate = ReactRuntime.useRef(new WallpaperFrameGate());
  const audioGate = ReactRuntime.useRef(new WallpaperAudioGate());
  // Wenn ein späteres iframe erst nach dem React-Effekt bereit ist, muss der
  // erste Zustand noch einmal zugestellt werden (inklusive Track-Fortschritt).
  const playerPacketRef = ReactRuntime.useRef(wallpaperPlayerPacket(title, artist, playing, songRun, progressMs, durationMs));
  playerPacketRef.current = wallpaperPlayerPacket(title, artist, playing, songRun, progressMs, durationMs);
  // Direkte Schlüsselprüfung schon beim Empfang einer Ready-Nachricht:
  // React hat beim Trackwechsel eventuell noch den vorherigen Frame gemountet.
  const activeKeyRef = ReactRuntime.useRef("");
  const contentRef = ReactRuntime.useRef<Content | null>(content);
  contentRef.current = content;
  const getSpectrumRef = ReactRuntime.useRef(getSpectrum);
  getSpectrumRef.current = getSpectrum;
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
        if (!current?.runtime || current.key !== activeKeyRef.current || !frame ||
            !frameGate.current.onReady(current.key, event.data.documentId)) return;
        try {
          frame.postMessage({ zukatoProjectInit: true, ...current.runtime,
            storage: loadWallpaperPrefs(current.sceneId!),
            sessionStorage: loadWallpaperPrefs(current.sceneId!, "session") }, "*");
        } catch {
          frameGate.current.failed(current.key);
          callback.current("HTML-Wallpaper-Dateien konnten nicht erneut übertragen werden.");
        }
        return;
      }
      if (event.data?.zukatoProjectMounted === true) {
        const current = contentRef.current;
        const frame = frameRef.current?.contentWindow;
        if (!current?.runtime || current.key !== activeKeyRef.current || !frame ||
            event.data.storageToken !== current.runtime.storageToken) return;
        // Die echte HTML-App hat erst JETZT ihre Message-Listener angelegt.
        // Ohne diesen Replay verlor Nebula bei schnellem Trackwechsel Titel,
        // Play/Pause und oftmals den ersten Audiosignal-Status.
        frame.postMessage(playerPacketRef.current, "*");
        audioGate.current.reset();
        const packet = audioGate.current.next(getSpectrumRef.current(), playerPacketRef.current.playing);
        if (packet) frame.postMessage(packet, "*");
        return;
      }
      // Niemals sceneId aus der Sandbox akzeptieren. Der Parent bestimmt die
      // aktive Projekt-ID und kontrolliert den einmaligen Sitzungs-Token.
      const storageAction = parseWallpaperPrefsOperation(event.data);
      if (storageAction) {
        const current = contentRef.current;
        if (!current?.sceneId || !current.runtime || current.key !== activeKeyRef.current ||
            event.data?.storageToken !== current.runtime.storageToken) return;
        if (!applyWallpaperPrefsOperation(current.sceneId, storageAction))
          callback.current("Wallpaper-Einstellungen konnten nicht dauerhaft gespeichert werden (Speicherlimit/Browser).");
        return;
      }
      if (event.data?.zukatoProjectError === true &&
          contentRef.current?.key === activeKeyRef.current) {
        // Fehlertypen statt lokaler Dateipfade melden: Keine privaten Inhalte
        // aus einem Wallpaper an andere Module oder Diagnoseberichte geben.
        const errors: Record<string, string> = {
          PROJECT_ASSET_MISSING: "Eine dynamisch geladene Wallpaper-Datei fehlt.",
          PROJECT_RESOURCE_ERROR: "Ein Wallpaper-Bild oder anderes Asset konnte nicht geladen werden.",
          PROJECT_SCRIPT_ERROR: "Eine JavaScript-Animation des Wallpapers ist fehlgeschlagen.",
          PROJECT_INITIALIZATION_FAILED: "HTML-Wallpaper konnte in der Sandbox nicht gestartet werden.",
          PROJECT_MODULE_ERROR: "Ein JavaScript-Modul des Wallpapers konnte nicht geladen werden.",
          PROJECT_STORAGE_UNAVAILABLE: "Der Browser verhindert die Einstellungen-Speicherung dieses Wallpapers.",
        };
        callback.current(errors[event.data?.code] ?? "HTML-Wallpaper meldet einen Laufzeitfehler.");
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  // Die Vorschau verwendet dieselbe Szenen-ID. Änderungen dort werden beim
  // laufenden Wallpaper aktualisiert und beim nächsten Songstart geladen.
  ReactRuntime.useEffect(() => {
    const sync = (event: Event): void => {
      const sceneId = (event as CustomEvent<{ sceneId: string }>).detail?.sceneId;
      const current = contentRef.current;
      if (!current?.runtime || !current.sceneId || sceneId !== current.sceneId ||
          current.key !== activeKeyRef.current) return;
      frameRef.current?.contentWindow?.postMessage({ zukatoProjectStorageSync: true,
        storageToken: current.runtime.storageToken, storage: loadWallpaperPrefs(sceneId),
        sessionStorage: loadWallpaperPrefs(sceneId, "session") }, "*");
    };
    window.addEventListener(WALLPAPER_PREFS_CHANGED, sync);
    return () => window.removeEventListener(WALLPAPER_PREFS_CHANGED, sync);
  }, []);

  // Wichtig: Ein Trackwechsel beginnt auch bei gleichem Wallpaper/URL eine
  // neue Wiedergabe. Bei Pause/Seek bleibt der Schlüssel unverändert.
  const key = `${songRun}:${choice.kind === "scene" ? choice.id : choice.url}`;
  activeKeyRef.current = key;
  // Noch laufende asynchrone DB-Ladevorgänge dürfen das alte Wallpaper nach
  // einem Songwechsel niemals auch nur für einen Render-Takt anzeigen.
  const visibleContent = currentWallpaper(content, key, "key");
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
            runtime = { ...frame.runtime,
              storageToken: typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID() : `${Date.now()}:${Math.random()}` };
          } else {
            srcDoc = ensureWallpaperCsp(await scene.blob.text());
          }
        }
        if (cancelled) { disposeProject?.(); return; }
        const url = scene.kind === "video" ? URL.createObjectURL(scene.blob) : "";
        createdUrl = url;
        setContent({ key, sceneId: scene.id, kind: scene.kind, url, srcDoc, runtime });
      }).catch((cause: unknown) => { if (!cancelled) callback.current(String(cause)); });
    }
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      disposeProject?.();
    };
  }, [key]);

  // Wie bei Spotify Canvas gilt: Ein Video ist beim ersten React-Effect
  // eventuell noch nicht decodiert. Früheres sofortiges play() konnte einen
  // Browserfehler verursachen und wurde danach NIE erneut versucht. Deshalb
  // wartet die Wiedergabe auf echte Mediendaten und startet bei "canplay".
  const synchronizeSceneVideo = ReactRuntime.useCallback((video: HTMLVideoElement): void => {
    syncCanvasVideoPlayback(video, playingRef.current, () => {
      // Ein verspätetes play()-Promise der alten Szene darf beim Songwechsel
      // nicht die neue Szene mit einer Fehlermeldung überlagern.
      if (video !== videoRef.current || !playingRef.current) return;
      callback.current("Videowiedergabe durch Browser blockiert.");
    });
  }, []);
  ReactRuntime.useEffect(() => {
    const video = videoRef.current;
    if (video && visibleContent?.kind === "video") {
      video.playbackRate = speed;
      synchronizeSceneVideo(video);
    }
  }, [visibleContent?.key, visibleContent?.kind, playing, speed, synchronizeSceneVideo]);

  // Für HTML-Wallpapers max. 20 echte Spektren pro Sekunde statt nur zehn.
  // Nebula interpoliert weiterhin selbst auf der Grafik-FPS. Dieses Intervall
  // ist bewusst auf 50 ms begrenzt (weder Audio-Rohdaten noch Dauer-Speicherung).
  // Keine zusätzlichen Spotify-Audiodaten: die Sandbox erhält nur Momentwerte
  // aus einer ausdrücklich freigegebenen Quelle. Bei Pause/Spurende senden wir
  // genau EIN Stillepaket, sonst würde Nebula am letzten Peak hängenbleiben.
  // Der Kanal läuft unabhängig davon, ob ZuKaTos eigenes Balken-Overlay „off“ ist.
  ReactRuntime.useEffect(() => {
    audioGate.current.reset();
    if (visibleContent?.kind !== "html") return;
    const send = (): void => {
      const current = contentRef.current;
      if (!current || current.key !== activeKeyRef.current || current.kind !== "html") return;
      const packet = audioGate.current.next(getSpectrum(), playing);
      if (packet) frameRef.current?.contentWindow?.postMessage(packet, "*");
    };
    // Wichtig: EIN Stillepaket bleibt auch bei Pause/fehlender Freigabe noetig.
    // Danach kein Dauer-Intervall, solange es nichts zu uebertragen gibt.
    send();
    if (!shouldPollWallpaperAudio(playing, audioActive)) return;
    const interval = window.setInterval(send, WALLPAPER_AUDIO_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [visibleContent?.key, visibleContent?.kind, getSpectrum, playing, audioActive]);

  // An selbst erstellte HTML-Wallpapers ausschließlich nichtprivate Playerwerte
  // übermitteln. Sie erhalten weder direkten Spotify-API-Zugriff noch Zugriff
  // auf Einstellungen/Dateien. Der Sandbox-Origin ist absichtlich opaque.
  // HTML-Projekte können zukato:player für CSS/Canvas-Animationen nutzen.
  ReactRuntime.useEffect(() => {
    if (content?.kind !== "html") return;
    frameRef.current?.contentWindow?.postMessage(
      wallpaperPlayerPacket(title, artist, playing, songRun, progressMs, durationMs), "*");
  }, [content?.key, content?.kind, playing, title, artist, songRun, progressMs, durationMs]);

  const style = { objectFit: fit } as CSSProperties;
  return <div className="zukato-viz__backdrop zukato-viz__scene-backdrop" aria-hidden="true">
    {visibleContent?.kind === "html" && <iframe key={visibleContent.key} ref={frameRef}
      className="zukato-viz__web-frame" title="Isoliertes HTML-Wallpaper"
      sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={visibleContent.srcDoc}
      onLoad={() => {
        const frame = frameRef.current?.contentWindow;
        if (!frame) return;
        // Die Sandbox löst nach document.write() ein zweites load aus.
        // Assets daher nur EINMAL übertragen; sonst würden 100+ Blobs erneut
        // initialisiert. Danach lediglich den aktuellen Playerstand senden.
        if (visibleContent.key !== activeKeyRef.current) return;
        if (visibleContent.runtime) {
          if (frameGate.current.onLoad(visibleContent.key)) {
            try { frame.postMessage({ zukatoProjectInit: true, ...visibleContent.runtime,
              storage: loadWallpaperPrefs(visibleContent.sceneId!),
              sessionStorage: loadWallpaperPrefs(visibleContent.sceneId!, "session") }, "*"); }
            catch {
              frameGate.current.failed(visibleContent.key);
              callback.current("HTML-Wallpaper-Dateien konnten nicht an die Sandbox übertragen werden.");
            }
          }
        } else {
          // Auch klassische HTML-Szenen können erst NACH dem ersten 20-Hz-
          // Tick ihren Message-Listener registrieren. Am tatsächlichen load
          // erhalten sie immer den aktuellsten Spielerstand und EIN
          // frisches Audiopaket (bzw. Stille), unabhängig vom Tick-Timing.
          frame.postMessage(playerPacketRef.current, "*");
          audioGate.current.reset();
          const packet = audioGate.current.next(
            getSpectrumRef.current(), playerPacketRef.current.playing);
          if (packet) frame.postMessage(packet, "*");
        }
      }} />}
    {visibleContent?.kind === "video" && <video key={visibleContent.key} ref={videoRef}
      className="zukato-viz__video" src={visibleContent.url} style={style}
      // Kein autoPlay: Ein später geladenes Wallpaper darf nicht trotz
      // pausiertem Spotify-Song anlaufen. Der Player-Effekt steuert play().
      muted playsInline loop={range.start === 0 && range.end === null} preload="auto"
      onCanPlay={(event) => {
        // Nach dem Laden/Seek erneut versuchen, aber niemals gegen Pause.
        if (event.currentTarget === videoRef.current) synchronizeSceneVideo(event.currentTarget);
      }}
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
