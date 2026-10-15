// =============================================================================
// Datei: src/custom-app/modules/listening-history/ListeningHistory.tsx
// Zweck: Lokaler Verlauf der von der ZuKaTo-Extension beobachteten Titelwechsel.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { changeLibrary, toggleFavorite } from "../../../shared/library";
import { TrackList } from "../../components/TrackList";
import { useToolkitData } from "../../hooks/useToolkitData";

/** Zeigt die letzten 100 Einträge; keine Behauptung über die Spotify-Gesamthistorie. */
export function ListeningHistory({ t }: { t: Translator }): ReactElement {
  const { history } = useToolkitData();
  return <section className="zukato-panel">
    <p>{t("history.intro")}</p>
    <div className="zukato-toolbar">
      <span>{t("history.count", { count: history.length })}</span>
      <button type="button" disabled={!history.length} onClick={() => {
        if (window.confirm(t("history.confirm"))) changeLibrary((db) => ({ ...db, history: [] }));
      }}>{t("history.clear")}</button>
    </div>
    <TrackList tracks={history.slice(0, 100)} emptyText={t("history.empty")}
      action={toggleFavorite} actionLabel={t("history.remember")}
      details={(_, index) => new Date(history[index].playedAt).toLocaleString()} />
  </section>;
}
