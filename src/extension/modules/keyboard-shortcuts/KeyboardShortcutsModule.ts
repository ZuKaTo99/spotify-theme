import type {
  ExtensionModule,
} from "../ExtensionModule";

import {
  loadSettings,
  subscribeToSettings,
} from "../../../shared/settings";

import {
  keyboardShortcutActions,
} from "./KeyboardShortcutActions";

import {
  createKeyboardShortcuts,
  type KeyboardShortcut,
} from "./KeyboardShortcutDefinitions";

const MODULE_NAME =
  "Keyboard Shortcuts";

let activeShortcuts:
  readonly KeyboardShortcut[] = [];

let unsubscribeFromSettings:
  (() => void) | null = null;

const pressedCodes =
  new Set<string>();

function isEditableTarget(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function matchesShortcut(
  shortcut: KeyboardShortcut,
): boolean {
  if (
    shortcut.codes.length === 0 ||
    shortcut.codes.length !==
      pressedCodes.size
  ) {
    return false;
  }

  return shortcut.codes.every(
    (code) =>
      pressedCodes.has(code),
  );
}

function handleKeyDown(
  event: KeyboardEvent,
): void {
  if (
    isEditableTarget(event.target)
  ) {
    return;
  }

  pressedCodes.add(
    event.code,
  );

  if (event.repeat) {
    return;
  }

  const shortcut =
    activeShortcuts.find(
      matchesShortcut,
    );

  if (!shortcut) {
    return;
  }

  const action =
    keyboardShortcutActions[
      shortcut.actionId
    ];

  event.preventDefault();

  action();
}

function handleKeyUp(
  event: KeyboardEvent,
): void {
  pressedCodes.delete(
    event.code,
  );
}

function handleWindowBlur(): void {
  pressedCodes.clear();
}

function loadCurrentShortcuts(): void {
  const settings =
    loadSettings();

  activeShortcuts =
    createKeyboardShortcuts(
      settings.keyboardShortcuts,
    );
}

export const keyboardShortcutsModule:
  ExtensionModule = {
    id: "keyboard-shortcuts",

    start(): void {
      loadCurrentShortcuts();

      unsubscribeFromSettings =
        subscribeToSettings(
          (settings) => {
            activeShortcuts =
              createKeyboardShortcuts(
                settings.keyboardShortcuts,
              );
          },
        );

      document.addEventListener(
        "keydown",
        handleKeyDown,
      );

      document.addEventListener(
        "keyup",
        handleKeyUp,
      );

      window.addEventListener(
        "blur",
        handleWindowBlur,
      );

      console.info(
        `[Spotify Toolkit] ${MODULE_NAME} gestartet.`,
      );
    },

    stop(): void {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      document.removeEventListener(
        "keyup",
        handleKeyUp,
      );

      window.removeEventListener(
        "blur",
        handleWindowBlur,
      );

      if (unsubscribeFromSettings) {
        unsubscribeFromSettings();
        unsubscribeFromSettings = null;
      }

      pressedCodes.clear();
      activeShortcuts = [];

      console.info(
        `[Spotify Toolkit] ${MODULE_NAME} beendet.`,
      );
    },
  };