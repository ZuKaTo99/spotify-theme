// =============================================================================
// Datei: src/extension/modules/context-actions/ContextActionsModule.ts
// Zweck: ZuKaTo-Lesezeichen über Spotifys Kontextmenü hinzufügen/entfernen.
// Wo ändern? Die Spotify-URI-Validierung ist zentral in shared/track-search.ts.
// =============================================================================
import { currentTrack, toggleFavorite, type TrackInfo } from "../../../shared/library";
import { parseSpotifyTrackInput } from "../../../shared/track-search";
import { runtimeText } from "../../../shared/runtime-i18n";
import type { ExtensionModule } from "../ExtensionModule";

let item: Spicetify.ContextMenu.Item | null = null;
let menu: Spicetify.Menu.Item | null = null;

/** Die erste gültige Titel-/Episoden-URI normalisieren, niemals Album/Playlist. */
function selectedTrackUri(uris: string[]): string | null {
  for (const uri of uris) {
    const normalized = parseSpotifyTrackInput(uri);
    if (normalized) return normalized;
  }
  return null;
}

/** URI allein reicht für das Lesezeichen; Metadaten folgen aus laufendem Track. */
function rememberUri(uri: string): void {
  const playing = currentTrack();
  const info: TrackInfo = playing?.uri === uri ? playing : {
    uri, title: "Titel (URI)", artist: "", album: "",
  };
  // Bei Storage-Lesefehlern NICHT mit einer leeren Bibliothek überschreiben.
  // Spotify bekommt eine Fehlermeldung statt eines unhandled Exceptions.
  try {
    const nowFavorite = toggleFavorite(info);
    Spicetify.showNotification(nowFavorite ? runtimeText("runtime.bookmarkAdded") : runtimeText("runtime.bookmarkRemoved"));
  } catch (error) {
    console.error("[ZuKaTo] Kontextmenü-Lesezeichen konnte nicht gespeichert werden", error);
    Spicetify.showNotification(runtimeText("library.actionFailed"), true);
  }
}

export const contextActionsModule: ExtensionModule = {
  id: "context-actions",
  start(): void {
    item = new Spicetify.ContextMenu.Item(
      "ZuKaTo: Lesezeichen umschalten",
      (uris) => {
        const uri = selectedTrackUri(uris);
        if (uri) rememberUri(uri);
      },
      (uris) => selectedTrackUri(uris) !== null,
    );
    item.register();
    menu = new Spicetify.Menu.Item("ZuKaTo: laufenden Titel merken", false, () => {
      const playing = currentTrack();
      if (playing) {
        const uri = parseSpotifyTrackInput(playing.uri);
        if (uri) rememberUri(uri);
        else Spicetify.showNotification(runtimeText("runtime.noCurrent"), true);
      } else Spicetify.showNotification(runtimeText("runtime.noCurrent"), true);
    });
    menu.register();
  },
  stop(): void {
    item?.deregister(); item = null;
    menu?.deregister(); menu = null;
  },
};
