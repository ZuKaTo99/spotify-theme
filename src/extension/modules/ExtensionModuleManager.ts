// =============================================================================
// Datei: src/extension/modules/ExtensionModuleManager.ts
// Zweck: Ausfallsicherer Lifecycle: ein Modulfehler stoppt nicht alle anderen.
// =============================================================================
import type { FeaturePreferences } from "../../shared/feature-preferences";
import type { FeatureId } from "../../shared/features";
import type { ExtensionModule } from "./ExtensionModule";

/** Idempotente Verwaltung der Feature-Runtimes mit einzelnem Fehlerprotokoll. */
export class ExtensionModuleManager {
  private readonly modulesById = new Map<FeatureId, ExtensionModule>();
  private readonly startedModuleIds = new Set<FeatureId>();

  constructor(modules: readonly ExtensionModule[]) {
    for (const module of modules) {
      if (this.modulesById.has(module.id)) throw new Error(`Doppelte Extension-Feature-ID: ${module.id}`);
      this.modulesById.set(module.id, module);
    }
  }

  /** Mehrfacher Start darf keine doppelten Listener oder Menüeinträge erzeugen. */
  start(featureId: FeatureId): void {
    if (this.startedModuleIds.has(featureId)) return;
    const module = this.modulesById.get(featureId);
    if (!module) return;
    try {
      module.start();
      this.startedModuleIds.add(featureId);
    } catch (error) {
      console.error(`[ZuKaTo] Modul ${featureId} konnte nicht starten:`, error);
      // So gut wie möglich fehlerhaft angelegte Ressourcen wieder freigeben.
      try { module.stop(); } catch (cleanupError) { console.warn(`[ZuKaTo] Cleanup ${featureId}:`, cleanupError); }
    }
  }

  /** Stop-Lifecycle trotz eines Fehlers als beendet behandeln. */
  stop(featureId: FeatureId): void {
    if (!this.startedModuleIds.has(featureId)) return;
    const module = this.modulesById.get(featureId);
    this.startedModuleIds.delete(featureId);
    try { module?.stop(); }
    catch (error) { console.error(`[ZuKaTo] Modul ${featureId} konnte nicht sauber stoppen:`, error); }
  }

  /** Einstellungen sind normalisiert: es existiert für jede Modul-ID ein Eintrag. */
  applyPreferences(preferences: FeaturePreferences): void {
    for (const featureId of this.modulesById.keys()) {
      if (preferences[featureId]?.enabled) this.start(featureId);
      else this.stop(featureId);
    }
  }

  /** Zentraler Shutdown, inklusive Deaktivierung später ergänzter Module. */
  stopAll(): void {
    for (const featureId of [...this.startedModuleIds]) this.stop(featureId);
  }
}
