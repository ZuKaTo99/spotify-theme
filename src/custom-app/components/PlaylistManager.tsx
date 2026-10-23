// =============================================================================
// Datei: src/custom-app/components/PlaylistManager.tsx
// Zweck: Spotify-Playlist-Inhalte im Workspace lesen, auswählen und bearbeiten.
// Wo ändern? Playlist-API-Validierung in shared/spotify-playlist-content.ts;
// UI hier. Keine Netzwerkaktion ohne Klick und keine automatische DELETE-Retry.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../shared/i18n";
import {
  parseSpotifyPlaylistInput, normalizePlaylistBrowserPage, mergeBrowsedPlaylists,
  playlistBrowserUrl, type BrowserPlaylist,
} from "../../shared/spotify-playlist-transfer";
import {
  playlistItemsUrl, playlistItemPageOffset, CONTENT_LIMIT, CONTENT_PAGE_SIZE, normalizePlaylistItemsPage, mergePlaylistItems,
  selectedPlaylistUris, removePlaylistUris, PlaylistRemoveError,
  type SpotifyPlaylistEntry,
} from "../../shared/spotify-playlist-content";
import { PlaylistDestination } from "./PlaylistDestination";
import { moveSpotifyPlaylistEntry } from "../../shared/spotify-playlist-reorder";
import {
  fetchOwnedPlaylistDetails, validatePlaylistDetailsChange,
  updateSpotifyPlaylistDetails, type EditablePlaylistDetails,
} from "../../shared/spotify-playlist-details";

const ReactRuntime = Spicetify.React as typeof import("react");
// Gleiche Zeilenzahl wie eine Spotify-API-Seite: direkter Seitensprung zeigt
// sofort genau die neu geladene Seite, statt mitten in alten Treffern zu landen.
const VISIBLE_PER_PAGE = CONTENT_PAGE_SIZE;

interface Props {
  t: Translator;
  disabled?: boolean;
  /** Nutzt die bestehende Batch-Queue samt Fehlerbehandlung in PlaylistTools. */
  onQueue: (uris: string[]) => Promise<void>;
}

export function PlaylistManager({ t, disabled = false, onQueue }: Props): ReactElement {
  const [source, setSource] = ReactRuntime.useState("");
  const [loadedSource, setLoadedSource] = ReactRuntime.useState("");
  const [entries, setEntries] = ReactRuntime.useState<SpotifyPlaylistEntry[]>([]);
  const [total, setTotal] = ReactRuntime.useState(0);
  const [nextOffset, setNextOffset] = ReactRuntime.useState(0);
  const [hasMore, setHasMore] = ReactRuntime.useState(false);
  // API-Seiten sind 1-basiert im Formular; im Speicher 0-basierte Offsets.
  const [remotePage, setRemotePage] = ReactRuntime.useState("1");
  const [details, setDetails] = ReactRuntime.useState<EditablePlaylistDetails | null>(null);
  const [editName, setEditName] = ReactRuntime.useState("");
  const [editDescription, setEditDescription] = ReactRuntime.useState("");
  const [detailsBusy, setDetailsBusy] = ReactRuntime.useState(false);
  const detailsLock = ReactRuntime.useRef(false);
  const [search, setSearch] = ReactRuntime.useState("");
  const [page, setPage] = ReactRuntime.useState(0);
  const [selected, setSelected] = ReactRuntime.useState<string[]>([]);
  // Die Verschiebeauswahl ist POSITIONsbasiert. Doppelte Songs bleiben unterscheidbar.
  const [moveFrom, setMoveFrom] = ReactRuntime.useState<number | null>(null);
  const [moveTo, setMoveTo] = ReactRuntime.useState("");
  const [message, setMessage] = ReactRuntime.useState("");
  const [error, setError] = ReactRuntime.useState(false);
  const [busy, setBusy] = ReactRuntime.useState(false);
  const [writing, setWriting] = ReactRuntime.useState(false);
  const readLock = ReactRuntime.useRef(false);
  const writeLock = ReactRuntime.useRef(false);
  const sourceEpoch = ReactRuntime.useRef(0);
  const mounted = ReactRuntime.useRef(true);
  ReactRuntime.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; sourceEpoch.current++; };
  }, []);

  // Spotify-Playlist-Browser: nur auf Klick, keine fremden next-URLs verfolgen.
  const [choices, setChoices] = ReactRuntime.useState<BrowserPlaylist[]>([]);
  const [choiceNext, setChoiceNext] = ReactRuntime.useState(0);
  const [choiceMore, setChoiceMore] = ReactRuntime.useState(false);
  const [choiceLoaded, setChoiceLoaded] = ReactRuntime.useState(false);
  const [choiceBusy, setChoiceBusy] = ReactRuntime.useState(false);
  const [choiceSearch, setChoiceSearch] = ReactRuntime.useState("");
  const choiceLock = ReactRuntime.useRef(false);

  function changeSource(input: string): void {
    sourceEpoch.current++;
    setSource(input);
    setLoadedSource("");
    setEntries([]);
    setTotal(0);
    setSelected([]);
    setMoveFrom(null);
    setMoveTo("");
    setDetails(null);
    setRemotePage("1");
    setSearch("");
    setPage(0);
    setHasMore(false);
    setNextOffset(0);
    setMessage("");
    setError(false);
  }

  async function loadChoices(reset: boolean): Promise<void> {
    if (choiceLock.current || readLock.current || writeLock.current || disabled) return;
    if (!reset && !choiceMore) return;
    choiceLock.current = true;
    setChoiceBusy(true);
    setError(false);
    try {
      const offset = reset ? 0 : choiceNext;
      const data = await Spicetify.CosmosAsync.get(playlistBrowserUrl(offset));
      const normalized = normalizePlaylistBrowserPage(data, offset);
      if (!mounted.current) return;
      setChoices(before => mergeBrowsedPlaylists(reset ? [] : before, normalized.items));
      setChoiceNext(normalized.nextOffset);
      setChoiceMore(normalized.hasMore);
      setChoiceLoaded(true);
    } catch (cause) {
      console.error("[ZuKaTo] Playlist-Quellen konnten nicht geladen werden", cause);
      if (mounted.current) { setError(true); setMessage(t("playlistManager.sourceError")); }
    } finally {
      choiceLock.current = false;
      if (mounted.current) setChoiceBusy(false);
    }
  }

  /** Neue Playlist oder erstes Refresh: vollständige lokale Auswahl löschen. */
  async function loadItems(reset: boolean, jumpOffset?: number): Promise<void> {
    const parsed = parseSpotifyPlaylistInput(source);
    if (!parsed || disabled || readLock.current || writeLock.current || choiceLock.current || detailsLock.current) return;
    if (!reset && (loadedSource !== parsed || (jumpOffset === undefined && !hasMore))) return;
    const offset = reset ? 0 : jumpOffset ?? nextOffset;
    const epoch = sourceEpoch.current;
    readLock.current = true;
    setBusy(true);
    setError(false);
    if (reset) {
      setLoadedSource(""); setEntries([]); setSelected([]);
      setMoveFrom(null); setMoveTo(""); setPage(0); setHasMore(false); setRemotePage("1");
    }
    setMessage("");
    try {
      const raw = await Spicetify.CosmosAsync.get(playlistItemsUrl(parsed, offset));
      const result = normalizePlaylistItemsPage(raw, parsed, offset);
      if (!mounted.current || epoch !== sourceEpoch.current) return;
      const merged = mergePlaylistItems(reset ? [] : entries, result.items);
      setEntries(merged);
      if (jumpOffset !== undefined) {
        // Beim direkten Sprung das neue 50er-Fenster sofort sichtbar machen.
        // Alle früher geladenen Positionen bleiben für Auswahl/Kopieren erhalten.
        setSearch("");
        const index = merged.findIndex(item => item.position >= offset);
        setPage(Math.floor(Math.max(0, index) / VISIBLE_PER_PAGE));
      }
      setLoadedSource(parsed);
      setTotal(result.total);
      setNextOffset(result.nextOffset);
      setHasMore(result.hasMore);
      setRemotePage(String(Math.floor(offset / CONTENT_PAGE_SIZE) + 1));
    } catch (cause) {
      console.error("[ZuKaTo] Playlist-Inhalte konnten nicht geladen werden", cause);
      if (mounted.current && epoch === sourceEpoch.current) {
        setError(true);
        setMessage(t("playlistManager.loadError"));
      }
    } finally {
      readLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  /** Einzelne entfernte API-Seite laden, ohne alle dazwischen abfragen zu müssen. */
  function jumpToPage(): void {
    if (!validView || locked) return;
    try {
      const numeric = /^\d+$/.test(remotePage.trim()) ? Number(remotePage.trim()) : NaN;
      const offset = playlistItemPageOffset(numeric, total);
      void loadItems(false, offset);
    } catch {
      setError(true);
      setMessage(t("playlistManager.invalidRemotePage"));
    }
  }

  /** Spotify-Eigentümer getrennt prüfen; keine Metadaten früherer Quelle zeigen. */
  async function loadDetails(): Promise<void> {
    const parsed = parseSpotifyPlaylistInput(source);
    if (!parsed || disabled || detailsLock.current || readLock.current || writeLock.current || choiceLock.current) return;
    const epoch = sourceEpoch.current;
    detailsLock.current = true;
    setDetailsBusy(true);
    setDetails(null);
    setMessage(""); setError(false);
    try {
      const loaded = await fetchOwnedPlaylistDetails(parsed, url => Spicetify.CosmosAsync.get(url));
      if (!mounted.current || epoch !== sourceEpoch.current) return;
      setDetails(loaded);
      setEditName(loaded.name);
      setEditDescription(loaded.description);
    } catch (cause) {
      console.error("[ZuKaTo] Playlist-Metadaten konnten nicht geladen werden", cause);
      if (mounted.current && epoch === sourceEpoch.current) {
        setMessage(t("playlistManager.detailsError")); setError(true);
      }
    } finally {
      detailsLock.current = false;
      if (mounted.current) setDetailsBusy(false);
    }
  }

  /** Nur Name/Beschreibung ändern, mit Besitzerprüfung und Bestätigung. */
  async function saveDetails(): Promise<void> {
    if (!details || details.uri !== parseSpotifyPlaylistInput(source) ||
      detailsLock.current || writeLock.current || readLock.current || disabled) return;
    let changed;
    try { changed = validatePlaylistDetailsChange(editName, editDescription); }
    catch { setError(true); setMessage(t("playlistManager.detailsInvalid")); return; }
    if (changed.name === details.name && changed.description === details.description) return;
    if (!window.confirm(t("playlistManager.detailsConfirm", { name: changed.name }))) return;
    const epoch = sourceEpoch.current;
    detailsLock.current = true;
    writeLock.current = true;
    setWriting(true); setMessage(""); setError(false);
    try {
      const sent = await updateSpotifyPlaylistDetails(details, changed.name, changed.description,
        (url, body) => Spicetify.CosmosAsync.put(url, body),
        () => mounted.current && epoch === sourceEpoch.current);
      if (mounted.current && epoch === sourceEpoch.current && sent) {
        setMessage(t("playlistManager.detailsSaved"));
      }
    } catch (cause) {
      console.error("[ZuKaTo] Playlist-Metadaten konnten nicht aktualisiert werden", cause);
      if (mounted.current && epoch === sourceEpoch.current) {
        setError(true); setMessage(t("playlistManager.detailsSaveError"));
      }
    } finally {
      detailsLock.current = false;
      writeLock.current = false;
      if (mounted.current) {
        // Keine falsche erneute Speicherung bei unbestätigter HTTP-Antwort.
        // Name/Beschreibung neu von Spotify lesen, bevor wieder editiert wird.
        setDetails(null);
        setWriting(false);
      }
    }
  }

  const parsedSource = parseSpotifyPlaylistInput(source);
  const validView = Boolean(parsedSource && parsedSource === loadedSource);
  const lower = search.trim().toLocaleLowerCase();
  const filtered = validView ? entries.filter(item =>
    `${item.title} ${item.artist} ${item.uri}`.toLocaleLowerCase().includes(lower)) : [];
  const pages = Math.ceil(filtered.length / VISIBLE_PER_PAGE);
  const safePage = Math.min(page, Math.max(0, pages - 1));
  const visible = filtered.slice(safePage * VISIBLE_PER_PAGE, (safePage + 1) * VISIBLE_PER_PAGE);
  const availableSelection = validView ? selectedPlaylistUris(entries, selected) : [];
  const selectedSet = new Set(availableSelection);
  const locked = busy || writing || choiceBusy || detailsBusy || disabled;
  const filteredUris = [...new Set(filtered.map(entry => entry.uri))];
  const moveEntry = validView && moveFrom !== null ? entries.find(item => item.position === moveFrom) : undefined;
  const moveTarget = /^\d+$/.test(moveTo.trim()) ? Number(moveTo.trim()) : NaN;
  const canMove = Boolean(moveEntry && Number.isSafeInteger(moveTarget) && moveTarget >= 1 &&
    moveTarget <= total && moveTarget !== moveFrom! + 1 && !locked);
  const remotePages = Math.ceil(Math.min(total, CONTENT_LIMIT) / CONTENT_PAGE_SIZE);
  const remoteTarget = /^\d+$/.test(remotePage.trim()) ? Number(remotePage.trim()) : NaN;
  const validRemotePage = Number.isSafeInteger(remoteTarget) && remoteTarget >= 1 &&
    remoteTarget <= remotePages;
  const detailsChangeValid = (() => {
    if (!details || details.uri !== parsedSource) return false;
    try {
      const change = validatePlaylistDetailsChange(editName, editDescription);
      return change.name !== details.name || change.description !== details.description;
    } catch { return false; }
  })();
  const chosen = choices.filter(item =>
    `${item.name} ${item.owner}`.toLocaleLowerCase().includes(choiceSearch.trim().toLocaleLowerCase()));

  function toggle(uri: string): void {
    if (locked) return;
    setSelected(before => before.includes(uri) ? before.filter(item => item !== uri) : [...before, uri]);
  }

  /** Ein einzelnes Playlist-Vorkommen auf eine absolute Zielposition bewegen.
   * Snapshot erst unmittelbar vor PUT laden, dann die Ansicht invalidieren.
   * Bei unsicherer Serverantwort niemals einen zweiten PUT senden. */
  async function moveSelected(): Promise<void> {
    if (!canMove || writeLock.current || readLock.current || !parsedSource || moveFrom === null || !moveEntry) return;
    const position = moveFrom;
    const destination = moveTarget - 1;
    if (!window.confirm(t("playlistManager.moveConfirm", {
      title: moveEntry.title, from: position + 1, to: destination + 1,
    }))) return;
    const epoch = sourceEpoch.current;
    const expectedSource = parsedSource;
    writeLock.current = true;
    setWriting(true);
    setMessage("");
    setError(false);
    try {
      const moved = await moveSpotifyPlaylistEntry(
        expectedSource, position, destination, total,
        url => Spicetify.CosmosAsync.get(url),
        (url, body) => Spicetify.CosmosAsync.put(url, body),
        () => mounted.current && epoch === sourceEpoch.current,
      );
      if (mounted.current && epoch === sourceEpoch.current && moved) {
        setMessage(t("playlistManager.moved", { from: position + 1, to: destination + 1 }));
      }
    } catch (cause) {
      console.error("[ZuKaTo] Playlist-Verschieben fehlgeschlagen", cause);
      if (mounted.current && epoch === sourceEpoch.current) {
        setError(true);
        setMessage(t("playlistManager.moveError"));
      }
    } finally {
      writeLock.current = false;
      if (mounted.current && epoch === sourceEpoch.current) {
        // GET/PUT kann zwischenzeitlich den Zustand geändert haben; selbst
        // ein Timeout lässt eine bestätigte Antwort unsicher erscheinen.
        setLoadedSource("");
        setSelected([]);
        setMoveFrom(null);
        setMoveTo("");
        setHasMore(false);
        setWriting(false);
      } else if (mounted.current) {
        setWriting(false);
      }
    }
  }

  async function deleteSelected(): Promise<void> {
    if (!validView || locked || writeLock.current || !availableSelection.length || !parsedSource) return;
    // API-DELETE entfernt alle Vorkommen der gewählten URI, auch noch nicht
    // nachgeladene Duplikate. Diese Tatsache wird ausdrücklich bestätigt.
    if (!window.confirm(t("playlistManager.deleteConfirm", { count: availableSelection.length }))) return;
    const epoch = sourceEpoch.current;
    const snapshot = entries;
    const deletion = availableSelection;
    writeLock.current = true;
    setWriting(true);
    setMessage("");
    setError(false);
    try {
      const result = await removePlaylistUris(parsedSource, snapshot, deletion, (url, body) =>
        Spicetify.CosmosAsync.del(url, body));
      if (!mounted.current || epoch !== sourceEpoch.current) return;
      // Nur bestätigte URIs aus der Ansicht entfernen. Eine erneute
      // vollständige API-Abfrage kann der Nutzer selbst auslösen.
      const removedUris = new Set(deletion);
      setEntries(before => before.filter(item => !removedUris.has(item.uri)));
      setSelected([]);
      setMessage(t("playlistManager.deleted", { count: result.removed }));
      // Nach Änderungen sind frühere Offsets nicht mehr zuverlässig, daher
      // vor einem neuen "Weitere"-Klick ausdrücklich neu laden.
      setHasMore(false);
    } catch (cause) {
      console.error("[ZuKaTo] Playlist-Entfernen fehlgeschlagen", cause);
      if (mounted.current && epoch === sourceEpoch.current) {
        setError(true);
        setMessage(cause instanceof PlaylistRemoveError && cause.removed > 0
          ? t("playlistManager.partial", { count: cause.removed, total: cause.total })
          : t("playlistManager.deleteError"));
        // Nach ungewissem Write ist die alte Ansicht nicht autoritativ.
        setLoadedSource("");
        setSelected([]);
        setHasMore(false);
      }
    } finally {
      writeLock.current = false;
      if (mounted.current) setWriting(false);
    }
  }

  return <section className="zukato-playlist-manager" aria-label={t("playlistManager.heading")}>
    <h3>{t("playlistManager.heading")}</h3>
    <p>{t("playlistManager.description")}</p>
    <div className="zukato-toolbar">
      <button type="button" disabled={locked} onClick={() => { void loadChoices(true); }}>
        {choiceBusy ? t("playlistManager.loading") : t("playlistManager.myPlaylists")}
      </button>
      {choiceLoaded && <span>{t("playlistManager.choices", { count: choices.length })}</span>}
    </div>
    {choiceLoaded && <div className="zukato-playlist-manager__picker">
      <label htmlFor="zukato-manager-choices-search">{t("playlistManager.findPlaylist")}</label>
      <input id="zukato-manager-choices-search" type="search" value={choiceSearch} disabled={locked}
        onChange={event => setChoiceSearch(event.currentTarget.value)} />
      <label htmlFor="zukato-manager-choices">{t("playlistManager.chooseSource")}</label>
      <select id="zukato-manager-choices" value="" disabled={locked || !chosen.length}
        onChange={event => changeSource(event.currentTarget.value)}>
        <option value="">{t("playlistManager.chooseSource")}</option>
        {chosen.map(item => <option key={item.uri} value={item.uri}>{item.name} · {item.owner}</option>)}
      </select>
      {choiceMore && <button type="button" disabled={locked} onClick={() => { void loadChoices(false); }}>
        {t("playlistBrowser.more")}
      </button>}
    </div>}
    <label htmlFor="zukato-manager-source">{t("playlistManager.source")}</label>
    <div className="zukato-toolbar">
      <input id="zukato-manager-source" type="text" maxLength={320} value={source}
        aria-invalid={source.trim() ? !parsedSource : undefined} disabled={locked}
        placeholder="https://open.spotify.com/playlist/…"
        onChange={event => changeSource(event.currentTarget.value)} />
      <button type="button" disabled={locked || !parsedSource} onClick={() => { void loadItems(true); }}>
        {busy ? t("playlistManager.loading") : t("playlistManager.load")}
      </button>
    </div>
    <div className="zukato-playlist-manager__details">
      <button type="button" disabled={locked || !parsedSource} onClick={() => { void loadDetails(); }}>
        {detailsBusy ? t("playlistManager.loading") : t("playlistManager.detailsLoad")}
      </button>
      {details && details.uri === parsedSource && <div className="zukato-playlist-manager__details-form">
        <label htmlFor="zukato-manager-details-name">{t("playlistManager.detailsName")}</label>
        <input id="zukato-manager-details-name" type="text" maxLength={100}
          disabled={locked} value={editName}
          onChange={event => setEditName(event.currentTarget.value)} />
        <label htmlFor="zukato-manager-details-description">{t("playlistManager.detailsDescription")}</label>
        <textarea id="zukato-manager-details-description" maxLength={300}
          disabled={locked} value={editDescription}
          onChange={event => setEditDescription(event.currentTarget.value)} />
        <small>{t("playlistManager.detailsHint")}</small>
        <button type="button" disabled={locked || !detailsChangeValid} onClick={() => { void saveDetails(); }}>
          {t("playlistManager.detailsSave")}
        </button>
      </div>}
    </div>
    {message && <p role={error ? "alert" : "status"} className={error ? "zukato-error" : ""}>{message}</p>}
    {validView && <>
      <p role="status">{t("playlistManager.count", { count: entries.length, total })}</p>
      <label htmlFor="zukato-manager-search">{t("playlistManager.filter")}</label>
      <input id="zukato-manager-search" type="search" value={search} disabled={locked}
        onChange={event => { setSearch(event.currentTarget.value); setPage(0); }} />
      <div className="zukato-toolbar">
        <button type="button" disabled={locked || !filteredUris.length} onClick={() =>
          setSelected(before => [...new Set([...before, ...filteredUris])])}>
          {t("playlistManager.selectResults")}
        </button>
        <button type="button" disabled={locked || !selected.length} onClick={() => setSelected([])}>
          {t("playlistManager.clear")}
        </button>
        <span>{t("playlistManager.selected", { count: availableSelection.length })}</span>
      </div>
      <ul className="zukato-playlist-manager__items">
        {visible.map(item => <li key={item.key}>
          <label>
            <input type="checkbox" checked={selectedSet.has(item.uri)} disabled={locked}
              onChange={() => toggle(item.uri)} aria-label={t("playlistManager.selectTrack", { title: item.title })} />
            <span><strong>{item.title}</strong><small>{item.artist || item.uri}</small></span>
          </label>
          <button type="button" disabled={locked} aria-pressed={moveFrom === item.position}
            aria-label={t("playlistManager.chooseMove", { title: item.title, position: item.position + 1 })}
            onClick={() => {
              setMoveFrom(item.position);
              setMoveTo(String(item.position + 1));
            }}>{t("playlistManager.moveChoose")}</button>
        </li>)}
      </ul>
      {moveEntry && <div className="zukato-playlist-manager__move">
        <p>{t("playlistManager.moveSelected", { title: moveEntry.title, position: moveFrom! + 1 })}</p>
        <label htmlFor="zukato-manager-move-target">{t("playlistManager.moveTarget", { total })}</label>
        <div className="zukato-toolbar">
          <input id="zukato-manager-move-target" type="number" min={1} max={total} step={1}
            disabled={locked} value={moveTo} onChange={event => setMoveTo(event.currentTarget.value)} />
          <button type="button" disabled={!canMove} onClick={() => { void moveSelected(); }}>
            {t("playlistManager.moveApply")}
          </button>
          <button type="button" disabled={locked} onClick={() => { setMoveFrom(null); setMoveTo(""); }}>
            {t("playlistManager.moveCancel")}
          </button>
        </div>
        <small>{t("playlistManager.moveHint")}</small>
      </div>}
      {pages > 1 && <div className="zukato-toolbar">
        <button type="button" disabled={locked || safePage === 0} onClick={() => setPage(safePage - 1)}>
          {t("playlistPaste.previous")}</button>
        <span>{t("playlistPaste.page", { page: safePage + 1, total: pages })}</span>
        <button type="button" disabled={locked || safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
          {t("playlistPaste.next")}</button>
      </div>}
      <div className="zukato-playlist-manager__jump">
        <label htmlFor="zukato-manager-remote-page">{t("playlistManager.remotePage", { total: remotePages })}</label>
        <div className="zukato-toolbar">
          <input id="zukato-manager-remote-page" type="number" min={1} max={remotePages} step={1}
            disabled={locked} value={remotePage}
            onChange={event => setRemotePage(event.currentTarget.value)} />
          <button type="button" disabled={locked || !validRemotePage}
            onClick={jumpToPage}>{t("playlistManager.jump")}</button>
        </div>
        {total > CONTENT_LIMIT && <small>{t("playlistManager.maxPages", { limit: CONTENT_LIMIT })}</small>}
        <small>{t("playlistManager.jumpHint")}</small>
      </div>
      {hasMore && <button type="button" disabled={locked} onClick={() => { void loadItems(false); }}>
        {t("playlistManager.more")}
      </button>}
      <div className="zukato-toolbar">
        <button type="button" disabled={locked || availableSelection.length === 0}
          onClick={() => { void onQueue([...availableSelection]); }}>
          {t("playlistManager.queue", { count: availableSelection.length })}
        </button>
        <button type="button" disabled={locked || availableSelection.length === 0}
          onClick={() => { void deleteSelected(); }}>
          {writing ? t("playlistManager.deleting") : t("playlistManager.remove", { count: availableSelection.length })}
        </button>
      </div>
      <small>{t("playlistManager.duplicates")}</small>
      <h4>{t("playlistManager.copy")}</h4>
      <PlaylistDestination t={t} uris={availableSelection} disabled={locked}
        idPrefix="zukato-manager-copy" />
    </>}
  </section>;
}
