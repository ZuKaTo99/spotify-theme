// =============================================================================
// Datei: src/extension/modules/copy-track-info/CopyTrackInfoModule.ts
// Zweck: Gerüst für das spätere Kopieren von Track-Informationen.
// =============================================================================
import type {
  ExtensionModule,
} from "../ExtensionModule";

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `copyTrackInfoModule`.
// -----------------------------------------------------------------------------
export const copyTrackInfoModule:
  ExtensionModule = {
    id: "copy-track-info",

    // Startet ein registriertes Modul, sofern es noch nicht läuft.
    start(): void {
      // Funktionalität folgt später.
    },

    // Stoppt ein laufendes Modul und entfernt es aus dem aktiven Zustand.
    stop(): void {
      // Aufräumlogik folgt später.
    },
  };