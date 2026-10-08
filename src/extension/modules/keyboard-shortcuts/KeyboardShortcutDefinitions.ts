// =============================================================================
// Datei: src/extension/modules/keyboard-shortcuts/KeyboardShortcutDefinitions.ts
// Zweck: Wandelt persistente Shortcut-Einstellungen in Runtime-Definitionen um.
// =============================================================================
import type {
  KeyboardShortcutActionId,
} from "../../../shared/keyboard-shortcuts";

import type {
  KeyboardShortcutPreferences,
} from "../../../shared/settings";

// -----------------------------------------------------------------------------
// Datenvertrag `KeyboardShortcut` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
export interface KeyboardShortcut {
  actionId: KeyboardShortcutActionId;
  codes: readonly string[];
}

// -----------------------------------------------------------------------------
// Überführt persistente Shortcut-Preferences in die Runtime-Struktur.
// -----------------------------------------------------------------------------
export function createKeyboardShortcuts(
  preferences: KeyboardShortcutPreferences,
): readonly KeyboardShortcut[] {
  return Object.entries(
    preferences,
  ).map(
    (
      [
        actionId,
        binding,
      ],
    ) => ({
      actionId:
        actionId as KeyboardShortcutActionId,

      codes: [
        ...binding.codes,
      ],
    }),
  );
}