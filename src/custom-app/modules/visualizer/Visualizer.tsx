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
  loadVisualizerConfig, saveVisualizerConfig, VISUALIZER_CONFIG_CHANGED_EVENT,
  loadTrackVisualizerScene, saveTrackVisualizerScene, deleteTrackVisualizerScene,
  VISUALIZER_TRACK_SCENES_CHANGED_EVENT, type VisualizerConfig,
} from "../../../shared/visualizer-config";
import {
  DEFAULT_WALLPAPER_KEY, deleteLyrics, deleteWallpaper, loadLyrics,
  MAX_LRC_BYTES, saveLyrics, saveWallpaper,
} from "./media-store";
import { activeLyricIndex, parseLrc, type TimedLyricLine } from "./lyrics";
import { useMicrophoneSpectrum } from "./useMicrophoneSpectrum";
import { WallpaperBackdrop, type WallpaperInfo } from "./WallpaperBackdrop";
import { WallpaperLibrary } from "./WallpaperLibrary";
import { VisualizerPresets } from "./VisualizerPresets";
import { LyricsEditor } from "./LyricsEditor";
import { createVideoThumbnail } from "./video-thumbnail";
import {
  loadScenePreferences, resolveScene, sceneList, SCENE_PLAYLIST_CHANGED_EVENT,
} from "../../../shared/scene-playlists";
import { SceneBackdrop } from "./SceneBackdrop";
import { SceneManager } from "./SceneManager";
import { loadSongSession, observeSongSession, SONG_SESSION_EVENT } from "../../../shared/song-session";

const ReactRuntime = Spicetify.React as typeof import("react");

type Assignment = "default" | "track";
interface PlayerSnapshot {
  uri: string;
  title: string;
  artist: string;
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
  const [lyricsLoaded, setLyricsLoaded] = ReactRuntime.useState(false);
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
        previous.artist === next.artist && previous.playing === next.playing &&
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

  // Nie bei jeder Progress-Aktualisierung laden: Lyrics nur beim Titelwechsel.
  ReactRuntime.useEffect(() => {
    let alive = true;
    setLyrics([]);
    setLyricsLoaded(false);
    void loadLyrics(player.uri).then((content) => {
      if (!alive) return;
      setLyrics(content ? parseLrc(content) : []);
      setLyricsLoaded(Boolean(content));
    }).catch((cause: unknown) => { if (alive) setError(String(cause)); });
    return () => { alive = false; };
  }, [player.uri, lyricsRevision]);

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
  const chosenScene = resolveScene(sceneSettings, player.uri, songRun);
  const stageStyle = { "--zukato-video-dim": config.dim / 100, "--zukato-video-blur": `${config.blur}px`,
    "--zukato-video-saturation": `${config.videoSaturation}%`,
    "--zukato-video-hue": `${config.videoHue}deg`, "--zukato-vignette": config.vignette / 100,
    "--zukato-caption-scale": config.lyricScale,
    "--zukato-caption-color": config.lyricColor,
    "--zukato-caption-highlight": config.lyricHighlight,
    "--zukato-caption-shadow": `${Math.round(config.lyricShadow * 0.25)}px`,
  } as CSSProperties;

  /** Decoderfehler in eine übersetzte Benutzerwarnung umwandeln. */
  function backdropError(message: string): void {
    setError(message === "VIDEO_UNSUPPORTED" ? t("viz.unsupportedVideo") : message);
  }

  return <section className="zukato-viz zukato-panel">
    <p>{t("viz.intro")}</p>
    <div className="zukato-viz__stage" ref={stageRef} style={stageStyle}>
      {chosenScene.kind === "missing-original" ? <div className="zukato-viz__missing-source" role="status">
        {t("viz.originalMissing")}
      </div> : chosenScene.kind === "legacy" ? <WallpaperBackdrop uri={player.uri} revision={mediaRevision} playing={player.playing}
        videoSpeed={config.videoSpeed} videoSync={config.videoSync} progressMs={player.progress + config.videoOffsetMs}
        wallpaperFit={config.wallpaperFit} transitionMs={config.transitionMs}
        onInfo={setWallpaperInfo} onError={backdropError}
        onAutoplayBlocked={() => setMessage(t("viz.autoplayBlocked"))} />
        : <SceneBackdrop choice={chosenScene} songRun={songRun} playing={player.playing} fit={config.wallpaperFit}
          speed={config.videoSpeed} progressMs={player.progress}
          durationMs={player.duration} onError={backdropError} />}
      <div className="zukato-viz__veil" aria-hidden="true" />
      {config.spectrum !== "off" && <canvas ref={spectrum.canvasRef} className="zukato-viz__spectrum" aria-label={t("viz.spectrumLabel")} role="img" />}
      <div className="zukato-viz__overlay">
        {config.showTrackInfo && <div className="zukato-viz__track">
          <strong>{player.title || t("viz.noTrack")}</strong><span>{player.artist}</span>
        </div>}
        {config.lyricsEnabled && <div className={`zukato-viz__lyrics zukato-viz__lyrics--${config.lyricPosition}`}
          style={{ textAlign: config.lyricAlign }} aria-live="off">
          {lines.length ? lines.map((line, offset) => <p key={`${line.timeMs}-${offset}`}
            className={lineStart + offset === index ? "is-current" : ""}>{line.text}</p>)
            : <span className="zukato-viz__hint">{t("viz.noLyrics")}</span>}
        </div>}
      </div>
      <button type="button" className="zukato-viz__fullscreen" onClick={enterFullscreen}>{t("viz.fullscreen")}</button>
      <div className="zukato-viz__timeline" aria-hidden="true"><div style={{ width: `${progress}%` }} /></div>
    </div>
    <div className="zukato-toolbar">
      <span>{chosenScene.kind === "scene" ? `${t("viz.background")}: ${t("viz.sceneCurrent")} ${(songRun % Math.max(1, sceneList(sceneSettings, player.uri).length)) + 1}`
        : chosenScene.kind === "original" ? t("viz.sceneOriginalActive")
        : chosenScene.kind === "missing-original" ? t("viz.originalMissing")
        : wallpaperInfo.filename ? `${t("viz.background")}: ${wallpaperInfo.filename} (${wallpaperInfo.key.endsWith(":default") ? t("viz.default") : t("viz.forTrack")})` : t("viz.noWallpaper")}</span>
      <span>{Spicetify.Player.formatTime(player.progress)} / {Spicetify.Player.formatTime(player.duration)} · {player.playing ? t("visualizer.playing") : t("visualizer.paused")}</span>
    </div>
    <div className="zukato-player-monitor__buttons">
      <button type="button" onClick={() => Spicetify.Player.back()}>⏮</button>
      <button type="button" onClick={() => Spicetify.Player.togglePlay()}>{player.playing ? t("visualizer.pause") : t("visualizer.play")}</button>
      <button type="button" onClick={() => Spicetify.Player.next()}>⏭</button>
    </div>
    {message && <p role="status">{message}</p>}
    {error && <p className="zukato-error" role="alert">{error}</p>}
    <div className="zukato-viz__settings">
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
      </section>
      <section className="zukato-viz__controls">
        <h3>{t("viz.audioHeading")}</h3>
        <p>{t("viz.audioHelp")}</p>
        <label>{t("viz.spectrumMode")}
          <select value={config.spectrum} onChange={(event) => changeConfig({ spectrum: event.currentTarget.value as VisualizerConfig["spectrum"] })}>
            <option value="off">{t("viz.modeOff")}</option><option value="bars">{t("viz.modeBars")}</option>
            <option value="ring">{t("viz.modeRing")}</option><option value="wave">{t("viz.modeWave")}</option>
            <option value="particles">{t("viz.modeParticles")}</option>
          </select>
        </label>
        <button type="button" disabled={config.spectrum === "off"} onClick={() => { if (spectrum.active) spectrum.stop(); else void spectrum.start(); }}>
          {spectrum.active ? t("viz.stopMic") : t("viz.startMic")}
        </button>
        {spectrum.error && <p className="zukato-error" role="alert">{spectrum.error}</p>}
        <RangeControl label={t("viz.sensitivity")} value={config.sensitivity} min={0.5} max={5} step={0.1} onChange={(sensitivity) => changeConfig({ sensitivity })} />
        <RangeControl label={t("viz.smoothing")} value={config.smoothing} min={0} max={0.95} step={0.05} onChange={(smoothing) => changeConfig({ smoothing })} />
        <RangeControl label={t("viz.bars")} value={config.bars} min={12} max={128} step={4} onChange={(bars) => changeConfig({ bars })} />
        <label>{t("viz.spectrumColor")} <input type="color" value={config.spectrumColor}
          onChange={(event) => changeConfig({ spectrumColor: event.currentTarget.value })} /></label>
        <RangeControl label={t("viz.spectrumOpacity")} value={config.spectrumOpacity} min={10} max={100}
          suffix="%" onChange={(spectrumOpacity) => changeConfig({ spectrumOpacity })} />
        <RangeControl label={t("viz.spectrumGlow")} value={config.spectrumGlow} min={0} max={30}
          suffix="px" onChange={(spectrumGlow) => changeConfig({ spectrumGlow })} />
      </section>
      <section className="zukato-viz__controls">
        <h3>{t("viz.lyricsHeading")}</h3>
        <p>{t("viz.lyricsHelp")}</p>
        <label className="zukato-viz__checkbox"><input type="checkbox" checked={config.lyricsEnabled} onChange={(event) => changeConfig({ lyricsEnabled: event.currentTarget.checked })} /> {t("viz.showLyrics")}</label>
        <label className="zukato-viz__checkbox"><input type="checkbox" checked={config.showTrackInfo} onChange={(event) => changeConfig({ showTrackInfo: event.currentTarget.checked })} /> {t("viz.showTitle")}</label>
        <div className="zukato-toolbar">
          <label className="zukato-viz__upload">{t("viz.pickLyrics")}
            <input type="file" accept=".lrc,text/plain" disabled={busy || !canAssignTrack} onChange={onLyricsChange} />
          </label>
          <button type="button" disabled={busy || !canAssignTrack || !lyricsLoaded} onClick={() => void runFileAction(() => deleteLyrics(player.uri), "lyrics")}>{t("viz.deleteLyrics")}</button>
        </div>
        <LyricsEditor t={t} uri={player.uri} revision={lyricsRevision}
          onUpdated={() => setLyricsRevision((value) => value + 1)} onError={setError}
          progressMs={player.progress} />
        <RangeControl label={t("viz.lyricScale")} value={config.lyricScale} min={0.7} max={1.8} step={0.1} suffix="×" onChange={(lyricScale) => changeConfig({ lyricScale })} />
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
        <label>{t("viz.lyricColor")} <input type="color" value={config.lyricColor} onChange={(event) => changeConfig({ lyricColor: event.currentTarget.value })} /></label>
        <label>{t("viz.lyricHighlight")} <input type="color" value={config.lyricHighlight} onChange={(event) => changeConfig({ lyricHighlight: event.currentTarget.value })} /></label>
        <RangeControl label={t("viz.lyricShadow")} value={config.lyricShadow} min={0} max={100} suffix="%" onChange={(lyricShadow) => changeConfig({ lyricShadow })} />
        <span className="zukato-viz__hint">{lyrics.length ? t("viz.lyricsReady", { count: String(lyrics.length) }) : t("viz.noLyrics")}</span>
      </section>
    </div>
    <section className="zukato-viz__controls zukato-viz__track-scenes">
      <h3>{t("viz.trackSceneHeading")}</h3>
      <p>{t("viz.trackSceneHelp")}</p>
      <strong>{trackSceneUri === player.uri && player.uri ? t("viz.trackSceneActive") : t("viz.trackSceneGlobal")}</strong>
      <div className="zukato-viz__library-actions">
        <button type="button" disabled={!player.uri} onClick={saveCurrentTrackScene}>{t("viz.trackSceneSave")}</button>
        <button type="button" disabled={!player.uri || trackSceneUri !== player.uri} onClick={resetCurrentTrackScene}>{t("viz.trackSceneReset")}</button>
      </div>
    </section>
    <SceneManager t={t} trackUri={player.uri} settings={sceneSettings} onChange={setSceneSettings} onError={setError} />
    <VisualizerPresets t={t} config={config} onApply={(next) => { applyConfig(next); setMessage(t("viz.presetApplied")); setError(""); }}
      onError={(cause) => setError(cause)} />
    <WallpaperLibrary t={t} trackUri={player.uri} revision={mediaRevision}
      onUpdated={() => { setMediaRevision((value) => value + 1); setMessage(t("viz.saved")); setError(""); }}
      onError={backdropError} />
  </section>;
}
