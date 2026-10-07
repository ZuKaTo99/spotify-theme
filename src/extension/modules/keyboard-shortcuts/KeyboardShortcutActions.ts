import type {
  KeyboardShortcutActionId,
} from "../../../shared/keyboard-shortcuts";

export function togglePlayPause(): void {
  Spicetify.Player.togglePlay();
}

export const keyboardShortcutActions:
  Record<
    KeyboardShortcutActionId,
    () => void
  > = {
    "play-pause": togglePlayPause,
  };