const EXTENSION_NAME = "ZuKaTo Core";
const READY_CHECK_INTERVAL_MS = 100;

let isStarted = false;

/**
 * Prüft, ob die grundlegenden Spicetify-APIs bereitstehen.
 */
function isSpicetifyReady(): boolean {
  return Boolean(
    Spicetify.Player &&
    Spicetify.Platform,
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

bootstrap();