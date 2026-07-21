export const SETTINGS_CHANGED_EVENT =
  "spotify-toolkit:settings-changed";

const SETTINGS_STORAGE_KEY =
  "spotify-toolkit.settings";

const CURRENT_SCHEMA_VERSION = 1;

export type AppLocale =
  | "auto"
  | "de"
  | "en";

export interface AppSettings {
  schemaVersion: number;

  /**
   * Frei wählbare Überschrift innerhalb der Custom App.
   */
  workspaceTitle: string;

  /**
   * Optionaler Name für persönliche Begrüßungen.
   * Ein leerer Wert deaktiviert die persönliche Ansprache.
   */
  displayName: string;

  showGreeting: boolean;
  locale: AppLocale;
}

export const DEFAULT_SETTINGS: Readonly<AppSettings> = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  workspaceTitle: "Workspace",
  displayName: "",
  showGreeting: true,
  locale: "auto",
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

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

  return normalized.slice(0, maximumLength);
}

function normalizeOptionalText(
  value: unknown,
  maximumLength: number,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maximumLength);
}

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

/**
 * Validiert gespeicherte oder importierte Einstellungen.
 *
 * Dadurch führen veraltete oder manuell beschädigte Daten
 * nicht zum Absturz der Anwendung.
 */
export function normalizeSettings(
  value: unknown,
): AppSettings {
  const source = isRecord(value)
    ? value
    : {};

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,

    workspaceTitle: normalizeText(
      source.workspaceTitle,
      DEFAULT_SETTINGS.workspaceTitle,
      60,
    ),

    displayName: normalizeOptionalText(
      source.displayName,
      40,
    ),

    showGreeting:
      typeof source.showGreeting === "boolean"
        ? source.showGreeting
        : DEFAULT_SETTINGS.showGreeting,

    locale: normalizeLocale(
      source.locale,
    ),
  };
}

/**
 * Lädt die Einstellungen des aktuell angemeldeten
 * Spotify-Benutzerkontos.
 */
export function loadSettings(): AppSettings {
  const storedValue =
    Spicetify.Platform.LocalStorageAPI.getItem(
      SETTINGS_STORAGE_KEY,
    );

  return normalizeSettings(storedValue);
}

/**
 * Speichert validierte Einstellungen und informiert
 * laufende Anwendungsmodule über die Änderung.
 */
export function saveSettings(
  settings: AppSettings,
): AppSettings {
  const normalized =
    normalizeSettings(settings);

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
    Omit<AppSettings, "schemaVersion">
  >,
): AppSettings {
  return saveSettings({
    ...loadSettings(),
    ...changes,
    schemaVersion: CURRENT_SCHEMA_VERSION,
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
    if (!(event instanceof CustomEvent)) {
      return;
    }

    listener(
      normalizeSettings(event.detail),
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