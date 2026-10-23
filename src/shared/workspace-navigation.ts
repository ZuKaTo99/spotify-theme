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

// -----------------------------------------------------------------------------
// v1.68: Schnellzugriff und Modulsuche für die gesamte Workspace-Navigation.
// Die Liste enthält nur Custom-App-Seiten, keine Extension-Hintergrundmodule.
// -----------------------------------------------------------------------------
export const WORKSPACE_PIN_LIMIT = 5;
export const WORKSPACE_PINS_STORAGE_KEY = "zukato-toolkit.workspace.pinned.v1";
const PINNABLE_WORKSPACE_IDS: readonly FeatureId[] = [
  "dashboard", "listening-history", "statistics", "favorites", "playlist-tools",
  "visualizer", "song-notes", "theme-studio", "settings",
];

/** Normalisiert Suchbegriffe, damit beispielsweise „hör“ auch „Hörverlauf“ findet. */
function normalizedWorkspaceSearch(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

/** Filtert echte Navigationsdaten; Labels und Nutzer-Reihenfolge bleiben erhalten. */
export function filterWorkspaceNavigation<T extends { id: FeatureId; title: string }>(
  items: readonly T[],
  search: string,
  groupTitle?: (group: WorkspaceGroup) => string,
): T[] {
  const query = normalizedWorkspaceSearch(search);
  if (!query) return [...items];
  return items.filter((item) =>
    [item.title, item.id, groupTitle?.(workspaceGroup(item.id)) ?? ""]
      .some((value) => normalizedWorkspaceSearch(value).includes(query)));
}

/** Fremde/alte/duplizierte Pins nie als gültigen Navigationszustand verwenden. */
export function normalizeWorkspacePins(candidate: unknown): FeatureId[] {
  if (!Array.isArray(candidate)) return [];
  const valid = new Set(PINNABLE_WORKSPACE_IDS);
  const result: FeatureId[] = [];
  for (const entry of candidate) {
    if (typeof entry !== "string" || !valid.has(entry as FeatureId)) continue;
    const featureId = entry as FeatureId;
    if (!result.includes(featureId)) result.push(featureId);
    if (result.length === WORKSPACE_PIN_LIMIT) break;
  }
  return result;
}

/** Pin-Toggle ist rein funktional; am Limit bleibt die alte Auswahl unverändert. */
export function toggleWorkspacePin(current: readonly FeatureId[], featureId: FeatureId): FeatureId[] {
  const pins = normalizeWorkspacePins(current);
  if (!PINNABLE_WORKSPACE_IDS.includes(featureId)) return pins;
  if (pins.includes(featureId)) return pins.filter((id) => id !== featureId);
  return pins.length < WORKSPACE_PIN_LIMIT ? [...pins, featureId] : pins;
}

/** Pins sind dauerhaft lokal, auch wenn eine Seite vorübergehend deaktiviert wird. */
export function readWorkspacePins(): FeatureId[] {
  try {
    const stored = window.localStorage.getItem(WORKSPACE_PINS_STORAGE_KEY);
    if (!stored || stored.length > 2048) return [];
    return normalizeWorkspacePins(JSON.parse(stored) as unknown);
  } catch { return []; /* Beispielsweise blockierter Profilspeicher. */ }
}

export function rememberWorkspacePins(pins: readonly FeatureId[]): void {
  try {
    window.localStorage.setItem(WORKSPACE_PINS_STORAGE_KEY, JSON.stringify(normalizeWorkspacePins(pins)));
  } catch { /* Aktuelle Sitzung bleibt benutzbar, auch bei Storage-Ausfall. */ }
}
