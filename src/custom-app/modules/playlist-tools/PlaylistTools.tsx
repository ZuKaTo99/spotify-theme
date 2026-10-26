// =============================================================================
// Datei: src/custom-app/modules/playlist-tools/PlaylistTools.tsx
// Zweck: Warteschlange befüllen und Playlist-Inhalte nach Bestätigung verwalten.
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
import { BulkLinkImporter } from "../../components/BulkLinkImporter";
import { PlaylistManager } from "../../components/PlaylistManager";
import { CollectionWorkbench } from "./CollectionWorkbench";
import { PLAYLIST_WORKSPACE_TABS, PLAYLIST_WORKSPACE_TAB_STORAGE_KEY,
  normalizePlaylistWorkspaceTab, nextPlaylistWorkspaceTab, type PlaylistWorkspaceTab,
} from "../../../shared/playlist-workspace-tabs";

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

  // Den zuletzt geöffneten Bereich nur für diese Sitzung merken. Ein gesperrter
  // Browser-Speicher darf den Workspace nicht blockieren.
  const [activeTab, setActiveTab] = ReactRuntime.useState<PlaylistWorkspaceTab>(() => {
    try { return normalizePlaylistWorkspaceTab(window.sessionStorage.getItem(PLAYLIST_WORKSPACE_TAB_STORAGE_KEY)); }
    catch { return "queue"; }
  });
  // Sammlungs-Storage erst beim ersten Öffnen des Tabs initialisieren. Danach
  // bleibt die Werkbank wie die anderen Werkzeuge für Tabwechsel gemountet.
  const [collectionsOpened, setCollectionsOpened] = ReactRuntime.useState(activeTab === "collections");

  function selectTab(tab: PlaylistWorkspaceTab): void {
    setActiveTab(tab);
    if (tab === "collections") setCollectionsOpened(true);
    try { window.sessionStorage.setItem(PLAYLIST_WORKSPACE_TAB_STORAGE_KEY, tab); }
    catch { /* Sitzungsspeicher ist optional; der aktive Tab bleibt im RAM. */ }
  }

  function handleTabKey(event: import("react").KeyboardEvent<HTMLDivElement>): void {
    // Nur Events behandeln, die direkt von einer Tab-Schaltfläche kommen.
    // So bleiben Suchfelder und die eingebetteten Werkzeuge uneingeschränkt bedienbar.
    const target = event.target as HTMLElement;
    const id = target.getAttribute?.("data-playlist-tab");
    if (!id) return;
    const next = nextPlaylistWorkspaceTab(normalizePlaylistWorkspaceTab(id), event.key);
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    // Den Tastaturfokus auf die gewählte Schaltfläche mitnehmen (ARIA tabs).
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-playlist-tab="${next}"]`)?.focus();
  }

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

  return <section className="zukato-panel zukato-playlist-workspace">
    {/* Bereits geöffnete Werkzeuge bleiben gemountet: ein Tabwechsel darf weder
        importierte Songlisten noch Playlist-Auswahl oder ungesendete Eingaben löschen. */}
    <div className="zukato-playlist-workspace__tabs" role="tablist"
      aria-label={t("playlistWorkspace.navigation")} onKeyDown={handleTabKey}>
      {PLAYLIST_WORKSPACE_TABS.map((tab) => <button type="button" key={tab}
        id={`zukato-playlist-tab-${tab}`} data-playlist-tab={tab}
        role="tab" aria-selected={activeTab === tab}
        aria-controls={`zukato-playlist-panel-${tab}`}
        tabIndex={activeTab === tab ? 0 : -1}
        onClick={() => selectTab(tab)}>
        <span>{t(`playlistWorkspace.${tab}`)}</span>
        {tab === "transfer" && favorites.length > 0 &&
          <small aria-label={t("playlistWorkspace.favoritesCount", { count: favorites.length })}>
            {favorites.length}
          </small>}
      </button>)}
    </div>
    <section id="zukato-playlist-panel-queue" role="tabpanel"
      aria-labelledby="zukato-playlist-tab-queue" hidden={activeTab !== "queue"}
      className="zukato-playlist-workspace__panel">
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
      <TrackSearch t={t} actionLabel={t("search.queue")} disabled={working}
        onChoose={async (track) => { await queue([track.uri]); }} />
      <label htmlFor="zukato-queue-uri">{t("playlist.label")}</label>
      <div className="zukato-toolbar">
        <input id="zukato-queue-uri" placeholder="https://open.spotify.com/track/…"
          value={uri} disabled={working} onChange={(event) => setUri(event.target.value)} />
        <button type="button" disabled={working || !uri.trim()}
          onClick={() => void queue([uri.trim()])}>{t("playlist.queue")}</button>
      </div>
    </section>
    <section id="zukato-playlist-panel-import" role="tabpanel"
      aria-labelledby="zukato-playlist-tab-import" hidden={activeTab !== "import"}
      className="zukato-playlist-workspace__panel">
      <BulkLinkImporter t={t} disabled={working} onQueue={queue} />
    </section>
    <section id="zukato-playlist-panel-manage" role="tabpanel"
      aria-labelledby="zukato-playlist-tab-manage" hidden={activeTab !== "manage"}
      className="zukato-playlist-workspace__panel">
      <PlaylistManager t={t} disabled={working} onQueue={queue} />
    </section>
    <section id="zukato-playlist-panel-transfer" role="tabpanel"
      aria-labelledby="zukato-playlist-tab-transfer" hidden={activeTab !== "transfer"}
      className="zukato-playlist-workspace__panel">
      <h3>{t("playlistTransfer.heading")}</h3>
      <p>{t("playlistTransfer.description")}</p>
      <PlaylistDestination t={t} uris={favorites.map((track) => track.uri)} disabled={working} />
    </section>
    <section id="zukato-playlist-panel-collections" role="tabpanel"
      aria-labelledby="zukato-playlist-tab-collections" hidden={activeTab !== "collections"}
      className="zukato-playlist-workspace__panel">
      {collectionsOpened && <CollectionWorkbench t={t} />}
    </section>
  </section>;
}
