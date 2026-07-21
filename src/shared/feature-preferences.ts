import {
  FEATURE_DEFINITIONS,
} from "./features";

import type {
  FeatureId,
} from "./features";

/**
 * Benutzerbezogene Einstellungen eines einzelnen Moduls.
 */
export interface FeaturePreference {
  /**
   * Legt fest, ob das Modul verwendet beziehungsweise
   * innerhalb der Oberfläche angezeigt wird.
   */
  enabled: boolean;

  /**
   * Benutzerdefinierte Reihenfolge.
   */
  order: number;

  /**
   * Optionaler sichtbarer Name.
   *
   * Ein leerer Wert bedeutet:
   * Den übersetzten Standardnamen verwenden.
   */
  customTitle: string;
}

export type FeaturePreferences = Record<
  FeatureId,
  FeaturePreference
>;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeOrder(
  value: unknown,
  fallback: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(
      10_000,
      Math.round(value),
    ),
  );
}

function normalizeCustomTitle(
  value: unknown,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, 60);
}

/**
 * Erzeugt für jedes registrierte Modul eine eigene,
 * neue Standardkonfiguration.
 */
export function createDefaultFeaturePreferences():
FeaturePreferences {
  return Object.fromEntries(
    FEATURE_DEFINITIONS.map(
      (feature) => [
        feature.id,
        {
          enabled: feature.defaultEnabled,
          order: feature.defaultOrder,
          customTitle: "",
        },
      ],
    ),
  ) as FeaturePreferences;
}

/**
 * Validiert gespeicherte oder importierte Modul-Einstellungen.
 *
 * Neue Module erhalten automatisch ihre Standardwerte.
 * Unbekannte oder veraltete Module werden ignoriert.
 */
export function normalizeFeaturePreferences(
  value: unknown,
): FeaturePreferences {
  const defaults =
    createDefaultFeaturePreferences();

  if (!isRecord(value)) {
    return defaults;
  }

  const normalized =
    createDefaultFeaturePreferences();

  for (
    const feature of FEATURE_DEFINITIONS
  ) {
    const featureId = feature.id;

    const storedPreference =
      value[featureId];

    if (!isRecord(storedPreference)) {
      normalized[featureId].enabled =
        feature.required
          ? true
          : normalized[featureId].enabled;

      continue;
    }

    normalized[featureId] = {
      enabled:
        feature.required
          ? true
          : typeof storedPreference.enabled ===
              "boolean"
            ? storedPreference.enabled
            : defaults[featureId].enabled,

      order: normalizeOrder(
        storedPreference.order,
        defaults[featureId].order,
      ),

      customTitle: normalizeCustomTitle(
        storedPreference.customTitle,
      ),
    };
  }

  return normalized;
}