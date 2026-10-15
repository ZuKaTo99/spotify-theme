// =============================================================================
// Datei: src/extension/modules/context-actions/ContextActionsModule.ts
// Zweck: ZuKaTo-Lesezeichen über Spotifys Kontextmenü hinzufügen/entfernen.
// =============================================================================
import { currentTrack, toggleFavorite, type TrackInfo } from "../../../shared/library";
import { runtimeText } from "../../../shared/runtime-i18n";
import type { ExtensionModule } from "../ExtensionModule";

let item: Spicetify.ContextMenu.Item | null = null;
let menu: Spicetify.Menu.Item | null = null;

/** URI allein reicht für das Lesezeichen; Metadaten folgen aus laufendem Track. */
function rememberUri(uri: string): void {
  const playing = currentTrack();
  const info: TrackInfo = playing?.uri === uri ? playing : {
    uri, title: "Titel (URI)", artist: "", album: "",
  };
  const nowFavorite = toggleFavorite(info);
  Spicetify.showNotification(nowFavorite ? runtimeText("runtime.bookmarkAdded") : runtimeText("runtime.bookmarkRemoved"));
}

export const contextActionsModule: ExtensionModule = {
  id: "context-actions",
  start(): void {
    item = new Spicetify.ContextMenu.Item(
      "ZuKaTo: Lesezeichen umschalten",
      (uris) => { if (uris[0]) rememberUri(uris[0]); },
      (uris) => uris.some((uri) => /^spotify:(track|episode):/.test(uri)),
    );
    item.register();
    menu = new Spicetify.Menu.Item("ZuKaTo: laufenden Titel merken", false, () => {
      const playing = currentTrack();
      if (playing) rememberUri(playing.uri);
      else Spicetify.showNotification(runtimeText("runtime.noCurrent"), true);
    });
    menu.register();
  },
  stop(): void {
    item?.deregister(); item = null;
    menu?.deregister(); menu = null;
  },
};
