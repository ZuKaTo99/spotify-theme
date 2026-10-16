// =============================================================================
// Datei: lyrics-identity.ts
// Zweck: Vollständigkeit der Spotify-Metadaten vor externen Lyrics-Abfragen.
//
// WARUM EXISTIERT DIESE DATEI?
//   Spicetify liefert die Track-URI häufig vor Titel, Künstler oder Laufzeit.
//   Eine Abfrage mit Platzhaltern führte bisher zu einem dauerhaften "Nicht
//   gefunden", obwohl die korrekten Daten kurz darauf vorlagen.
//
// Wo ändern? Weitere erkannte Platzhalter bzw. die Abfrage-Signatur hier.
// =============================================================================

/** Nur Metadaten, die für die automatische Lyrics-Suche relevant sind. */
export interface LyricsIdentity {
  uri: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

const PLACEHOLDERS = new Set([
  "unbekannter titel", "unbekannter künstler", "unknown title",
  "unknown artist", "unknown track", "unknown", "",
]);

/** Unvollständige Namen nicht versehentlich als echte Lyrics-Suchbegriffe senden. */
export function lyricsMetadataReady(track: LyricsIdentity): boolean {
  if (!/^spotify:track:[A-Za-z0-9]+$/.test(track.uri)) return false;
  const title = track.title.trim().toLocaleLowerCase();
  const artist = track.artist.trim().toLocaleLowerCase();
  return title.length > 0 && artist.length > 0 &&
    !PLACEHOLDERS.has(title) && !PLACEHOLDERS.has(artist);
}

/**
 * Stabiler Effect-Schlüssel: Fortschritt und Play/Pause sind ABSICHTLICH
 * ausgeschlossen; Titel-/Künstler-Nachlieferungen starten einen neuen Versuch.
 * Die Dauer wird auf Sekunden gerundet, um Millisekunden-Flattern zu vermeiden.
 */
export function lyricsLookupSignature(track: LyricsIdentity): string {
  const duration = Number.isFinite(track.duration) && track.duration > 0
    ? Math.round(track.duration / 1000) : 0;
  return JSON.stringify([track.uri, track.title.trim(), track.artist.trim(),
    track.album.trim(), duration]);
}
