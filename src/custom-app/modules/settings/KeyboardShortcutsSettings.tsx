// =============================================================================
// Datei:
// src/custom-app/modules/settings/KeyboardShortcutsSettings.tsx
//
// Zweck:
// Oberfläche zum Anzeigen, Bearbeiten, Entfernen und Zurücksetzen aller
// Tastenkürzel inklusive Konflikterkennung.
// =============================================================================

import type {
  ReactElement,
} from "react";

import {
  findKeyboardShortcutConflict,
  KEYBOARD_SHORTCUT_DEFINITIONS,
} from "../../../shared/keyboard-shortcuts";

import type {
  KeyboardShortcutActionId,
} from "../../../shared/keyboard-shortcuts";

import type {
  TranslationKey,
  Translator,
} from "../../../shared/i18n";

import type {
  KeyboardShortcutPreferences,
} from "../../../shared/settings";

import type {
  SettingsChanges,
} from "../../hooks/useSettings";

// -----------------------------------------------------------------------------
// Typisierte Referenz auf die von Spicetify bereitgestellte React-Laufzeit.
// -----------------------------------------------------------------------------
const ReactRuntime =
  Spicetify.React as typeof import("react");

// -----------------------------------------------------------------------------
// Props der Shortcut-Einstellungsseite.
// -----------------------------------------------------------------------------
interface KeyboardShortcutsSettingsProps {
  // Alle aktuell gespeicherten Shortcut-Belegungen.
  keyboardShortcuts:
    KeyboardShortcutPreferences;

  // Übersetzungsfunktion der aktuell gewählten Sprache.
  t: Translator;

  // Navigation zurück zur allgemeinen Einstellungsseite.
  onBack: () => void;

  // Persistiert Änderungen an den App-Einstellungen.
  onChange: (
    changes: SettingsChanges,
  ) => void;
}

// -----------------------------------------------------------------------------
// Beschreibt einen erkannten Shortcut-Konflikt.
// -----------------------------------------------------------------------------
interface KeyboardShortcutConflict {
  // Aktion, deren neue Belegung nicht gespeichert werden konnte.
  actionId:
    KeyboardShortcutActionId;

  // Andere Aktion, die diese Kombination bereits verwendet.
  conflictingActionId:
    KeyboardShortcutActionId;
}

// -----------------------------------------------------------------------------
// Modifier-Tasten.
//
// Diese Tasten schließen eine Aufnahme alleine noch nicht ab.
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Verbindung zwischen technischer Shortcut-ID und sichtbarem Übersetzungstext.
//
// Der Record-Typ sorgt dafür, dass jede registrierte Shortcut-Aktion einen
// sichtbaren Namen besitzen muss.
// -----------------------------------------------------------------------------
const SHORTCUT_TITLE_KEYS:
  Record<
    KeyboardShortcutActionId,
    TranslationKey
  > = {
    // Wiedergabe / Pause.
    "play-pause":
      "shortcuts.playPause",

    // Nächster Titel.
    "next-track":
      "shortcuts.nextTrack",

    // Vorheriger Titel.
    "previous-track":
      "shortcuts.previousTrack",

    // Lautstärke erhöhen.
    "volume-up":
      "shortcuts.volumeUp",

    // Lautstärke verringern.
    "volume-down":
      "shortcuts.volumeDown",

    // Stumm ein / aus.
    "toggle-mute":
      "shortcuts.toggleMute",
  };

// -----------------------------------------------------------------------------
// Wandelt KeyboardEvent.code-Werte in kurze sichtbare Tastennamen um.
// -----------------------------------------------------------------------------
function formatKeyCode(
  code: string,
): string {
  // Linke Alt-Taste.
  if (code === "AltLeft") {
    return "Alt";
  }

  // Rechte Alt-/Alt-Gr-Taste.
  if (code === "AltRight") {
    return "Alt Gr";
  }

  // Steuerungstaste.
  if (
    code === "ControlLeft" ||
    code === "ControlRight"
  ) {
    return "Ctrl";
  }

  // Umschalttaste.
  if (
    code === "ShiftLeft" ||
    code === "ShiftRight"
  ) {
    return "Shift";
  }

  // Windows-/Command-Taste.
  if (
    code === "MetaLeft" ||
    code === "MetaRight"
  ) {
    return "Meta";
  }

  // Pfeiltasten.
  if (code === "ArrowRight") {
    return "→";
  }

  if (code === "ArrowLeft") {
    return "←";
  }

  if (code === "ArrowUp") {
    return "↑";
  }

  if (code === "ArrowDown") {
    return "↓";
  }

  // Buchstabentasten:
  //
  // KeyP -> P
  // KeyM -> M
  if (code.startsWith("Key")) {
    return code.slice(3);
  }

  // Zahlentasten:
  //
  // Digit1 -> 1
  if (code.startsWith("Digit")) {
    return code.slice(5);
  }

  // Unbekannte Codes werden unverändert dargestellt.
  return code;
}

// -----------------------------------------------------------------------------
// Formatiert eine vollständige Tastenkombination für die Oberfläche.
// -----------------------------------------------------------------------------
function formatBinding(
  codes: readonly string[],
): string {
  // Eine leere Liste bedeutet, dass die Aktion nicht belegt ist.
  if (codes.length === 0) {
    return "—";
  }

  // Einzelne Keycodes formatieren und mit "+" verbinden.
  return codes
    .map(formatKeyCode)
    .join(" + ");
}

// -----------------------------------------------------------------------------
// Hauptkomponente der Shortcut-Verwaltung.
// -----------------------------------------------------------------------------
export function KeyboardShortcutsSettings({
  keyboardShortcuts,
  t,
  onBack,
  onChange,
}: KeyboardShortcutsSettingsProps):
  ReactElement {
  // ---------------------------------------------------------------------------
  // ID der Aktion, für die gerade eine neue Tastenkombination aufgenommen wird.
  // ---------------------------------------------------------------------------
  const [
    editingActionId,
    setEditingActionId,
  ] =
    ReactRuntime.useState<
      KeyboardShortcutActionId | null
    >(null);

  // ---------------------------------------------------------------------------
  // Enthält Informationen über einen eventuell erkannten Konflikt.
  // ---------------------------------------------------------------------------
  const [
    conflict,
    setConflict,
  ] =
    ReactRuntime.useState<
      KeyboardShortcutConflict | null
    >(null);

  // ---------------------------------------------------------------------------
  // Temporärer Speicher aller während der Aufnahme gedrückten Tasten.
  //
  // useRef verhindert unnötige React-Renders bei jedem Tastendruck.
  // ---------------------------------------------------------------------------
  const recordedCodesRef =
    ReactRuntime.useRef<
      Set<string>
    >(
      new Set(),
    );

  // ---------------------------------------------------------------------------
  // Zentraler Speicherweg für Shortcut-Belegungen.
  //
  // Diese Funktion wird verwendet für:
  //
  // - neue Belegung
  // - Belegung entfernen
  // - Standardbelegung wiederherstellen
  //
  // Dadurch läuft jede Änderung durch dieselbe Konfliktprüfung.
  // ---------------------------------------------------------------------------
  const applyBinding =
    ReactRuntime.useCallback(
      (
        actionId:
          KeyboardShortcutActionId,

        codes:
          readonly string[],
      ): boolean => {
        // ---------------------------------------------------------------------
        // Prüfen, ob eine andere Aktion dieselbe Kombination verwendet.
        // ---------------------------------------------------------------------
        const conflictingActionId =
          findKeyboardShortcutConflict(
            actionId,
            codes,
            keyboardShortcuts,
          );

        // ---------------------------------------------------------------------
        // Bei einem Konflikt wird nichts gespeichert.
        //
        // Die bisherige Belegung bleibt unverändert erhalten.
        // ---------------------------------------------------------------------
        if (conflictingActionId) {
          setConflict({
            actionId,
            conflictingActionId,
          });

          return false;
        }

        // ---------------------------------------------------------------------
        // Neue Belegung persistent speichern.
        //
        // codes wird kopiert, damit keine mutable Referenz übernommen wird.
        // ---------------------------------------------------------------------
        onChange({
          keyboardShortcuts: {
            ...keyboardShortcuts,

            [actionId]: {
              codes: [
                ...codes,
              ],
            },
          },
        });

        // ---------------------------------------------------------------------
        // Nach erfolgreichem Speichern eine alte Konfliktmeldung entfernen.
        // ---------------------------------------------------------------------
        setConflict(
          null,
        );

        return true;
      },
      [
        keyboardShortcuts,
        onChange,
      ],
    );

  // ---------------------------------------------------------------------------
  // Globaler Tastatur-Listener für die Aufnahme einer neuen Kombination.
  // ---------------------------------------------------------------------------
  ReactRuntime.useEffect(
    () => {
      // Ohne aktive Bearbeitung wird kein Listener benötigt.
      if (!editingActionId) {
        return;
      }

      // ID lokal sichern, damit die Event-Funktion damit arbeiten kann.
      const actionId =
        editingActionId;

      // Alte Aufnahme-Reste entfernen.
      recordedCodesRef.current.clear();

      // -----------------------------------------------------------------------
      // Reagiert auf Tastendrücke während der Shortcut-Aufnahme.
      // -----------------------------------------------------------------------
      function handleKeyDown(
        event: KeyboardEvent,
      ): void {
        // ---------------------------------------------------------------------
        // Verhindern, dass Spotify oder andere Module den Tastendruck
        // gleichzeitig verarbeiten.
        // ---------------------------------------------------------------------
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // ---------------------------------------------------------------------
        // Automatisch wiederholte Keydown-Events ignorieren.
        // ---------------------------------------------------------------------
        if (event.repeat) {
          return;
        }

        // ---------------------------------------------------------------------
        // Escape bricht die Aufnahme ohne Änderung ab.
        // ---------------------------------------------------------------------
        if (
          event.code === "Escape"
        ) {
          recordedCodesRef.current.clear();

          setConflict(
            null,
          );

          setEditingActionId(
            null,
          );

          return;
        }

        // ---------------------------------------------------------------------
        // Gedrückte Taste zur aktuellen Kombination hinzufügen.
        // ---------------------------------------------------------------------
        recordedCodesRef.current.add(
          event.code,
        );

        // ---------------------------------------------------------------------
        // Eine Modifier-Taste alleine beendet die Aufnahme nicht.
        //
        // Beispiel:
        //
        // AltLeft -> weiter warten
        // ArrowUp -> Kombination fertig
        // ---------------------------------------------------------------------
        if (
          MODIFIER_CODES.has(
            event.code,
          )
        ) {
          return;
        }

        // ---------------------------------------------------------------------
        // Maximal vier Tasten pro Shortcut speichern.
        // ---------------------------------------------------------------------
        const codes = [
          ...recordedCodesRef.current,
        ].slice(
          0,
          4,
        );

        // ---------------------------------------------------------------------
        // Kombination speichern.
        //
        // applyBinding übernimmt auch die Konfliktprüfung.
        // ---------------------------------------------------------------------
        applyBinding(
          actionId,
          codes,
        );

        // Temporären Aufnahmespeicher leeren.
        recordedCodesRef.current.clear();

        // Aufnahme beenden.
        setEditingActionId(
          null,
        );
      }

      // -----------------------------------------------------------------------
      // Listener in der Capture-Phase registrieren.
      //
      // Dadurch wird die Shortcut-Aufnahme verarbeitet, bevor der normale
      // Extension-Listener dieselben Tasten sieht.
      // -----------------------------------------------------------------------
      window.addEventListener(
        "keydown",
        handleKeyDown,
        true,
      );

      // -----------------------------------------------------------------------
      // Cleanup beim Beenden der Aufnahme oder Unmount der Komponente.
      // -----------------------------------------------------------------------
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
      applyBinding,
    ],
  );

  // ---------------------------------------------------------------------------
  // Startet die Aufnahme einer neuen Tastenkombination.
  // ---------------------------------------------------------------------------
  function handleEdit(
    actionId:
      KeyboardShortcutActionId,
  ): void {
    // Alte Konfliktmeldung bei einem neuen Versuch entfernen.
    setConflict(
      null,
    );

    // Gewählte Aktion in den Bearbeitungsmodus setzen.
    setEditingActionId(
      actionId,
    );
  }

  // ---------------------------------------------------------------------------
  // Entfernt eine Belegung vollständig.
  //
  // Eine leere Belegung wird von der Extension nicht ausgeführt.
  // ---------------------------------------------------------------------------
  function handleClear(
    actionId:
      KeyboardShortcutActionId,
  ): void {
    // Eventuelle Aufnahme beenden.
    setEditingActionId(
      null,
    );

    // Temporäre Tasten entfernen.
    recordedCodesRef.current.clear();

    // Leeres Binding speichern.
    applyBinding(
      actionId,
      [],
    );
  }

  // ---------------------------------------------------------------------------
  // Stellt die Standardbelegung einer Aktion wieder her.
  //
  // Auch ein Reset läuft durch die Konfliktprüfung, weil eine andere Aktion
  // inzwischen die ursprüngliche Standardbelegung übernommen haben könnte.
  // ---------------------------------------------------------------------------
  function handleReset(
    actionId:
      KeyboardShortcutActionId,

    defaultCodes:
      readonly string[],
  ): void {
    // Eventuelle Aufnahme beenden.
    setEditingActionId(
      null,
    );

    // Temporäre Tasten entfernen.
    recordedCodesRef.current.clear();

    // Standardbelegung erneut speichern.
    applyBinding(
      actionId,
      defaultCodes,
    );
  }

  // ---------------------------------------------------------------------------
  // Oberfläche rendern.
  //
  // Die Einträge werden automatisch aus KEYBOARD_SHORTCUT_DEFINITIONS erzeugt.
  // ---------------------------------------------------------------------------
  return (
    <section
      className="zukato-shortcuts"
      aria-labelledby="shortcuts-heading"
    >
      {/* ----------------------------------------------------------------------
          Kopfbereich der Shortcut-Seite.
          ------------------------------------------------------------------- */}
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
          {t(
            "shortcuts.heading",
          )}
        </h2>

        <p>
          {t(
            "shortcuts.description",
          )}
        </p>
      </header>

      {/* ----------------------------------------------------------------------
          Für jede registrierte Shortcut-Aktion automatisch einen Eintrag
          erzeugen.
          ------------------------------------------------------------------- */}
      {KEYBOARD_SHORTCUT_DEFINITIONS.map(
        (definition) => {
          // -------------------------------------------------------------------
          // Aktuell gespeicherte Belegung dieser Aktion.
          // -------------------------------------------------------------------
          const binding =
            keyboardShortcuts[
              definition.id
            ];

          // -------------------------------------------------------------------
          // Prüfen, ob genau dieser Eintrag gerade bearbeitet wird.
          // -------------------------------------------------------------------
          const isEditing =
            editingActionId ===
            definition.id;

          // -------------------------------------------------------------------
          // Konflikt nur beim tatsächlich betroffenen Eintrag anzeigen.
          // -------------------------------------------------------------------
          const currentConflict =
            conflict?.actionId ===
            definition.id
              ? conflict
              : null;

          return (
            <article
              key={definition.id}
              className={
                "zukato-shortcuts__item"
              }
            >
              {/* --------------------------------------------------------------
                  Sichtbarer Name der Shortcut-Aktion.
                  ----------------------------------------------------------- */}
              <h3>
                {t(
                  SHORTCUT_TITLE_KEYS[
                    definition.id
                  ],
                )}
              </h3>

              {/* --------------------------------------------------------------
                  Überschrift der aktuellen Belegung.
                  ----------------------------------------------------------- */}
              <p>
                {t(
                  "shortcuts.currentBinding",
                )}
              </p>

              {/* --------------------------------------------------------------
                  Formatierte Tastenkombination.
                  ----------------------------------------------------------- */}
              <kbd>
                {formatBinding(
                  binding.codes,
                )}
              </kbd>

              {/* --------------------------------------------------------------
                  Während der Aufnahme werden die normalen Buttons ausgeblendet.
                  ----------------------------------------------------------- */}
              {isEditing ? (
                <p>
                  {t(
                    "shortcuts.pressKeys",
                  )}
                </p>
              ) : (
                <>
                  {/* ----------------------------------------------------------
                      Neue Belegung aufnehmen.
                      ------------------------------------------------------- */}
                  <button
                    type="button"
                    onClick={() => {
                      handleEdit(
                        definition.id,
                      );
                    }}
                  >
                    {t(
                      "shortcuts.edit",
                    )}
                  </button>

                  {/* ----------------------------------------------------------
                      Der Entfernen-Button wird nur angezeigt, wenn aktuell
                      überhaupt eine Belegung vorhanden ist.
                      ------------------------------------------------------- */}
                  {binding.codes.length >
                    0 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleClear(
                          definition.id,
                        );
                      }}
                    >
                      {t(
                        "shortcuts.clear",
                      )}
                    </button>
                  )}

                  {/* ----------------------------------------------------------
                      Standardbelegung wiederherstellen.
                      ------------------------------------------------------- */}
                  <button
                    type="button"
                    onClick={() => {
                      handleReset(
                        definition.id,
                        definition
                          .defaultCodes,
                      );
                    }}
                  >
                    {t(
                      "shortcuts.reset",
                    )}
                  </button>
                </>
              )}

              {/* --------------------------------------------------------------
                  Konfliktmeldung mit dem Namen der bereits belegten Aktion.
                  ----------------------------------------------------------- */}
              {currentConflict && (
                <p role="alert">
                  {t(
                    "shortcuts.conflictWith",
                    {
                      action: t(
                        SHORTCUT_TITLE_KEYS[
                          currentConflict
                            .conflictingActionId
                        ],
                      ),
                    },
                  )}
                </p>
              )}
            </article>
          );
        },
      )}
    </section>
  );
}