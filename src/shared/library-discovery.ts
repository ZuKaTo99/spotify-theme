// =============================================================================
// Datei: src/shared/library-discovery.ts
// Zweck: Titel aus dem lokal protokollierten Hörverlauf erneut entdecken.
// Keine Spotify-API, kein Storage-Schreibzugriff und keine fiktiven Hörminuten.
// =============================================================================
import type { HistoryEntry, TrackInfo } from "./library";

export type DiscoveryOrder = "frequent" | "missed";
export interface DiscoveryTrack extends TrackInfo {
  /** Häufigkeit der lokal protokollierten Songwechsel für diese Spotify-URI. */
  count: number;
  lastPlayedAt: number;
  /** Ob der Titel bereits in den lokalen ZuKaTo-Favoriten gespeichert ist. */
  isFavorite: boolean;
}

/** Ein Spotify-Eintrag erhält nur dann einen Vorschlag, wenn er im aktuellen
 * lokalen Verlauf tatsächlich vorkommt. Mehrfache Titel werden nach URI
 * zusammengefasst; verschiedene Songs mit gleichem Namen bleiben getrennt.
 * Ungültige und zukünftige Zeitstempel zählen grundsätzlich nicht mit. */
export function discoverLibraryTracks(
  history: readonly HistoryEntry[], favorites: readonly TrackInfo[],
  order: DiscoveryOrder = "frequent", minimumPlays = 2,
  onlyUnfavorited = true, now = Date.now(),
): DiscoveryTrack[] {
  const reference = Number.isFinite(now) ? now : Date.now();
  const minimum = Number.isSafeInteger(minimumPlays) && minimumPlays >= 1 && minimumPlays <= 10
    ? minimumPlays : 2;
  const saved = new Set(favorites.map((item) => item.uri));
  const found = new Map<string, DiscoveryTrack>();
  for (const entry of history) {
    if (!entry || !/^spotify:(?:track|episode):[A-Za-z0-9]{22}$/.test(entry.uri) ||
      !Number.isFinite(entry.playedAt) || entry.playedAt < 0 || entry.playedAt > reference) continue;
    const existing = found.get(entry.uri);
    if (existing) {
      existing.count += 1;
      if (entry.playedAt > existing.lastPlayedAt) {
        existing.lastPlayedAt = entry.playedAt;
        // Metadaten aus dem neuesten beobachteten Songwechsel übernehmen.
        existing.title = entry.title;
        existing.artist = entry.artist;
        existing.album = entry.album;
      }
    } else {
      found.set(entry.uri, {
        uri: entry.uri, title: entry.title, artist: entry.artist, album: entry.album,
        count: 1, lastPlayedAt: entry.playedAt, isFavorite: saved.has(entry.uri),
      });
    }
  }
  const results = [...found.values()].filter((entry) =>
    entry.count >= minimum && (!onlyUnfavorited || !entry.isFavorite));
  // Stabile Sortierung: Bei Gleichstand entscheiden echte lokale Zeitpunkte,
  // anschließend die Spotify-URI statt die zufällige Eingabereihenfolge.
  return results.sort((a, b) => order === "missed"
    ? a.lastPlayedAt - b.lastPlayedAt || b.count - a.count || a.uri.localeCompare(b.uri)
    : b.count - a.count || b.lastPlayedAt - a.lastPlayedAt || a.uri.localeCompare(b.uri));
}
