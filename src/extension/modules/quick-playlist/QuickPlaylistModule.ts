// =============================================================================
// Datei: src/extension/modules/quick-playlist/QuickPlaylistModule.ts
// Zweck: Sichere, manuell ausgelöste Queue-Aktionen im Spotify-Kontextmenü.
// Wo ändern? Batch-Größe und Fehlerreport in shared/queue-batches.ts;
//             Spotify-Kontextmenü und Rückmeldungen hier.
// =============================================================================
import { QueueBatchError, enqueueQueueBatches } from "../../../shared/queue-batches";
import { createSingleFlight } from "../../../shared/single-flight";
import { parseSpotifyTrackInput } from "../../../shared/track-search";
import { runtimeText } from "../../../shared/runtime-i18n";
import type { ExtensionModule } from "../ExtensionModule";

let item: Spicetify.ContextMenu.Item | null = null;

// Ein Kontextmenü-Klick kann schon vor einer sichtbaren UI-Reaktion ein zweites
// Mal ausgelöst werden. Die synchrone Sperre verhindert doppelte Queue-Aufträge.
// Sie überlebt Start/Stop des Menüs, damit ein noch laufender Auftrag nicht
// versehentlich durch eine erneute Modulinitialisierung dupliziert wird.
const queueGate = createSingleFlight();

/** Eine gemischte Auswahl darf nur gültige Spotify-Titel/Episoden enthalten. */
function hasQueueableTrack(uris: string[]): boolean {
  return uris.some((uri) => parseSpotifyTrackInput(uri) !== null);
}

/**
 * Reicht eine Auswahl geordnet in kleinen Blöcken an Spotify weiter.
 * Kein automatischer Retry bei Fehlern: Spotify könnte den fehlgeschlagenen
 * Block schon übernommen haben und ein erneuter Versand würde Duplikate erzeugen.
 */
async function queueSelection(uris: string[]): Promise<void> {
  await queueGate.run(async () => {
    // Spicetify liefert normalerweise URIs. Zusätzlich normalisieren wir
    // gültige Spotify-Links; ungültige Album-/Playlist-URIs bleiben außen vor.
    const normalized = uris.map((uri) => parseSpotifyTrackInput(uri) ?? "");
    try {
      const report = await enqueueQueueBatches(normalized, (batch) =>
        Spicetify.addToQueue(batch.map((uri) => ({ uri }))));

      // Auch bei einer leeren/zwischenzeitlich ungültigen Auswahl niemals
      // fälschlicherweise „0 Titel eingereiht“ als Erfolg melden.
      if (report.queued === 0) {
        Spicetify.showNotification(runtimeText("playlist.noValid"), true);
        return;
      }
      Spicetify.showNotification(runtimeText("runtime.queued", { count: report.queued }));
      if (report.skipped > 0) {
        Spicetify.showNotification(runtimeText("playlist.skipped", { count: report.skipped }), true);
      }
    } catch (error) {
      console.error("[ZuKaTo] Kontextmenü-Queue fehlgeschlagen", error);
      if (error instanceof QueueBatchError && error.queued > 0) {
        Spicetify.showNotification(runtimeText("playlist.partial", {
          count: error.queued,
          total: error.totalValid,
        }), true);
      } else {
        Spicetify.showNotification(runtimeText("runtime.queueFailed"), true);
      }
    }
  });
}

export const quickPlaylistModule: ExtensionModule = {
  id: "quick-playlist",
  start(): void {
    item = new Spicetify.ContextMenu.Item(
      "ZuKaTo: zur Warteschlange hinzufügen",
      (uris) => { void queueSelection(uris); },
      // Das Kontextmenü nur für echte Titel/Episoden anbieten. Dieselbe
      // Validierung gilt auch unmittelbar vor der API-Anfrage.
      hasQueueableTrack,
    );
    item.register();
  },
  stop(): void { item?.deregister(); item = null; },
};
