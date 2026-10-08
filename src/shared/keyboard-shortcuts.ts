// =============================================================================
// Datei: src/shared/keyboard-shortcuts.ts
// Zweck: Zentrale Definition aller verfügbaren Tastenkürzel,
//        Standardbelegungen und gemeinsame Konflikterkennung.
// =============================================================================

// -----------------------------------------------------------------------------
// Technische IDs aller verfügbaren Shortcut-Aktionen.
//
// Diese Liste ist die zentrale Quelle für KeyboardShortcutActionId.
//
// Wenn hier eine neue Aktion ergänzt wird, sorgt TypeScript dafür,
// dass auch alle abhängigen Stellen im Projekt aktualisiert werden.
// -----------------------------------------------------------------------------
export const KEYBOARD_SHORTCUT_ACTION_IDS = [
  "play-pause",
  "next-track",
  "previous-track",
  "volume-up",
  "volume-down",
  "toggle-mute",
] as const;

// -----------------------------------------------------------------------------
// Union-Typ aller gültigen Shortcut-Aktions-IDs.
//
// Aktuell entspricht der Typ:
//
// "play-pause"
// | "next-track"
// | "previous-track"
// | "volume-up"
// | "volume-down"
// | "toggle-mute"
// -----------------------------------------------------------------------------
export type KeyboardShortcutActionId =
  typeof KEYBOARD_SHORTCUT_ACTION_IDS[number];

// -----------------------------------------------------------------------------
// Beschreibung einer registrierten Shortcut-Aktion.
// -----------------------------------------------------------------------------
export interface KeyboardShortcutDefinition {
  // Stabile technische ID der Shortcut-Aktion.
  id: KeyboardShortcutActionId;

  // Standardbelegung der Aktion.
  //
  // Die Werte entsprechen KeyboardEvent.code aus dem Browser.
  defaultCodes: readonly string[];
}

// -----------------------------------------------------------------------------
// Minimaler gemeinsamer Typ für eine Shortcut-Belegung.
//
// Dieser Typ wird unter anderem von der Konflikterkennung verwendet.
// -----------------------------------------------------------------------------
export interface KeyboardShortcutBindingLike {
  // Alle Tasten, die gleichzeitig gedrückt werden müssen.
  codes: readonly string[];
}

// -----------------------------------------------------------------------------
// Generische Sammlung von Shortcut-Belegungen.
//
// Der Typ ist absichtlich generisch, damit die Konflikterkennung auch mit
// zukünftigen Shortcut-Aktionen funktioniert.
// -----------------------------------------------------------------------------
export type KeyboardShortcutBindingsLike<
  TActionId extends string =
    KeyboardShortcutActionId,
> = Readonly<
  Record<
    TActionId,
    KeyboardShortcutBindingLike
  >
>;

// -----------------------------------------------------------------------------
// Zentrale Registry aller Shortcut-Aktionen.
//
// Standardbelegungen:
//
// Alt + P  -> Wiedergabe/Pause
// Alt + →  -> Nächster Titel
// Alt + ←  -> Vorheriger Titel
// Alt + ↑  -> Lautstärke hoch
// Alt + ↓  -> Lautstärke runter
// Alt + M  -> Stumm ein/aus
// -----------------------------------------------------------------------------
export const KEYBOARD_SHORTCUT_DEFINITIONS:
  readonly KeyboardShortcutDefinition[] = [
    // -------------------------------------------------------------------------
    // Wiedergabe / Pause.
    // -------------------------------------------------------------------------
    {
      id: "play-pause",

      defaultCodes: [
        "AltLeft",
        "KeyP",
      ],
    },

    // -------------------------------------------------------------------------
    // Zum nächsten Titel springen.
    // -------------------------------------------------------------------------
    {
      id: "next-track",

      defaultCodes: [
        "AltLeft",
        "ArrowRight",
      ],
    },

    // -------------------------------------------------------------------------
    // Zum vorherigen Titel springen.
    // -------------------------------------------------------------------------
    {
      id: "previous-track",

      defaultCodes: [
        "AltLeft",
        "ArrowLeft",
      ],
    },

    // -------------------------------------------------------------------------
    // Spotify-Lautstärke erhöhen.
    // -------------------------------------------------------------------------
    {
      id: "volume-up",

      defaultCodes: [
        "AltLeft",
        "ArrowUp",
      ],
    },

    // -------------------------------------------------------------------------
    // Spotify-Lautstärke verringern.
    // -------------------------------------------------------------------------
    {
      id: "volume-down",

      defaultCodes: [
        "AltLeft",
        "ArrowDown",
      ],
    },

    // -------------------------------------------------------------------------
    // Spotify stumm schalten beziehungsweise die Stummschaltung aufheben.
    // -------------------------------------------------------------------------
    {
      id: "toggle-mute",

      defaultCodes: [
        "AltLeft",
        "KeyM",
      ],
    },
  ];

// -----------------------------------------------------------------------------
// Erstellt eine vergleichbare Signatur für eine Tastenkombination.
//
// Die Codes werden sortiert, damit die Reihenfolge beim Vergleich keine Rolle
// spielt.
//
// Beispiel:
//
// AltLeft + KeyP
//
// und
//
// KeyP + AltLeft
//
// ergeben dieselbe Signatur.
// -----------------------------------------------------------------------------
export function createKeyboardShortcutSignature(
  codes: readonly string[],
): string {
  // Das Array wird kopiert, damit die gespeicherte Belegung nicht verändert wird.
  return [...codes]
    .sort()
    .join("|");
}

// -----------------------------------------------------------------------------
// Prüft, ob eine Tastenkombination bereits einer anderen Aktion zugeordnet ist.
//
// Rückgabe:
//
// - ID einer anderen Aktion -> Konflikt vorhanden
// - null                    -> Kombination ist frei
// -----------------------------------------------------------------------------
export function findKeyboardShortcutConflict<
  TActionId extends string,
>(
  actionId: TActionId,
  codes: readonly string[],
  bindings:
    KeyboardShortcutBindingsLike<TActionId>,
): TActionId | null {
  // ---------------------------------------------------------------------------
  // Eine leere Belegung bedeutet "kein Shortcut".
  //
  // Sie kann deshalb niemals einen Konflikt verursachen.
  // ---------------------------------------------------------------------------
  if (codes.length === 0) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Vergleichssignatur der neuen Kombination erstellen.
  // ---------------------------------------------------------------------------
  const signature =
    createKeyboardShortcutSignature(
      codes,
    );

  // ---------------------------------------------------------------------------
  // Alle aktuell gespeicherten Shortcut-Aktions-IDs auslesen.
  //
  // Object.keys liefert grundsätzlich string[].
  // Da bindings jedoch Record<TActionId, ...> ist, können die Keys hier
  // auf TActionId[] eingegrenzt werden.
  // ---------------------------------------------------------------------------
  const candidateActionIds =
    Object.keys(
      bindings,
    ) as TActionId[];

  // ---------------------------------------------------------------------------
  // Jede vorhandene Belegung gegen die neue Kombination prüfen.
  // ---------------------------------------------------------------------------
  for (
    const candidateActionId
    of candidateActionIds
  ) {
    // -------------------------------------------------------------------------
    // Die gerade bearbeitete Aktion selbst überspringen.
    //
    // Dadurch darf ein Shortcut seine aktuelle Belegung behalten.
    // -------------------------------------------------------------------------
    if (
      candidateActionId === actionId
    ) {
      continue;
    }

    // -------------------------------------------------------------------------
    // Aktuelle Belegung der anderen Aktion auslesen.
    // -------------------------------------------------------------------------
    const candidateCodes =
      bindings[
        candidateActionId
      ].codes;

    // -------------------------------------------------------------------------
    // Unbelegte Aktionen können keinen Konflikt verursachen.
    // -------------------------------------------------------------------------
    if (candidateCodes.length === 0) {
      continue;
    }

    // -------------------------------------------------------------------------
    // Vergleichssignatur der bereits vorhandenen Belegung erstellen.
    // -------------------------------------------------------------------------
    const candidateSignature =
      createKeyboardShortcutSignature(
        candidateCodes,
      );

    // -------------------------------------------------------------------------
    // Stimmen beide Signaturen überein, ist die Kombination bereits vergeben.
    // -------------------------------------------------------------------------
    if (
      candidateSignature === signature
    ) {
      return candidateActionId;
    }
  }

  // ---------------------------------------------------------------------------
  // Keine andere Aktion verwendet diese Tastenkombination.
  // ---------------------------------------------------------------------------
  return null;
}