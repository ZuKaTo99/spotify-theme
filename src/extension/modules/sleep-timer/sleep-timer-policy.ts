// =============================================================================
// Datei: src/extension/modules/sleep-timer/sleep-timer-policy.ts
// Zweck: Pure, ohne Spotify testbare Zeit- und Storage-Regeln des Sleep-Timers.
// Wo ändern? Ablaufintervall und die Normalisierung gespeicherter Deadlines.
// =============================================================================

/**
 * Je nach Spicetify-Version kommt LocalStorageAPI als Zahl oder als String
 * zurück. Beide Formen sind erlaubt; beschädigte Werte werden nicht gestartet.
 */
export function normalizeSleepDeadline(raw: unknown): number {
  const value = typeof raw === "string" && raw.trim() ? Number(raw) : raw;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value : 0;
}

/**
 * Nur bei aktivem Timer prüfen: höchstens einmal pro Minute, spätestens aber
 * an der Deadline. Damit entfällt der bisherige 1-Sekunden-Dauertimer.
 * Fokus-/Sichtbarkeitsereignisse prüfen separat nach einem PC-Standby.
 */
export function sleepTimerNextDelayMs(deadline: number, now: number): number | null {
  if (!deadline || !Number.isFinite(deadline) || !Number.isFinite(now)) return null;
  return Math.max(1, Math.min(60_000, deadline - now));
}
