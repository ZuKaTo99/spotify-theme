// =============================================================================
// Datei: src/extension/modules/quick-playlist/QuickPlaylistModule.ts
// Zweck: Gerüst für spätere Schnellaktionen rund um Playlists.
// =============================================================================
import type {
  ExtensionModule,
} from "../ExtensionModule";

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `quickPlaylistModule`.
// -----------------------------------------------------------------------------
export const quickPlaylistModule:
  ExtensionModule = {
    id: "quick-playlist",

    // Startet ein registriertes Modul, sofern es noch nicht läuft.
    start(): void {
      // Funktionalität folgt später.
    },

    // Stoppt ein laufendes Modul und entfernt es aus dem aktiven Zustand.
    stop(): void {
      // Aufräumlogik folgt später.
    },
  };