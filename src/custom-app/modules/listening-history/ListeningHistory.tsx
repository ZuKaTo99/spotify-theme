// =============================================================================
// Datei: src/custom-app/modules/listening-history/ListeningHistory.tsx
// Zweck: Alle lokal gespeicherten Titelwechsel erreichbar und durchsuchbar.
// Lokale Suche ohne Spotify-API; 40 statt bis zu 500 DOM-Zeilen gleichzeitig.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { addFavorite, changeLibrary } from "../../../shared/library";
import { collectionPage, filterCollection } from "../../../shared/collection-view";
import { toggleTrackSelection } from "../../../shared/bulk-selection";
import { BulkTrackActions } from "../../components/BulkTrackActions";
import { TrackList } from "../../components/TrackList";
import { useToolkitData } from "../../hooks/useToolkitData";

const ReactRuntime = Spicetify.React as typeof import("react");

export function ListeningHistory({ t }: { t: Translator }): ReactElement {
  const { history } = useToolkitData();
  const [filter, setFilter] = ReactRuntime.useState("");
  const [requestedPage, setRequestedPage] = ReactRuntime.useState(0);
  // Auswahl ist nur UI-State, wird nie in der lokalen Bibliothek gespeichert.
  // React-Updates erzeugen stets ein neues Set (kein Mutieren des alten State).
  const [selectedUris, setSelectedUris] = ReactRuntime.useState<Set<string>>(() => new Set());
  const filteredTracks = filterCollection(history, filter);
  const view = collectionPage(history, filter, requestedPage);
  // Bei verkleinerter Sammlung den korrigierten Seitenindex im React-State
  // sichern, damit späteres Hinzufügen nicht plötzlich auf alte Seiten springt.
  ReactRuntime.useEffect(() => {
    if (requestedPage !== view.page) setRequestedPage(view.page);
  }, [requestedPage, view.page]);
  return <section className="zukato-panel">
    <p>{t("history.intro")}</p>
    <div className="zukato-toolbar">
      <span>{t("history.count", { count: history.length })}</span>
      <button type="button" disabled={!history.length} onClick={() => {
        if (window.confirm(t("history.confirm"))) {
          try {
            changeLibrary((db) => ({ ...db, history: [] }));
            setRequestedPage(0);
          } catch (error) {
            console.error("[ZuKaTo] Hörverlauf konnte nicht gelöscht werden", error);
            Spicetify.showNotification(t("library.actionFailed"), true);
          }
        }
      }}>{t("history.clear")}</button>
    </div>
    {history.length > 0 && <div className="zukato-collection__filter">
      <label htmlFor="zukato-history-filter">{t("collection.filter")}</label>
      <input id="zukato-history-filter" type="search" maxLength={150} value={filter}
        placeholder={t("collection.placeholder")}
        onChange={(event) => {
          setFilter(event.currentTarget.value);
          setRequestedPage(0);
          setSelectedUris(new Set()); // Keine versteckte Auswahl aus altem Filter.
        }} />
      <small aria-live="polite">{t("collection.results", { count: view.total })}</small>
    </div>}
    {history.length > 0 && <BulkTrackActions t={t} sourceTracks={history}
      filteredTracks={filteredTracks} pageTracks={view.items} mode="history"
      selectedUris={selectedUris} onSelectionChange={setSelectedUris} />}
    <TrackList playLabel={t("common.play")} tracks={view.items}
      emptyText={history.length ? t("collection.noResults") : t("history.empty")}
      // „Merken“ darf einen vorhandenen Favoriten niemals wieder entfernen.
      action={addFavorite} actionLabel={t("history.remember")}
      actionErrorLabel={t("library.actionFailed")}
      details={(_, index) => new Date(view.items[index].playedAt).toLocaleString()}
      selectedUris={selectedUris} selectLabel={t("bulk.selectTrack")}
      onSelectionChange={(uri, checked) => setSelectedUris((before) => toggleTrackSelection(before, uri, checked))} />
    {view.pages > 1 && <nav className="zukato-collection__pages" aria-label={t("collection.pagesLabel")}>
      <button type="button" disabled={view.page === 0}
        onClick={() => setRequestedPage(view.page - 1)}>{t("collection.previous")}</button>
      <span aria-live="polite">{t("collection.page", { page: view.page + 1, pages: view.pages })}</span>
      <button type="button" disabled={view.page >= view.pages - 1}
        onClick={() => setRequestedPage(view.page + 1)}>{t("collection.next")}</button>
    </nav>}
  </section>;
}
