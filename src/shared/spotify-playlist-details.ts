// =============================================================================
// Datei: src/shared/spotify-playlist-details.ts
// Zweck: Eigene Playlists lesen und Name/Beschreibung nach Bestätigung ändern.
// Spotify: GET /me, GET /playlists/{id}, PUT /playlists/{id}.
// Nur Eigentümer dürfen Details ändern. Weder Sichtbarkeit noch Songs anfassen.
// =============================================================================
import { parseSpotifyPlaylistInput } from "./spotify-playlist-transfer";

export interface EditablePlaylistDetails {
  uri: string;
  name: string;
  description: string;
  ownerId: string;
}
export interface PlaylistDetailsChange {
  name: string;
  description: string;
}

export function playlistDetailsUrl(value: string): string {
  const uri = parseSpotifyPlaylistInput(value);
  if (!uri) throw new Error("Invalid playlist source");
  return `https://api.spotify.com/v1/playlists/${uri.split(":")[2]}`;
}

/** API-Daten nicht still als leere Werte ausgeben. */
export function parseOwnedPlaylistDetails(
  playlist: string, me: unknown, details: unknown,
): EditablePlaylistDetails {
  const uri = parseSpotifyPlaylistInput(playlist);
  if (!uri || !me || typeof me !== "object" || !details || typeof details !== "object") {
    throw new Error("Invalid playlist details");
  }
  const accountId = (me as Record<string, unknown>).id;
  const data = details as Record<string, unknown>;
  const owner = data.owner && typeof data.owner === "object"
    ? (data.owner as Record<string, unknown>).id : undefined;
  if (typeof accountId !== "string" || !accountId ||
    typeof owner !== "string" || !owner || owner !== accountId) {
    throw new Error("Playlist is not owned by current user");
  }
  // Verhindert versehentliches Bearbeiten einer falschen Playlist aus einem
  // gecachten Spotify-Response oder einem konkurrierenden Request.
  const responseUri = typeof data.uri === "string" ? parseSpotifyPlaylistInput(data.uri) : null;
  const responseId = typeof data.id === "string"
    ? parseSpotifyPlaylistInput(`spotify:playlist:${data.id}`) : null;
  if ((responseUri && responseUri !== uri) || (responseId && responseId !== uri) ||
    (!responseUri && !responseId) || typeof data.name !== "string" ||
    !data.name.trim() || data.name.length > 100 ||
    (data.description !== null && typeof data.description !== "string") ||
    (typeof data.description === "string" && data.description.length > 300)) {
    throw new Error("Invalid or mismatched playlist details");
  }
  return { uri, name: data.name, description: typeof data.description === "string" ? data.description : "", ownerId: owner };
}

/** Formularwerte strikt begrenzen, BEVOR Spotify kontaktiert wird. */
export function validatePlaylistDetailsChange(name: string, description: string): PlaylistDetailsChange {
  if (typeof name !== "string" || typeof description !== "string") {
    throw new Error("Invalid playlist details input");
  }
  const cleanName = name.trim();
  const cleanDescription = description.trim();
  if (!cleanName || cleanName.length > 100 || cleanDescription.length > 300 ||
    /[\u0000-\u001f\u007f]/u.test(cleanName) ||
    /[\u0000-\u001f\u007f]/u.test(cleanDescription)) {
    throw new Error("Invalid playlist details input");
  }
  return { name: cleanName, description: cleanDescription };
}

/** Besitz mit zwei frischen GET-Antworten prüfen, bevor Daten im UI editiert werden. */
export async function fetchOwnedPlaylistDetails(
  playlist: string, get: (url: string) => Promise<unknown>,
): Promise<EditablePlaylistDetails> {
  const url = playlistDetailsUrl(playlist);
  const me = await get("https://api.spotify.com/v1/me");
  const details = await get(`${url}?fields=id,uri,name,description,owner(id)`);
  return parseOwnedPlaylistDetails(playlist, me, details);
}

/** Keine Retry-Schleife: Ein Netzfehler kann NACH erfolgreichem PUT auftreten. */
export async function updateSpotifyPlaylistDetails(
  original: EditablePlaylistDetails,
  name: string, description: string,
  put: (url: string, body: PlaylistDetailsChange) => Promise<unknown>,
  mayWrite: () => boolean = () => true,
): Promise<boolean> {
  const body = validatePlaylistDetailsChange(name, description);
  const url = playlistDetailsUrl(original.uri);
  if (body.name === original.name && body.description === original.description) return false;
  if (!mayWrite()) return false;
  // PUT /playlists/{id} kann bei Erfolg einen LEEREN Body zurückgeben.
  // Die Übertragung gilt als gesendet, wenn die API keinen Fehler wirft.
  await put(url, body);
  return true;
}
