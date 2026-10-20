// =============================================================================
// Datei: src/custom-app/modules/dashboard/dashboard-polling.ts
// Zweck: Einheitliche Polling-Regeln für den Dashboard-Fortschrittsbalken.
// Kein Zugriff auf Spicetify/DOM: bewusst isoliert und direkt testbar.
// =============================================================================
import type { PlayerProgress } from "../../../shared/player-progress";

/** Bei Pause und ausgeblendetem Fenster genügt ein langsamer Sicherheits-Poll. */
export function dashboardProgressDelayMs(playing: boolean, hidden: boolean): number {
  if (hidden) return 4_000;
  return playing ? 1_000 : 3_000;
}

/** Millisekundengenauer Prozentwert und Text werden nur bei Veränderung gerendert. */
export function sameDashboardProgress(a: PlayerProgress, b: PlayerProgress): boolean {
  return a.elapsed === b.elapsed && a.total === b.total && a.percent === b.percent;
}
