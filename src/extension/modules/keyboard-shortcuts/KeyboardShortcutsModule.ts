// =============================================================================
// Datei: src/extension/modules/keyboard-shortcuts/KeyboardShortcutsModule.ts
// Zweck: Globale Shortcut-Runtime: verfolgt Tasten, erkennt Kombinationen und führt Aktionen aus.
// =============================================================================
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

// -----------------------------------------------------------------------------
// Zentrale Konstante `MODULE_NAME` dieses Moduls.
// -----------------------------------------------------------------------------
const MODULE_NAME =
  "Keyboard Shortcuts";

// -----------------------------------------------------------------------------
// Aktuell gültige Shortcut-Belegungen, gegen die Tastendrücke geprüft werden.
// -----------------------------------------------------------------------------
let activeShortcuts:
  readonly KeyboardShortcut[] = [];

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `unsubscribeFromSettings`.
// -----------------------------------------------------------------------------
let unsubscribeFromSettings:
  (() => void) | null = null;

// -----------------------------------------------------------------------------
// Menge aller momentan gedrückten Tastencodes für exaktes Kombinations-Matching.
// -----------------------------------------------------------------------------
const pressedCodes =
  new Set<string>();

// -----------------------------------------------------------------------------
// Erkennt Eingabefelder, in denen globale Shortcuts beim Tippen nicht auslösen dürfen.
// -----------------------------------------------------------------------------
function isEditableTarget(
  target: EventTarget | null,
): boolean {
  // Auch SVG-Unterelemente und verschachtelte Editor-Flächen berücksichtigen.
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
    '[role="textbox"], [role="searchbox"], [role="combobox"]',
  )) || (target instanceof HTMLElement && target.isContentEditable);
}

/**
 * Shadow-DOM-Editoren können den DOM-Event-Target auf ihren Host retargeten.
 * Der vollständige Event-Pfad schützt auch dort vor globalen Shortcuts.
 */
function isEditableEvent(event: KeyboardEvent): boolean {
  const targets = typeof event.composedPath === "function"
    ? event.composedPath()
    : [event.target];
  return targets.some(isEditableTarget);
}

/**
 * Von Spotify oder einem Shortcut-Recorder bereits behandelte Tasten nicht
 * erneut als Player-Aktionen ausführen. Verhindert Doppelaktionen.
 */
function isBlockedKeyEvent(event: KeyboardEvent): boolean {
  return event.defaultPrevented || isEditableEvent(event) ||
    event.isComposing || event.key === "Dead" || event.code === "Unidentified";
}

// Verpasste Keyup-Events dürfen Modifier nicht dauerhaft im Zustand halten.
function reconcileModifierState(event: KeyboardEvent): void {
  if (!event.altKey) {
    pressedCodes.delete("AltLeft");
    pressedCodes.delete("AltRight");
  }
  if (!event.ctrlKey) {
    pressedCodes.delete("ControlLeft");
    pressedCodes.delete("ControlRight");
  }
  if (!event.shiftKey) {
    pressedCodes.delete("ShiftLeft");
    pressedCodes.delete("ShiftRight");
  }
  if (!event.metaKey) {
    pressedCodes.delete("MetaLeft");
    pressedCodes.delete("MetaRight");
  }
}

// -----------------------------------------------------------------------------
// Prüft, ob exakt die für einen Shortcut gespeicherten Tasten gedrückt sind.
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Verarbeitet Tastendrücke und wertet die aktuell gedrückte Kombination aus.
// -----------------------------------------------------------------------------
function handleKeyDown(
  event: KeyboardEvent,
): void {
  if (
    isBlockedKeyEvent(event)
  ) {
    // Keine alten Modifier von vorherigen Fokuswechseln behalten.
    pressedCodes.clear();
    return;
  }

  reconcileModifierState(event);

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

// -----------------------------------------------------------------------------
// Entfernt losgelassene Tasten aus dem aktuellen Tastenzustand.
// -----------------------------------------------------------------------------
function handleKeyUp(
  event: KeyboardEvent,
): void {
  pressedCodes.delete(
    event.code,
  );
}

// -----------------------------------------------------------------------------
// Leert den Tastenzustand bei Fokusverlust, damit keine Modifier hängen bleiben.
// -----------------------------------------------------------------------------
function handleWindowBlur(): void {
  pressedCodes.clear();
}

// -----------------------------------------------------------------------------
// Lädt die aktuellen Shortcut-Einstellungen in den Runtime-Zustand.
// -----------------------------------------------------------------------------
function loadCurrentShortcuts(): void {
  const settings =
    loadSettings();

  activeShortcuts =
    createKeyboardShortcuts(
      settings.keyboardShortcuts,
    );
}

// -----------------------------------------------------------------------------
// Extension-Modul mit Event-Listenern, Settings-Abonnement und sauberem Cleanup.
// -----------------------------------------------------------------------------
export const keyboardShortcutsModule:
  ExtensionModule = {
    id: "keyboard-shortcuts",

    // Startet ein registriertes Modul, sofern es noch nicht läuft.
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

    // Stoppt ein laufendes Modul und entfernt es aus dem aktiven Zustand.
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