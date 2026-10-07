export const KEYBOARD_SHORTCUT_ACTION_IDS = [
  "play-pause",
] as const;

export type KeyboardShortcutActionId =
  typeof KEYBOARD_SHORTCUT_ACTION_IDS[number];

export interface KeyboardShortcutDefinition {
  id: KeyboardShortcutActionId;
  defaultCodes: readonly string[];
}

export const KEYBOARD_SHORTCUT_DEFINITIONS:
  readonly KeyboardShortcutDefinition[] = [
    {
      id: "play-pause",
      defaultCodes: [
        "AltLeft",
        "KeyP",
      ],
    },
  ];