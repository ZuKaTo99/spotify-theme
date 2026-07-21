import {
  loadSettings,
  subscribeToSettings,
  updateSettings,
} from "../../shared/settings";

import type {
  AppSettings,
} from "../../shared/settings";

/*
 * Spicetify stellt React zur Laufzeit bereit.
 * Die offiziellen Spicetify-Typen deklarieren es jedoch als `any`.
 *
 * Durch diese Typzusicherung erhalten wir die vollständigen
 * React-Hook-Typen, ohne React zusätzlich zur Laufzeit zu bündeln.
 */
const ReactRuntime =
  Spicetify.React as typeof import("react");

export type SettingsChanges = Partial<
  Omit<AppSettings, "schemaVersion">
>;

export interface SettingsController {
  settings: AppSettings;

  update: (
    changes: SettingsChanges,
  ) => void;
}

/**
 * Verbindet React-Komponenten mit den persistenten
 * Anwendungseinstellungen.
 */
export function useSettings(): SettingsController {
  const [settings, setSettings] =
    ReactRuntime.useState<AppSettings>(
      () => loadSettings(),
    );

  ReactRuntime.useEffect(
    () => subscribeToSettings(setSettings),
    [],
  );

  const update =
    ReactRuntime.useCallback(
      (
        changes: SettingsChanges,
      ): void => {
        const nextSettings =
          updateSettings(changes);

        setSettings(nextSettings);
      },
      [],
    );

  return {
    settings,
    update,
  };
}