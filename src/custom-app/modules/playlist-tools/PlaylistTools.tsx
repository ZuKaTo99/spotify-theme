// =============================================================================
// Datei: src/custom-app/modules/playlist-tools/PlaylistTools.tsx
// Zweck: Spotify-Warteschlange befüllen, ohne bestehende Playlists zu verändern.
// Wo ändern? UI hier, URI-Parsing in shared/track-search.ts, Versandgrößen und
// Teilfehler-Behandlung in shared/queue-batches.ts.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { currentTrack } from "../../../shared/library";
import { QueueBatchError, enqueueQueueBatches } from "../../../shared/queue-batches";
import { parseSpotifyTrackInput } from "../../../shared/track-search";
import { useToolkitData } from "../../hooks/useToolkitData";
import { TrackSearch } from "../../components/TrackSearch";
import { PlaylistDestination } from "../../components/PlaylistDestination";

const ReactRuntime = Spicetify.React as typeof import("react");

/**
 * Queue-Aktionen sind ausdrücklich vom Nutzer ausgelöst. Ein synchron gesetzter
 * Ref schützt vor Doppelklicks, bevor React den disabled-Zustand gerendert hat.
 */
export function PlaylistTools({ t }: { t: Translator }): ReactElement {
  const { favorites } = useToolkitData();
  const [uri, setUri] = ReactRuntime.useState("");
  const [working, setWorking] = ReactRuntime.useState(false);
  const queueBusy = ReactRuntime.useRef(false);

  async function queue(uris: string[]): Promise<void> {
    if (queueBusy.current) return;
    queueBusy.current = true;
    setWorking(true);
    try {
      // Links vor dem Versand in Spotify-URIs umwandeln. Ungültige Einträge
      // werden niemals an die Spotify-API übergeben.
      const normalized = uris.map((value) => parseSpotifyTrackInput(value) ?? "");
      const validCount = normalized.filter(Boolean).length;
      if (!validCount) {
        Spicetify.showNotification(t("playlist.noValid"), true);
        return;
      }

      // Spotify erhält kleine, geordnete Blöcke. Die Funktion stoppt nach dem
      // ersten API-Fehler, ohne teilweise eingereihte Titel erneut zu senden.
      const report = await enqueueQueueBatches(normalized, (batch) =>
        Spicetify.addToQueue(batch.map((item) => ({ uri: item }))));
      Spicetify.showNotification(t("playlist.done", { count: report.queued }));
      if (report.skipped > 0) {
        Spicetify.showNotification(t("playlist.skipped", { count: report.skipped }), true);
      }
    } catch (error) {
      console.error("[ZuKaTo] Queue fehlgeschlagen:", error);
      if (error instanceof QueueBatchError && error.queued > 0) {
        Spicetify.showNotification(t("playlist.partial", {
          count: error.queued,
          total: error.totalValid,
        }), true);
      } else {
        Spicetify.showNotification(t("playlist.failed"), true);
      }
    } finally {
      queueBusy.current = false;
      setWorking(false);
    }
  }

  return <section className="zukato-panel">
    <p>{t("playlist.intro")}</p>
    <div className="zukato-toolbar">
      <button type="button" disabled={working} onClick={() => {
        const track = currentTrack();
        if (track) void queue([track.uri]);
        else Spicetify.showNotification(t("playlist.noCurrent"), true);
      }}>{t("playlist.current")}</button>
      <button type="button" disabled={working || favorites.length === 0}
        onClick={() => void queue(favorites.map((item) => item.uri))}>
        {t("playlist.allFavorites", { count: favorites.length })}
      </button>
    </div>
    <h3>{t("playlistTransfer.heading")}</h3>
    <p>{t("playlistTransfer.description")}</p>
    <PlaylistDestination t={t} uris={favorites.map((track) => track.uri)} disabled={working} />
    <TrackSearch t={t} actionLabel={t("search.queue")} disabled={working}
      onChoose={async (track) => { await queue([track.uri]); }} />
    <label htmlFor="zukato-queue-uri">{t("playlist.label")}</label>
    <div className="zukato-toolbar">
      <input id="zukato-queue-uri" placeholder="https://open.spotify.com/track/…"
        value={uri} disabled={working} onChange={(event) => setUri(event.target.value)} />
      <button type="button" disabled={working || !uri.trim()}
        onClick={() => void queue([uri.trim()])}>{t("playlist.queue")}</button>
    </div>
  </section>;
}
