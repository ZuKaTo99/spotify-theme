// =============================================================================
// Datei: src/shared/settings.ts
// Zweck: Persistenz-, Schema- und Normalisierungsschicht für alle Toolkit-Einstellungen.
// =============================================================================
import {
  createDefaultFeaturePreferences,
  normalizeFeaturePreferences,
} from "./feature-preferences";

import type {
  FeaturePreferences,
} from "./feature-preferences";

import {
  KEYBOARD_SHORTCUT_DEFINITIONS,
} from "./keyboard-shortcuts";

import type {
  KeyboardShortcutActionId,
} from "./keyboard-shortcuts";

// -----------------------------------------------------------------------------
// Name des browserweiten Events, über das Settings-Änderungen live verteilt werden.
// -----------------------------------------------------------------------------
export const SETTINGS_CHANGED_EVENT =
  "spotify-toolkit:settings-changed";

// -----------------------------------------------------------------------------
// Schlüssel für die benutzerspezifische Speicherung über Spicetify LocalStorageAPI.
// -----------------------------------------------------------------------------
const SETTINGS_STORAGE_KEY =
  "spotify-toolkit.settings";

/**
 * Version 3 ergänzt konfigurierbare Tastenkürzel.
 */
const CURRENT_SCHEMA_VERSION = 3;

// -----------------------------------------------------------------------------
// Gemeinsamer Typ `AppLocale` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
export type AppLocale =
  | "auto"
  | "de"
  | "en";

// -----------------------------------------------------------------------------
// Datenvertrag `KeyboardShortcutBinding` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
export interface KeyboardShortcutBinding {
  codes: string[];
}

// -----------------------------------------------------------------------------
// Gemeinsamer Typ `KeyboardShortcutPreferences` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
export type KeyboardShortcutPreferences =
  Record<
    KeyboardShortcutActionId,
    KeyboardShortcutBinding
  >;

// -----------------------------------------------------------------------------
// Datenvertrag `AppSettings` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
export interface AppSettings {
  schemaVersion: number;

  /**
   * Frei wählbare Überschrift innerhalb der Custom App.
   */
  workspaceTitle: string;

  /**
   * Optionaler Name für persönliche Begrüßungen.
   */
  displayName: string;

  showGreeting: boolean;
  locale: AppLocale;

  /**
   * Einstellungen aller registrierten Module.
   */
  features: FeaturePreferences;

  /**
   * Benutzerdefinierte Tastenkürzel.
   */
  keyboardShortcuts:
    KeyboardShortcutPreferences;
}

// -----------------------------------------------------------------------------
// Erzeugt Standardbelegungen aus der zentralen Shortcut-Registry.
// -----------------------------------------------------------------------------
function createDefaultKeyboardShortcutPreferences():
  KeyboardShortcutPreferences {
  const preferences:
    Partial<KeyboardShortcutPreferences> = {};

  for (
    const definition
    of KEYBOARD_SHORTCUT_DEFINITIONS
  ) {
    preferences[definition.id] = {
      codes: [
        ...definition.defaultCodes,
      ],
    };
  }

  return (
    preferences as KeyboardShortcutPreferences
  );
}

// -----------------------------------------------------------------------------
// Vollständige sichere Standardkonfiguration der Anwendung.
// -----------------------------------------------------------------------------
export const DEFAULT_SETTINGS:
  Readonly<AppSettings> = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workspaceTitle: "Workspace",
    displayName: "",
    showGreeting: true,
    locale: "auto",

    features:
      createDefaultFeaturePreferences(),

    keyboardShortcuts:
      createDefaultKeyboardShortcutPreferences(),
  };

// -----------------------------------------------------------------------------
// Prüft die zugehörige Laufzeitbedingung und liefert einen booleschen Wert.
// -----------------------------------------------------------------------------
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// -----------------------------------------------------------------------------
// Normalisiert den zugehörigen Wert defensiv auf eine sichere interne Form.
// -----------------------------------------------------------------------------
function normalizeText(
  value: unknown,
  fallback: string,
  maximumLength: number,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(
    0,
    maximumLength,
  );
}

// -----------------------------------------------------------------------------
// Normalisiert den zugehörigen Wert defensiv auf eine sichere interne Form.
// -----------------------------------------------------------------------------
function normalizeOptionalText(
  value: unknown,
  maximumLength: number,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      maximumLength,
    );
}

// -----------------------------------------------------------------------------
// Normalisiert den zugehörigen Wert defensiv auf eine sichere interne Form.
// -----------------------------------------------------------------------------
function normalizeLocale(
  value: unknown,
): AppLocale {
  if (
    value === "de" ||
    value === "en" ||
    value === "auto"
  ) {
    return value;
  }

  return DEFAULT_SETTINGS.locale;
}

// -----------------------------------------------------------------------------
// Normalisiert den zugehörigen Wert defensiv auf eine sichere interne Form.
// -----------------------------------------------------------------------------
function normalizeShortcutCodes(
  value: unknown,
  fallback: readonly string[],
): string[] {
  if (!Array.isArray(value)) {
    return [
      ...fallback,
    ];
  }

  const normalizedCodes =
    value
      .filter(
        (code): code is string =>
          typeof code === "string",
      )
      .map(
        (code) =>
          code
            .trim()
            .slice(
              0,
              40,
            ),
      )
      .filter(
        (code) =>
          code.length > 0,
      );

  return [
    ...new Set(
      normalizedCodes,
    ),
  ].slice(
    0,
    4,
  );
}

// -----------------------------------------------------------------------------
// Normalisiert den zugehörigen Wert defensiv auf eine sichere interne Form.
// -----------------------------------------------------------------------------
function normalizeKeyboardShortcutPreferences(
  value: unknown,
): KeyboardShortcutPreferences {
  const source =
    isRecord(value)
      ? value
      : {};

  const preferences:
    Partial<KeyboardShortcutPreferences> = {};

  for (
    const definition
    of KEYBOARD_SHORTCUT_DEFINITIONS
  ) {
    const storedBinding =
      source[definition.id];

    const binding =
      isRecord(storedBinding)
        ? storedBinding
        : {};

    preferences[definition.id] = {
      codes: normalizeShortcutCodes(
        binding.codes,
        definition.defaultCodes,
      ),
    };
  }

  return (
    preferences as KeyboardShortcutPreferences
  );
}

/**
 * Validiert gespeicherte oder importierte Einstellungen.
 *
 * Ältere Einstellungen werden dabei automatisch auf das
 * aktuelle Schema ergänzt.
 */
export function normalizeSettings(
  value: unknown,
): AppSettings {
  const source =
    isRecord(value)
      ? value
      : {};

  return {
    schemaVersion:
      CURRENT_SCHEMA_VERSION,

    workspaceTitle:
      normalizeText(
        source.workspaceTitle,
        DEFAULT_SETTINGS.workspaceTitle,
        60,
      ),

    displayName:
      normalizeOptionalText(
        source.displayName,
        40,
      ),

    showGreeting:
      typeof source.showGreeting ===
        "boolean"
        ? source.showGreeting
        : DEFAULT_SETTINGS.showGreeting,

    locale:
      normalizeLocale(
        source.locale,
      ),

    features:
      normalizeFeaturePreferences(
        source.features,
      ),

    keyboardShortcuts:
      normalizeKeyboardShortcutPreferences(
        source.keyboardShortcuts,
      ),
  };
}

/**
 * Lädt die Einstellungen des aktuell angemeldeten
 * Spotify-Benutzerkontos.
 */
export function loadSettings():
  AppSettings {
  const storedValue =
    Spicetify.Platform.LocalStorageAPI.getItem(
      SETTINGS_STORAGE_KEY,
    );

  return normalizeSettings(
    storedValue,
  );
}

/**
 * Speichert validierte Einstellungen und informiert
 * laufende Anwendungsmodule über die Änderung.
 */
export function saveSettings(
  settings: AppSettings,
): AppSettings {
  const normalized =
    normalizeSettings(
      settings,
    );

  Spicetify.Platform.LocalStorageAPI.setItem(
    SETTINGS_STORAGE_KEY,
    normalized,
  );

  window.dispatchEvent(
    new CustomEvent<AppSettings>(
      SETTINGS_CHANGED_EVENT,
      {
        detail: normalized,
      },
    ),
  );

  return normalized;
}

/**
 * Ändert nur ausgewählte Einstellungswerte.
 */
export function updateSettings(
  changes: Partial<
    Omit<
      AppSettings,
      "schemaVersion"
    >
  >,
): AppSettings {
  return saveSettings({
    ...loadSettings(),
    ...changes,
    schemaVersion:
      CURRENT_SCHEMA_VERSION,
  });
}

/**
 * Registriert einen Listener für Änderungen innerhalb
 * der laufenden Spotify-Sitzung.
 */
export function subscribeToSettings(
  listener: (
    settings: AppSettings,
  ) => void,
): () => void {
  const handleSettingsChange = (
    event: Event,
  ): void => {
    if (
      !(event instanceof CustomEvent)
    ) {
      return;
    }

    listener(
      normalizeSettings(
        event.detail,
      ),
    );
  };

  window.addEventListener(
    SETTINGS_CHANGED_EVENT,
    handleSettingsChange,
  );

  return () => {
    window.removeEventListener(
      SETTINGS_CHANGED_EVENT,
      handleSettingsChange,
    );
  };
}