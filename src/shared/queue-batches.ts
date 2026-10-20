// =============================================================================
// Datei: src/shared/queue-batches.ts
// Zweck: Lange Spotify-Warteschlangen kontrolliert in kleinen Blöcken einreihen.
// Wo ändern? Blockgröße hier; Spotify-API und Rückmeldung in PlaylistTools.tsx.
// Keine automatischen Wiederholungen: Nach einem API-Fehler könnte Spotify einen
// Block bereits übernommen haben. Ein Retry würde diese Titel duplizieren.
// =============================================================================

/** Ein Spotify-Titel/eine Episode benötigt immer eine ID mit 22 Zeichen. */
const QUEUE_URI = /^spotify:(?:track|episode):[a-zA-Z0-9]{22}$/;

/** Kleine Blöcke verhindern unkontrolliert große Queue-API-Anfragen. */
export const QUEUE_BATCH_SIZE = 25;

export interface QueueReport {
  /** Von Spotify bestätigte Queue-Einträge, Wiederholungen bewusst eingeschlossen. */
  queued: number;
  /** Ungültige Einträge, die nicht zur Spotify-API geschickt wurden. */
  skipped: number;
  /** Anzahl gültiger Einträge vor dem Absenden. */
  totalValid: number;
}

/** Teilweise erfolgreiche Aktionen müssen ausdrücklich gemeldet werden. */
export class QueueBatchError extends Error {
  readonly queued: number;
  readonly totalValid: number;
  readonly reason: unknown;

  constructor(queued: number, totalValid: number, reason: unknown) {
    super("Die Spotify-Warteschlange konnte nicht vollständig befüllt werden.");
    this.name = "QueueBatchError";
    this.queued = queued;
    this.totalValid = totalValid;
    this.reason = reason;
  }
}

/**
 * Bewahrt die Reihenfolge der Titel und sendet die nächsten Blöcke erst nach
 * erfolgreicher Bestätigung durch Spotify. Teilfehler beenden sofort die Aktion.
 *
 * Die Funktion enthält absichtlich keine Spotify- oder React-Abhängigkeiten,
 * damit Fehlerfälle isoliert getestet werden können.
 */
export async function enqueueQueueBatches(
  uris: readonly string[],
  submitBatch: (uris: string[]) => Promise<unknown>,
): Promise<QueueReport> {
  const valid = uris.filter((uri) => typeof uri === "string" && QUEUE_URI.test(uri));
  const report: QueueReport = {
    queued: 0,
    skipped: uris.length - valid.length,
    totalValid: valid.length,
  };

  for (let offset = 0; offset < valid.length; offset += QUEUE_BATCH_SIZE) {
    const batch = valid.slice(offset, offset + QUEUE_BATCH_SIZE);
    try {
      await submitBatch(batch);
    } catch (reason) {
      // Keine nachfolgenden Blöcke senden; Spotify hat die vorige Anzahl
      // bestätigt, aber der fehlgeschlagene Block ist möglicherweise unklar.
      throw new QueueBatchError(report.queued, report.totalValid, reason);
    }
    report.queued += batch.length;
  }
  return report;
}
