// =============================================================================
// Datei: src/custom-app/modules/visualizer/lyrics.ts
// Zweck: Offline-Parser für synchronisierte .lrc-Dateien, OHNE fremde Lyrics-API.
// Wo ändern? Timing / Importformat hier; Anzeige und Import befinden sich in Visualizer.tsx.
// =============================================================================

/** Eine Zeile kann in einer LRC-Datei mehrere Zeitmarken besitzen. */
export interface TimedLyricLine { timeMs: number; text: string }

/** Maximale Textlänge vermeidet unabsichtlich riesige Storage-Einträge. */
export const MAX_LYRICS_CHARS = 200_000;

/**
 * Unterstützt [mm:ss.xx], [mm:ss.xxx], mehrere Marken pro Zeile und [offset:+/-ms].
 * Metadaten wie [ar:] oder [ti:] werden ignoriert; keine Lyrics werden erfunden.
 */
export function parseLrc(content: string): TimedLyricLine[] {
  const input = content.replace(/^\uFEFF/, "").slice(0, MAX_LYRICS_CHARS);
  const offset = /\[offset:\s*([+-]?\d+)\s*\]/i.exec(input);
  const delayMs = offset ? Math.max(-60_000, Math.min(60_000, Number(offset[1]))) : 0;
  const found: TimedLyricLine[] = [];
  const timestamp = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const original of input.split(/\r?\n/)) {
    const matches = [...original.matchAll(timestamp)];
    if (matches.length === 0) continue;
    // Nach Entfernen aller Timestamps bleibt ausschließlich der sichtbare Liedtext.
    const text = original.replace(timestamp, "").replace(/\[[a-z]{1,10}:[^\]]*\]/gi, "").trim();
    if (!text) continue;
    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      if (seconds > 59) continue;
      // 2 Stellen = Hundertstel, 3 Stellen = Millisekunden.
      const fraction = match[3] ?? "0";
      const ms = Number(fraction.padEnd(3, "0"));
      const timeMs = Math.max(0, minutes * 60_000 + seconds * 1000 + ms + delayMs);
      found.push({ timeMs, text: text.slice(0, 500) });
      if (found.length >= 3000) break;
    }
    if (found.length >= 3000) break;
  }
  return found.sort((a, b) => a.timeMs - b.timeMs);
}

/** Gibt -1 zurück, bevor die erste Liedzeile beginnt (kein vorzeitiges Highlight). */
export function activeLyricIndex(lines: readonly TimedLyricLine[], progressMs: number): number {
  if (!Number.isFinite(progressMs) || lines.length === 0) return -1;
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (lines[middle].timeMs <= progressMs) {
      result = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return result;
}

/**
 * Der lokale LRC-Editor setzt Zeitmarken passend zum Spotify-Player.
 * Immer Hundertstelsekunden verwenden, damit Export/Import mit LRC-Apps klappt.
 */
export function formatLrcTimestamp(progressMs: number): string {
  const centiseconds = Math.max(0, Math.floor((Number.isFinite(progressMs) ? progressMs : 0) / 10));
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const fraction = centiseconds % 100;
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}]`;
}
