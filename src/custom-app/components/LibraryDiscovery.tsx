// =============================================================================
// Datei: src/custom-app/components/LibraryDiscovery.tsx
// Zweck: Intelligente, lokal berechnete Wiederentdeckungs-Liste.
// Alle Schreibaktionen laufen ausschließlich über die bestehenden, geprüften
// Bulk-Aktionen (Favoriten / Warteschlange / Spotify-Playlist mit Bestätigung).
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../shared/i18n";
import type { HistoryEntry, TrackInfo } from "../../shared/library";
import { discoverLibraryTracks, type DiscoveryOrder } from "../../shared/library-discovery";
import { collectionPage, filterCollection } from "../../shared/collection-view";
import { toggleTrackSelection } from "../../shared/bulk-selection";
import { BulkTrackActions } from "./BulkTrackActions";
import { TrackList } from "./TrackList";

const ReactRuntime = Spicetify.React as typeof import("react");
const PAGE_SIZE = 20;

export function LibraryDiscovery({ history, favorites, t }: {
  history: readonly HistoryEntry[];
  favorites: readonly TrackInfo[];
  t: Translator;
}): ReactElement {
  const [order, setOrder] = ReactRuntime.useState<DiscoveryOrder>("frequent");
  const [minimum, setMinimum] = ReactRuntime.useState(2);
  const [onlyUnfavorited, setOnlyUnfavorited] = ReactRuntime.useState(true);
  const [query, setQuery] = ReactRuntime.useState("");
  const [requestedPage, setRequestedPage] = ReactRuntime.useState(0);
  const [selectedUris, setSelectedUris] = ReactRuntime.useState<Set<string>>(() => new Set());

  // Getrennt vom 7-/30-Tage-Statistikfilter: Wiederentdecken verwendet immer
  // alle maximal 500 lokal verfügbaren Historieneinträge.
  const candidates = ReactRuntime.useMemo(() => discoverLibraryTracks(
    history, favorites, order, minimum, onlyUnfavorited,
  ), [history, favorites, order, minimum, onlyUnfavorited]);
  const filtered = filterCollection(candidates, query);
  const view = collectionPage(candidates, query, requestedPage, PAGE_SIZE);
  ReactRuntime.useEffect(() => {
    if (view.page !== requestedPage) setRequestedPage(view.page);
  }, [view.page, requestedPage]);

  function resetSelection(): void {
    setSelectedUris(new Set());
    setRequestedPage(0);
  }

  return <section className="zukato-discovery" aria-label={t("discovery.heading")}>
    <div className="zukato-discovery__header">
      <div><h3>{t("discovery.heading")}</h3><p>{t("discovery.intro")}</p></div>
      <strong aria-live="polite">{t("discovery.count", { count: view.total })}</strong>
    </div>
    <div className="zukato-discovery__filters">
      <label>{t("discovery.order")}
        <select value={order} onChange={(event) => {
          setOrder(event.currentTarget.value as DiscoveryOrder); resetSelection();
        }}>
          <option value="frequent">{t("discovery.frequent")}</option>
          <option value="missed">{t("discovery.missed")}</option>
        </select>
      </label>
      <label>{t("discovery.minimum")}
        <select value={minimum} onChange={(event) => {
          setMinimum(Number(event.currentTarget.value)); resetSelection();
        }}>
          <option value={1}>1</option><option value={2}>2</option>
          <option value={3}>3</option><option value={5}>5</option>
        </select>
      </label>
      <label>{t("discovery.search")}
        <input type="search" value={query} onChange={(event) => {
          setQuery(event.currentTarget.value); resetSelection();
        }} placeholder={t("discovery.searchPlaceholder")} />
      </label>
      <label className="zukato-discovery__checkbox">
        <input type="checkbox" checked={onlyUnfavorited} onChange={(event) => {
          setOnlyUnfavorited(event.currentTarget.checked); resetSelection();
        }} /> {t("discovery.onlyMissing")}
      </label>
    </div>
    <p className="zukato-discovery__hint">{t("discovery.hint")}</p>
    {filtered.length > 0 && <BulkTrackActions t={t}
      sourceTracks={candidates} filteredTracks={filtered} pageTracks={view.items}
      selectedUris={selectedUris} onSelectionChange={setSelectedUris} mode="history" />}
    <TrackList playLabel={t("common.play")} tracks={view.items}
      emptyText={t("discovery.empty")}
      details={(track) => {
        const item = candidates.find((candidate) => candidate.uri === track.uri);
        return item ? t("discovery.details", { count: item.count,
          date: new Date(item.lastPlayedAt).toLocaleDateString(t("stats.dateLocale")) }) : "";
      }}
      selectedUris={selectedUris} selectLabel={t("bulk.selectTrack")}
      onSelectionChange={(uri, selected) => setSelectedUris((previous) => toggleTrackSelection(previous, uri, selected))} />
    {view.pages > 1 && <nav className="zukato-collection__pages" aria-label={t("collection.pagesLabel")}>
      <button type="button" disabled={view.page === 0}
        onClick={() => setRequestedPage(view.page - 1)}>{t("collection.previous")}</button>
      <span aria-live="polite">{t("collection.page", { page: view.page + 1, pages: view.pages })}</span>
      <button type="button" disabled={view.page === view.pages - 1}
        onClick={() => setRequestedPage(view.page + 1)}>{t("collection.next")}</button>
    </nav>}
  </section>;
}
