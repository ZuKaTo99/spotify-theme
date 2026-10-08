// =============================================================================
// Datei:
// src/extension/modules/keyboard-shortcuts/KeyboardShortcutActions.ts
//
// Zweck:
// Verbindet Shortcut-Aktions-IDs mit den echten Spotify-Player-Funktionen.
// =============================================================================

import type {
  KeyboardShortcutActionId,
} from "../../../shared/keyboard-shortcuts";

// -----------------------------------------------------------------------------
// Wiedergabe / Pause umschalten.
//
// Spicetify entscheidet anhand des aktuellen Zustands automatisch,
// ob pausiert oder weitergespielt werden soll.
// -----------------------------------------------------------------------------
export function togglePlayPause(): void {
  Spicetify.Player.togglePlay();
}

// -----------------------------------------------------------------------------
// Zum nächsten Titel springen.
// -----------------------------------------------------------------------------
export function playNextTrack(): void {
  Spicetify.Player.next();
}

// -----------------------------------------------------------------------------
// Zum vorherigen Titel springen.
// -----------------------------------------------------------------------------
export function playPreviousTrack(): void {
  Spicetify.Player.back();
}

// -----------------------------------------------------------------------------
// Lautstärke erhöhen.
//
// Wir verwenden absichtlich die native Spicetify-Funktion.
// Dadurch übernimmt Spotify selbst die passende Schrittgröße.
// -----------------------------------------------------------------------------
export function increasePlayerVolume(): void {
  Spicetify.Player.increaseVolume();
}

// -----------------------------------------------------------------------------
// Lautstärke verringern.
//
// Auch hier verwenden wir direkt die native Spicetify-Funktion.
// -----------------------------------------------------------------------------
export function decreasePlayerVolume(): void {
  Spicetify.Player.decreaseVolume();
}

// -----------------------------------------------------------------------------
// Stummschaltung umschalten.
//
// Ist Spotify nicht stummgeschaltet, wird stummgeschaltet.
// Ist Spotify bereits stummgeschaltet, wird die Stummschaltung aufgehoben.
// -----------------------------------------------------------------------------
export function togglePlayerMute(): void {
  Spicetify.Player.toggleMute();
}

// -----------------------------------------------------------------------------
// Zentrale Verbindung zwischen Shortcut-ID und ausführbarer Funktion.
//
// Der Record-Typ ist absichtlich streng.
//
// Wird in shared/keyboard-shortcuts.ts eine neue Shortcut-ID registriert,
// verlangt TypeScript automatisch, dass auch hier eine Funktion zugeordnet wird.
// -----------------------------------------------------------------------------
export const keyboardShortcutActions:
  Record<
    KeyboardShortcutActionId,
    () => void
  > = {
    // -------------------------------------------------------------------------
    // Wiedergabe / Pause.
    // -------------------------------------------------------------------------
    "play-pause":
      togglePlayPause,

    // -------------------------------------------------------------------------
    // Nächster Titel.
    // -------------------------------------------------------------------------
    "next-track":
      playNextTrack,

    // -------------------------------------------------------------------------
    // Vorheriger Titel.
    // -------------------------------------------------------------------------
    "previous-track":
      playPreviousTrack,

    // -------------------------------------------------------------------------
    // Lautstärke erhöhen.
    // -------------------------------------------------------------------------
    "volume-up":
      increasePlayerVolume,

    // -------------------------------------------------------------------------
    // Lautstärke verringern.
    // -------------------------------------------------------------------------
    "volume-down":
      decreasePlayerVolume,

    // -------------------------------------------------------------------------
    // Stumm ein / aus.
    // -------------------------------------------------------------------------
    "toggle-mute":
      togglePlayerMute,
  };