import type {
  FeaturePreferences,
} from "./feature-preferences";

/**
 * Stabile technische Kennungen aller Anwendungsmodule.
 *
 * Diese IDs dürfen nach einer Veröffentlichung nicht leichtfertig
 * geändert werden, da Einstellungen und gespeicherte Daten darauf
 * verweisen können.
 *
 * Sichtbare Namen werden später separat übersetzt und können
 * vom Nutzer überschrieben werden.
 */
export const FEATURE_IDS = [
  // Custom-App-Seiten
  "dashboard",
  "listening-history",
  "statistics",
  "favorites",
  "playlist-tools",
  "visualizer",
  "song-notes",
  "theme-studio",
  "settings",

  // Extension-Funktionen
  "keyboard-shortcuts",
  "sleep-timer",
  "volume-scroll",
  "copy-track-info",
  "quick-playlist",
  "mini-player",
  "player-statistics",
  "context-actions",
] as const;

export type FeatureId =
  typeof FEATURE_IDS[number];

export type FeatureSurface =
  | "custom-app"
  | "extension";

export interface FeatureDefinition {
  /**
   * Stabile interne Kennung.
   */
  id: FeatureId;

  /**
   * Legt fest, wo das Feature ausgeführt wird.
   */
  surface: FeatureSurface;

  /**
   * Standardsortierung innerhalb seiner Oberfläche.
   */
  defaultOrder: number;

  /**
   * Gibt an, ob das Feature bei einer Neuinstallation
   * standardmäßig aktiviert sein soll.
   */
  defaultEnabled: boolean;

  /**
   * Bestimmt, ob der sichtbare Titel später vom Nutzer
   * überschrieben werden darf.
   */
  customizableTitle: boolean;

  /**
 * Pflichtmodule bleiben immer aktiviert.
 */
required?: boolean;
}

/**
 * Zentrale Feature-Definitionen.
 *
 * Noch nicht implementierte Funktionen dürfen bereits registriert
 * sein. Die Registry beschreibt das geplante Produktsystem und
 * nicht zwingend den aktuellen Entwicklungsstand.
 */
export const FEATURE_DEFINITIONS:
  readonly FeatureDefinition[] = [
    {
      id: "dashboard",
      surface: "custom-app",
      defaultOrder: 10,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "listening-history",
      surface: "custom-app",
      defaultOrder: 20,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "statistics",
      surface: "custom-app",
      defaultOrder: 30,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "favorites",
      surface: "custom-app",
      defaultOrder: 40,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "playlist-tools",
      surface: "custom-app",
      defaultOrder: 50,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "visualizer",
      surface: "custom-app",
      defaultOrder: 60,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "song-notes",
      surface: "custom-app",
      defaultOrder: 70,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "theme-studio",
      surface: "custom-app",
      defaultOrder: 80,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "settings",
      surface: "custom-app",
      defaultOrder: 90,
      defaultEnabled: true,
      customizableTitle: true,
      required: true,
    },

    {
      id: "keyboard-shortcuts",
      surface: "extension",
      defaultOrder: 10,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "sleep-timer",
      surface: "extension",
      defaultOrder: 20,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "volume-scroll",
      surface: "extension",
      defaultOrder: 30,
      defaultEnabled: false,
      customizableTitle: true,
    },
    {
      id: "copy-track-info",
      surface: "extension",
      defaultOrder: 40,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "quick-playlist",
      surface: "extension",
      defaultOrder: 50,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "mini-player",
      surface: "extension",
      defaultOrder: 60,
      defaultEnabled: false,
      customizableTitle: true,
    },
    {
      id: "player-statistics",
      surface: "extension",
      defaultOrder: 70,
      defaultEnabled: true,
      customizableTitle: true,
    },
    {
      id: "context-actions",
      surface: "extension",
      defaultOrder: 80,
      defaultEnabled: true,
      customizableTitle: true,
    },
  ];

/**
 * Effiziente Laufzeitprüfung für unbekannte oder importierte Daten.
 */
const FEATURE_ID_SET =
  new Set<string>(FEATURE_IDS);

export function isFeatureId(
  value: unknown,
): value is FeatureId {
  return (
    typeof value === "string" &&
    FEATURE_ID_SET.has(value)
  );
}

/**
 * Liefert die Definition eines bestimmten Features.
 */
export function getFeatureDefinition(
  featureId: FeatureId,
): FeatureDefinition {
  const definition =
    FEATURE_DEFINITIONS.find(
      (feature) =>
        feature.id === featureId,
    );

  if (!definition) {
    throw new Error(
      `Unbekannte Feature-ID: ${featureId}`,
    );
  }

  return definition;
}



/**
 * Liefert sortierte Features für eine bestimmte Oberfläche.
 */
export function getFeaturesBySurface(
  surface: FeatureSurface,
): readonly FeatureDefinition[] {
  return FEATURE_DEFINITIONS
    .filter(
      (feature) =>
        feature.surface === surface,
    )
    .sort(
      (first, second) =>
        first.defaultOrder -
        second.defaultOrder,
    );
}

/**
 * Liefert aktivierte Features einer Oberfläche in der
 * vom Nutzer gespeicherten Reihenfolge.
 */
export function getEnabledFeaturesBySurface(
  surface: FeatureSurface,
  preferences: FeaturePreferences,
): readonly FeatureDefinition[] {
  return FEATURE_DEFINITIONS
    .filter(
      (feature) =>
        feature.surface === surface &&
        preferences[feature.id].enabled,
    )
    .sort(
      (first, second) => {
        const orderDifference =
          preferences[first.id].order -
          preferences[second.id].order;

        if (orderDifference !== 0) {
          return orderDifference;
        }

        return (
          first.defaultOrder -
          second.defaultOrder
        );
      },
    );
}