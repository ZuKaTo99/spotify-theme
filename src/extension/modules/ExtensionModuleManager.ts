import type {
  FeaturePreferences,
} from "../../shared/feature-preferences";

import type {
  FeatureId,
} from "../../shared/features";

import type {
  ExtensionModule,
} from "./ExtensionModule";

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

  stopAll(): void {
    for (
      const featureId
      of [...this.startedModuleIds]
    ) {
      this.stop(featureId);
    }
  }
}