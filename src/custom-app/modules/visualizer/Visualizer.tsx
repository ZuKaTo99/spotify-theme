// =============================================================================
// Datei: src/custom-app/modules/visualizer/Visualizer.tsx
// Zweck: Immersiver Wallpaper-Visualizer im ZuKaTo Workspace.
// Aufbau: Hintergrundvideo -> optionaler ECHTER Mikrofon-Visualizer -> LRC-Lyrics.
// Wo ändern? UI / Dateiaktionen hier; Parser, IndexedDB und Canvas getrennt halten.
// =============================================================================
import type { ChangeEvent, CSSProperties, ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { currentTrack } from "../../../shared/library";
import {
  loadVisualizerConfig, saveVisualizerConfig, effectiveBackdropColorSettings, VISUALIZER_CONFIG_CHANGED_EVENT,
  loadTrackVisualizerScene, saveTrackVisualizerScene, deleteTrackVisualizerScene,
  VISUALIZER_TRACK_SCENES_CHANGED_EVENT, type VisualizerConfig,
} from "../../../shared/visualizer-config";
import {
  DEFAULT_WALLPAPER_KEY, deleteLyrics, deleteWallpaper, loadLyrics,
  MAX_LRC_BYTES, saveLyrics, saveWallpaper,
} from "./media-store";
import { activeLyricIndex, parseLrc, type TimedLyricLine } from "./lyrics";
import { lookupAutomaticLyrics, LYRICS_PROVIDER_URL, type AutomaticLyrics } from "./automatic-lyrics";
import { useMicrophoneSpectrum } from "./useMicrophoneSpectrum";
import { WallpaperBackdrop, type WallpaperInfo } from "./WallpaperBackdrop";
import { WallpaperLibrary } from "./WallpaperLibrary";
import { VisualizerPresets } from "./VisualizerPresets";
import { LyricsEditor } from "./LyricsEditor";
import { createVideoThumbnail } from "./video-thumbnail";
import {
  loadScenePreferences, saveScenePreferences, resolveScene, scenePosition, SCENE_PLAYLIST_CHANGED_EVENT,
} from "../../../shared/scene-playlists";
import { SceneBackdrop } from "./SceneBackdrop";
import { SpotifyCanvasBackdrop, type CanvasAvailability, type CanvasDiagnostic } from "./SpotifyCanvasBackdrop";
import { readSpotifyLyricsPreview } from "./spotify-lyrics-preview";
import { lookupSpotifyLyrics } from "./spotify-lyrics";
import { chooseLyricsSource } from "./lyrics-source-selection";
import { lyricsMetadataReady, lyricsLookupSignature } from "./lyrics-identity";
import { buildSafeDiagnosticReport, diagnosticSummary, type LyricsCheck, type VisualizerDiagnostics } from "./visualizer-diagnostics";
import { spotifyArtworkUrl } from "../../../shared/artwork";
import { SceneManager } from "./SceneManager";
import { loadSongSession, observeSongSession, SONG_SESSION_EVENT } from "../../../shared/song-session";
import { readVisualizerPanel, rememberVisualizerPanel, sourceStatus, VISUALIZER_PANELS, type VisualizerPanel } from "../../../shared/visualizer-workspace";

const ReactRuntime = Spicetify.React as typeof import("react");

type Assignment = "default" | "track";
interface PlayerSnapshot {
  uri: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  progress: number;
  playing: boolean;
}

/** Aktueller Stand des Spotify-Players; keine Roh-Audiodaten werden behauptet. */
function snapshot(): PlayerSnapshot {
  const track = currentTrack();
  return {
    uri: track?.uri ?? "",
    title: track?.title ?? "",
    artist: track?.artist ?? "",
    album: track?.album ?? "",
    duration: Math.max(0, Spicetify.Player.getDuration() || 0),
    progress: Math.max(0, Spicetify.Player.getProgress() || 0),
    playing: Spicetify.Player.isPlaying(),
  };
}

/** Ein Regler mit Zahlenanzeige; einheitliche Bedienung in allen Ansichten. */
function RangeControl({ label, value, min, max, step = 1, suffix = "", onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string;
  onChange: (value: number) => void;
}): ReactElement {
  return <label className="zukato-viz__range">
    <span>{label} <strong>{value}{suffix}</strong></span>
    <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.currentTarget.value))} />
  </label>;
}

/** Die Seite hält nur UI-State; große Dateien verbleiben lokal in IndexedDB. */
export function Visualizer({ t }: { t: Translator }): ReactElement {
  const [player, setPlayer] = ReactRuntime.useState(snapshot);
  // Die UI-Navigation ist bewusst vom Media-Store getrennt: Beim Wechsel
  // zwischen Registern wird keine Datei geladen, gelöscht oder neu zugeordnet.
  const [activePanel, setActivePanel] = ReactRuntime.useState(readVisualizerPanel);
  const [cinemaMode, setCinemaMode] = ReactRuntime.useState(false);
  function selectPanel(panel: VisualizerPanel): void {
    rememberVisualizerPanel(panel);
    setActivePanel(panel);
  }
  // Der Zähler ist der Index des SONGS in der Ordnerfolge – niemals Sekunden.
  // Spotify-Repeats derselben URI lösen ebenfalls songchange aus und zählen.
  // Persistenter Songlauf statt lokalem Seitencounter. Dadurch bleibt die
  // Playlist-Reihenfolge selbst nach Navigation/Neustart dieselbe.
  const [session, setSession] = ReactRuntime.useState(() =>
    observeSongSession("poll") ?? loadSongSession());
  const songRun = session?.index ?? 0;
  const [sceneSettings, setSceneSettings] = ReactRuntime.useState(loadScenePreferences);
  const [config, setConfig] = ReactRuntime.useState(loadVisualizerConfig);
  const [assignment, setAssignment] = ReactRuntime.useState<Assignment>("default");
  // Leerer Schlüssel = globale Szene. Bei gesetztem Song-Override werden
  // zukünftige Änderungen NUR für den aktuellen Titel persistiert.
  const [trackSceneUri, setTrackSceneUri] = ReactRuntime.useState("");
  // Videos und LRC unabhängig aktualisieren: ein Lyric-Import darf die laufende
  // Szene nicht neu laden oder die Videoposition verlieren.
  const [mediaRevision, setMediaRevision] = ReactRuntime.useState(0);
  const [lyricsRevision, setLyricsRevision] = ReactRuntime.useState(0);
  const [wallpaperInfo, setWallpaperInfo] = ReactRuntime.useState<WallpaperInfo>({ filename: "", key: "" });
  const [lyrics, setLyrics] = ReactRuntime.useState<TimedLyricLine[]>([]);
  // Eigene LRCs sind Overrides; automatische Texte werden nie in IndexedDB geschrieben.
  const [localLyricsLoaded, setLocalLyricsLoaded] = ReactRuntime.useState(false);
  const [plainLyrics, setPlainLyrics] = ReactRuntime.useState<string[]>([]);
  const [nativeLyricsPreview, setNativeLyricsPreview] = ReactRuntime.useState<string[]>([]);
  const [canvasAvailability, setCanvasAvailability] = ReactRuntime.useState<CanvasAvailability>("searching");
  const [canvasDiagnostic, setCanvasDiagnostic] = ReactRuntime.useState<CanvasDiagnostic>("no-sidebar");
  // Ein erneuter Check setzt den Adapter zurück, ohne den gesamten Visualizer
  // neu zu laden oder seine Lyrics-/Audio-Zustände zu verlieren.
  const [canvasRetry, setCanvasRetry] = ReactRuntime.useState(0);
  const [remoteLyrics, setRemoteLyrics] = ReactRuntime.useState<AutomaticLyrics | null>(null);
  const [lyricsState, setLyricsState] = ReactRuntime.useState<LyricsCheck>("idle");
  const [lyricsRetry, setLyricsRetry] = ReactRuntime.useState(0);
  // Technische Details standardmäßig AUS. Keine Tokens, URIs, Songtexte oder
  // Kontodaten in exportierten Diagnoseberichten (siehe Hilfsmodul).
  const [diagnosticsOpen, setDiagnosticsOpen] = ReactRuntime.useState(false);
  const [diagnosticCopyState, setDiagnosticCopyState] = ReactRuntime.useState<"idle" | "copied" | "manual">("idle");
  // Spotify zeigt rechts gelegentlich schon eine Lyrics-Vorschau, obwohl
  // LRCLIB wegen Netzwerk-/CORS-Sperren nicht erreichbar ist. Diese wenigen
  // Zeilen sind ein UNsynchronisierter Anzeige-Fallback, niemals Full-Lyrics.
  ReactRuntime.useEffect(() => {
    const read = (): void => {
      const next = readSpotifyLyricsPreview(document, player.title);
      setNativeLyricsPreview((previous) => previous.join("\n") === next.join("\n") ? previous : next);
    };
    setNativeLyricsPreview([]);
    read();
    const id = window.setInterval(read, 1500);
    return () => window.clearInterval(id);
  }, [player.uri, player.title]);
  // Erzwingt eine neue API-Anfrage nur beim gezielten Klick auf „Erneut suchen“.
  const retryUriRef = ReactRuntime.useRef("");
  const [message, setMessage] = ReactRuntime.useState("");
  const [error, setError] = ReactRuntime.useState("");
  const [busy, setBusy] = ReactRuntime.useState(false);
  const stageRef = ReactRuntime.useRef<HTMLDivElement>(null);
  const spectrum = useMicrophoneSpectrum(
    config.spectrum, config.bars, config.sensitivity, config.smoothing, player.playing,
    config.spectrumColor, config.spectrumOpacity, config.spectrumGlow,
  );

  // Auch Backup-Importe können den Visualizer von der Einstellungsseite aus ändern.
  ReactRuntime.useEffect(() => {
    const refresh = (): void => {
      const uri = currentTrack()?.uri ?? "";
      const songScene = loadTrackVisualizerScene(uri);
      setTrackSceneUri(songScene ? uri : "");
      setConfig(songScene ?? loadVisualizerConfig());
    };
    window.addEventListener(VISUALIZER_CONFIG_CHANGED_EVENT, refresh);
    window.addEventListener(VISUALIZER_TRACK_SCENES_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(VISUALIZER_CONFIG_CHANGED_EVENT, refresh);
      window.removeEventListener(VISUALIZER_TRACK_SCENES_CHANGED_EVENT, refresh);
    };
  }, []);

  // Änderungen aus Einstellungen/Backup oder anderen UI-Komponenten aufnehmen.
  ReactRuntime.useEffect(() => {
    const reload = (): void => setSceneSettings(loadScenePreferences());
    window.addEventListener(SCENE_PLAYLIST_CHANGED_EVENT, reload);
    return () => window.removeEventListener(SCENE_PLAYLIST_CHANGED_EVENT, reload);
  }, []);

  // Songzähler wird von der ständig laufenden Extension verwaltet. Für eine
  // separat installierte Custom App übernimmt dieser Listener dieselbe
  // idempotente Beobachtung als Fallback (ohne doppelt zu zählen).
  ReactRuntime.useEffect(() => {
    const refresh = (): void => setSession(observeSongSession("poll"));
    const songChanged = (): void => setSession(observeSongSession("songchange"));
    const onSaved = (): void => setSession(loadSongSession());
    Spicetify.Player.addEventListener("songchange", songChanged);
    window.addEventListener(SONG_SESSION_EVENT, onSaved);
    const timer = window.setInterval(refresh, 1000);
    refresh();
    return () => {
      Spicetify.Player.removeEventListener("songchange", songChanged);
      window.removeEventListener(SONG_SESSION_EVENT, onSaved);
      window.clearInterval(timer);
    };
  }, []);

  // Automatischer Scene-Switch beim Songwechsel, ohne den globalen Stil zu
  // überschreiben. Auch das Zurückwechseln auf einen Song mit eigener Szene
  // stellt dessen zuvor gespeicherte Werte wieder her.
  ReactRuntime.useEffect(() => {
    const scene = loadTrackVisualizerScene(player.uri);
    setTrackSceneUri(scene ? player.uri : "");
    setConfig(scene ?? loadVisualizerConfig());
  }, [player.uri]);

  // Der Player meldet sowohl Titel- als auch Pausenwechsel; Intervall nur für Progress/LRC.
  ReactRuntime.useEffect(() => {
    const refresh = (): void => setPlayer((previous) => {
      const next = snapshot();
      // Bei unverändertem Player keine React-Arbeit erzwingen.
      return previous.uri === next.uri && previous.title === next.title &&
        previous.artist === next.artist && previous.album === next.album && previous.playing === next.playing &&
        previous.progress === next.progress && previous.duration === next.duration
        ? previous : next;
    });
    Spicetify.Player.addEventListener("songchange", refresh);
    Spicetify.Player.addEventListener("onplaypause", refresh);
    const timer = window.setInterval(refresh, 250);
    return () => {
      window.clearInterval(timer);
      Spicetify.Player.removeEventListener("songchange", refresh);
      Spicetify.Player.removeEventListener("onplaypause", refresh);
    };
  }, []);

  // Auto-Lyrics: Jede neue Song-URI startet eine frische, abbrechbare Abfrage.
  // Lokale LRC-Dateien behalten Vorrang. Änderungen am Fortschrittsbalken
  // dürfen NICHT erneut das Netz anfragen. Langsame Altantworten werden
  // durch AbortController und das alive-Flag zuverlässig verworfen.
  const lyricsQueryKey = lyricsLookupSignature(player);
  const lyricsReady = lyricsMetadataReady(player);
  ReactRuntime.useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLyrics([]);
    setPlainLyrics([]);
    setRemoteLyrics(null);
    setLocalLyricsLoaded(false);
    setLyricsState(player.uri && config.lyricsEnabled ? "loading" : "idle");

    async function loadCurrentLyrics(): Promise<void> {
      if (!player.uri || !config.lyricsEnabled) return;
      try {
        const own = await loadLyrics(player.uri);
        if (!alive) return;
        const localLines = own ? parseLrc(own) : [];
        if (localLines.length) {
          setLyrics(localLines);
          setLocalLyricsLoaded(true);
          setLyricsState("local");
          return;
        }
        // ZUERST den bereits angemeldeten Spotify-Client versuchen: Genau
        // dieser kann rechts Lyrics anzeigen, auch wenn LRCLIB nicht antwortet.
        // CosmosAsync ist intern und kann ausfallen -> LRCLIB bleibt Fallback.
        const spotifyResult = await lookupSpotifyLyrics(player.uri);
        if (!alive || controller.signal.aborted) return;
        if (spotifyResult.kind === "synced") {
          const lines = parseLrc(spotifyResult.text);
          if (lines.length) {
            setLyrics(lines);
            setLyricsState("spotify-synced");
            return;
          }
        }
        // WICHTIG: Bei Spotify-UNSYNCED nicht sofort aufhören. LRCLIB
        // könnte eine synchronisierte, genau zum Track passende LRC-Datei
        // anbieten. Diese hat Vorrang vor einem ungetimten Text. Bis die
        // vollständigen Metadaten vorliegen, dürfen Spotify-Zeilen aber schon
        // als Fallback sichtbar sein.
        if (spotifyResult.kind === "plain") {
          setPlainLyrics(spotifyResult.lines);
          setLyricsState("spotify-plain");
        }
        // WICHTIG: Spotify liefert die URI häufig VOR Titel/Künstler. Nicht
        // mit "Unbekannter Künstler" suchen und diesen Fehlversuch cachen.
        // Sobald echte Metadaten eintreffen, ändert sich lyricsQueryKey und
        // dieser Effect startet automatisch neu – ohne manuelles Retry.
        if (!lyricsMetadataReady(player)) {
          if (spotifyResult.kind !== "plain") setLyricsState("waiting-metadata");
          return;
        }
        // Songmetadaten stammen aus dem Spotify-Player; LRCLIB benötigt
        // nur Titel, Künstler, Album und Dauer. Keine Account-/Tokendaten.
        const forceRefresh = retryUriRef.current === player.uri;
        retryUriRef.current = "";
        const result = await lookupAutomaticLyrics({
          uri: player.uri, title: player.title, artist: player.artist,
          album: player.album, durationMs: player.duration,
        }, { signal: controller.signal, skipCache: forceRefresh });
        if (!alive || controller.signal.aborted) return;
        setRemoteLyrics(result);
        // Die Spotify-Antwort kann theoretisch LINE_SYNCED ankündigen, aber
        // ungültige Zeitmarken enthalten. In diesem Fall muss LRCLIB noch
        // gewinnen können, statt ebenfalls als fehlerhaft verworfen zu werden.
        const validNative = spotifyResult.kind === "synced"
          ? { kind: "unavailable" as const } : spotifyResult;
        const chosen = chooseLyricsSource(validNative, result);
        if (chosen.kind === "synced") {
          const lines = parseLrc(chosen.text);
          if (lines.length) {
            setLyrics(lines);
            setPlainLyrics([]);
            setLyricsState(chosen.source === "spotify" ? "spotify-synced" : "synced");
          } else setLyricsState("not-found");
        } else if (chosen.kind === "plain") {
          setPlainLyrics(chosen.lines);
          setLyricsState(chosen.source === "spotify" ? "spotify-plain" : "plain");
        } else {
          setLyricsState(result.kind);
        }
      } catch (cause) {
        if (alive && !controller.signal.aborted) {
          console.warn("[ZuKaTo] Lyrics konnten nicht geladen werden.", cause);
          setLyricsState("error");
        }
      }
    }
    void loadCurrentLyrics();
    return () => { alive = false; controller.abort(); };
  // Weder player.progress noch player.playing dürfen einen Request auslösen.
  }, [lyricsQueryKey, lyricsRevision, lyricsRetry, config.lyricsEnabled]);

  /** Persistiert einen einzelnen Reglerwert sofort. */
  function changeConfig(changes: Partial<VisualizerConfig>): void {
    applyConfig({ ...config, ...changes });
  }

  /** Ein Preset wird in die aktive (globale oder songbezogene) Szene kopiert. */
  function applyConfig(value: VisualizerConfig): void {
    try {
      const next = trackSceneUri === player.uri && player.uri
        ? saveTrackVisualizerScene(player.uri, value)
        : saveVisualizerConfig(value);
      setConfig(next);
    } catch (cause) { setError(String(cause)); }
  }

  /** Erst beim Klick eine individuelle Szene aus dem derzeitigen Stil anlegen. */
  function saveCurrentTrackScene(): void {
    try {
      if (!player.uri) return;
      saveTrackVisualizerScene(player.uri, config);
      setTrackSceneUri(player.uri);
      setMessage(t("viz.trackSceneSaved"));
    } catch (cause) { setError(String(cause)); }
  }

  /** Entfernt nur den Override, nicht das zugeordnete Video oder die Lyrics. */
  function resetCurrentTrackScene(): void {
    deleteTrackVisualizerScene(player.uri);
    setTrackSceneUri("");
    setConfig(loadVisualizerConfig());
    setMessage(t("viz.trackSceneRemoved"));
  }

  /** Dateiupload nie vorzeitig als erfolgreich melden; lokale DB-Quota möglich. */
  async function runFileAction(action: () => Promise<void>, kind: "video" | "lyrics" = "video"): Promise<void> {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
      if (kind === "video") setMediaRevision((value) => value + 1);
      else setLyricsRevision((value) => value + 1);
      setMessage(t("viz.saved"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  /** Videos nur dem ausdrücklich gewählten Track oder Standard-Slot zuordnen. */
  function onVideoChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const key = assignment === "track" ? player.uri : DEFAULT_WALLPAPER_KEY;
    // Thumbnail-Fehler dürfen den Video-Import niemals blockieren.
    void runFileAction(async () => {
      const thumbnail = await createVideoThumbnail(file);
      await saveWallpaper(key, file, thumbnail);
    });
  }

  /** LRC-Text wird nach Prüfung direkt mit dem gerade laufenden Titel verbunden. */
  function onLyricsChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const uri = player.uri;
    void runFileAction(async () => {
      if (!uri) throw new Error(t("viz.noTrack"));
      if (!/\.lrc$/i.test(file.name)) throw new Error(t("viz.invalidLyrics"));
      if (file.size > MAX_LRC_BYTES) throw new Error(t("viz.largeLyrics"));
      const content = await file.text();
      if (!parseLrc(content).length) throw new Error(t("viz.invalidLyrics"));
      await saveLyrics(uri, content, file.name);
    }, "lyrics");
  }

  /** Browser-Fullscreen betrifft ausschließlich die Videobühne, nicht Spotify. */
  function enterFullscreen(): void {
    void stageRef.current?.requestFullscreen?.().catch((cause: unknown) => setError(String(cause)));
  }

  // Positive Korrektur verzögert den Text relativ zum Spotify-Player.
  const index = activeLyricIndex(lyrics, player.progress - config.lyricOffsetMs);
  // 1, 3 oder 5 synchronisierte Zeilen ohne leere DOM-Platzhalter anzeigen.
  const neighborCount = Math.floor(config.lyricLines / 2);
  const lineStart = index < 0 ? 0 : Math.max(0, index - neighborCount);
  const lines = lyrics.slice(lineStart, lineStart + config.lyricLines);
  const progress = player.duration ? Math.min(100, (player.progress / player.duration) * 100) : 0;
  const canAssignTrack = Boolean(player.uri);
  const selectedScope = assignment === "track" ? player.uri : DEFAULT_WALLPAPER_KEY;
  // Original-Modus bedeutet nach Nutzerwunsch Spotify Canvas, NICHT mehr
  // das manuelle URL-Manifest früherer Versionen. Alte Daten bleiben erhalten.
  const chosenScene = sceneSettings.mode === "original"
    ? { kind: "missing-original" as const }
    : resolveScene(sceneSettings, player.uri, songRun);
  // Statusanzeige aus tatsächlich ausgewählter Quelle und geladenem Legacyvideo.
  // "missing" bedeutet gerade NICHT, dass bereits automatisch ein Originalclip
  // im Internet gefunden wurde (dafür gibt es derzeit keine legitime Quelle).
  const backgroundStatus = sourceStatus(chosenScene.kind, Boolean(wallpaperInfo.filename));
  // Wenn ein nativer Canvas nicht kopierbar ist, wenigstens das gültige
  // Spotify-Cover statt einer komplett schwarzen Bühne darstellen.
  const artwork = spotifyArtworkUrl(Spicetify.Player?.data?.item?.metadata?.image_large_url);
  const sceneOrder = scenePosition(sceneSettings, player.uri, songRun);
  // Die Report-Funktion akzeptiert nur feste Statuswerte. Auch im Fall eines
  // Browserfehlers werden keine Rohfehler oder privaten Spotify-Daten kopiert.
  const diagnostics: VisualizerDiagnostics = {
    hasTrack: Boolean(player.uri), metadataReady: lyricsReady,
    originalMode: sceneSettings.mode === "original",
    canvas: canvasAvailability, canvasReason: canvasDiagnostic,
    lyricsEnabled: config.lyricsEnabled, lyrics: lyricsState,
    spectrumEnabled: config.spectrum !== "off",
    audioSource: spectrum.activeSource, audioSignal: spectrum.signal,
    displayCaptureSupported: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia),
    microphoneSupported: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
  };
  const diagnosticReport = buildSafeDiagnosticReport(diagnostics);

  /** Nutzeraktion: bei gesperrtem Clipboard bleibt ein markierbarer Bericht. */
  async function copyDiagnosticReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(diagnosticReport);
      setDiagnosticCopyState("copied");
    } catch {
      setDiagnosticCopyState("manual");
    }
  }
  // Für selbst importierte Szenen niemals ungefragt eine schwarze Deckschicht
  // oder Farbfilter anwenden – viele Wallpaper haben eigene Licht-/Wettereffekte.
  // Der Schalter in den Feinoptionen erlaubt absichtlich wieder ZuKaTo-Filter.
  const displayColors = effectiveBackdropColorSettings(config, chosenScene.kind === "scene");
  const stageStyle = { "--zukato-video-dim": displayColors.dim / 100,
    "--zukato-video-blur": `${displayColors.blur}px`,
    "--zukato-video-saturation": `${displayColors.saturation}%`,
    "--zukato-video-hue": `${displayColors.hue}deg`,
    "--zukato-vignette": displayColors.vignette / 100,
    "--zukato-caption-scale": config.lyricScale,
    "--zukato-caption-color": config.lyricColor,
    "--zukato-caption-highlight": config.lyricHighlight,
    "--zukato-caption-shadow": `${Math.round(config.lyricShadow * 0.25)}px`,
  } as CSSProperties;

  /** Decoderfehler in eine übersetzte Benutzerwarnung umwandeln. */
  function backdropError(message: string): void {
    setError(message === "VIDEO_UNSUPPORTED" ? t("viz.unsupportedVideo") : message);
  }

  return <section className={`zukato-viz zukato-panel${cinemaMode ? " zukato-viz--cinema" : ""}`}>
    {!cinemaMode && <p>{t("viz.intro")}</p>}
    <div className="zukato-viz__commandbar">
      <div className="zukato-viz__commandbar-info">
        <strong>{player.title || t("viz.noTrack")}</strong>
        <small>{player.artist || t("viz.noTrack")} · {chosenScene.kind === "missing-original"
          ? "Spotify Canvas aus der Seitenleiste (experimentell)" : t(`viz.status.${backgroundStatus}`)}</small>
      </div>
      <div className="zukato-viz__commandbar-actions">
        {/* Audio ist absichtlich opt-in: Hier gibt es zwei echte Quellen.
            Die Systemtonfreigabe ist nur in kompatiblen Clients verfügbar. */}
        {spectrum.active ? <button type="button" aria-pressed onClick={spectrum.stop}>
          Audio stoppen ({spectrum.activeSource === "system" ? "System/Tab" : "Mikrofon"})
        </button> : <>
          <button type="button" title="Bildschirm oder Tab MIT Audio freigeben; abhängig vom Spotify-Client"
            onClick={() => {
              if (config.spectrum === "off") changeConfig({ spectrum: "bars" });
              void spectrum.startSystem();
            }}>System-/Tab-Audio</button>
          <button type="button" title="Audio aus deinem ausdrücklich freigegebenen Mikrofon analysieren"
            onClick={() => {
              if (config.spectrum === "off") changeConfig({ spectrum: "bars" });
              void spectrum.start();
            }}>Mikrofon</button>
        </>}
        <button type="button" aria-pressed={sceneSettings.mode === "original"}
          title={t("viz.originalModeInfo")}
          onClick={() => {
            try {
              const mode = sceneSettings.mode === "original" ? "wallpapers" : "original";
              // Nur den Quellenmodus umschalten; alle bisher importierten
              // HTML-Projekte, Clip-Verweise und Playlists bleiben erhalten.
              // Die Wallpaper-Verwaltung könnte seit dem letzten Rendern
              // ihre Reihenfolge geändert haben. Nur den Modus aktualisieren.
              setSceneSettings(saveScenePreferences({ ...loadScenePreferences(), mode }));
              setError("");
            } catch (cause) { setError(String(cause)); }
          }}>{sceneSettings.mode === "original" ? t("viz.switchToWallpapers") : t("viz.switchToOriginals")}</button>
        <button type="button" aria-pressed={cinemaMode} onClick={() => setCinemaMode((previous) => !previous)}>
          {cinemaMode ? t("viz.cinemaExit") : t("viz.cinemaEnter")}
        </button>
        <button type="button" onClick={enterFullscreen}>{t("viz.fullscreen")}</button>
      </div>
    </div>
    <div className="zukato-viz__stage" ref={stageRef} style={stageStyle}>
      {chosenScene.kind === "missing-original" ? <SpotifyCanvasBackdrop title={player.title} artist={player.artist} trackUri={player.uri} retryToken={canvasRetry}
        playing={player.playing} artwork={artwork} fit={config.wallpaperFit}
        onAvailability={setCanvasAvailability} onDiagnostic={setCanvasDiagnostic} /> : chosenScene.kind === "legacy" ? <WallpaperBackdrop uri={player.uri} revision={mediaRevision} playing={player.playing}
        videoSpeed={config.videoSpeed} videoSync={config.videoSync} progressMs={player.progress + config.videoOffsetMs}
        wallpaperFit={config.wallpaperFit} transitionMs={config.transitionMs}
        onInfo={setWallpaperInfo} onError={backdropError}
        onAutoplayBlocked={() => setMessage(t("viz.autoplayBlocked"))} />
        : <SceneBackdrop choice={chosenScene} songRun={songRun} playing={player.playing} fit={config.wallpaperFit}
          speed={config.videoSpeed} progressMs={player.progress}
          durationMs={player.duration} onError={backdropError} />}
      <div className="zukato-viz__veil" aria-hidden="true" />
      {/* Canvas bleibt bei "off" gemountet, damit der ref beim Umschalten auf
          einen Effekt nicht verloren geht. Ohne Freigabe keine erfundenen Peaks. */}
      <canvas ref={spectrum.canvasRef} className="zukato-viz__spectrum"
        style={{ display: config.spectrum === "off" ? "none" : undefined }}
        aria-label={t("viz.spectrumLabel")} role="img" />
      <div className="zukato-viz__overlay">
        {config.showTrackInfo && <div className="zukato-viz__track">
          <strong>{player.title || t("viz.noTrack")}</strong><span>{player.artist}</span>
        </div>}
        {config.lyricsEnabled && <div className={`zukato-viz__lyrics zukato-viz__lyrics--${config.lyricPosition}`}
          style={{ textAlign: config.lyricAlign }} aria-live="off">
          {lines.length ? lines.map((line, offset) => <p key={`${line.timeMs}-${offset}`}
            className={lineStart + offset === index ? "is-current" : ""}>{line.text}</p>)
            : plainLyrics.length || (lyricsState !== "loading" && nativeLyricsPreview.length) ?
              <div className="zukato-viz__plain" tabIndex={0} aria-label={t("viz.plainLyricsLabel")}>
                {(plainLyrics.length ? plainLyrics : nativeLyricsPreview).map((line, offset) => <p key={offset}>{line}</p>)}
              </div> : lyricsState === "loading" && player.uri
                ? <p className="zukato-viz__lyrics-loading">{t("viz.lyricsLoading")}</p>
                : null}
        </div>}
      </div>
      <div className="zukato-viz__timeline" aria-hidden="true"><div style={{ width: `${progress}%` }} /></div>
    </div>
    {/* Mikrofon-/WebAudio-Fehler direkt anzeigen, weil der Audioregler häufig
        unter einem anderen Panel liegt und sonst 'kaputt' wirkt. */}
    {!cinemaMode && spectrum.error && <p className="zukato-error" role="alert">Audioquelle: {spectrum.error}</p>}
    {!cinemaMode && chosenScene.kind === "missing-original" &&
      <p className="zukato-viz__source-note" role="status">{canvasAvailability === "available"
        ? "Spotify Canvas erkannt – Wiedergabe erfolgt aus der bereits angezeigten Videoquelle."
        : canvasAvailability === "unsupported" ? "Spotify Canvas wurde erkannt, kann hier aber nicht abgespielt werden. Das Cover bleibt sichtbar."
        : canvasDiagnostic === "no-sidebar" ? "Die Spotify-Seitenleiste ist nicht sichtbar. Öffne rechts die Jetzt-läuft-Ansicht; sonst wird das Cover gezeigt."
        : canvasDiagnostic === "different-track" ? "Spotify lädt die Seitenleiste noch für den aktuellen Titel. Vorübergehend erscheint das Cover."
        : canvasDiagnostic === "no-video" ? "Spotify zeigt für diesen Titel kein auslesbares HTML5-Canvas. Das Cover wird angezeigt."
        : canvasDiagnostic === "unreadable-source" ? "Canvas sichtbar, aber Spotify stellt keine kopierbare Video-URL bereit. Das Cover bleibt sichtbar."
        : "Suche nach dem Canvas. Spotify kann den Zugriff auf seine Videopipeline einschränken."}</p>}
    {!cinemaMode && config.lyricsEnabled && !lyrics.length && !plainLyrics.length && nativeLyricsPreview.length > 0 &&
      <p className="zukato-viz__source-note">Spotify zeigt nur eine kurze, nicht synchronisierte Lyrics-Vorschau. Für vollständige Lyrics wird Spotify/LRCLIB versucht.</p>}
    {!cinemaMode && chosenScene.kind === "missing-original" && canvasAvailability !== "available" &&
      <button type="button" className="zukato-viz__retry-canvas" onClick={() => {
        setCanvasAvailability("searching");
        setCanvasRetry((previous) => previous + 1);
      }}>{t("viz.canvasRetry")}</button>}
    {!cinemaMode && config.lyricsEnabled && !lyrics.length && !plainLyrics.length && !nativeLyricsPreview.length &&
      <p className="zukato-viz__source-note" role="status">{lyricsState === "loading" ? "Suche automatische Lyrics …"
        : lyricsState === "waiting-metadata" ? t("viz.waitingMetadata")
        : lyricsState === "error" ? "Lyrics-Abfrage fehlgeschlagen (Netzwerk oder Webview)."
          : lyricsState === "rate-limited" ? "Lyrics-Dienst ist vorübergehend begrenzt."
            : "Für diesen Titel wurden noch keine Lyrics gefunden."}
        <button type="button" onClick={() => { retryUriRef.current = player.uri; setLyricsRetry((value) => value + 1); }}
          disabled={!player.uri || lyricsState === "loading"}>Erneut suchen</button></p>}
    {/* Diagnose nur auf Wunsch: normale Bedienung bleibt aufgeräumt. */}
    {!cinemaMode && <section className="zukato-viz__diagnostics">
      <button type="button" aria-expanded={diagnosticsOpen}
        onClick={() => { setDiagnosticsOpen((previous) => !previous); setDiagnosticCopyState("idle"); }}>
        {diagnosticsOpen ? t("viz.diagnosticsClose") : t("viz.diagnosticsOpen")}
      </button>
      {diagnosticsOpen && <div className="zukato-viz__diagnostics-detail">
        <p>{t("viz.diagnosticsIntro")}</p>
        <ul>{diagnosticSummary(diagnostics).map((entry) => <li key={entry}>{entry}</li>)}</ul>
        <button type="button" onClick={() => void copyDiagnosticReport()}>{t("viz.diagnosticsCopy")}</button>
        {diagnosticCopyState === "copied" && <span role="status">{t("viz.diagnosticsCopied")}</span>}
        {diagnosticCopyState === "manual" && <span role="status">{t("viz.diagnosticsManual")}</span>}
        <pre tabIndex={0} aria-label={t("viz.diagnosticsReport")}>{diagnosticReport}</pre>
      </div>}
    </section>}
    {!cinemaMode && <div className="zukato-toolbar">
      <span>{chosenScene.kind === "missing-original" ? "Spotify Canvas (aus rechter Seitenleiste, sofern verfügbar)"
        : chosenScene.kind === "scene" ? `${t("viz.background")}: ${t("viz.sceneCurrent")} ${sceneOrder.index + 1}`
        : chosenScene.kind === "original" ? t("viz.sceneOriginalActive")
        : wallpaperInfo.filename ? `${t("viz.background")}: ${wallpaperInfo.filename} (${wallpaperInfo.key.endsWith(":default") ? t("viz.default") : t("viz.forTrack")})` : t("viz.noWallpaper")}</span>
      <span>{Spicetify.Player.formatTime(player.progress)} / {Spicetify.Player.formatTime(player.duration)} · {player.playing ? t("visualizer.playing") : t("visualizer.paused")}</span>
    </div>}
    {!cinemaMode && <div className="zukato-player-monitor__buttons">
      <button type="button" onClick={() => Spicetify.Player.back()}>⏮</button>
      <button type="button" onClick={() => Spicetify.Player.togglePlay()}>{player.playing ? t("visualizer.pause") : t("visualizer.play")}</button>
      <button type="button" onClick={() => Spicetify.Player.next()}>⏭</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {error && <p className="zukato-error" role="alert">{error}</p>}
    {!cinemaMode && <>
      <nav className="zukato-viz__panel-tabs" aria-label={t("viz.panelsLabel")}>
        {VISUALIZER_PANELS.map((panel) => <button key={panel} type="button"
          className={activePanel === panel ? "is-active" : ""}
          aria-current={activePanel === panel ? "page" : undefined}
          onClick={() => selectPanel(panel)}>{t(`viz.panel.${panel}`)}</button>)}
      </nav>
      <div className="zukato-viz__settings">
      {activePanel === "wallpapers" && <>
        <section className="zukato-viz__controls">
          <label className="zukato-viz__checkbox">
            <input type="checkbox" checked={config.preserveSceneAppearance}
              onChange={(event) => changeConfig({ preserveSceneAppearance: event.currentTarget.checked })} />
            {t("viz.preserveAppearance")}
          </label>
          <p className="zukato-viz__hint">{t("viz.preserveAppearanceHelp")}</p>
          {!config.preserveSceneAppearance && <RangeControl label={t("viz.dim")}
            value={config.dim} min={0} max={90} suffix="%"
            onChange={(dim) => changeConfig({ dim })} />}
        </section>
        <SceneManager t={t} trackUri={player.uri} settings={sceneSettings} onChange={setSceneSettings} onError={setError} showModeToggle={false} />
        <details className="zukato-viz__library-panel">
        <summary>{t("viz.manageLegacyLibrary")}</summary>
        <section className="zukato-viz__controls">
        <h3>{t("viz.wallpaperHeading")}</h3>
        <p>{t("viz.wallpaperHelp")}</p>
        <label>{t("viz.assignment")}
          <select value={assignment} onChange={(event) => setAssignment(event.currentTarget.value as Assignment)}>
            <option value="default">{t("viz.default")}</option>
            <option value="track" disabled={!canAssignTrack}>{t("viz.forTrack")}</option>
          </select>
        </label>
        <div className="zukato-toolbar">
          <label className="zukato-viz__upload">{t("viz.pickVideo")}
            <input type="file" accept=".mp4,.webm,.ogv,video/mp4,video/webm,video/ogg" disabled={busy || (assignment === "track" && !canAssignTrack)} onChange={onVideoChange} />
          </label>
          <button type="button" disabled={busy} onClick={() => void runFileAction(() => deleteWallpaper(selectedScope))}>{t("viz.deleteVideo")}</button>
        </div>
        <label>{t("viz.fit")}
          <select value={config.wallpaperFit} onChange={(event) => changeConfig({ wallpaperFit: event.currentTarget.value as VisualizerConfig["wallpaperFit"] })}>
            <option value="cover">{t("viz.cover")}</option><option value="contain">{t("viz.contain")}</option>
          </select>
        </label>
        <RangeControl label={t("viz.dim")} value={config.dim} min={0} max={90} suffix="%" onChange={(dim) => changeConfig({ dim })} />
        <details className="zukato-viz__options">
          <summary>{t("viz.moreVideoOptions")}</summary>
        <RangeControl label={t("viz.blur")} value={config.blur} min={0} max={20} suffix="px" onChange={(blur) => changeConfig({ blur })} />
        <label>{t("viz.videoSync")}
          <select value={config.videoSync} onChange={(event) => changeConfig({ videoSync: event.currentTarget.value as VisualizerConfig["videoSync"] })}>
            <option value="free">{t("viz.videoSyncFree")}</option><option value="song">{t("viz.videoSyncSong")}</option>
          </select>
        </label>
        <p className="zukato-viz__hint">{t("viz.videoSyncHelp")}</p>
        {config.videoSync === "song" && <RangeControl label={t("viz.videoOffset")} value={config.videoOffsetMs}
          min={-10000} max={10000} step={100} suffix=" ms" onChange={(videoOffsetMs) => changeConfig({ videoOffsetMs })} />}
        <RangeControl label={t("viz.videoSpeed")} value={config.videoSpeed} min={0.5} max={2} step={0.1} suffix="×" onChange={(videoSpeed) => changeConfig({ videoSpeed })} />
        <RangeControl label={t("viz.videoSaturation")} value={config.videoSaturation} min={0} max={200} step={5} suffix="%" onChange={(videoSaturation) => changeConfig({ videoSaturation })} />
        <RangeControl label={t("viz.videoHue")} value={config.videoHue} min={-180} max={180} step={5} suffix="°" onChange={(videoHue) => changeConfig({ videoHue })} />
        <RangeControl label={t("viz.vignette")} value={config.vignette} min={0} max={100} step={5} suffix="%" onChange={(vignette) => changeConfig({ vignette })} />
        <RangeControl label={t("viz.transition")} value={config.transitionMs} min={0} max={3000} step={100} suffix=" ms" onChange={(transitionMs) => changeConfig({ transitionMs })} />
        </details>
        </section>
        <WallpaperLibrary t={t} trackUri={player.uri} revision={mediaRevision}
          onUpdated={() => { setMediaRevision((value) => value + 1); setMessage(t("viz.saved")); setError(""); }}
          onError={backdropError} />
        </details>
      </>}
      {activePanel === "audio" && <section className="zukato-viz__controls">
        <h3>{t("viz.audioHeading")}</h3>
        <p>{t("viz.audioHelp")}</p>
        <label>{t("viz.spectrumMode")}
          <select value={config.spectrum} onChange={(event) => changeConfig({ spectrum: event.currentTarget.value as VisualizerConfig["spectrum"] })}>
            <option value="off">{t("viz.modeOff")}</option><option value="bars">{t("viz.modeBars")}</option>
            <option value="ring">{t("viz.modeRing")}</option><option value="wave">{t("viz.modeWave")}</option>
            <option value="particles">{t("viz.modeParticles")}</option>
          </select>
        </label>
        <div className="zukato-toolbar">
          {spectrum.active ? <button type="button" onClick={spectrum.stop}>{t("viz.stopMic")}</button> : <>
            <button type="button" disabled={config.spectrum === "off"} onClick={() => void spectrum.startSystem()}>System-/Tab-Audio freigeben</button>
            <button type="button" disabled={config.spectrum === "off"} onClick={() => void spectrum.start()}>{t("viz.startMic")}</button>
          </>}
        </div>
        <p className="zukato-viz__source-note" role="status">{config.spectrum === "off"
          ? "Visualizer ist ausgeschaltet. Wähle zuerst Balken, Ring, Welle oder Partikel."
          : spectrum.activeSource === "system" ? "Audioanalyse läuft über die freigegebene System-/Tab-Audiospur."
            : spectrum.activeSource === "microphone" ? "Audioanalyse läuft über dein freigegebenes Mikrofon."
            : "Noch keine Audioquelle aktiv. System-/Tab-Audio benötigt eine Freigabe MIT Ton und wird nicht von jedem Spotify-Client unterstützt. Alternativ Mikrofon freigeben."}
          {spectrum.active && <> <strong>· {spectrum.signal === "detected" ? t("viz.signalDetected")
            : spectrum.signal === "silent" ? t("viz.signalSilent")
            : spectrum.signal === "paused" ? t("viz.signalPaused") : t("viz.signalChecking")}</strong></>}</p>
        {spectrum.error && <p className="zukato-error" role="alert">{spectrum.error}</p>}
        <details className="zukato-viz__options">
          <summary>{t("viz.moreAudioOptions")}</summary>
        <RangeControl label={t("viz.sensitivity")} value={config.sensitivity} min={0.5} max={5} step={0.1} onChange={(sensitivity) => changeConfig({ sensitivity })} />
        <RangeControl label={t("viz.smoothing")} value={config.smoothing} min={0} max={0.95} step={0.05} onChange={(smoothing) => changeConfig({ smoothing })} />
        <RangeControl label={t("viz.bars")} value={config.bars} min={12} max={128} step={4} onChange={(bars) => changeConfig({ bars })} />
        <label>{t("viz.spectrumColor")} <input type="color" value={config.spectrumColor}
          onChange={(event) => changeConfig({ spectrumColor: event.currentTarget.value })} /></label>
        <RangeControl label={t("viz.spectrumOpacity")} value={config.spectrumOpacity} min={10} max={100}
          suffix="%" onChange={(spectrumOpacity) => changeConfig({ spectrumOpacity })} />
        <RangeControl label={t("viz.spectrumGlow")} value={config.spectrumGlow} min={0} max={30}
          suffix="px" onChange={(spectrumGlow) => changeConfig({ spectrumGlow })} />
        </details>
      </section>}
      {activePanel === "lyrics" && <section className="zukato-viz__controls">
        <h3>{t("viz.lyricsHeading")}</h3>
        <p>{t("viz.lyricsHelp")}</p>
        <label className="zukato-viz__checkbox"><input type="checkbox" checked={config.lyricsEnabled} onChange={(event) => changeConfig({ lyricsEnabled: event.currentTarget.checked })} /> {t("viz.showLyrics")}</label>
        <label className="zukato-viz__checkbox"><input type="checkbox" checked={config.showTrackInfo} onChange={(event) => changeConfig({ showTrackInfo: event.currentTarget.checked })} /> {t("viz.showTitle")}</label>
        <div className="zukato-viz__lyrics-source" role="status">
          <span>{lyricsState === "spotify-synced" ? "Spotify-Lyrics: synchronisiert (interne Quelle)"
            : lyricsState === "spotify-plain" ? "Spotify-Lyrics: ohne Zeitmarken (interne Quelle)"
            : lyricsState === "local" ? t("viz.lyricsOwn")
            : lyricsState === "synced" ? t("viz.lyricsAutoSynced")
              : lyricsState === "plain" ? t("viz.lyricsAutoPlain")
                : lyricsState === "loading" ? t("viz.lyricsLoading")
                  : lyricsState === "instrumental" ? t("viz.lyricsInstrumental")
                    : lyricsState === "rate-limited" ? t("viz.lyricsRateLimited")
                      : lyricsState === "error" ? t("viz.lyricsError") : t("viz.noLyrics")}</span>
          {(lyricsState === "synced" || lyricsState === "plain") && remoteLyrics && "sourceId" in remoteLyrics &&
            <a href={`${LYRICS_PROVIDER_URL}/api/get/${remoteLyrics.sourceId}`}
              target="_blank" rel="noopener noreferrer">{t("viz.lyricsSource")}: LRCLIB</a>}
          {(lyricsState === "not-found" || lyricsState === "error" || lyricsState === "rate-limited") &&
            <button type="button" disabled={!canAssignTrack || busy} onClick={() => { retryUriRef.current = player.uri; setLyricsRetry((value) => value + 1); }}>{t("viz.lyricsRetry")}</button>}
        </div>
        <details className="zukato-viz__lyrics-editor">
          <summary>{t("viz.lyricsAdvanced")}</summary>
          <p className="zukato-viz__hint">{t("viz.lyricsAdvancedHelp")}</p>
          <div className="zukato-toolbar">
            <label className="zukato-viz__upload">{t("viz.pickLyrics")}
              <input type="file" accept=".lrc,text/plain" disabled={busy || !canAssignTrack} onChange={onLyricsChange} />
            </label>
            <button type="button" disabled={busy || !canAssignTrack || !localLyricsLoaded}
              onClick={() => void runFileAction(() => deleteLyrics(player.uri), "lyrics")}>{t("viz.deleteLyrics")}</button>
          </div>
          <LyricsEditor t={t} uri={player.uri} revision={lyricsRevision}
            onUpdated={() => setLyricsRevision((value) => value + 1)} onError={setError}
            progressMs={player.progress} />
        </details>
        <RangeControl label={t("viz.lyricScale")} value={config.lyricScale} min={0.7} max={1.8} step={0.1} suffix="×" onChange={(lyricScale) => changeConfig({ lyricScale })} />
        <label>{t("viz.lyricColor")} <input type="color" value={config.lyricColor} onChange={(event) => changeConfig({ lyricColor: event.currentTarget.value })} /></label>
        <label>{t("viz.lyricHighlight")} <input type="color" value={config.lyricHighlight} onChange={(event) => changeConfig({ lyricHighlight: event.currentTarget.value })} /></label>
        <details className="zukato-viz__options">
          <summary>{t("viz.moreLyricsOptions")}</summary>
        <RangeControl label={t("viz.lyricOffset")} value={config.lyricOffsetMs} min={-5000} max={5000} step={100} suffix=" ms" onChange={(lyricOffsetMs) => changeConfig({ lyricOffsetMs })} />
        <label>{t("viz.lyricAlign")}
          <select value={config.lyricAlign} onChange={(event) => changeConfig({ lyricAlign: event.currentTarget.value as VisualizerConfig["lyricAlign"] })}>
            <option value="left">{t("viz.alignLeft")}</option><option value="center">{t("viz.alignCenter")}</option><option value="right">{t("viz.alignRight")}</option>
          </select>
        </label>
        <label>{t("viz.lyricPosition")}
          <select value={config.lyricPosition} onChange={(event) => changeConfig({ lyricPosition: event.currentTarget.value as VisualizerConfig["lyricPosition"] })}>
            <option value="top">{t("viz.positionTop")}</option><option value="middle">{t("viz.positionMiddle")}</option><option value="bottom">{t("viz.positionBottom")}</option>
          </select>
        </label>
        <label>{t("viz.lyricLines")}
          <select value={config.lyricLines} onChange={(event) => changeConfig({ lyricLines: Number(event.currentTarget.value) as VisualizerConfig["lyricLines"] })}>
            <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option>
          </select>
        </label>
        <RangeControl label={t("viz.lyricShadow")} value={config.lyricShadow} min={0} max={100} suffix="%" onChange={(lyricShadow) => changeConfig({ lyricShadow })} />
        </details>
        <span className="zukato-viz__hint">{lyrics.length ? t("viz.lyricsReady", { count: String(lyrics.length) })
          : lyricsState === "plain" ? t("viz.lyricsNoSync") : t("viz.lyricsAutoHelp")}</span>
      </section>}
    </div>
    {activePanel === "advanced" && <section className="zukato-viz__controls zukato-viz__track-scenes">
      <h3>{t("viz.trackSceneHeading")}</h3>
      <p>{t("viz.trackSceneHelp")}</p>
      <strong>{trackSceneUri === player.uri && player.uri ? t("viz.trackSceneActive") : t("viz.trackSceneGlobal")}</strong>
      <div className="zukato-viz__library-actions">
        <button type="button" disabled={!player.uri} onClick={saveCurrentTrackScene}>{t("viz.trackSceneSave")}</button>
        <button type="button" disabled={!player.uri || trackSceneUri !== player.uri} onClick={resetCurrentTrackScene}>{t("viz.trackSceneReset")}</button>
      </div>
    </section>}
    {activePanel === "advanced" && <VisualizerPresets t={t} config={config} onApply={(next) => { applyConfig(next); setMessage(t("viz.presetApplied")); setError(""); }}
      onError={(cause) => setError(cause)} />}
    </>}
  </section>;
}
