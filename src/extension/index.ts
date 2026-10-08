// =============================================================================
// Datei: src/extension/index.ts
// Zweck: Bootstrap der Extension: wartet auf Spicetify-APIs und steuert Start und Stop der Runtime.
// =============================================================================
import {
  startExtensionRuntime,
  stopExtensionRuntime,
} from "./modules/extension-runtime";

// -----------------------------------------------------------------------------
// Zentrale Konstante `EXTENSION_NAME` dieses Moduls.
// -----------------------------------------------------------------------------
const EXTENSION_NAME = "ZuKaTo Core";
// -----------------------------------------------------------------------------
// Zentrale Konstante `READY_CHECK_INTERVAL_MS` dieses Moduls.
// -----------------------------------------------------------------------------
const READY_CHECK_INTERVAL_MS = 100;

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `isStarted`.
// -----------------------------------------------------------------------------
let isStarted = false;

// -----------------------------------------------------------------------------
// Stoppt die Extension-Runtime vor dem Entladen des Spotify-Fensters.
// -----------------------------------------------------------------------------
function stopExtension(): void {
  if (!isStarted) {
    return;
  }

  stopExtensionRuntime();

  isStarted = false;

  console.info(
    `[${EXTENSION_NAME}] Extension erfolgreich beendet.`,
  );
}

/**
 * Prüft, ob die grundlegenden Spicetify-APIs bereitstehen.
 */
function isSpicetifyReady(): boolean {
  return Boolean(
    Spicetify.Player &&
    Spicetify.Platform &&
    Spicetify.Platform.LocalStorageAPI,
  );
}

/**
 * Hier werden später unsere Module gestartet:
 *
 * - Tastenkürzel
 * - Sleep-Timer
 * - Song-Historie
 * - Kontextmenüs
 * - Player-Erweiterungen
 * - eigene Buttons
 * - Einstellungen
 */
function startExtension(): void {
  if (isStarted) {
    return;
  }

  startExtensionRuntime();

  isStarted = true;

  console.info(
    `[${EXTENSION_NAME}] Extension erfolgreich gestartet.`,
  );
}

/**
 * Wartet kontrolliert auf Spotify und startet anschließend die Extension.
 */
function bootstrap(): void {
  if (!isSpicetifyReady()) {
    window.setTimeout(
      bootstrap,
      READY_CHECK_INTERVAL_MS,
    );

    return;
  }

  try {
    startExtension();
  } catch (error: unknown) {
    console.error(
      `[${EXTENSION_NAME}] Start fehlgeschlagen:`,
      error,
    );
  }
}

window.addEventListener(
  "beforeunload",
  stopExtension,
);

bootstrap();