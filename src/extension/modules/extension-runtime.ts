// =============================================================================
// Datei: src/extension/modules/extension-runtime.ts
// Zweck: Synchronisiert Feature-Einstellungen mit dem ExtensionModuleManager.
// =============================================================================
import {
  loadSettings,
  subscribeToSettings,
} from "../../shared/settings";

import {
  extensionModules,
} from "./extension-modules";

import {
  ExtensionModuleManager,
} from "./ExtensionModuleManager";

// -----------------------------------------------------------------------------
// Gemeinsame Manager-Instanz für den gesamten Extension-Lifecycle.
// -----------------------------------------------------------------------------
export const extensionModuleManager =
  new ExtensionModuleManager(
    extensionModules,
  );

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `unsubscribeFromSettings`.
// -----------------------------------------------------------------------------
let unsubscribeFromSettings:
  (() => void) | null = null;

// -----------------------------------------------------------------------------
// Lädt die aktuellen Einstellungen und wendet die Feature-Aktivierung auf die Runtime an.
// -----------------------------------------------------------------------------
export function applyCurrentExtensionPreferences():
  void {
  const settings =
    loadSettings();

  extensionModuleManager.applyPreferences(
    settings.features,
  );
}

// -----------------------------------------------------------------------------
// Startet die Runtime und abonniert danach live weitere Settings-Änderungen.
// -----------------------------------------------------------------------------
export function startExtensionRuntime():
  void {
  applyCurrentExtensionPreferences();

  if (unsubscribeFromSettings) {
    return;
  }

  unsubscribeFromSettings =
    subscribeToSettings(
      (settings) => {
        extensionModuleManager.applyPreferences(
          settings.features,
        );
      },
    );
}

// -----------------------------------------------------------------------------
// Beendet das Settings-Abonnement und stoppt alle laufenden Module.
// -----------------------------------------------------------------------------
export function stopExtensionRuntime():
  void {
  if (unsubscribeFromSettings) {
    unsubscribeFromSettings();
    unsubscribeFromSettings = null;
  }

  extensionModuleManager.stopAll();
}