// =============================================================================
// Datei: src/custom-app/components/PlaylistDestination.tsx
// Zweck: Wiederverwendbarer Export ausgewählter Titel in eine Spotify-Playlist.
// Einfügen: Favoriten, Hörverlauf und Playlist-Werkzeuge. Kein Auto-Senden.
// Die Spotify-Cosmos-API kann je nach Account/Berechtigungen 403 zurückgeben.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../shared/i18n";
import {
  addItemsToSpotifyPlaylist, parseSpotifyPlaylistInput, PlaylistTransferError,
  normalizeRecentPlaylists, rememberPlaylistDestination, RECENT_PLAYLIST_STORAGE_KEY,
  normalizePlaylistBrowserPage, mergeBrowsedPlaylists, playlistBrowserUrl,
  type BrowserPlaylist,
  createSpotifyPlaylist, validateNewPlaylist,
} from "../../shared/spotify-playlist-transfer";

const ReactRuntime = Spicetify.React as typeof import("react");

interface Props {
  t: Translator;
  /** Ausschließlich explizit ausgewählte Titel; keine automatische Übernahme. */
  uris: readonly string[];
  disabled?: boolean;
  /** Verschiedene Instanzen derselben Seite benötigen eindeutige Label-IDs. */
  idPrefix?: string;
}

export function PlaylistDestination({ t, uris, disabled = false, idPrefix = "zukato-playlist" }: Props): ReactElement {
  const destinationInputId = `${idPrefix}-destination`;
  const recentInputId = `${idPrefix}-recent`;
  const createNameId = `${idPrefix}-create-name`;
  const createDescriptionId = `${idPrefix}-create-description`;
  const createVisibilityId = `${idPrefix}-create-visibility`;
  const browseFilterId = `${idPrefix}-browse-filter`;
  const browseSelectId = `${idPrefix}-browse-select`;
  const [destination, setDestination] = ReactRuntime.useState("");
  // Neues Ziel erstellen: nur nach Bestätigung, standardmäßig privat und leer.
  const [creatingOpen, setCreatingOpen] = ReactRuntime.useState(false);
  const [creating, setCreating] = ReactRuntime.useState(false);
  const [newName, setNewName] = ReactRuntime.useState("");
  const [newDescription, setNewDescription] = ReactRuntime.useState("");
  const [newPublic, setNewPublic] = ReactRuntime.useState(false);
  const createInFlight = ReactRuntime.useRef(false);
  const [busy, setBusy] = ReactRuntime.useState(false);
  const [message, setMessage] = ReactRuntime.useState("");
  const [recent, setRecent] = ReactRuntime.useState<string[]>([]);
  // Ein nicht zugänglicher localStorage darf niemals die Playlist-Übertragung
  // blockieren. Nur bereits bestätigte Ziel-Playlists werden vorgemerkt.
  ReactRuntime.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_PLAYLIST_STORAGE_KEY);
      setRecent(normalizeRecentPlaylists(stored ? JSON.parse(stored) : []));
    } catch { setRecent([]); }
  }, []);
  // Die Liste wird ausschließlich auf Nutzerklick geladen und weder auf dem
  // Rechner noch in Spicetify dauerhaft abgelegt. Angezeigte Playlists dürfen
  // abonniert sein, ohne dass Schreibrechte vorliegen.
  const [browsed, setBrowsed] = ReactRuntime.useState<BrowserPlaylist[]>([]);
  const [browseLoaded, setBrowseLoaded] = ReactRuntime.useState(false);
  const [browseBusy, setBrowseBusy] = ReactRuntime.useState(false);
  const [browseError, setBrowseError] = ReactRuntime.useState(false);
  const [browseFilter, setBrowseFilter] = ReactRuntime.useState("");
  const [browseNextOffset, setBrowseNextOffset] = ReactRuntime.useState(0);
  const [browseHasMore, setBrowseHasMore] = ReactRuntime.useState(false);
  const browserInFlight = ReactRuntime.useRef(false);
  const inFlight = ReactRuntime.useRef(false);
  const mounted = ReactRuntime.useRef(true);
  ReactRuntime.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Keine fremden `next`-Links folgen: Offset und Spotify-Endpoint sind fix.
  // Ein HTTP-Fehler darf bestehende Treffer nicht löschen und keinen
  // automatischen Retry auslösen (insbesondere bei 403 oder 429).
  async function loadPlaylists(reset: boolean): Promise<void> {
    if (browserInFlight.current || busy || creating || disabled) return;
    const offset = reset ? 0 : browseNextOffset;
    if (!reset && !browseHasMore) return;
    browserInFlight.current = true;
    setBrowseBusy(true);
    setBrowseError(false);
    try {
      const response: unknown = await Spicetify.CosmosAsync.get(playlistBrowserUrl(offset));
      const page = normalizePlaylistBrowserPage(response, offset);
      if (!mounted.current) return;
      setBrowsed((before) => mergeBrowsedPlaylists(reset ? [] : before, page.items));
      setBrowseNextOffset(page.nextOffset);
      setBrowseHasMore(page.hasMore);
      setBrowseLoaded(true);
    } catch (error) {
      console.error("[ZuKaTo] Playlist-Liste konnte nicht geladen werden", error);
      if (mounted.current) setBrowseError(true);
    } finally {
      browserInFlight.current = false;
      if (mounted.current) setBrowseBusy(false);
    }
  }

  const browserQuery = browseFilter.trim().toLocaleLowerCase();
  const visiblePlaylists = browserQuery
    ? browsed.filter((item) => `${item.name} ${item.owner}`.toLocaleLowerCase().includes(browserQuery))
    : browsed;
  const parsed = parseSpotifyPlaylistInput(destination);
  const canSend = !disabled && !busy && !creating && Boolean(parsed) && uris.length > 0;
  let canCreate = false;
  try { validateNewPlaylist(newName, newDescription, newPublic); canCreate = true; }
  catch { /* Erst gültige Eingaben erlauben die Bestätigung. */ }

  async function createPlaylist(): Promise<void> {
    if (createInFlight.current || inFlight.current || disabled || busy || browseBusy || !canCreate) return;
    // Sichtbar festhalten, dass zunächst eine LEERE Playlist angelegt wird.
    if (!window.confirm(t("playlistCreate.confirm", { name: newName.trim() }))) return;
    createInFlight.current = true;
    setCreating(true);
    setMessage("");
    try {
      const created = await createSpotifyPlaylist(newName, newDescription, newPublic,
        (url, body) => Spicetify.CosmosAsync.post(url, body));
      if (mounted.current) {
        // Das Ziel übernehmen, aber niemals automatisch Songs hinzufügen.
        setDestination(created);
        setCreatingOpen(false);
        setNewName("");
        setNewDescription("");
        setNewPublic(false);
        setMessage(t("playlistCreate.success"));
      }
    } catch (cause) {
      console.error("[ZuKaTo] Spotify-Playlist-Erstellung fehlgeschlagen", cause);
      if (mounted.current) setMessage(t("playlistCreate.failed"));
    } finally {
      createInFlight.current = false;
      if (mounted.current) setCreating(false);
    }
  }

  async function transfer(): Promise<void> {
    // Der synchrone Ref sperrt Doppelklicks, bevor React neu gerendert hat.
    if (inFlight.current || createInFlight.current || !canSend || !parsed) return;
    if (!window.confirm(t("playlistTransfer.confirm", { count: uris.length }))) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await addItemsToSpotifyPlaylist(parsed, uris, (url, body) =>
        Spicetify.CosmosAsync.post(url, body));
      if (mounted.current) {
        setMessage(t("playlistTransfer.success", { count: result.added }) +
          (result.skipped ? ` ${t("playlistTransfer.skipped", { count: result.skipped })}` : ""));
        if (result.added > 0) {
          const next = rememberPlaylistDestination(recent, parsed);
          setRecent(next);
          try { window.localStorage.setItem(RECENT_PLAYLIST_STORAGE_KEY, JSON.stringify(next)); }
          catch { /* Die Aktion war erfolgreich, auch wenn das Merken scheitert. */ }
        }
      }
    } catch (error) {
      console.error("[ZuKaTo] Spotify-Playlist konnte nicht aktualisiert werden", error);
      if (mounted.current) setMessage(error instanceof PlaylistTransferError && error.added > 0
        ? t("playlistTransfer.partial", { count: error.added, total: error.totalValid })
        : t("playlistTransfer.failed"));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <div className="zukato-playlist-destination">
    <label htmlFor={destinationInputId}>{t("playlistTransfer.destination")}</label>
    <div className="zukato-playlist-destination__row">
      <input id={destinationInputId} type="text" value={destination}
        placeholder="https://open.spotify.com/playlist/…" maxLength={320}
        aria-invalid={destination.trim() ? !parsed : undefined}
        disabled={busy || creating || disabled}
        onChange={(event) => { setDestination(event.currentTarget.value); setMessage(""); }} />
      <button type="button" disabled={!canSend} onClick={() => { void transfer(); }}>
        {busy ? t("playlistTransfer.working") : t("playlistTransfer.add", { count: uris.length })}
      </button>
    </div>
    {/* Neue Playlists entstehen leer und standardmäßig privat. Das optionale
        Einfüllen von Songs nutzt die bisherige separate Transferbestätigung. */}
    <div className="zukato-playlist-create">
      <button type="button" disabled={disabled || busy || creating || browseBusy}
        aria-expanded={creatingOpen}
        onClick={() => setCreatingOpen(before => !before)}>{t("playlistCreate.toggle")}</button>
      {creatingOpen && <div className="zukato-playlist-create__fields">
        <label htmlFor={createNameId}>{t("playlistCreate.name")}</label>
        <input id={createNameId} type="text" maxLength={100} value={newName}
          disabled={disabled || busy || creating}
          onChange={event => setNewName(event.currentTarget.value)} />
        <label htmlFor={createDescriptionId}>{t("playlistCreate.description")}</label>
        <textarea id={createDescriptionId} maxLength={300} value={newDescription}
          disabled={disabled || busy || creating}
          onChange={event => setNewDescription(event.currentTarget.value)} />
        <label htmlFor={createVisibilityId}>{t("playlistCreate.visibility")}</label>
        <select id={createVisibilityId} value={newPublic ? "public" : "private"}
          disabled={disabled || busy || creating}
          onChange={event => setNewPublic(event.currentTarget.value === "public") }>
          <option value="private">{t("playlistCreate.private")}</option>
          <option value="public">{t("playlistCreate.public")}</option>
        </select>
        <button type="button" disabled={disabled || busy || creating || !canCreate}
          onClick={() => { void createPlaylist(); }}>
          {creating ? t("playlistCreate.creating") : t("playlistCreate.submit")}
        </button>
        <small>{t("playlistCreate.hint")}</small>
      </div>}
    </div>
    {recent.length > 0 && <div className="zukato-playlist-destination__row">
      <label htmlFor={recentInputId}>{t("playlistTransfer.recent")}</label>
      <select id={recentInputId} value="" disabled={busy || creating || disabled}
        onChange={(event) => { setDestination(event.currentTarget.value); setMessage(""); }}>
        <option value="">{t("playlistTransfer.chooseRecent")}</option>
        {recent.map((item) => <option key={item} value={item}>
          {`Spotify Playlist …${item.slice(-8)}`}
        </option>)}
      </select>
      <button type="button" disabled={busy || creating || disabled} onClick={() => {
        setRecent([]);
        try { window.localStorage.removeItem(RECENT_PLAYLIST_STORAGE_KEY); }
        catch { /* Auswahl bleibt trotzdem in der Oberfläche gelöscht. */ }
      }}>{t("playlistTransfer.clearRecent")}</button>
    </div>}
    {/* Eine lesende Playlist-Auswahl ist in jeder Export-Ansicht verfügbar. */}
    <div className="zukato-playlist-browser">
      <div className="zukato-playlist-destination__row">
        <button type="button" disabled={disabled || busy || creating || browseBusy}
          onClick={() => { void loadPlaylists(true); }}>
          {browseBusy ? t("playlistBrowser.loading") : t("playlistBrowser.load")}
        </button>
        {browseLoaded && <small role="status">{t("playlistBrowser.count", { count: browsed.length })}</small>}
      </div>
      {browseError && <p role="alert" className="zukato-error">{t("playlistBrowser.error")}</p>}
      {browseLoaded && <>
        <label htmlFor={browseFilterId}>{t("playlistBrowser.search")}</label>
        <input id={browseFilterId} type="search" disabled={disabled || busy || creating || browseBusy}
          value={browseFilter} placeholder={t("playlistBrowser.searchHint")}
          onChange={(event) => setBrowseFilter(event.currentTarget.value)} />
        <label htmlFor={browseSelectId}>{t("playlistBrowser.choose")}</label>
        <select id={browseSelectId} value="" disabled={disabled || busy || browseBusy || !visiblePlaylists.length}
          onChange={(event) => { setDestination(event.currentTarget.value); setMessage(""); }}>
          <option value="">{t("playlistBrowser.placeholder")}</option>
          {visiblePlaylists.map((item) => <option key={item.uri} value={item.uri}>
            {`${item.name}${item.owner ? ` · ${item.owner}` : ""}${item.itemCount !== null ? ` (${item.itemCount})` : ""}`}
          </option>)}
        </select>
        {browseHasMore && <button type="button" disabled={disabled || busy || creating || browseBusy}
          onClick={() => { void loadPlaylists(false); }}>{t("playlistBrowser.more")}</button>}
        {!visiblePlaylists.length && <small>{t("playlistBrowser.empty")}</small>}
        <small>{t("playlistBrowser.hint")}</small>
      </>}
    </div>
    {destination.trim() && !parsed && <small className="zukato-error">{t("playlistTransfer.invalid")}</small>}
    <small>{t("playlistTransfer.hint")}</small>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </div>;
}
