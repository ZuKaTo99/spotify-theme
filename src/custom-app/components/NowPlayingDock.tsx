import type { ReactElement } from "react";
import { spotifyArtworkUrl } from "../../shared/artwork";
import { currentTrack } from "../../shared/library";
import { formatPlayerTime } from "../../shared/player-progress";
import { inspectNativeCanvas } from "../modules/visualizer/spotify-canvas";
import { closeVisualizerMiniWindow, miniWindowSupported } from "../modules/visualizer/mini-window";
import { PlayerControls } from "../modules/visualizer/PlayerControls";

const ReactRuntime = Spicetify.React as typeof import("react");
let restoreDockStage: (() => void) | null = null;

export function restoreNowPlayingDockStage(): void { restoreDockStage?.(); }

function playerSnapshot() {
  return {
    track: currentTrack(),
    artwork: spotifyArtworkUrl(Spicetify.Player?.data?.item?.metadata?.image_large_url),
    playing: Spicetify.Player.isPlaying(),
    shuffle: Spicetify.Player.getShuffle?.() ?? false,
    repeat: Spicetify.Player.getRepeat?.() ?? 0,
    progress: Math.max(0, Spicetify.Player.getProgress() || 0),
    duration: Math.max(0, Spicetify.Player.getDuration() || 0),
  };
}

/** Eigenes festes Fenster über der rechten Spotify-Seitenleiste. */
export function NowPlayingDock({ onOpenVisualizer, onOpenDesktop }: {
  onOpenVisualizer: () => void;
  onOpenDesktop: () => void;
}): ReactElement {
  const [player, setPlayer] = ReactRuntime.useState(playerSnapshot);
  const [canvasSource, setCanvasSource] = ReactRuntime.useState("");
  const [wallpaper, setWallpaper] = ReactRuntime.useState(false);
  const mediaRef = ReactRuntime.useRef<HTMLDivElement>(null);
  const videoRef = ReactRuntime.useRef<HTMLVideoElement>(null);
  ReactRuntime.useEffect(() => {
    const refresh = (): void => {
      const next = playerSnapshot();
      setPlayer((previous) => previous.track?.uri === next.track?.uri &&
        previous.track?.title === next.track?.title && previous.track?.artist === next.track?.artist &&
        previous.artwork === next.artwork && previous.playing === next.playing &&
        previous.shuffle === next.shuffle && previous.repeat === next.repeat &&
        Math.floor(previous.progress / 1000) === Math.floor(next.progress / 1000) &&
        previous.duration === next.duration ? previous : next);
    };
    Spicetify.Player.addEventListener("songchange", refresh);
    Spicetify.Player.addEventListener("onplaypause", refresh);
    const timer = window.setInterval(refresh, 1000);
    refresh();
    return () => {
      window.clearInterval(timer);
      Spicetify.Player.removeEventListener("songchange", refresh);
      Spicetify.Player.removeEventListener("onplaypause", refresh);
    };
  }, []);
  ReactRuntime.useEffect(() => {
    let stopped = false;
    const refreshCanvas = (): void => {
      if (stopped || document.hidden || !player.track) return;
      const result = inspectNativeCanvas(document, player.track.title, player.track.artist);
      setCanvasSource(result.kind === "ready" ? result.source.src : "");
    };
    setCanvasSource("");
    refreshCanvas();
    const timer = window.setInterval(refreshCanvas, 2500);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [player.track?.uri, player.track?.title, player.track?.artist]);
  ReactRuntime.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!player.playing || wallpaper) { video.pause(); return; }
    void video.play().catch(() => setCanvasSource(""));
  }, [canvasSource, player.playing, wallpaper]);

  // Die bestehende Bühne wandert innerhalb desselben Dokuments ins Dock.
  // Beim Wechsel zurück wird exakt dasselbe Element wieder eingesetzt.
  ReactRuntime.useLayoutEffect(() => {
    if (!wallpaper) return;
    const stage = document.querySelector<HTMLElement>(".zukato-viz-host--mini .zukato-viz__stage");
    const media = mediaRef.current;
    if (!stage || !media || !stage.parentNode) return;
    const originalParent = stage.parentNode;
    const following = stage.nextSibling;
    media.append(stage);
    const restore = (): void => {
      if (stage.ownerDocument !== document) closeVisualizerMiniWindow();
      if (stage.parentNode === media) originalParent.insertBefore(stage,
        following?.parentNode === originalParent ? following : null);
      if (restoreDockStage === restore) restoreDockStage = null;
    };
    restoreDockStage = restore;
    return restore;
  }, [wallpaper]);

  return <aside className="zukato-app zukato-now-dock" aria-label="ZuKaTo: Läuft gerade">
    <div className="zukato-now-dock__media" ref={mediaRef}>
      {player.artwork && <img src={player.artwork} alt="" />}
      {canvasSource && <video ref={videoRef} src={canvasSource} muted playsInline loop
        onError={() => setCanvasSource("")} aria-hidden="true" />}
      {!player.artwork && !canvasSource && <span aria-hidden="true">♫</span>}
    </div>
    <div className="zukato-now-dock__info">
      <strong>{player.track?.title || "Kein Titel"}</strong>
      <span>{player.track?.artist || ""}</span>
    </div>
    <div className="zukato-now-dock__progress" aria-label="Wiedergabefortschritt">
      <input type="range" min={0} max={Math.max(1, player.duration)} step={1000}
        value={Math.min(player.progress, Math.max(1, player.duration))}
        disabled={!player.track || player.duration <= 0}
        aria-label="Wiedergabeposition" aria-valuetext={formatPlayerTime(player.progress)}
        onChange={(event) => {
          const progress = Number(event.currentTarget.value);
          Spicetify.Player.seek(progress);
          setPlayer((previous) => ({ ...previous, progress }));
        }} />
      <span>{formatPlayerTime(player.progress)} / {formatPlayerTime(player.duration)}</span>
    </div>
    <div className="zukato-now-dock__transport">
      <button type="button" className={player.shuffle ? "is-active" : ""}
        aria-label="Zufallswiedergabe" title="Zufallswiedergabe" aria-pressed={player.shuffle}
        onClick={() => { Spicetify.Player.toggleShuffle(); setPlayer(playerSnapshot()); }}>⤨</button>
      <PlayerControls playing={player.playing} disabled={!player.track}
        onPrevious={() => Spicetify.Player.back()}
        onToggle={() => Spicetify.Player.togglePlay()}
        onNext={() => Spicetify.Player.next()} />
      <button type="button" className={player.repeat ? "is-active" : ""}
        aria-label={player.repeat === 2 ? "Einen Titel wiederholen" : player.repeat === 1 ? "Alle wiederholen" : "Wiederholen aus"}
        title={player.repeat === 2 ? "Einen Titel wiederholen" : player.repeat === 1 ? "Alle wiederholen" : "Wiederholen aus"}
        aria-pressed={player.repeat > 0}
        onClick={() => { Spicetify.Player.toggleRepeat(); setPlayer(playerSnapshot()); }}>{player.repeat === 2 ? "↻¹" : "↻"}</button>
    </div>
    <div className="zukato-now-dock__actions">
      <button type="button" aria-pressed={wallpaper} onClick={() => setWallpaper(!wallpaper)}>
        {wallpaper ? "Cover/Video" : "Diashow"}</button>
      <button type="button" onClick={onOpenVisualizer}>Visualizer öffnen</button>
      <button type="button" disabled={!miniWindowSupported()} onClick={onOpenDesktop}>Desktop</button>
    </div>
  </aside>;
}
