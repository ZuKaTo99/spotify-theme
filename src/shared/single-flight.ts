// =============================================================================
// Datei: src/shared/single-flight.ts
// Zweck: Verhindert parallele Benutzeraktionen, bevor React Buttons deaktiviert.
// Wo ändern? Die Sperre ist absichtlich unabhängig von Spotify und React, damit
// Schnellsuche und Track-Aktionen dieselbe getestete Semantik verwenden.
// =============================================================================

/**
 * Eine Aktion startet unmittelbar beim Klick (noch vor dem nächsten Render).
 * Weitere Klicks während des laufenden Promise werden ignoriert. Nach Erfolg
 * UND Fehler ist die Sperre wieder frei; Fehler werden an den Aufrufer gegeben.
 *
 * Es wird absichtlich keine Aktion in eine Warteschlange gestellt: Wiederholte
 * Spotify-Queue-Aktionen können nicht gefahrlos nachträglich abgearbeitet werden.
 */
export function createSingleFlight(): {
  isBusy(): boolean;
  run(action: () => void | Promise<void>): Promise<boolean>;
} {
  let busy = false;
  return {
    isBusy: () => busy,
    async run(action) {
      if (busy) return false;
      busy = true;
      try {
        await action();
        return true;
      } finally {
        busy = false;
      }
    },
  };
}
