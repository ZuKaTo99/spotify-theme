import type {
  ReactElement,
} from "react";

import {
  KEYBOARD_SHORTCUT_DEFINITIONS,
} from "../../../shared/keyboard-shortcuts";

import type {
  KeyboardShortcutActionId,
} from "../../../shared/keyboard-shortcuts";

import type {
  Translator,
} from "../../../shared/i18n";

import type {
  KeyboardShortcutPreferences,
} from "../../../shared/settings";

import type {
  SettingsChanges,
} from "../../hooks/useSettings";

const ReactRuntime =
  Spicetify.React as typeof import("react");

interface KeyboardShortcutsSettingsProps {
  keyboardShortcuts:
    KeyboardShortcutPreferences;

  t: Translator;

  onBack: () => void;

  onChange: (
    changes: SettingsChanges,
  ) => void;
}

const MODIFIER_CODES =
  new Set<string>([
    "AltLeft",
    "AltRight",
    "ControlLeft",
    "ControlRight",
    "ShiftLeft",
    "ShiftRight",
    "MetaLeft",
    "MetaRight",
  ]);

const playPauseDefinition =
  KEYBOARD_SHORTCUT_DEFINITIONS.find(
    (definition) =>
      definition.id === "play-pause",
  );

function formatKeyCode(
  code: string,
): string {
  if (code === "AltLeft") {
    return "Alt";
  }

  if (code === "AltRight") {
    return "Alt Gr";
  }

  if (
    code === "ControlLeft" ||
    code === "ControlRight"
  ) {
    return "Ctrl";
  }

  if (
    code === "ShiftLeft" ||
    code === "ShiftRight"
  ) {
    return "Shift";
  }

  if (
    code === "MetaLeft" ||
    code === "MetaRight"
  ) {
    return "Meta";
  }

  if (code.startsWith("Key")) {
    return code.slice(3);
  }

  if (code.startsWith("Digit")) {
    return code.slice(5);
  }

  return code;
}

function formatBinding(
  codes: readonly string[],
): string {
  if (codes.length === 0) {
    return "—";
  }

  return codes
    .map(formatKeyCode)
    .join(" + ");
}

export function KeyboardShortcutsSettings({
  keyboardShortcuts,
  t,
  onBack,
  onChange,
}: KeyboardShortcutsSettingsProps):
  ReactElement {
  const [
    editingActionId,
    setEditingActionId,
  ] =
    ReactRuntime.useState<
      KeyboardShortcutActionId | null
    >(null);

  const recordedCodesRef =
    ReactRuntime.useRef<
      Set<string>
    >(
      new Set(),
    );

  const playPauseBinding =
    keyboardShortcuts["play-pause"];

  ReactRuntime.useEffect(
    () => {
      if (!editingActionId) {
        return;
      }

      const actionId =
        editingActionId;

      recordedCodesRef.current.clear();

      function handleKeyDown(
        event: KeyboardEvent,
      ): void {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (event.repeat) {
          return;
        }

        if (
          event.code === "Escape"
        ) {
          recordedCodesRef.current.clear();

          setEditingActionId(
            null,
          );

          return;
        }

        recordedCodesRef.current.add(
          event.code,
        );

        if (
          MODIFIER_CODES.has(
            event.code,
          )
        ) {
          return;
        }

        const codes = [
          ...recordedCodesRef.current,
        ].slice(
          0,
          4,
        );

        onChange({
          keyboardShortcuts: {
            ...keyboardShortcuts,

            [actionId]: {
              codes,
            },
          },
        });

        recordedCodesRef.current.clear();

        setEditingActionId(
          null,
        );
      }

      window.addEventListener(
        "keydown",
        handleKeyDown,
        true,
      );

      return () => {
        window.removeEventListener(
          "keydown",
          handleKeyDown,
          true,
        );

        recordedCodesRef.current.clear();
      };
    },
    [
      editingActionId,
      keyboardShortcuts,
      onChange,
    ],
  );

  function handleReset(): void {
    if (!playPauseDefinition) {
      return;
    }

    setEditingActionId(
      null,
    );

    recordedCodesRef.current.clear();

    onChange({
      keyboardShortcuts: {
        ...keyboardShortcuts,

        "play-pause": {
          codes: [
            ...playPauseDefinition
              .defaultCodes,
          ],
        },
      },
    });
  }

  return (
    <section
      className="zukato-shortcuts"
      aria-labelledby="shortcuts-heading"
    >
      <header>
        <button
          type="button"
          onClick={onBack}
        >
          {t(
            "shortcuts.backToSettings",
          )}
        </button>

        <h2 id="shortcuts-heading">
          {t("shortcuts.heading")}
        </h2>

        <p>
          {t("shortcuts.description")}
        </p>
      </header>

      <article
        className="zukato-shortcuts__item"
      >
        <h3>
          {t("shortcuts.playPause")}
        </h3>

        <p>
          {t(
            "shortcuts.currentBinding",
          )}
        </p>

        <kbd>
          {formatBinding(
            playPauseBinding.codes,
          )}
        </kbd>

        {editingActionId ===
        "play-pause" ? (
          <p>
            {t(
              "shortcuts.pressKeys",
            )}
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setEditingActionId(
                  "play-pause",
                );
              }}
            >
              {t("shortcuts.edit")}
            </button>

            <button
              type="button"
              onClick={handleReset}
            >
              {t("shortcuts.reset")}
            </button>
          </>
        )}
      </article>
    </section>
  );
}