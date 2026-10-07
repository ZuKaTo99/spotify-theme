import type {
  ExtensionModule,
} from "../ExtensionModule";

import {
  shortcuts,
  type KeyboardShortcut,
} from "./KeyboardShortcutDefinitions";

const MODULE_NAME =
  "Keyboard Shortcuts";

let isLeftAltPressed = false;

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

function matchesModifiers(
  shortcut: KeyboardShortcut,
  event: KeyboardEvent,
): boolean {
  const modifiers =
    shortcut.modifiers ?? {};

  return (
    isLeftAltPressed ===
    Boolean(modifiers.leftAlt) &&
    event.ctrlKey ===
    Boolean(modifiers.ctrl) &&
    event.shiftKey ===
    Boolean(modifiers.shift) &&
    event.metaKey ===
    Boolean(modifiers.meta)
  );
}

function matchesShortcut(
  shortcut: KeyboardShortcut,
  event: KeyboardEvent,
): boolean {
  return (
    event.code === shortcut.code &&
    matchesModifiers(
      shortcut,
      event,
    )
  );
}

function handleKeyDown(
  event: KeyboardEvent,
): void {
  if (event.code === "AltLeft") {
    isLeftAltPressed = true;
    return;
  }

  if (
    event.repeat ||
    isEditableTarget(event.target)
  ) {
    return;
  }

  const shortcut =
    shortcuts.find(
      (candidate) =>
        matchesShortcut(
          candidate,
          event,
        ),
    );

  if (!shortcut) {
    return;
  }

  event.preventDefault();

  shortcut.action();
}

function handleKeyUp(
  event: KeyboardEvent,
): void {
  if (event.code === "AltLeft") {
    isLeftAltPressed = false;
  }
}

function handleWindowBlur(): void {
  isLeftAltPressed = false;
}

export const keyboardShortcutsModule:
  ExtensionModule = {
  id: "keyboard-shortcuts",

  start(): void {
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

    isLeftAltPressed = false;

    console.info(
      `[Spotify Toolkit] ${MODULE_NAME} beendet.`,
    );
  },
};