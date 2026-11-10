// =============================================================================
// Datei: src/extension/modules/extension-runtime.ts
// Zweck: Synchronisiert Feature-Einstellungen mit dem ExtensionModuleManager.
// =============================================================================
import {
  loadSettings,
  subscribeToSettings,
} from "../../shared/settings";

import { startSongSessionTracker, stopSongSessionTracker } from "../../shared/song-session";
import { APPEARANCE_CHANGED_EVENT, BACKGROUND_CHANGED_EVENT,
  applyGlobalPalette, applyGlobalBackgroundPalette, loadPalette, loadBackgroundPalette,
  type PaletteSelection } from "../../shared/appearance";

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

function onAppearanceChanged(event: Event): void {
  applyGlobalPalette((event as CustomEvent<PaletteSelection>).detail);
}

function onBackgroundChanged(event: Event): void {
  applyGlobalBackgroundPalette((event as CustomEvent<PaletteSelection>).detail);
}

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
  applyGlobalPalette(loadPalette());
  applyGlobalBackgroundPalette(loadBackgroundPalette());
  // Der Songzähler ist unabhängig von abschaltbaren Funktionsmodulen.
  // Er muss auch außerhalb der Visualizer-Seite weiterlaufen.
  startSongSessionTracker();
  applyCurrentExtensionPreferences();

  if (unsubscribeFromSettings) {
    return;
  }

  window.addEventListener(APPEARANCE_CHANGED_EVENT, onAppearanceChanged);
  window.addEventListener(BACKGROUND_CHANGED_EVENT, onBackgroundChanged);
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
  window.removeEventListener(APPEARANCE_CHANGED_EVENT, onAppearanceChanged);
  window.removeEventListener(BACKGROUND_CHANGED_EVENT, onBackgroundChanged);
  if (unsubscribeFromSettings) {
    unsubscribeFromSettings();
    unsubscribeFromSettings = null;
  }

  stopSongSessionTracker();
  extensionModuleManager.stopAll();
}
