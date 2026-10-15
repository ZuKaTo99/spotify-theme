// =============================================================================
// Datei: src/custom-app/modules/statistics/Statistics.tsx
// Zweck: Berechnet lokale Titelwechsel-Statistiken; KEINE Spotify-Streaming-Minuten.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { useToolkitData } from "../../hooks/useToolkitData";

/** Sortiert Frequenzen ohne externe API, aus maximal 500 gespeicherten Ereignissen. */
function ranking(items: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10);
}

export function Statistics({ t }: { t: Translator }): ReactElement {
  const { history, favorites, notes } = useToolkitData();
  const artists = ranking(history.map((entry) => entry.artist));
  const titles = ranking(history.map((entry) => `${entry.title} — ${entry.artist}`));
  return <section className="zukato-panel">
    <p>{t("stats.intro")}</p>
    <div className="zukato-metrics">
      <div><strong>{history.length}</strong><span>{t("stats.changes")}</span></div>
      <div><strong>{new Set(history.map((entry) => entry.uri)).size}</strong><span>{t("stats.unique")}</span></div>
      <div><strong>{favorites.length}</strong><span>{t("stats.favorites")}</span></div>
      <div><strong>{notes.length}</strong><span>{t("stats.notes")}</span></div>
    </div>
    <div className="zukato-columns">
      <div><h3>{t("stats.artists")}</h3><ol>{artists.map(([name, count]) => <li key={name}>{name} <span>({count})</span></li>)}</ol></div>
      <div><h3>{t("stats.tracks")}</h3><ol>{titles.map(([name, count]) => <li key={name}>{name} <span>({count})</span></li>)}</ol></div>
    </div>
    {!history.length && <p className="zukato-empty">{t("stats.empty")}</p>}
  </section>;
}
