// =============================================================================
// Datei: src/extension/modules/volume-scroll/VolumeScrollModule.ts
// Zweck: Gerüst für spätere Lautstärkesteuerung per Scrollrad.
// =============================================================================
import type {
  ExtensionModule,
} from "../ExtensionModule";

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `volumeScrollModule`.
// -----------------------------------------------------------------------------
export const volumeScrollModule:
  ExtensionModule = {
    id: "volume-scroll",

    // Startet ein registriertes Modul, sofern es noch nicht läuft.
    start(): void {
      // Funktionalität folgt später.
    },

    // Stoppt ein laufendes Modul und entfernt es aus dem aktiven Zustand.
    stop(): void {
      // Aufräumlogik folgt später.
    },
  };