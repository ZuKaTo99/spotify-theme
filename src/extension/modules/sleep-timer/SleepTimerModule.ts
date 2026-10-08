// =============================================================================
// Datei: src/extension/modules/sleep-timer/SleepTimerModule.ts
// Zweck: Gerüst für den späteren Sleep-Timer.
// =============================================================================
import type {
  ExtensionModule,
} from "../ExtensionModule";

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `sleepTimerModule`.
// -----------------------------------------------------------------------------
export const sleepTimerModule:
  ExtensionModule = {
    id: "sleep-timer",

    // Startet ein registriertes Modul, sofern es noch nicht läuft.
    start(): void {
      // Funktionalität folgt später.
    },

    // Stoppt ein laufendes Modul und entfernt es aus dem aktiven Zustand.
    stop(): void {
      // Aufräumlogik folgt später.
    },
  };