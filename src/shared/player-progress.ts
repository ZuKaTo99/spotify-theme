// =============================================================================
// Datei: src/shared/player-progress.ts
// Zweck: Aus echten Player-Millisekunden ausschließlich Anzeigezahlen ableiten.
// Keine erfundenen Hördauern, keine Spotify-API-Seiteneffekte.
// =============================================================================
export interface PlayerProgress {
  elapsed: string;
  total: string;
  percent: number;
}

/** Behandelt NaN, negative Zahlen und einen ungültigen Playerzustand sicher. */
export function normalizedPlayerProgress(positionMs: number, durationMs: number): PlayerProgress {
  const total = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const position = Number.isFinite(positionMs) ? Math.max(0, Math.min(positionMs, total || 0)) : 0;
  return {
    elapsed: formatPlayerTime(position), total: formatPlayerTime(total),
    percent: total > 0 ? Math.min(100, Math.max(0, (position / total) * 100)) : 0,
  };
}

/** Millisekunden zu m:ss oder h:mm:ss; Anzeige begrenzt statt zu überlaufen. */
export function formatPlayerTime(milliseconds: number): string {
  const seconds = Number.isFinite(milliseconds) ? Math.min(359999, Math.floor(Math.max(0, milliseconds) / 1000)) : 0;
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  if (minutes < 60) return `${minutes}:${rest}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${rest}`;
}
