// =============================================================================
// Datei: src/shared/dashboard-summary.ts
// Zweck: Reine Dashboard-Auswertungen ohne Spotify-API oder React.
// Änderungsort für Kennzahlen und Ranglisten; einfache Unit-Tests möglich.
// =============================================================================
import type { HistoryEntry } from "./library";

export interface DashboardSummary {
  changes: number;
  distinct: number;
  topArtist: string | null;
  latest: HistoryEntry[];
}

/** Wertet nur tatsächlich gespeicherte Songwechsel aus – keine Hörminuten erfinden. */
export function summarizeDashboard(history: readonly HistoryEntry[]): DashboardSummary {
  const artistCounts = new Map<string, number>();
  for (const item of history) {
    // Ein fehlender Künstler soll kein Top-Artist sein.
    if (item.artist.trim()) artistCounts.set(item.artist, (artistCounts.get(item.artist) ?? 0) + 1);
  }
  const topArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    changes: history.length,
    distinct: new Set(history.map((entry) => entry.uri)).size,
    topArtist,
    latest: history.slice(0, 5),
  };
}
