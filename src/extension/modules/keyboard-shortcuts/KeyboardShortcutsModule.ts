import type {
  ExtensionModule,
} from "../ExtensionModule";

const MODULE_NAME =
  "Keyboard Shortcuts";

export const keyboardShortcutsModule:
  ExtensionModule = {
    id: "keyboard-shortcuts",

    start(): void {
      console.info(
        `[Spotify Toolkit] ${MODULE_NAME} gestartet.`,
      );
    },

    stop(): void {
      console.info(
        `[Spotify Toolkit] ${MODULE_NAME} beendet.`,
      );
    },
  };