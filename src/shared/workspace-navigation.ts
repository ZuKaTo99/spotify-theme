// =============================================================================
// Datei: src/shared/workspace-navigation.ts
// Zweck: Stabile Navigationsgruppen und sicherer letzter Workspace-Bereich.
// Wo ändern? Gruppen hier, sichtbare Darstellung in AppNavigation.tsx.
// =============================================================================
import type { FeatureId } from "./features";

export type WorkspaceGroup = "start" | "library" | "creative" | "system";
const STORE_KEY = "zukato-toolkit.workspace.last-feature.v1";

/** Sortierung innerhalb der Gruppen entspricht weiterhin der Nutzerreihenfolge. */
export function workspaceGroup(feature: FeatureId): WorkspaceGroup {
  if (feature === "dashboard") return "start";
  if (["listening-history", "statistics", "favorites", "playlist-tools", "song-notes"].includes(feature)) return "library";
  if (["visualizer", "theme-studio"].includes(feature)) return "creative";
  return "system";
}

/** Veraltete oder deaktivierte Seiten nie ungeprüft aus dem Speicher aufrufen. */
export function resolveWorkspaceFeature(saved: string | null, available: readonly FeatureId[]): FeatureId {
  if (saved && available.includes(saved as FeatureId)) return saved as FeatureId;
  if (available.includes("dashboard")) return "dashboard";
  if (available.includes("settings")) return "settings";
  return available[0] ?? "settings";
}

/** sessionStorage ist bewusst geräte- und sitzungslokal (kein Backup-Feld nötig). */
export function readWorkspaceFeature(): string | null {
  try { return window.sessionStorage.getItem(STORE_KEY); } catch { return null; }
}
export function rememberWorkspaceFeature(feature: FeatureId): void {
  try { window.sessionStorage.setItem(STORE_KEY, feature); } catch { /* Private Session: ohne Speicher fortfahren. */ }
}
