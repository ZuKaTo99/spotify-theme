// =============================================================================
// Datei: src/shared/spotify-playlist-reorder.ts
// Zweck: EIN Playlist-Vorkommen anhand seiner absoluten Position verschieben.
// Wichtig: Anders als Entfernen/Kopieren dürfen doppelte URIs NICHT zu einer
// Auswahl zusammengefasst werden. Spotify verwendet hierzu PUT /items mit
// Snapshot-ID; nach unklaren Antworten niemals automatisch wiederholen.
// =============================================================================
import { parseSpotifyPlaylistInput } from "./spotify-playlist-transfer";

export interface PlaylistReorderBody {
  range_start: number;
  insert_before: number;
  range_length: 1;
  snapshot_id: string;
}

/** GET und PUT werden ausschließlich an den geprüften Spotify-Host geschickt. */
export function playlistReorderEndpoints(source: string): { details: string; items: string } {
  const uri = parseSpotifyPlaylistInput(source);
  if (!uri) throw new Error("Invalid playlist source");
  const id = uri.split(":")[2];
  return {
    details: `https://api.spotify.com/v1/playlists/${id}?fields=snapshot_id`,
    items: `https://api.spotify.com/v1/playlists/${id}/items`,
  };
}

/** Ein Ziel ist 0-basiert. Beim Verschieben nach unten zählt insert_before
 * noch gegen die URSPRÜNGLICHE Reihenfolge (daher +1 nach dem Ziel). */
export function playlistReorderPositions(from: number, to: number, total: number):
  Pick<PlaylistReorderBody, "range_start" | "insert_before" | "range_length"> | null {
  if (![from, to, total].every(Number.isSafeInteger) || total < 1 || total > 1_000_000 ||
      from < 0 || from >= total || to < 0 || to >= total) {
    throw new Error("Invalid playlist reorder positions");
  }
  if (from === to) return null;
  return { range_start: from, insert_before: to > from ? to + 1 : to, range_length: 1 };
}

/** Snapshot strikt überprüfen. Kein PUT, wenn Spotify keinen liefert. */
export function readPlaylistSnapshot(value: unknown): string {
  if (!value || typeof value !== "object") throw new Error("Playlist snapshot missing");
  const snapshot = (value as Record<string, unknown>).snapshot_id;
  if (typeof snapshot !== "string" || !snapshot.trim() || snapshot.length > 512) {
    throw new Error("Invalid playlist snapshot");
  }
  return snapshot;
}

/**
 * Eine einzige bestätigte PUT-Anfrage – kein Retry oder stiller Ersatz der
 * Playlist-Inhalte. `mayWrite` verhindert einen alten PUT, wenn während des
 * Snapshot-GET die Quelle gewechselt oder die Komponente beendet wurde.
 */
export async function moveSpotifyPlaylistEntry(
  source: string,
  from: number,
  to: number,
  total: number,
  get: (url: string) => Promise<unknown>,
  put: (url: string, body: PlaylistReorderBody) => Promise<unknown>,
  mayWrite: () => boolean = () => true,
): Promise<boolean> {
  const positions = playlistReorderPositions(from, to, total);
  if (!positions) return false;
  const urls = playlistReorderEndpoints(source);
  const snapshot = readPlaylistSnapshot(await get(urls.details));
  if (!mayWrite()) return false;
  const response = await put(urls.items, { ...positions, snapshot_id: snapshot });
  readPlaylistSnapshot(response);
  return true;
}
