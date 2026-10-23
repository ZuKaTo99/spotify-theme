// =============================================================================
// Datei: src/shared/spotify-playlist-transfer.ts
// Zweck: Sichere Übernahme ausgewählter Titel in EXISTIERENDE Spotify-Playlists.
// WICHTIG: Dies ist KEIN lokaler ZuKaTo-Favoriten-Speicher und KEINE Queue.
// Netzwerkzugriffe werden ausschließlich vom expliziten UI-Klick ausgelöst.
// Spotify unterstützt maximal 100 URIs pro API-Aufruf. Nach einem unsicheren
// API-Fehler wird bewusst NICHT automatisch wiederholt (Duplikatgefahr).
// =============================================================================

/** Nur Playlist-Links der echten Spotify-Domain und 22-stellige IDs zulassen. */
export function parseSpotifyPlaylistInput(raw: string): string | null {
  const value = raw.trim();
  const uri = /^spotify:playlist:([A-Za-z0-9]{22})$/i.exec(value);
  if (uri) return `spotify:playlist:${uri[1]}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
    const match = /^\/(?:intl-[A-Za-z-]+\/)?playlist\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);
    return match ? `spotify:playlist:${match[1]}` : null;
  } catch {
    return null;
  }
}

/** Nur Titel und Episoden; Alben, externe Hosts und fremde Schemas bleiben weg. */
export function parsePlaylistItem(raw: string): string | null {
  const value = raw.trim();
  const uri = /^spotify:(track|episode):([A-Za-z0-9]{22})$/i.exec(value);
  if (uri) return `spotify:${uri[1].toLowerCase()}:${uri[2]}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
    const match = /^\/(?:intl-[A-Za-z-]+\/)?(track|episode)\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);
    return match ? `spotify:${match[1]}:${match[2]}` : null;
  } catch {
    return null;
  }
}

export interface PlaylistTransferResult {
  added: number;
  skipped: number;
  totalValid: number;
  playlistUri: string;
}

/** Fehler mit bestätigter Anzahl. Ein abgebrochener Request kann dennoch
 * serverseitig angekommen sein – daher keine automatische Wiederholung. */
export class PlaylistTransferError extends Error {
  readonly added: number;
  readonly totalValid: number;
  readonly skipped: number;
  constructor(message: string, added: number, totalValid: number, skipped: number) {
    super(message);
    this.name = "PlaylistTransferError";
    this.added = added;
    this.totalValid = totalValid;
    this.skipped = skipped;
  }
}

/** POST ist injizierbar: die gesamte Transfersicherheit ist ohne Spotify testbar. */
export async function addItemsToSpotifyPlaylist(
  destination: string,
  inputs: readonly string[],
  post: (url: string, body: { uris: string[] }) => Promise<unknown>,
): Promise<PlaylistTransferResult> {
  const playlistUri = parseSpotifyPlaylistInput(destination);
  if (!playlistUri) throw new Error("Invalid Spotify playlist URL");

  // Keine verdeckte Begrenzung: gültige Auswahl geht in Originalreihenfolge
  // in die Playlist. Doppelte Titel werden im Sinne einer Auswahl dedupliziert.
  const uris: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const item of inputs) {
    const uri = parsePlaylistItem(item);
    if (!uri || seen.has(uri)) { skipped++; continue; }
    seen.add(uri);
    uris.push(uri);
  }
  if (!uris.length) return { playlistUri, added: 0, skipped, totalValid: 0 };

  const id = playlistUri.split(":")[2];
  const endpoint = `https://api.spotify.com/v1/playlists/${id}/items`;
  let added = 0;
  for (let offset = 0; offset < uris.length; offset += 100) {
    const batch = uris.slice(offset, offset + 100);
    try {
      // Die aktuelle Spotify-Web-API erwartet {uris:[...]}, max. 100 Werte.
      // Eine erfüllte CosmosAsync-POST-Promise gilt als bestätigt.
      await post(endpoint, { uris: batch });
      added += batch.length;
    } catch (error) {
      throw new PlaylistTransferError(
        `Playlist transfer stopped: ${error instanceof Error ? error.message : String(error)}`,
        added, uris.length, skipped,
      );
    }
  }
  return { playlistUri, added, skipped, totalValid: uris.length };
}

// =============================================================================
// v1.61: Einfügen ganzer Link-Sammlungen statt einzelner Titel.
// Die Analyse greift auf dieselbe URI-Validierung wie der Playlist-Transfer zu.
// Ungültige oder doppelte Werte werden sichtbar gezählt; bei einer Überschreitung
// der Grenzen wird JEDE Übertragung blockiert, niemals still abgeschnitten.
// =============================================================================
export const PASTE_LIMIT = 500;
export const PASTE_CHARACTER_LIMIT = 60_000;
export const PASTE_TOKEN_LIMIT = 2_000;

export interface PastedPlaylistReport {
  uris: string[];
  total: number;
  invalid: number;
  duplicates: number;
  issue: "characters" | "tokens" | "items" | null;
}

/** Leerraum, Zeilenwechsel, Kommas und Semikola dürfen Links trennen. */
export function analyzePastedSpotifyLinks(raw: string): PastedPlaylistReport {
  const empty = (issue: PastedPlaylistReport["issue"]): PastedPlaylistReport =>
    ({ uris: [], total: 0, invalid: 0, duplicates: 0, issue });
  if (raw.length > PASTE_CHARACTER_LIMIT) return empty("characters");
  const tokens = raw.trim() ? raw.trim().split(/[\s,;]+/u) : [];
  if (tokens.length > PASTE_TOKEN_LIMIT) return empty("tokens");

  const seen = new Set<string>();
  const uris: string[] = [];
  let invalid = 0;
  let duplicates = 0;
  let issue: PastedPlaylistReport["issue"] = null;
  for (const token of tokens) {
    const normalized = parsePlaylistItem(token);
    if (!normalized) { invalid++; continue; }
    if (seen.has(normalized)) { duplicates++; continue; }
    seen.add(normalized);
    if (uris.length < PASTE_LIMIT) uris.push(normalized);
    else issue = "items";
  }
  return { uris, total: tokens.length, invalid, duplicates, issue };
}

// Zuletzt benutzte Ziele enthalten NUR valide Spotify-Playlist-URIs.
// Es werden keine Kontodaten, Zugangstoken oder Playlist-Inhalte gespeichert.
export const RECENT_PLAYLIST_LIMIT = 5;
export const RECENT_PLAYLIST_STORAGE_KEY = "zukato:recent-playlist-destinations:v1";

/** Nach einem Storage- oder Importfehler nie fremde Daten im UI anzeigen. */
export function normalizeRecentPlaylists(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const distinct = new Set<string>();
  for (const item of raw.slice(0, 100)) {
    if (typeof item !== "string") continue;
    const uri = parseSpotifyPlaylistInput(item);
    if (uri) distinct.add(uri);
    if (distinct.size === RECENT_PLAYLIST_LIMIT) break;
  }
  return [...distinct];
}

/** Die zuletzt erfolgreich benutzte Playlist steht stets ganz vorn. */
export function rememberPlaylistDestination(previous: unknown, destination: string): string[] {
  const normalized = parseSpotifyPlaylistInput(destination);
  const saved = normalizeRecentPlaylists(previous);
  if (!normalized) return saved;
  return [normalized, ...saved.filter((item) => item !== normalized)]
    .slice(0, RECENT_PLAYLIST_LIMIT);
}

// =============================================================================
// v1.62: Bearbeitbare Import-Arbeitsliste.
// Wichtig: Die Originaleingabe bleibt beim Markieren/Sortieren unverändert.
// Listenoperationen verarbeiten ausschließlich URIs aus der gültigen Analyse;
// fremde bzw. veraltete React-State-Werte können keine Titel einschleusen.
// =============================================================================
export const PASTE_WORKBENCH_PAGE_SIZE = 30;

/** Der Benutzer kann Titel umsortieren, ohne Inhalte oder Duplikate zu erzeugen. */
export function orderPastedTracks(available: readonly string[], preferred: readonly string[]): string[] {
  const valid = new Set(available);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [...preferred, ...available]) {
    if (!valid.has(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

/** Eine Verschiebung betrifft genau einen Nachbarn in der Gesamt-Liste. */
export function movePastedTrack(ordered: readonly string[], item: string, direction: -1 | 1): string[] {
  const position = ordered.indexOf(item);
  const target = position + direction;
  if (position === -1 || target < 0 || target >= ordered.length) return [...ordered];
  const next = [...ordered];
  [next[position], next[target]] = [next[target], next[position]];
  return next;
}

/** Auswahl erhält die sichtbare Importreihenfolge. Der Ausschluss ist lokal. */
export function selectedPastedTracks(ordered: readonly string[], excluded: readonly string[]): string[] {
  const skip = new Set(excluded);
  return ordered.filter((item) => !skip.has(item));
}

export interface PastedTrackPage {
  items: string[];
  filteredTotal: number;
  page: number;
  pages: number;
}

/** Maximal 30 DOM-Zeilen gleichzeitig, Suchfilter ändert niemals den Versand. */
export function pagePastedTracks(ordered: readonly string[], search: string, page: number): PastedTrackPage {
  const query = search.trim().toLowerCase();
  const filtered = query ? ordered.filter((item) => item.toLowerCase().includes(query)) : [...ordered];
  const pages = Math.ceil(filtered.length / PASTE_WORKBENCH_PAGE_SIZE);
  const safePage = Number.isFinite(page) ? Math.min(Math.max(Math.floor(page), 0), Math.max(0, pages - 1)) : 0;
  return {
    items: filtered.slice(safePage * PASTE_WORKBENCH_PAGE_SIZE, (safePage + 1) * PASTE_WORKBENCH_PAGE_SIZE),
    filteredTotal: filtered.length,
    page: safePage,
    pages,
  };
}

// =============================================================================
// v1.63: Lesender Playlist-Browser. Nur Spotify-eigene GET-Endpunkte; niemals
// extern gelieferte `next`-URLs ausführen (diese können veraltet sein).
// Mutationen bleiben strikt in addItemsToSpotifyPlaylist() nach Bestätigung.
// =============================================================================
export const PLAYLIST_BROWSER_PAGE_SIZE = 50;
export const PLAYLIST_BROWSER_LIMIT = 500;

export interface BrowserPlaylist {
  uri: string;
  name: string;
  owner: string;
  itemCount: number | null;
}

export interface BrowserPlaylistPage {
  items: BrowserPlaylist[];
  nextOffset: number;
  hasMore: boolean;
  total: number;
}

/** Die Adresse wird ausschließlich aus konstantem Endpoint und geprüftem Offset erstellt. */
export function playlistBrowserUrl(offset: number): string {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= PLAYLIST_BROWSER_LIMIT ||
    offset % PLAYLIST_BROWSER_PAGE_SIZE !== 0) {
    throw new Error("Invalid playlist browse offset");
  }
  return `https://api.spotify.com/v1/me/playlists?limit=${PLAYLIST_BROWSER_PAGE_SIZE}&offset=${offset}`;
}

/** Nur begrenzte, plausibel strukturierte Metadaten für die Auswahlliste übernehmen. */
export function normalizePlaylistBrowserPage(raw: unknown, requestedOffset: number): BrowserPlaylistPage {
  playlistBrowserUrl(requestedOffset);
  if (!raw || typeof raw !== "object") throw new Error("Invalid Spotify playlist response");
  const payload = raw as Record<string, unknown>;
  if (!Array.isArray(payload.items) || payload.items.length > PLAYLIST_BROWSER_PAGE_SIZE ||
    !Number.isSafeInteger(payload.total) || (payload.total as number) < 0 ||
    (payload.total as number) > 100_000) {
    throw new Error("Invalid Spotify playlist page");
  }
  const items: BrowserPlaylist[] = [];
  const seen = new Set<string>();
  for (const candidate of payload.items) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    const uri = typeof entry.uri === "string" ? parseSpotifyPlaylistInput(entry.uri) : null;
    const fallback = typeof entry.id === "string" ? parseSpotifyPlaylistInput(`spotify:playlist:${entry.id}`) : null;
    const normalized = uri ?? fallback;
    if (!normalized || seen.has(normalized) || typeof entry.name !== "string" || !entry.name.trim()) continue;
    seen.add(normalized);
    const owner = entry.owner && typeof entry.owner === "object"
      ? entry.owner as Record<string, unknown> : {};
    const ownerLabel = typeof owner.display_name === "string" && owner.display_name.trim()
      ? owner.display_name : typeof owner.id === "string" ? owner.id : "";
    const countHolder = entry.items && typeof entry.items === "object"
      ? entry.items as Record<string, unknown> : entry.tracks && typeof entry.tracks === "object"
        ? entry.tracks as Record<string, unknown> : {};
    const itemCount = Number.isSafeInteger(countHolder.total) &&
      (countHolder.total as number) >= 0 && (countHolder.total as number) <= 1_000_000
      ? countHolder.total as number : null;
    items.push({
      uri: normalized,
      name: entry.name.trim().slice(0, 120),
      owner: ownerLabel.slice(0, 100),
      itemCount,
    });
  }
  const total = payload.total as number;
  // Bei defekten oder verkürzten Seiten keine Schleife auslösen. Spotify
  // liefert je Anfrage maximal 50 Einträge, daher nur volle Seiten fortsetzen.
  const nextOffset = requestedOffset + PLAYLIST_BROWSER_PAGE_SIZE;
  return {
    items,
    nextOffset,
    hasMore: payload.items.length === PLAYLIST_BROWSER_PAGE_SIZE &&
      nextOffset < total && nextOffset < PLAYLIST_BROWSER_LIMIT,
    total,
  };
}

/** Gültige Ergebnisse aus mehreren Seiten ohne Duplikate zusammenführen. */
export function mergeBrowsedPlaylists(
  previous: readonly BrowserPlaylist[], incoming: readonly BrowserPlaylist[],
): BrowserPlaylist[] {
  const seen = new Set<string>();
  const result: BrowserPlaylist[] = [];
  for (const item of [...previous, ...incoming]) {
    if (!parseSpotifyPlaylistInput(item.uri) || seen.has(item.uri)) continue;
    seen.add(item.uri);
    result.push(item);
    if (result.length === PLAYLIST_BROWSER_LIMIT) break;
  }
  return result;
}

// =============================================================================
// v1.65: Neue Playlist als Ziel erstellen, aber KEINE Songs automatisch senden.
// POST /me/playlists wurde von der aktuellen Spotify Web API bestätigt.
// Weil ein Server-Timeout trotz erfolgreichem POST auftreten kann, niemals
// ungefragt denselben Namen ein zweites Mal anlegen (keine Auto-Retries).
// =============================================================================
export interface CreatePlaylistBody {
  name: string;
  description: string;
  public: boolean;
}

/** Ungültige Namen, Steuerzeichen und zu lange Texte VOR dem Netzwerk ablehnen. */
export function validateNewPlaylist(
  name: string, description: string, isPublic: boolean,
): CreatePlaylistBody {
  const cleanName = name.trim();
  const cleanDescription = description.trim();
  if (!cleanName || cleanName.length > 100 || /[\u0000-\u001F\u007F]/u.test(cleanName) ||
      cleanDescription.length > 300 || /[\u0000-\u001F\u007F]/u.test(cleanDescription) ||
      typeof isPublic !== "boolean") {
    throw new Error("Invalid new playlist details");
  }
  return { name: cleanName, description: cleanDescription, public: isPublic };
}

/** Nur von Spotify bestätigte Playlist-IDs als Ziel verwenden. Kein Transfer! */
export async function createSpotifyPlaylist(
  name: string, description: string, isPublic: boolean,
  post: (url: string, body: CreatePlaylistBody) => Promise<unknown>,
): Promise<string> {
  const body = validateNewPlaylist(name, description, isPublic);
  const response = await post("https://api.spotify.com/v1/me/playlists", body);
  if (!response || typeof response !== "object") throw new Error("Playlist creation unconfirmed");
  const data = response as Record<string, unknown>;
  const byUri = typeof data.uri === "string" ? parseSpotifyPlaylistInput(data.uri) : null;
  const byId = typeof data.id === "string" ? parseSpotifyPlaylistInput(`spotify:playlist:${data.id}`) : null;
  // Bei gleichzeitig ausgelieferten ID-/URI-Feldern müssen BEIDE korrekt sein.
  // Ein gültiges Feld darf ein widersprüchliches zweites nicht verdecken.
  if ((data.uri !== undefined && !byUri) || (data.id !== undefined && !byId)) {
    throw new Error("Invalid playlist creation response");
  }
  if (!byUri && !byId) throw new Error("Playlist creation unconfirmed");
  if (byUri && byId && byUri !== byId) throw new Error("Inconsistent playlist creation response");
  return (byUri ?? byId)!;
}
