// =============================================================================
// Datei: src/shared/spotify-playlist-content.ts
// Zweck: Playlist-Inhalte lesen, Seiten sicher prüfen und gezielt entfernen.
// Die Spotify-API ab 2026 benutzt /items statt /tracks. Ein DELETE anhand einer
// URI entfernt gegebenenfalls ALLE Vorkommen dieser URI in der Ziel-Playlist.
// Niemals unbestätigt löschen oder fehlgeschlagene Writes blind wiederholen.
// =============================================================================
import { parsePlaylistItem, parseSpotifyPlaylistInput } from "./spotify-playlist-transfer";

export const CONTENT_PAGE_SIZE = 50;
// Bis 10.000 Playlist-Positionen, aber pro Request unverändert nur 50.
// Große Playlists werden über direkte Seitennavigation statt Massenabruf gelesen.
export const CONTENT_LIMIT = 10_000;

/** 1-basierte API-Seite sicher in einen Spotify-Offset umrechnen. */
export function playlistItemPageOffset(page: number, total: number): number {
  if (!Number.isSafeInteger(total) || total < 1 || total > 1_000_000 ||
    !Number.isSafeInteger(page) || page < 1 ||
    page > Math.ceil(Math.min(total, CONTENT_LIMIT) / CONTENT_PAGE_SIZE)) {
    throw new Error("Invalid playlist page");
  }
  return (page - 1) * CONTENT_PAGE_SIZE;
}

export interface SpotifyPlaylistEntry {
  /** In der geladenen Ansicht eindeutig, auch bei mehrfachen Songs. */
  key: string;
  uri: string;
  title: string;
  artist: string;
  position: number;
}

export interface SpotifyPlaylistContentPage {
  items: SpotifyPlaylistEntry[];
  nextOffset: number;
  hasMore: boolean;
  total: number;
}

/** URL aus geprüfter Playlist-ID und Seitenposition erstellen; nie API-next folgen. */
export function playlistItemsUrl(playlist: string, offset: number): string {
  const parsed = parseSpotifyPlaylistInput(playlist);
  if (!parsed || !Number.isSafeInteger(offset) || offset < 0 ||
    offset >= CONTENT_LIMIT || offset % CONTENT_PAGE_SIZE !== 0) {
    throw new Error("Invalid playlist or items offset");
  }
  const id = parsed.split(":")[2];
  return `https://api.spotify.com/v1/playlists/${id}/items?limit=${CONTENT_PAGE_SIZE}&offset=${offset}`;
}

/** API-Paging validieren; gelöschte, lokale oder unbekannte Items nicht senden. */
export function normalizePlaylistItemsPage(
  raw: unknown, playlist: string, offset: number,
): SpotifyPlaylistContentPage {
  playlistItemsUrl(playlist, offset);
  if (!raw || typeof raw !== "object") throw new Error("Invalid playlist items response");
  const page = raw as Record<string, unknown>;
  if (!Array.isArray(page.items) || page.items.length > CONTENT_PAGE_SIZE ||
    !Number.isSafeInteger(page.total) || (page.total as number) < 0 ||
    (page.total as number) > 1_000_000) {
    throw new Error("Invalid playlist items page");
  }
  const items: SpotifyPlaylistEntry[] = [];
  for (const [index, rawEntry] of page.items.entries()) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = rawEntry as Record<string, unknown>;
    if (entry.is_local === true) continue;
    // Die neue Web-API verwendet `item`; Spotify-Cosmos liefert je nach
    // Client ggf. noch `track`. Beide Varianten werden geprüft.
    const track = entry.item ?? entry.track;
    if (!track || typeof track !== "object") continue;
    const info = track as Record<string, unknown>;
    const uri = typeof info.uri === "string" ? parsePlaylistItem(info.uri) : null;
    if (!uri) continue;
    const title = typeof info.name === "string" && info.name.trim()
      ? info.name.trim().slice(0, 160) : uri;
    const artists = Array.isArray(info.artists) ? info.artists : [];
    const artist = artists.map((artist: unknown) => {
      if (!artist || typeof artist !== "object") return "";
      const name = (artist as Record<string, unknown>).name;
      return typeof name === "string" ? name.trim().slice(0, 80) : "";
    }).filter(Boolean).slice(0, 4).join(", ");
    const publisher = typeof info.show === "object" && info.show
      ? (info.show as Record<string, unknown>).publisher : "";
    const by = artist || (typeof publisher === "string" ? publisher.slice(0, 120) : "");
    items.push({ key: `${offset + index}:${uri}`, uri, title, artist: by, position: offset + index });
  }
  const nextOffset = offset + CONTENT_PAGE_SIZE;
  return {
    items, nextOffset, total: page.total as number,
    hasMore: page.items.length === CONTENT_PAGE_SIZE && nextOffset < (page.total as number) &&
      nextOffset < CONTENT_LIMIT,
  };
}

/** Bei erneuten Seitenanfragen existierende Playlist-Positionen nicht duplizieren. */
export function mergePlaylistItems(
  before: readonly SpotifyPlaylistEntry[], incoming: readonly SpotifyPlaylistEntry[],
): SpotifyPlaylistEntry[] {
  const byPosition = new Map(before.map(item => [item.position, item]));
  for (const item of incoming) byPosition.set(item.position, item);
  return [...byPosition.values()].sort((a, b) => a.position - b.position).slice(0, CONTENT_LIMIT);
}

/** Auswahl ist URI-basiert: Alle Vorkommen derselben URI werden gemeinsam gewählt. */
export function selectedPlaylistUris(
  entries: readonly SpotifyPlaylistEntry[], selected: readonly string[],
): string[] {
  // Playlist-Reihenfolge ist maßgeblich, nicht die Reihenfolge der Klicks.
  // Dadurch bleiben Kopieren, Queue und Löschen über alle Seiten konsistent.
  const chosen = new Set(selected.map(value => parsePlaylistItem(value)).filter(Boolean));
  const sent = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    if (!chosen.has(entry.uri) || sent.has(entry.uri)) continue;
    sent.add(entry.uri);
    result.push(entry.uri);
  }
  return result;
}

export class PlaylistRemoveError extends Error {
  readonly removed: number;
  readonly total: number;
  constructor(removed: number, total: number, cause: unknown) {
    super(`Playlist removal stopped after ${removed}/${total}: ${String(cause)}`);
    this.removed = removed;
    this.total = total;
    this.name = "PlaylistRemoveError";
  }
}

/**
 * Löscht explizit ausgewählte URIs, max. 100 je Request. Spotify entfernt
 * möglicherweise ALLE Duplikate der URI, nicht nur eine Listenposition.
 * API-Antwort muss eine Snapshot-ID enthalten; unklare Writes werden NICHT
 * wiederholt, da sie serverseitig schon angekommen sein könnten.
 */
export async function removePlaylistUris(
  playlist: string,
  loaded: readonly SpotifyPlaylistEntry[],
  selected: readonly string[],
  del: (url: string, body: { items: { uri: string }[] }) => Promise<unknown>,
): Promise<{ removed: number; total: number }> {
  const uri = parseSpotifyPlaylistInput(playlist);
  if (!uri) throw new Error("Invalid Spotify playlist");
  const confirmed = selectedPlaylistUris(loaded, selected);
  if (!confirmed.length) return { removed: 0, total: 0 };
  const endpoint = `https://api.spotify.com/v1/playlists/${uri.split(":")[2]}/items`;
  let removed = 0;
  for (let start = 0; start < confirmed.length; start += 100) {
    const batch = confirmed.slice(start, start + 100);
    try {
      const response: unknown = await del(endpoint, { items: batch.map(item => ({ uri: item })) });
      if (!response || typeof response !== "object" ||
        typeof (response as Record<string, unknown>).snapshot_id !== "string" ||
        !(response as Record<string, string>).snapshot_id) {
        throw new Error("Spotify returned no confirmed snapshot");
      }
      removed += batch.length;
    } catch (error) {
      throw new PlaylistRemoveError(removed, confirmed.length, error);
    }
  }
  return { removed, total: confirmed.length };
}
