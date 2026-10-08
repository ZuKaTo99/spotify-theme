// =============================================================================
// Datei: src/extension/modules/mini-player/MiniPlayerModule.ts
// Zweck: Gerüst für den späteren Mini-Player.
// =============================================================================
import type {
  ExtensionModule,
} from "../ExtensionModule";

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `miniPlayerModule`.
// -----------------------------------------------------------------------------
export const miniPlayerModule:
  ExtensionModule = {
    id: "mini-player",

    // Startet ein registriertes Modul, sofern es noch nicht läuft.
    start(): void {
      // Funktionalität folgt später.
    },

    // Stoppt ein laufendes Modul und entfernt es aus dem aktiven Zustand.
    stop(): void {
      // Aufräumlogik folgt später.
    },
  };