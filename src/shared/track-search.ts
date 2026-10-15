// =============================================================================
// Datei: src/shared/track-search.ts
// Zweck: Normale Spotify-Songs über Suche oder kopierte Spotify-Links finden.
// Architektur: ausschließlich offizielle Spotify-API über den Spotify-Client;
// weder Drittserver noch Zugangstoken auslesen oder manuell speichern.
// UI und Aktionen (Favorit / Warteschlange / Notiz) liegen in React-Komponenten.
// =============================================================================
import type { TrackInfo } from "./library";

/** URI und gewöhnliche Spotify-Links auf denselben stabilen Schlüssel bringen. */
export function parseSpotifyTrackInput(raw: string): string | null {
  const value = raw.trim();
  const uri = /^spotify:(track|episode):([a-zA-Z0-9]{22})$/i.exec(value);
  if (uri) return `spotify:${uri[1].toLowerCase()}:${uri[2]}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
    const match = /^\/(?:intl-[a-zA-Z-]+\/)?(track|episode)\/([a-zA-Z0-9]{22})\/?$/.exec(url.pathname);
    return match ? `spotify:${match[1]}:${match[2]}` : null;
  } catch { return null; }
}

/** Fremde oder beschädigte API-Antworten nie ungeprüft in die Library übernehmen. */
export function parseSpotifySearchResponse(raw: unknown): TrackInfo[] {
  if (!raw || typeof raw !== "object") return [];
  const source = raw as Record<string, unknown>;
  const list: unknown[] = [];
  for (const type of ["tracks", "episodes"] as const) {
    const section = source[type];
    if (section && typeof section === "object" && Array.isArray((section as { items?: unknown }).items)) {
      list.push(...(section as { items: unknown[] }).items);
    }
  }
  const found = new Set<string>();
  return list.flatMap((rawItem) => {
    if (!rawItem || typeof rawItem !== "object") return [];
    const item = rawItem as Record<string, unknown>;
    const uri = typeof item.uri === "string" ? parseSpotifyTrackInput(item.uri) : null;
    if (!uri || found.has(uri)) return [];
    found.add(uri);
    const artists = Array.isArray(item.artists) ? item.artists : [];
    const names = artists.flatMap((artist) => artist && typeof artist === "object" &&
      typeof (artist as { name?: unknown }).name === "string" ? [(artist as { name: string }).name] : []);
    const album = item.album && typeof item.album === "object" ? item.album as Record<string, unknown> : {};
    const show = item.show && typeof item.show === "object" ? item.show as Record<string, unknown> : {};
    return [{
      uri,
      title: typeof item.name === "string" ? item.name.slice(0, 180) : "Unbekannter Titel",
      artist: (names.join(", ") || (typeof show.name === "string" ? show.name : "Unbekannter Künstler")).slice(0, 180),
      album: (typeof album.name === "string" ? album.name : "").slice(0, 180),
    }];
  });
}

/** Führt eine einmalige Suche nach Bestätigung aus, nicht bei jedem Tastendruck. */
export async function searchSpotifyTracks(query: string): Promise<TrackInfo[]> {
  const input = query.trim();
  if (!input || input.length > 150) throw new Error("Bitte 1–150 Suchzeichen eingeben.");
  const url = `https://api.spotify.com/v1/search?type=track,episode&limit=15&q=${encodeURIComponent(input)}`;
  const response: unknown = await Spicetify.CosmosAsync.get(url);
  return parseSpotifySearchResponse(response);
}

/** Eingefügter Link wird über die gleiche Spotify-API mit Metadaten aufgelöst. */
export async function findSpotifyTrack(uri: string): Promise<TrackInfo | null> {
  const normalized = parseSpotifyTrackInput(uri);
  if (!normalized) return null;
  const [, type, id] = normalized.split(":");
  const response: unknown = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/${type}s/${id}`);
  // Das Detailobjekt hat denselben Aufbau wie ein einzelner Suchtreffer.
  return parseSpotifySearchResponse({ [type === "track" ? "tracks" : "episodes"]: { items: [response] } })[0] ?? null;
}
