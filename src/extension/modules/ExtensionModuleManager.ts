// =============================================================================
// Datei: src/extension/modules/ExtensionModuleManager.ts
// Zweck: Isolierter Modul-Lifecycle mit aufräumbaren Startwiederholungen.
// Wo ändern? Retry-Abstände und zentrale Start-/Stop-Logik nur hier.
// =============================================================================
import type { FeaturePreferences } from "../../shared/feature-preferences";
import type { FeatureId } from "../../shared/features";
import type { ExtensionModule } from "./ExtensionModule";

const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 30_000;

/**
 * Ein defektes Zusatzmodul darf nicht das gesamte Toolkit abschalten.
 * Temporär fehlende Spotify-APIs werden mit begrenztem Backoff erneut geprüft.
 * Deaktivieren und Shutdown entfernen sämtliche ausstehenden Retry-Timer.
 */
export class ExtensionModuleManager {
  private readonly modulesById = new Map<FeatureId, ExtensionModule>();
  private readonly startedModuleIds = new Set<FeatureId>();
  private readonly enabledModuleIds = new Set<FeatureId>();
  private readonly retryTimers = new Map<FeatureId, number>();
  private readonly failureCounts = new Map<FeatureId, number>();

  constructor(modules: readonly ExtensionModule[]) {
    for (const module of modules) {
      if (this.modulesById.has(module.id)) throw new Error(`Doppelte Extension-Feature-ID: ${module.id}`);
      this.modulesById.set(module.id, module);
    }
  }

  /** Timer beim Zustandswechsel wirklich entfernen, nicht nur den Callback ignorieren. */
  private cancelRetry(featureId: FeatureId): void {
    const timer = this.retryTimers.get(featureId);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    this.retryTimers.delete(featureId);
  }

  /** Ein einziger Retry pro Modul; exponentiell, aber maximal alle 30 Sekunden. */
  private scheduleRetry(featureId: FeatureId): void {
    if (!this.enabledModuleIds.has(featureId) || this.retryTimers.has(featureId)) return;
    const failures = (this.failureCounts.get(featureId) ?? 0) + 1;
    this.failureCounts.set(featureId, failures);
    const delay = Math.min(MAX_RETRY_DELAY_MS,
      INITIAL_RETRY_DELAY_MS * 2 ** Math.min(failures - 1, 6));
    const timer = window.setTimeout(() => {
      this.retryTimers.delete(featureId);
      // Stop oder neue Settings können während der Wartezeit eingetroffen sein.
      if (this.enabledModuleIds.has(featureId)) this.start(featureId);
    }, delay);
    this.retryTimers.set(featureId, timer);
  }

  /** Start ist idempotent. Ein fehlerhafter Start wird zuerst aufgeräumt. */
  start(featureId: FeatureId): void {
    const module = this.modulesById.get(featureId);
    if (!module) return;
    this.enabledModuleIds.add(featureId);
    if (this.startedModuleIds.has(featureId)) return;
    this.cancelRetry(featureId);
    try {
      module.start();
      this.startedModuleIds.add(featureId);
      this.failureCounts.delete(featureId);
    } catch (error) {
      console.error(`[ZuKaTo] Modul ${featureId} konnte nicht starten:`, error);
      // Bei teilweise registrierten Spotify-Menüs / Listenern unbedingt aufräumen.
      try { module.stop(); }
      catch (cleanupError) { console.warn(`[ZuKaTo] Cleanup ${featureId}:`, cleanupError); }
      this.scheduleRetry(featureId);
    }
  }

  /** Auch ein nie erfolgreich gestartetes Modul kann einen Retry-Timer besitzen. */
  stop(featureId: FeatureId): void {
    this.enabledModuleIds.delete(featureId);
    this.cancelRetry(featureId);
    this.failureCounts.delete(featureId);
    if (!this.startedModuleIds.delete(featureId)) return;
    const module = this.modulesById.get(featureId);
    try { module?.stop(); }
    catch (error) { console.error(`[ZuKaTo] Modul ${featureId} konnte nicht sauber stoppen:`, error); }
  }

  /** Settings werden einzeln und ausfallsicher angewendet. */
  applyPreferences(preferences: FeaturePreferences): void {
    for (const featureId of this.modulesById.keys()) {
      if (preferences[featureId]?.enabled) {
        // Ein wartender Retry wird bei identischen Settings nicht zurückgesetzt.
        if (!this.retryTimers.has(featureId)) this.start(featureId);
      } else this.stop(featureId);
    }
  }

  /** Der Shutdown stoppt gestartete Module UND fehlgeschlagene Modul-Retries. */
  stopAll(): void {
    for (const featureId of [...this.enabledModuleIds]) this.stop(featureId);
  }
}
