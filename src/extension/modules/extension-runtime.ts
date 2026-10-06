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

export const extensionModuleManager =
  new ExtensionModuleManager(
    extensionModules,
  );

let unsubscribeFromSettings:
  (() => void) | null = null;

export function applyCurrentExtensionPreferences():
  void {
  const settings =
    loadSettings();

  extensionModuleManager.applyPreferences(
    settings.features,
  );
}

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

export function stopExtensionRuntime():
  void {
  if (unsubscribeFromSettings) {
    unsubscribeFromSettings();
    unsubscribeFromSettings = null;
  }

  extensionModuleManager.stopAll();
}