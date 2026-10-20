// =============================================================================
// Datei: src/custom-app/modules/dashboard/Dashboard.tsx
// Zweck: Neue Workspace-Startseite mit Jetzt-läuft-Bereich, Aktionen, Verlauf
//        und verständlichen Kennzahlen statt einer nackten Modulliste.
// Änderungen am Layout gehören hierher; Zahlenberechnung: dashboard-summary.ts.
// =============================================================================
import type { ReactElement } from "react";
import type { FeaturePreferences } from "../../../shared/feature-preferences";
import type { FeatureId } from "../../../shared/features";
import { getEnabledFeaturesBySurface } from "../../../shared/features";
import type { Translator } from "../../../shared/i18n";
import { currentTrack, toggleFavorite, type TrackInfo } from "../../../shared/library";
import { summarizeDashboard } from "../../../shared/dashboard-summary";
import { spotifyArtworkUrl } from "../../../shared/artwork";
import { normalizedPlayerProgress, type PlayerProgress } from "../../../shared/player-progress";
import { useToolkitData } from "../../hooks/useToolkitData";
import { TrackList } from "../../components/TrackList";
import { dashboardProgressDelayMs, sameDashboardProgress } from "./dashboard-polling";

const ReactRuntime = Spicetify.React as typeof import("react");

interface DashboardProps {
  features: FeaturePreferences;
  t: Translator;
  onNavigate: (featureId: FeatureId) => void;
  onOpenQuick: () => void;
}

/** Beobachtet echte Player-Ereignisse – die Ansicht muss dafür nicht neu geöffnet werden. */
function useNowPlaying(): { track: TrackInfo | null; playing: boolean; cover: string | null } {
  const snapshot = (): { track: TrackInfo | null; playing: boolean; cover: string | null } => ({
    track: currentTrack(),
    playing: Boolean(Spicetify.Player?.isPlaying()),
    cover: spotifyArtworkUrl(Spicetify.Player?.data?.item?.metadata?.image_large_url),
  });
  const [value, setValue] = ReactRuntime.useState(snapshot);
  ReactRuntime.useEffect(() => {
    const refresh = (): void => setValue(snapshot());
    Spicetify.Player.addEventListener("songchange", refresh);
    Spicetify.Player.addEventListener("onplaypause", refresh);
    refresh();
    return () => {
      Spicetify.Player.removeEventListener("songchange", refresh);
      Spicetify.Player.removeEventListener("onplaypause", refresh);
    };
  }, []);
  return value;
}

/** Schaltflächen erscheinen nur, wenn das Zielmodul tatsächlich aktiviert ist. */
export function Dashboard({ features, t, onNavigate, onOpenQuick }: DashboardProps): ReactElement {
  const { history, favorites, notes } = useToolkitData();
  const { track, playing, cover } = useNowPlaying();
  const summary = ReactRuntime.useMemo(() => summarizeDashboard(history), [history]);
  const visible = new Set(getEnabledFeaturesBySurface("custom-app", features).map((item) => item.id));
  const isFavorite = Boolean(track && favorites.some((favorite) => favorite.uri === track.uri));
  const [message, setMessage] = ReactRuntime.useState("");
  // Bei Wiedergabe bleibt die Zeitanzeige sekundengenau. Während Pause und
  // Hintergrundbetrieb sinkt die Zahl der Timerläufe deutlich; Songwechsel,
  // Pause/Play und Tab-Rückkehr werden unabhängig davon sofort verarbeitet.
  const [position, setPosition] = ReactRuntime.useState<PlayerProgress>(() => normalizedPlayerProgress(
    Spicetify.Player.getProgress(), Spicetify.Player.getDuration()));
  ReactRuntime.useEffect(() => {
    let stopped = false;
    let timer: number | null = null;
    const refresh = (): void => {
      const next = normalizedPlayerProgress(Spicetify.Player.getProgress(), Spicetify.Player.getDuration());
      setPosition((previous) => sameDashboardProgress(previous, next) ? previous : next);
    };
    const schedule = (): void => {
      if (stopped) return;
      timer = window.setTimeout(() => {
        timer = null;
        refresh();
        schedule();
      }, dashboardProgressDelayMs(Spicetify.Player.isPlaying(), document.hidden));
    };
    const refreshAndSchedule = (): void => {
      if (stopped) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      refresh();
      schedule();
    };
    Spicetify.Player.addEventListener("songchange", refreshAndSchedule);
    Spicetify.Player.addEventListener("onplaypause", refreshAndSchedule);
    document.addEventListener("visibilitychange", refreshAndSchedule);
    refreshAndSchedule();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      Spicetify.Player.removeEventListener("songchange", refreshAndSchedule);
      Spicetify.Player.removeEventListener("onplaypause", refreshAndSchedule);
      document.removeEventListener("visibilitychange", refreshAndSchedule);
    };
  }, []);
  // Beim nächsten Song keinen alten Favoriten-Hinweis stehen lassen.
  ReactRuntime.useEffect(() => setMessage(""), [track?.uri]);

  // Navigation ist eine Prop vom App-Router; kein Umweg über URL oder History.
  const shortcuts: Array<{ id: FeatureId; icon: string; title: string; description: string }> = [
    { id: "favorites", icon: "☆", title: t("feature.favorites"), description: t("dashboard.actionFavorites") },
    { id: "playlist-tools", icon: "≡", title: t("feature.playlist-tools"), description: t("dashboard.actionQueue") },
    { id: "visualizer", icon: "◉", title: t("feature.visualizer"), description: t("dashboard.actionVisualizer") },
    { id: "theme-studio", icon: "◐", title: t("feature.theme-studio"), description: t("dashboard.actionTheme") },
  ];

  return <section className="zukato-dashboard">
    <div className="zukato-dashboard__intro">
      <div>
        <p className="zukato-eyebrow">{t("dashboard.welcomeLabel")}</p>
        <h3>{t("dashboard.welcome")}</h3>
        <p>{t("dashboard.description")}</p>
      </div>
      <span className="zukato-dashboard__indicator">● {playing ? t("dashboard.playing") : t("dashboard.idle")}</span>
    </div>

    <div className="zukato-dashboard__main">
      <section className="zukato-dashboard__now" aria-label={t("dashboard.nowPlaying")}>
        <p className="zukato-eyebrow">{t("dashboard.nowPlaying")}</p>
        <div className="zukato-dashboard__cover" aria-hidden="true">
          {cover ? <img src={cover} alt="" loading="lazy" /> : <span>♫</span>}
        </div>
        <div className="zukato-dashboard__now-details">
          <h3>{track?.title ?? t("dashboard.noTrack")}</h3>
          <p>{track?.artist ?? t("dashboard.noTrackHelp")}</p>
          {track?.album && <small>{track.album}</small>}
        </div>
        <div className="zukato-dashboard__timeline" aria-label={t("dashboard.progress")}>
          <div className="zukato-dashboard__progress" role="progressbar" aria-valuemin={0}
            aria-valuemax={100} aria-valuenow={Math.round(position.percent)} aria-label={t("dashboard.progress")}>
            <div style={{ width: `${position.percent}%` }} />
          </div>
          <div className="zukato-dashboard__times"><span>{position.elapsed}</span><span>{position.total}</span></div>
        </div>
        <div className="zukato-dashboard__controls">
          <button type="button" className="zukato-primary" onClick={() => Spicetify.Player.togglePlay()}>
            {playing ? t("dashboard.pause") : t("dashboard.resume")}
          </button>
          <button type="button" onClick={() => Spicetify.Player.next()} aria-label={t("dashboard.next")}>{t("dashboard.next")}</button>
          <button type="button" onClick={onOpenQuick}>{t("quick.open")}</button>
          <button type="button" disabled={!track} aria-pressed={isFavorite} onClick={() => {
            if (track) {
              toggleFavorite(track);
              setMessage(isFavorite ? t("dashboard.removedFavorite") : t("dashboard.savedFavorite"));
            }
          }}>{isFavorite ? t("dashboard.removeFavorite") : t("dashboard.saveFavorite")}</button>
        </div>
        {message && <p className="zukato-dashboard__feedback" role="status">{message}</p>}
      </section>
      <section className="zukato-dashboard__shortcuts" aria-labelledby="dashboard-shortcuts-heading">
        <h3 id="dashboard-shortcuts-heading">{t("dashboard.quickAccess")}</h3>
        <p>{t("dashboard.quickAccessHelp")}</p>
        <div className="zukato-dashboard__shortcut-grid">
          {shortcuts.filter((item) => visible.has(item.id)).map((item) =>
            <button type="button" key={item.id} className="zukato-dashboard__shortcut" onClick={() => onNavigate(item.id)}>
              <span className="zukato-dashboard__shortcut-icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
              <span className="zukato-dashboard__shortcut-arrow" aria-hidden="true">↗</span>
            </button>)}
        </div>
        <button className="zukato-dashboard__search-link" type="button" onClick={onOpenQuick}>
          {t("dashboard.findSong")} →
        </button>
      </section>
    </div>

    <div className="zukato-dashboard__stats" aria-label={t("dashboard.statsHeading")}>
      <div><strong>{summary.changes}</strong><span>{t("stats.changes")}</span></div>
      <div><strong>{summary.distinct}</strong><span>{t("stats.unique")}</span></div>
      <div><strong>{favorites.length}</strong><span>{t("stats.favorites")}</span></div>
      <div><strong>{notes.length}</strong><span>{t("stats.notes")}</span></div>
    </div>

    <div className="zukato-dashboard__bottom">
      <section className="zukato-dashboard__recent">
        <div className="zukato-dashboard__section-header">
          <h3>{t("dashboard.recent")}</h3>
          {visible.has("listening-history") && <button type="button" onClick={() => onNavigate("listening-history")}>{t("dashboard.viewAll")}</button>}
        </div>
        <TrackList playLabel={t("common.play")} tracks={summary.latest} emptyText={t("dashboard.emptyHistory")} />
      </section>
      <aside className="zukato-dashboard__insights">
        <h3>{t("dashboard.yourWorkspace")}</h3>
        <p>{t("dashboard.topArtist")}</p>
        <strong>{summary.topArtist ?? t("dashboard.notYet")}</strong>
        <div className="zukato-dashboard__module-status">
          <span>{t("dashboard.workspaceModules")}: {getEnabledFeaturesBySurface("custom-app", features).length}</span>
          <span>{t("dashboard.extensionModules")}: {getEnabledFeaturesBySurface("extension", features).length}</span>
        </div>
        <button type="button" onClick={() => onNavigate("settings")}>{t("dashboard.openSettings")} →</button>
      </aside>
    </div>
  </section>;
}
