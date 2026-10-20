// =============================================================================
// Datei: visualizer-runtime.ts
// Zweck: Eine zentrale, testbare Abfrage-Policy fuer lange Spotify-Sitzungen.
// Wo aendern? Polling-Intervalle und die Regeln fuer unnoetige DOM-Arbeit hier.
// WICHTIG: Ereignisse von Spotify bleiben sofortig; nur Fallback-Timer werden
// langsamer. Damit bleiben Songwechsel, Pause und Rueckkehr sichtbar aktuell.
// =============================================================================

/** Sichtbarer laufender Player: genaue Lyrics/Video-Synchronisation (4 Hz). */
export const VISIBLE_PLAYING_POLL_MS = 250;
/** Pause: Seek-Erkennung ohne unnoetige vier React-Renders pro Sekunde. */
export const VISIBLE_PAUSED_POLL_MS = 1000;
/** Hintergrund: Audio wird nicht angehalten, nur teure UI-Abfragen gedrosselt. */
export const HIDDEN_PLAYER_POLL_MS = 2000;

/** Wird fuer jeden neuen Timer anhand des aktuellen Playerzustands berechnet. */
export function playerPollDelayMs(playing: boolean, hidden: boolean): number {
  return hidden ? HIDDEN_PLAYER_POLL_MS : playing ? VISIBLE_PLAYING_POLL_MS : VISIBLE_PAUSED_POLL_MS;
}

/** Nur der Songlauf (URI + Index) beeinflusst die Szenenwahl der Oberflaeche. */
export function sameVisibleSongRun(
  previous: { uri: string; index: number } | null,
  next: { uri: string; index: number } | null,
): boolean {
  return previous === next || (!!previous && !!next &&
    previous.uri === next.uri && previous.index === next.index);
}

/** Spotify-DOM nur dann nach Lyrics durchsuchen, wenn Fallback wirklich gebraucht wird. */
export function shouldReadNativeLyrics(
  enabled: boolean, timedLyricsPresent: boolean, plainLyricsPresent: boolean, hidden: boolean,
): boolean {
  return enabled && !timedLyricsPresent && !plainLyricsPresent && !hidden;
}
