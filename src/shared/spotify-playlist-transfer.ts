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
