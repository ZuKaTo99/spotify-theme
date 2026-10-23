// =============================================================================
// Datei: src/shared/listening-insights.ts
// Zweck: Lokale Auswertung gespeicherter Songwechsel für Dashboard und Statistik.
// Keine Spotify-Streamingminuten, keine Netzwerkabfrage, keine Speicherung.
// Alle Zeiträume basieren auf lokalen Kalendertagen (inklusive heute), auch an
// Tagen mit Sommer-/Winterzeitumstellung.
// =============================================================================
import type { HistoryEntry } from "./library";

export type InsightsPeriod = "7d" | "30d" | "all";
export interface RankedArtist { name: string; count: number }
export interface RankedTrack { uri: string; title: string; artist: string; count: number }
export interface ActivityDay { start: number; count: number }
export interface ListeningInsights {
  events: number;
  unique: number;
  today: number;
  activeDays: number;
  artists: RankedArtist[];
  tracks: RankedTrack[];
  /** Genau sieben lokale Kalendertage, auch wenn keine Wechsel aufgezeichnet wurden. */
  daily: ActivityDay[];
}

/** Beginnt jeweils um 00:00 Uhr in der lokalen Zeitzone – nicht UTC. */
function dayStart(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Reine Aggregation: beschädigte Zeitstempel und Einträge aus der Zukunft ignorieren. */
export function analyzeListeningHistory(
  history: readonly HistoryEntry[], period: InsightsPeriod, now: number = Date.now(),
): ListeningInsights {
  const reference = Number.isFinite(now) ? now : Date.now();
  const todayStart = dayStart(reference);
  const startOf = (days: number): number => {
    const d = new Date(reference);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - days + 1).getTime();
  };
  const lowerBound = period === "7d" ? startOf(7) : period === "30d" ? startOf(30) : -Infinity;
  const sevenDayStart = startOf(7);
  const artistCounts = new Map<string, number>();
  const trackCounts = new Map<string, RankedTrack>();
  const allDays = new Set<number>();
  const unique = new Set<string>();
  const daily: ActivityDay[] = Array.from({ length: 7 }, (_, offset) => ({
    start: startOf(7 - offset), count: 0,
  }));
  const dailyByStart = new Map(daily.map((day) => [day.start, day]));
  let events = 0;
  let today = 0;
  for (const entry of history) {
    if (!entry || typeof entry.uri !== "string" || !entry.uri ||
        typeof entry.playedAt !== "number" || !Number.isFinite(entry.playedAt) ||
        entry.playedAt < 0 || entry.playedAt > reference) continue;
    const start = dayStart(entry.playedAt);
    // Die Tageskurve ist immer eine Vorschau auf die letzten sieben Tage,
    // unabhängig vom ausgewählten Zeitraum der Ranglisten.
    if (start >= sevenDayStart) {
      const day = dailyByStart.get(start);
      if (day) day.count += 1;
    }
    if (entry.playedAt < lowerBound) continue;
    events += 1;
    unique.add(entry.uri);
    allDays.add(start);
    if (start === todayStart) today += 1;
    const artist = typeof entry.artist === "string" ? entry.artist.trim() : "";
    if (artist) artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    const existing = trackCounts.get(entry.uri);
    if (existing) existing.count += 1;
    else trackCounts.set(entry.uri, {
      uri: entry.uri,
      title: typeof entry.title === "string" && entry.title.trim() ? entry.title : entry.uri,
      artist,
      count: 1,
    });
  }
  // Map-Reihenfolge ist der Tie-Breaker (erster beobachteter Titel/Künstler).
  return {
    events,
    unique: unique.size,
    today,
    activeDays: allDays.size,
    artists: [...artistCounts].map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10),
    tracks: [...trackCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    daily,
  };
}
