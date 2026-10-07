import {
  togglePlayPause,
} from "./KeyboardShortcutActions";

export interface KeyboardShortcutModifiers {
  leftAlt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface KeyboardShortcut {
  code: string;
  modifiers?: KeyboardShortcutModifiers;
  action: () => void;
}

export const shortcuts:
  readonly KeyboardShortcut[] = [
    {
      code: "KeyP",
      modifiers: {
        leftAlt: true,
      },
      action: togglePlayPause,
    },
  ];