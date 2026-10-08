// =============================================================================
// Datei: src/extension/modules/ExtensionModuleManager.ts
// Zweck: Lifecycle-Manager für registrierte Extension-Module.
// =============================================================================
import type {
  FeaturePreferences,
} from "../../shared/feature-preferences";

import type {
  FeatureId,
} from "../../shared/features";

import type {
  ExtensionModule,
} from "./ExtensionModule";

// -----------------------------------------------------------------------------
// Verwaltet Registry und Lifecycle aller Extension-Module.
// -----------------------------------------------------------------------------
export class ExtensionModuleManager {
  private readonly modulesById =
    new Map<FeatureId, ExtensionModule>();

  private readonly startedModuleIds =
    new Set<FeatureId>();

  constructor(
    modules: readonly ExtensionModule[],
  ) {
    for (const module of modules) {
      this.modulesById.set(
        module.id,
        module,
      );
    }
  }

  // Startet ein registriertes Modul, sofern es noch nicht läuft.
  start(featureId: FeatureId): void {
    if (
      this.startedModuleIds.has(
        featureId,
      )
    ) {
      return;
    }

    const module =
      this.modulesById.get(featureId);

    if (!module) {
      return;
    }

    module.start();

    this.startedModuleIds.add(
      featureId,
    );
  }

  // Stoppt ein laufendes Modul und entfernt es aus dem aktiven Zustand.
  stop(featureId: FeatureId): void {
    if (
      !this.startedModuleIds.has(
        featureId,
      )
    ) {
      return;
    }

    const module =
      this.modulesById.get(featureId);

    if (!module) {
      return;
    }

    module.stop();

    this.startedModuleIds.delete(
      featureId,
    );
  }

  // Synchronisiert aktive Module mit den gespeicherten enabled-Einstellungen.
  applyPreferences(
    preferences: FeaturePreferences,
  ): void {
    for (
      const featureId
      of this.modulesById.keys()
    ) {
      const preference =
        preferences[featureId];

      if (preference.enabled) {
        this.start(featureId);
      } else {
        this.stop(featureId);
      }
    }
  }

  // Beendet beim Shutdown alle aktuell laufenden Extension-Module.
  stopAll(): void {
    for (
      const featureId
      of [...this.startedModuleIds]
    ) {
      this.stop(featureId);
    }
  }
}