// =============================================================================
// Datei: src/shared/dashboard-preferences.ts
// Zweck: Persönliche Startseite ohne Änderung an Musikbibliothek oder Spotify.
// Wo ändern? Erlaubte Dashboard-Module/Abschnitte hier, Schaltflächen in Dashboard.tsx.
// =============================================================================
import type { FeatureId } from "./features";
import type { InsightsPeriod } from "./listening-insights";

export const DASHBOARD_STORAGE_KEY = "zukato-toolkit.dashboard.preferences.v1";
export const DASHBOARD_SHORTCUT_LIMIT = 6;
export const DASHBOARD_SHORTCUT_IDS: readonly FeatureId[] = [
  "listening-history", "statistics", "favorites", "playlist-tools",
  "visualizer", "song-notes", "theme-studio", "settings",
];
/** Stabile IDs der frei sortierbaren Informationskarten. */
export type DashboardSection = "stats" | "activity" | "recent" | "overview" | "favorites" | "notes";
export const DASHBOARD_SECTIONS: readonly DashboardSection[] = ["stats", "activity", "recent", "overview", "favorites", "notes"];

export interface DashboardPreferences {
  shortcuts: FeatureId[];
  hiddenSections: DashboardSection[];
  cardOrder: DashboardSection[];
  period: InsightsPeriod;
}

/** Jedes Laden erhält neue Arrays; Komponenten dürfen Standards nie mutieren. */
export function defaultDashboardPreferences(): DashboardPreferences {
  return {
    shortcuts: ["favorites", "playlist-tools", "visualizer", "theme-studio"],
    hiddenSections: [],
    cardOrder: [...DASHBOARD_SECTIONS],
    period: "7d",
  };
}

/** Geänderte und manipulierte Storage-Daten streng, aber rückwärtskompatibel lesen. */
export function normalizeDashboardPreferences(candidate: unknown): DashboardPreferences {
  const defaults = defaultDashboardPreferences();
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return defaults;
  const value = candidate as Record<string, unknown>;
  const allowedShortcuts = new Set<string>(DASHBOARD_SHORTCUT_IDS);
  const allowedSections = new Set<string>(DASHBOARD_SECTIONS);
  const normalizedShortcuts: FeatureId[] = [];
  if (Array.isArray(value.shortcuts)) {
    for (const item of value.shortcuts) {
      if (typeof item !== "string" || !allowedShortcuts.has(item) || normalizedShortcuts.includes(item as FeatureId)) continue;
      normalizedShortcuts.push(item as FeatureId);
      if (normalizedShortcuts.length === DASHBOARD_SHORTCUT_LIMIT) break;
    }
  }
  const hidden: DashboardSection[] = [];
  if (Array.isArray(value.hiddenSections)) {
    for (const item of value.hiddenSections) {
      if (typeof item === "string" && allowedSections.has(item) && !hidden.includes(item as DashboardSection)) {
        hidden.push(item as DashboardSection);
      }
    }
  }
  // Migration: alte Dashboard-Einstellungen enthalten keine cardOrder.
  // Unbekannte und doppelte Werte niemals übernehmen, fehlende Karten ergänzen.
  const cardOrder: DashboardSection[] = [];
  if (Array.isArray(value.cardOrder)) for (const item of value.cardOrder) {
    if (typeof item === "string" && allowedSections.has(item) && !cardOrder.includes(item as DashboardSection))
      cardOrder.push(item as DashboardSection);
  }
  for (const id of DASHBOARD_SECTIONS) if (!cardOrder.includes(id)) cardOrder.push(id);
  return {
    cardOrder,
    shortcuts: Array.isArray(value.shortcuts) ? normalizedShortcuts : defaults.shortcuts,
    hiddenSections: hidden,
    period: value.period === "7d" || value.period === "30d" || value.period === "all" ? value.period : defaults.period,
  };
}

/** Außerhalb der React-Laufzeit ebenfalls problemlos testbar. */
export function readDashboardPreferences(): DashboardPreferences {
  try {
    const json = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
    return json && json.length <= 4096 ? normalizeDashboardPreferences(JSON.parse(json) as unknown) : defaultDashboardPreferences();
  } catch { return defaultDashboardPreferences(); }
}

export function rememberDashboardPreferences(preferences: DashboardPreferences): void {
  try {
    window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(normalizeDashboardPreferences(preferences)));
  } catch { /* Bei blockiertem Speicher bleibt der aktuelle React-Zustand nutzbar. */ }
}

export function toggleDashboardShortcut(previous: DashboardPreferences, id: FeatureId): DashboardPreferences {
  const state = normalizeDashboardPreferences(previous);
  if (!DASHBOARD_SHORTCUT_IDS.includes(id)) return state;
  if (state.shortcuts.includes(id)) return { ...state, shortcuts: state.shortcuts.filter((item) => item !== id) };
  if (state.shortcuts.length >= DASHBOARD_SHORTCUT_LIMIT) return state;
  return { ...state, shortcuts: [...state.shortcuts, id] };
}

/** Reihenfolge ist explizit nutzerdefiniert – keine Spotify-Playlist-Änderung. */
export function moveDashboardShortcut(previous: DashboardPreferences, id: FeatureId, offset: -1 | 1): DashboardPreferences {
  const state = normalizeDashboardPreferences(previous);
  const current = state.shortcuts.indexOf(id);
  const target = current + offset;
  if (current < 0 || target < 0 || target >= state.shortcuts.length) return state;
  const shortcuts = [...state.shortcuts];
  [shortcuts[current], shortcuts[target]] = [shortcuts[target], shortcuts[current]];
  return { ...state, shortcuts };
}

/** Verschiebt die Karte genau einen Platz. Alte Konfigurationen bleiben gültig. */
export function moveDashboardCard(previous: DashboardPreferences, id: DashboardSection, offset: -1 | 1): DashboardPreferences {
  const state = normalizeDashboardPreferences(previous);
  const index = state.cardOrder.indexOf(id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= state.cardOrder.length) return state;
  const cardOrder = [...state.cardOrder];
  [cardOrder[index], cardOrder[target]] = [cardOrder[target], cardOrder[index]];
  return { ...state, cardOrder };
}

export function toggleDashboardSection(previous: DashboardPreferences, id: DashboardSection): DashboardPreferences {
  const state = normalizeDashboardPreferences(previous);
  if (!DASHBOARD_SECTIONS.includes(id)) return state;
  return { ...state, hiddenSections: state.hiddenSections.includes(id)
    ? state.hiddenSections.filter((section) => section !== id)
    : [...state.hiddenSections, id] };
}

export function setDashboardPeriod(previous: DashboardPreferences, period: InsightsPeriod): DashboardPreferences {
  const state = normalizeDashboardPreferences(previous);
  return { ...state, period: period === "7d" || period === "30d" || period === "all" ? period : state.period };
}
