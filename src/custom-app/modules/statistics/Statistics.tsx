// =============================================================================
// Datei: src/custom-app/modules/statistics/Statistics.tsx
// Zweck: Interaktive, lokale Musikstatistik mit 7-/30-Tage-/Gesamtfilter.
// Gezählt werden ausschließlich erfasste Songwechsel, keine Hörminuten und
// keine Daten aus Spotifys serverseitigem Hörverlauf.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { analyzeListeningHistory, type InsightsPeriod } from "../../../shared/listening-insights";
import { useToolkitData } from "../../hooks/useToolkitData";
import { ListeningActivity } from "../../components/ListeningActivity";
import { LibraryDiscovery } from "../../components/LibraryDiscovery";

const ReactRuntime = Spicetify.React as typeof import("react");
const PERIODS: readonly InsightsPeriod[] = ["7d", "30d", "all"];

export function Statistics({ t }: { t: Translator }): ReactElement {
  const { history, favorites, notes } = useToolkitData();
  const [period, setPeriod] = ReactRuntime.useState<InsightsPeriod>("30d");
  const insights = ReactRuntime.useMemo(() => analyzeListeningHistory(history, period), [history, period]);
  const topCount = Math.max(1, insights.artists[0]?.count ?? 0, insights.tracks[0]?.count ?? 0);

  return <section className="zukato-panel zukato-statistics">
    <p>{t("stats.intro")}</p>
    <div className="zukato-statistics__periods" role="group" aria-label={t("stats.period")}>
      {PERIODS.map((value) => <button type="button" key={value}
        aria-pressed={period === value} className={period === value ? "is-active" : ""}
        onClick={() => setPeriod(value)}>{t(`stats.period.${value}`)}</button>)}
    </div>
    <div className="zukato-metrics">
      <div><strong>{insights.events}</strong><span>{t("stats.changes")}</span></div>
      <div><strong>{insights.unique}</strong><span>{t("stats.unique")}</span></div>
      <div><strong>{insights.today}</strong><span>{t("stats.today")}</span></div>
      <div><strong>{insights.activeDays}</strong><span>{t("stats.activeDays")}</span></div>
      <div><strong>{favorites.length}</strong><span>{t("stats.favorites")}</span></div>
      <div><strong>{notes.length}</strong><span>{t("stats.notes")}</span></div>
    </div>
    <section className="zukato-statistics__activity" aria-labelledby="statistics-activity-heading">
      <h3 id="statistics-activity-heading">{t("stats.activity7")}</h3>
      <ListeningActivity daily={insights.daily} t={t} />
      <p>{t("stats.activityHint")}</p>
    </section>
    <div className="zukato-columns zukato-statistics__rankings">
      <section><h3>{t("stats.artists")}</h3>
        {insights.artists.length ? <ol>{insights.artists.map(({ name, count }) =>
          <li key={name}><span>{name}</span><strong>{count}</strong>
            <div className="zukato-statistics__ranking-bar" aria-hidden="true"><div style={{ width: `${count / topCount * 100}%` }} /></div>
          </li>)}</ol> : <p className="zukato-empty">{t("stats.emptyPeriod")}</p>}
      </section>
      <section><h3>{t("stats.tracks")}</h3>
        {insights.tracks.length ? <ol>{insights.tracks.map(({ uri, title, artist, count }) =>
          <li key={uri}><span>{title} {artist && <small>— {artist}</small>}</span><strong>{count}</strong>
            <div className="zukato-statistics__ranking-bar" aria-hidden="true"><div style={{ width: `${count / topCount * 100}%` }} /></div>
          </li>)}</ol> : <p className="zukato-empty">{t("stats.emptyPeriod")}</p>}
      </section>
    </div>
    <LibraryDiscovery history={history} favorites={favorites} t={t} />
    {!history.length && <p className="zukato-empty">{t("stats.empty")}</p>}
  </section>;
}
