// =============================================================================
// Datei: src/extension/modules/ExtensionModule.ts
// Zweck: Gemeinsamer Vertrag für Extension-Module mit Feature-ID sowie Start- und Stop-Lifecycle.
// =============================================================================
import type {
  FeatureId,
} from "../../shared/features";

// -----------------------------------------------------------------------------
// Datenvertrag `ExtensionModule` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
export interface ExtensionModule {
  id: FeatureId;

  start: () => void;

  stop: () => void;
}