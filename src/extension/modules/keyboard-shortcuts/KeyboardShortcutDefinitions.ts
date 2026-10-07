import type {
  KeyboardShortcutActionId,
} from "../../../shared/keyboard-shortcuts";

import type {
  KeyboardShortcutPreferences,
} from "../../../shared/settings";

export interface KeyboardShortcut {
  actionId: KeyboardShortcutActionId;
  codes: readonly string[];
}

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