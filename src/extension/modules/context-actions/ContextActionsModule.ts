// =============================================================================
// Datei: src/extension/modules/context-actions/ContextActionsModule.ts
// Zweck: Gerüst für spätere zusätzliche Spotify-Kontextaktionen.
// =============================================================================
import type {
  ExtensionModule,
} from "../ExtensionModule";

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `contextActionsModule`.
// -----------------------------------------------------------------------------
export const contextActionsModule:
  ExtensionModule = {
    id: "context-actions",

    // Startet ein registriertes Modul, sofern es noch nicht läuft.
    start(): void {
      // Funktionalität folgt später.
    },

    // Stoppt ein laufendes Modul und entfernt es aus dem aktiven Zustand.
    stop(): void {
      // Aufräumlogik folgt später.
    },
  };