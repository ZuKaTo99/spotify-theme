// =============================================================================
// Datei: src/custom-app/modules/favorites/Favorites.tsx
// Zweck: Verwaltung lokaler ZuKaTo-Lesezeichen, unabhängig von Spotify-Likes.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { currentTrack, toggleFavorite } from "../../../shared/library";
import { TrackList } from "../../components/TrackList";
import { useToolkitData } from "../../hooks/useToolkitData";

export function Favorites({ t }: { t: Translator }): ReactElement {
  const { favorites } = useToolkitData();
  return <section className="zukato-panel">
    <p>{t("favorites.intro")}</p>
    <div className="zukato-toolbar"><span>{t("favorites.count", { count: favorites.length })}</span>
      <button type="button" onClick={() => {
        const track = currentTrack();
        if (track) toggleFavorite(track);
        else Spicetify.showNotification(t("playlist.noCurrent"), true);
      }}>{t("favorites.toggle")}</button>
    </div>
    <TrackList tracks={favorites} emptyText={t("favorites.empty")} action={toggleFavorite} actionLabel={t("common.remove")} />
  </section>;
}
