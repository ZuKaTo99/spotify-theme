// =============================================================================
// Datei: src/extension/modules/quick-playlist/QuickPlaylistModule.ts
// Zweck: Schnelle, nutzerbestätigte Warteschlangen-Aktionen im Kontextmenü.
// =============================================================================
import { runtimeText } from "../../../shared/runtime-i18n";
import type { ExtensionModule } from "../ExtensionModule";

let item: Spicetify.ContextMenu.Item | null = null;

/** Aus Kontextmenü-URIs nur echte Titel/Episoden an die Queue übergeben. */
async function queueSelection(uris: string[]): Promise<void> {
  const tracks = uris.filter((uri) => /^spotify:(track|episode):[A-Za-z0-9]+$/.test(uri));
  if (!tracks.length) return;
  try {
    await Spicetify.addToQueue(tracks.map((uri) => ({ uri })));
    Spicetify.showNotification(runtimeText("runtime.queued", { count: tracks.length }));
  } catch (error) {
    console.error("[ZuKaTo] Queue-Aktion fehlgeschlagen", error);
    Spicetify.showNotification(runtimeText("runtime.queueFailed"), true);
  }
}

export const quickPlaylistModule: ExtensionModule = {
  id: "quick-playlist",
  start(): void {
    item = new Spicetify.ContextMenu.Item(
      "ZuKaTo: zur Warteschlange hinzufügen",
      (uris) => { void queueSelection(uris); },
      (uris) => uris.some((uri) => /^spotify:(track|episode):/.test(uri)),
    );
    item.register();
  },
  stop(): void { item?.deregister(); item = null; },
};
