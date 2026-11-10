// =============================================================================
// Datei: src/custom-app/modules/dashboard/Dashboard.tsx
// Zweck: Neue Workspace-Startseite mit Jetzt-läuft-Bereich, Aktionen, Verlauf
//        und verständlichen Kennzahlen statt einer nackten Modulliste.
// Änderungen am Layout gehören hierher; Zahlenberechnung: dashboard-summary.ts.
// =============================================================================
import type { CSSProperties, ReactElement } from "react";
import type { FeaturePreferences } from "../../../shared/feature-preferences";
import type { FeatureId } from "../../../shared/features";
import { getEnabledFeaturesBySurface } from "../../../shared/features";
import { getFeatureTitle } from "../../../shared/feature-titles";
import { DASHBOARD_SECTIONS, DASHBOARD_SHORTCUT_IDS, DASHBOARD_SHORTCUT_LIMIT,
  defaultDashboardPreferences, moveDashboardShortcut, moveDashboardCard, readDashboardPreferences,
  rememberDashboardPreferences, setDashboardPeriod, toggleDashboardSection,
  toggleDashboardShortcut, type DashboardPreferences, type DashboardSection } from "../../../shared/dashboard-preferences";
import type { Translator } from "../../../shared/i18n";
import { currentTrack, toggleFavorite, type TrackInfo } from "../../../shared/library";
import { summarizeDashboard } from "../../../shared/dashboard-summary";
import { analyzeListeningHistory } from "../../../shared/listening-insights";
import { ListeningLandscape } from "../../components/ListeningLandscape";
import { spotifyArtworkUrl } from "../../../shared/artwork";
import { normalizedPlayerProgress, type PlayerProgress } from "../../../shared/player-progress";
import { useToolkitData } from "../../hooks/useToolkitData";
import { TrackList } from "../../components/TrackList";
import { dashboardProgressDelayMs, sameDashboardProgress } from "./dashboard-polling";

const ReactRuntime = Spicetify.React as typeof import("react");
const RHYTHM_BARS = Array.from({ length: 38 }, (_, index) =>
  Math.round(16 + 58 * Math.abs(Math.sin(index * .57) * Math.cos(index * .21 + 1))));

interface DashboardProps {
  features: FeaturePreferences;
  t: Translator;
  onNavigate: (featureId: FeatureId) => void;
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
export function Dashboard({ features, t, onNavigate }: DashboardProps): ReactElement {
  const { history, favorites, notes } = useToolkitData();
  const { track, playing, cover } = useNowPlaying();
  const summary = ReactRuntime.useMemo(() => summarizeDashboard(history), [history]);
  // Dieselbe reine 7-Tage-Auswertung wie in der Statistikansicht: keine
  // erfundenen Hörminuten und keine zusätzliche API-Abfrage.
  const insights = ReactRuntime.useMemo(() => analyzeListeningHistory(history, "7d"), [history]);
  // Individuelle Dashboard-Einstellungen dürfen bei schnellem Klicken nie verloren gehen.
  const [preferences, setPreferences] = ReactRuntime.useState<DashboardPreferences>(readDashboardPreferences);
  const preferencesRef = ReactRuntime.useRef(preferences);
  const [customizing, setCustomizing] = ReactRuntime.useState(false);
  const personalInsights = ReactRuntime.useMemo(() =>
    analyzeListeningHistory(history, preferences.period), [history, preferences.period]);
  function changePreferences(next: (current: DashboardPreferences) => DashboardPreferences): void {
    const updated = next(preferencesRef.current);
    preferencesRef.current = updated;
    setPreferences(updated);
    rememberDashboardPreferences(updated);
  }
  const sectionVisible = (id: DashboardSection): boolean =>
    !preferences.hiddenSections.includes(id);
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

  // Einmalige technische IDs: Titel (inklusive Nutzerüberschreibungen) kommen
  // aus derselben Registry wie die globale Workspace-Navigation.
  const shortcutIcons: Partial<Record<FeatureId, string>> = {
    "favorites": "☆", "playlist-tools": "≡", "visualizer": "◉", "theme-studio": "◐",
    "statistics": "▥", "listening-history": "◷", "song-notes": "✎", "settings": "⚙",
  };
  const shortcutDescriptions: Partial<Record<FeatureId, string>> = {
    "favorites": t("dashboard.actionFavorites"),
    "playlist-tools": t("dashboard.actionQueue"),
    "visualizer": t("dashboard.actionVisualizer"),
    "theme-studio": t("dashboard.actionTheme"),
    "statistics": t("dashboard.actionStatistics"),
    "listening-history": t("dashboard.actionHistory"),
    "song-notes": t("dashboard.actionNotes"),
    "settings": t("dashboard.actionSettings"),
  };
  const shortcutTitle = (id: FeatureId): string => id === "visualizer" &&
    !features[id].customTitle ? "Visualizer" : getFeatureTitle(id, features[id].customTitle, t);
  const shortcuts = preferences.shortcuts.filter((id) => visible.has(id));
  const availableShortcuts = DASHBOARD_SHORTCUT_IDS.filter((id) => visible.has(id) && !preferences.shortcuts.includes(id));
  const durationMs = Math.max(0, Spicetify.Player.getDuration() || 0);

  return <section className="zukato-dashboard">
    <div className="zukato-dashboard__ambient" aria-hidden="true">
      {cover && <img src={cover} alt="" />}
    </div>
    {/* Der Modultitel steht bereits im gemeinsamen Seitenkopf. Die Karten
        beginnen sofort mit Musik und Aktionen statt einer zweiten Begrüßung. */}
    <div className="zukato-dashboard__main">
      <section className={`zukato-dashboard__now${playing ? " is-playing" : ""}`} data-layout="orbit"
        aria-label={t("dashboard.nowPlaying")}>
        <div className="zukato-dashboard__art-backdrop" aria-hidden="true">
          {cover && <img src={cover} alt="" />}
        </div>
        <div className="zukato-dashboard__rhythm" aria-hidden="true">
          {RHYTHM_BARS.map((height, index) => <i key={index}
            style={{ height: `${height}%`, animationDelay: `-${index * 83}ms` }} />)}
        </div>
        <div className="zukato-dashboard__now-copy">
          <p className="zukato-eyebrow"><span className="zukato-dashboard__equalizer" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </span>{t("dashboard.nowPlaying")}</p>
          <div className="zukato-dashboard__now-details">
            <h3>{track?.title ?? t("dashboard.noTrack")}</h3>
            <p>{track?.artist ?? t("dashboard.noTrackHelp")}</p>
            {track?.album && track.album !== track.title && <small>{track.album}</small>}
          </div>
          <div className="zukato-dashboard__controls" role="group" aria-label={t("dashboard.nowPlaying")}>
            <button type="button" className="zukato-dashboard__control" onClick={() => Spicetify.Player.back()}
              title={t("shortcuts.previousTrack")} aria-label={t("shortcuts.previousTrack")}>⏮</button>
            <button type="button" className="zukato-dashboard__control zukato-dashboard__control--play"
              onClick={() => Spicetify.Player.togglePlay()}
              title={playing ? t("dashboard.pause") : t("dashboard.resume")}
              aria-label={playing ? t("dashboard.pause") : t("dashboard.resume")}>{playing ? "Ⅱ" : "▶"}</button>
            <button type="button" className="zukato-dashboard__control" onClick={() => Spicetify.Player.next()}
              title={t("dashboard.next")} aria-label={t("dashboard.next")}>⏭</button>
            <button type="button" className="zukato-dashboard__control zukato-dashboard__control--favorite"
              disabled={!track} aria-pressed={isFavorite}
              title={isFavorite ? t("dashboard.removeFavorite") : t("dashboard.saveFavorite")}
              aria-label={isFavorite ? t("dashboard.removeFavorite") : t("dashboard.saveFavorite")}
              onClick={() => {
                if (!track) return;
                try {
                  const nowFavorite = toggleFavorite(track);
                  setMessage(nowFavorite ? t("dashboard.savedFavorite") : t("dashboard.removedFavorite"));
                } catch (error) {
                  console.error("[ZuKaTo] Dashboard-Favorit konnte nicht gespeichert werden", error);
                  setMessage(t("library.actionFailed"));
                }
              }}>{isFavorite ? "★" : "☆"}</button>
            {visible.has("visualizer") && <button type="button" className="zukato-dashboard__control zukato-dashboard__control--visualizer"
              onClick={() => onNavigate("visualizer")} title={t("dashboard.actionVisualizer")}
              aria-label={t("dashboard.actionVisualizer")}>◉</button>}
          </div>
          <div className="zukato-dashboard__timeline">
            <input type="range" className="zukato-dashboard__seek" min={0}
              max={Math.max(1, durationMs)} step={1000}
              value={Math.round(durationMs * position.percent / 100)}
              disabled={!track || durationMs <= 0}
              style={{ "--zukato-progress": `${position.percent}%` } as CSSProperties}
              aria-label={t("dashboard.progress")} aria-valuetext={position.elapsed}
              onChange={(event) => {
                const progress = Number(event.currentTarget.value);
                Spicetify.Player.seek(progress);
                setPosition(normalizedPlayerProgress(progress, durationMs));
              }} />
            <div className="zukato-dashboard__times"><span>{position.elapsed}</span><span>{position.total}</span></div>
          </div>
          {message && <p className="zukato-dashboard__feedback" role="status">{message}</p>}
        </div>
        <div className="zukato-dashboard__orbit" aria-hidden="true">
          <div className="zukato-dashboard__orbit-halo" />
          <svg viewBox="0 0 320 320" className="zukato-dashboard__orbit-progress">
            <defs><linearGradient id="zukato-dashboard-orbit-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="color-mix(in srgb, var(--zukato-accent) 55%, white)" />
              <stop offset="48%" stopColor="var(--zukato-accent)" />
              <stop offset="100%" stopColor="color-mix(in srgb, var(--zukato-accent) 55%, #7acbff)" />
            </linearGradient></defs>
            <circle className="zukato-dashboard__orbit-track" cx="160" cy="160" r="145" />
            <circle className="zukato-dashboard__orbit-value" cx="160" cy="160" r="145" pathLength="100"
              strokeDasharray={`${position.percent} 100`} />
          </svg>
          <div className="zukato-dashboard__cover">
            {cover ? <img src={cover} alt="" /> : <span>♫</span>}
          </div>
          <span className="zukato-dashboard__orbit-dot" />
        </div>
      </section>
      <section className="zukato-dashboard__shortcuts" aria-labelledby="dashboard-shortcuts-heading">
        <div className="zukato-dashboard__shortcut-header">
          <h3 id="dashboard-shortcuts-heading">{t("dashboard.quickAccess")}</h3>
          <button type="button" aria-expanded={customizing} aria-controls="zukato-dashboard-editor"
            onClick={() => setCustomizing((open) => !open)}>{customizing ? t("dashboard.done") : t("dashboard.customize")}</button>
        </div>
        <div className="zukato-dashboard__shortcut-grid">
          {shortcuts.map((id) => <button type="button" key={id} className="zukato-dashboard__shortcut"
            title={shortcutDescriptions[id]} onClick={() => onNavigate(id)}>
            <span className="zukato-dashboard__shortcut-icon" aria-hidden="true">{shortcutIcons[id]}</span>
            <strong>{shortcutTitle(id)}</strong>
            <span className="zukato-dashboard__shortcut-arrow" aria-hidden="true">↗</span>
          </button>)}
          {shortcuts.length === 0 && <p className="zukato-empty">{t("dashboard.noShortcuts")}</p>}
        </div>
        {customizing && <div id="zukato-dashboard-editor" className="zukato-dashboard__editor">
          <h4>{t("dashboard.editShortcuts")}</h4>
          <div className="zukato-dashboard__editor-list">
            {preferences.shortcuts.map((id, index) => <div className="zukato-dashboard__editor-row" key={id}>
              <span>{shortcutTitle(id)}</span>
              <div>
                <button type="button" disabled={index === 0} aria-label={t("dashboard.moveUp", { title: shortcutTitle(id) })}
                  onClick={() => changePreferences((previous) => moveDashboardShortcut(previous, id, -1))}>↑</button>
                <button type="button" disabled={index === preferences.shortcuts.length - 1}
                  aria-label={t("dashboard.moveDown", { title: shortcutTitle(id) })}
                  onClick={() => changePreferences((previous) => moveDashboardShortcut(previous, id, 1))}>↓</button>
                <button type="button" aria-label={t("dashboard.removeShortcut", { title: shortcutTitle(id) })}
                  onClick={() => changePreferences((previous) => toggleDashboardShortcut(previous, id))}>×</button>
              </div>
            </div>)}
          </div>
          <h4>{t("dashboard.addShortcut")}</h4>
          <div className="zukato-dashboard__add-shortcuts">
            {availableShortcuts.map((id) => <button type="button" key={id}
              disabled={preferences.shortcuts.length >= DASHBOARD_SHORTCUT_LIMIT}
              onClick={() => changePreferences((previous) => toggleDashboardShortcut(previous, id))}>+ {shortcutTitle(id)}</button>)}
            {availableShortcuts.length === 0 && <small>{t("dashboard.allShortcutsAdded")}</small>}
          </div>
          <h4>{t("dashboard.cardOrder")}</h4>
          <div className="zukato-dashboard__section-toggles">
            {preferences.cardOrder.map((id, index) => <div className="zukato-dashboard__editor-row" key={id}>
              <label>
                <input type="checkbox" checked={sectionVisible(id)}
                  onChange={() => changePreferences((previous) => toggleDashboardSection(previous, id))}/>
                {t(`dashboard.section.${id}`)}
              </label>
              <div>
                <button type="button" disabled={index === 0}
                  aria-label={t("dashboard.moveUp", { title: t(`dashboard.section.${id}`) })}
                  onClick={() => changePreferences((previous) => moveDashboardCard(previous, id, -1))}>↑</button>
                <button type="button" disabled={index === preferences.cardOrder.length - 1}
                  aria-label={t("dashboard.moveDown", { title: t(`dashboard.section.${id}`) })}
                  onClick={() => changePreferences((previous) => moveDashboardCard(previous, id, 1))}>↓</button>
              </div>
            </div>)}
          </div>
          <button type="button" className="zukato-dashboard__reset"
            onClick={() => changePreferences(() => defaultDashboardPreferences())}>{t("dashboard.reset")}</button>
        </div>}
      </section>
    </div>

    {personalInsights.artists.length > 0 && <section className="zukato-dashboard__artist-deck"
      aria-label={t("stats.artists")}>
      <div className="zukato-dashboard__artist-deck-heading">
        <h3>{t("stats.artists")}</h3>
        <span>{t(`stats.period.${preferences.period}`)}</span>
      </div>
      <div className="zukato-dashboard__artist-deck-grid">
        {personalInsights.artists.slice(0, 3).map((artist, index) => <div
          className="zukato-dashboard__artist-tile" key={artist.name}
          aria-label={`${artist.name}: ${artist.count} ${t("stats.changes")}`}>
          <span className="zukato-dashboard__artist-rank" aria-hidden="true">0{index + 1}</span>
          <strong>{artist.name}</strong>
          <small>{artist.count} ×</small>
        </div>)}
      </div>
    </section>}

    {/* Karten verwenden eine gemeinsame Reihenfolge aus dem lokalen Speicher.
        Ein deaktiviertes Modul darf über Vorschaukarten nicht zugänglich sein. */}
    <div className="zukato-dashboard__cards" aria-label={t("dashboard.cardOrder")}>
      {preferences.cardOrder.filter((id) => sectionVisible(id) &&
        (id !== "favorites" || visible.has("favorites")) &&
        (id !== "notes" || visible.has("song-notes"))).map((id) => {
        switch (id) {
          case "stats": return <section key={id} className="zukato-dashboard__card zukato-dashboard__metrics">
            <div className="zukato-dashboard__stats-heading">
              <h3>{t("dashboard.statsHeading")}</h3>
              <div className="zukato-statistics__periods" role="group" aria-label={t("stats.period")}>
                {(["7d", "30d", "all"] as const).map((period) => <button type="button" key={period}
                  aria-pressed={preferences.period === period} className={preferences.period === period ? "is-active" : ""}
                  onClick={() => changePreferences((previous) => setDashboardPeriod(previous, period))}>
                  {t(`stats.period.${period}`)}</button>)}
              </div>
            </div>
            <div className="zukato-dashboard__stats" aria-label={t("dashboard.statsHeading")}>
              <div><strong>{personalInsights.events}</strong><span>{t("stats.changes")}</span></div>
              <div><strong>{personalInsights.unique}</strong><span>{t("stats.unique")}</span></div>
              <div><strong>{favorites.length}</strong><span>{t("stats.favorites")}</span></div>
              <div><strong>{notes.length}</strong><span>{t("stats.notes")}</span></div>
            </div>
            {/* Separater Schnellzugriff unterhalb der Kennzahlen, nicht als
                fünfte Kennzahlen-Kachel; niemals bei deaktivierter Statistik. */}
            {visible.has("statistics") && <button type="button" className="zukato-discovery__dashboard-link"
              onClick={() => onNavigate("statistics")}>{t("discovery.open")} →</button>}
          </section>;
          case "activity": return <section key={id} className="zukato-dashboard__card zukato-dashboard__activity" aria-labelledby="dashboard-activity-heading">
            <div className="zukato-dashboard__section-header"><div>
              <h3 id="dashboard-activity-heading">{t("stats.activity7")}</h3>
            </div>
              {visible.has("statistics") && <button type="button" onClick={() => onNavigate("statistics")}>{t("dashboard.openStatistics")}</button>}
            </div>
            <ListeningLandscape daily={insights.daily} t={t} />
          </section>;
          case "recent": return <section key={id} className="zukato-dashboard__card zukato-dashboard__recent" data-view="reel">
            <div className="zukato-dashboard__section-header"><h3>{t("dashboard.recent")}</h3>
              {visible.has("listening-history") && <button type="button" onClick={() => onNavigate("listening-history")}>{t("dashboard.viewAll")}</button>}
            </div>
            <TrackList playLabel={t("common.play")} tracks={summary.latest} emptyText={t("dashboard.emptyHistory")} />
          </section>;
          case "overview": return <aside key={id} className="zukato-dashboard__card zukato-dashboard__insights">
            <h3>{t("dashboard.yourWorkspace")}</h3><p>{t("dashboard.topArtist")}</p>
            <strong>{personalInsights.artists[0]?.name ?? t("dashboard.notYet")}</strong>
            <div className="zukato-dashboard__module-status">
              <span>{t("dashboard.workspaceModules")}: {getEnabledFeaturesBySurface("custom-app", features).length}</span>
              <span>{t("dashboard.extensionModules")}: {getEnabledFeaturesBySurface("extension", features).length}</span>
            </div>
            {visible.has("settings") && <button type="button" onClick={() => onNavigate("settings")}>{t("dashboard.openSettings")} →</button>}
          </aside>;
          case "favorites": return <section key={id} className="zukato-dashboard__card zukato-dashboard__recent">
            <div className="zukato-dashboard__section-header"><h3>{t("dashboard.section.favorites")}</h3>
              {visible.has("favorites") && <button type="button" onClick={() => onNavigate("favorites")}>{t("dashboard.openFavorites")}</button>}
            </div>
            <TrackList playLabel={t("common.play")} tracks={favorites.slice(0, 4)} emptyText={t("dashboard.cardFavoritesEmpty")} />
          </section>;
          case "notes": return <section key={id} className="zukato-dashboard__card zukato-dashboard__notes">
            <div className="zukato-dashboard__section-header"><h3>{t("dashboard.section.notes")}</h3>
              {visible.has("song-notes") && <button type="button" onClick={() => onNavigate("song-notes")}>{t("dashboard.openNotes")}</button>}
            </div>
            {notes.length ? <ul className="zukato-dashboard__note-list">
              {[...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4).map((note) => <li key={note.uri}>
                <strong>{note.title}</strong><span>{note.artist}</span><p>{note.text.slice(0, 110)}</p>
              </li>)}
            </ul> : <p className="zukato-empty">{t("dashboard.cardNotesEmpty")}</p>}
          </section>;
        }
      })}
    </div>
  </section>;
}
