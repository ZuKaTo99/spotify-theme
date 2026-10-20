// =============================================================================
// Datei: src/custom-app/modules/favorites/Favorites.tsx
// Zweck: Lokale Favoriten verwalten, suchen und in übersichtlichen Seiten zeigen.
// Änderungen an Suchtext oder Seitenindex verändern nie die gespeicherten Daten.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { addFavorite, currentTrack, toggleFavorite } from "../../../shared/library";
import { collectionPage } from "../../../shared/collection-view";
import { TrackList } from "../../components/TrackList";
import { TrackSearch } from "../../components/TrackSearch";
import { useToolkitData } from "../../hooks/useToolkitData";

const ReactRuntime = Spicetify.React as typeof import("react");

export function Favorites({ t }: { t: Translator }): ReactElement {
  const { favorites } = useToolkitData();
  const [filter, setFilter] = ReactRuntime.useState("");
  const [requestedPage, setRequestedPage] = ReactRuntime.useState(0);
  // Eine durch Löschungen veraltete Seitennummer wird sofort geklemmt.
  const view = collectionPage(favorites, filter, requestedPage);
  // Bei verkleinerter Sammlung den korrigierten Seitenindex im React-State
  // sichern, damit späteres Hinzufügen nicht plötzlich auf alte Seiten springt.
  ReactRuntime.useEffect(() => {
    if (requestedPage !== view.page) setRequestedPage(view.page);
  }, [requestedPage, view.page]);
  return <section className="zukato-panel">
    <p>{t("favorites.intro")}</p>
    <div className="zukato-toolbar"><span>{t("favorites.count", { count: favorites.length })}</span>
      <button type="button" onClick={() => {
        const track = currentTrack();
        if (track) toggleFavorite(track);
        else Spicetify.showNotification(t("playlist.noCurrent"), true);
      }}>{t("favorites.toggle")}</button>
    </div>
    <TrackSearch t={t} actionLabel={t("search.favorite")} onChoose={(track) => {
      // Idempotent: ein zweiter Klick oder veralteter View darf nie entfernen.
      const added = addFavorite(track);
      Spicetify.showNotification(t(added ? "search.saved" : "search.alreadyFavorite"));
    }} />
    {favorites.length > 0 && <div className="zukato-collection__filter">
      <label htmlFor="zukato-favorites-filter">{t("collection.filter")}</label>
      <input id="zukato-favorites-filter" type="search" maxLength={150} value={filter}
        placeholder={t("collection.placeholder")}
        onChange={(event) => { setFilter(event.currentTarget.value); setRequestedPage(0); }} />
      <small aria-live="polite">{t("collection.results", { count: view.total })}</small>
    </div>}
    <TrackList playLabel={t("common.play")} tracks={view.items}
      emptyText={favorites.length ? t("collection.noResults") : t("favorites.empty")}
      action={toggleFavorite} actionLabel={t("common.remove")} />
    {view.pages > 1 && <nav className="zukato-collection__pages" aria-label={t("collection.pagesLabel")}>
      <button type="button" disabled={view.page === 0}
        onClick={() => setRequestedPage(view.page - 1)}>{t("collection.previous")}</button>
      <span aria-live="polite">{t("collection.page", { page: view.page + 1, pages: view.pages })}</span>
      <button type="button" disabled={view.page >= view.pages - 1}
        onClick={() => setRequestedPage(view.page + 1)}>{t("collection.next")}</button>
    </nav>}
  </section>;
}
