// =============================================================================
// Datei: lyrics-local-recovery.ts
// Zweck: Fehlerhaftes IndexedDB darf ALLE automatischen Lyrics nicht blockieren.
//
// Eine lokal importierte LRC hat immer Vorrang. Falls ihr gespeicherter
// Datensatz jedoch nicht lesbar ist (z.B. Browser-Quota/IndexedDB-Fehler),
// muss ZuKaTo weiterhin Spotify und LRCLIB ausprobieren. Nur der defekte
// LOCAL-Override fällt aus; die fremden Lyrics werden nie lokal gespeichert.
// =============================================================================

/**
 * Mit direkter Dependency Injection leicht ohne echte Datenbank testbar.
 * Lese-Fehler werden sichtbar protokolliert, statt den gesamten Lyrics-Effekt
 * in Visualizer.tsx vorzeitig abzubrechen.
 */
export async function loadLocalLyricsWithFallback(
  uri: string,
  loader: (uri: string) => Promise<string | null>,
  report: (cause: unknown) => void,
): Promise<string | null> {
  try {
    return await loader(uri);
  } catch (cause) {
    report(cause);
    return null;
  }
}
