// =============================================================================
// Datei: src/extension/index.ts
// Zweck: Fehlerrobuster Start und sauberes Beenden der Spicetify-Erweiterung.
// Wo ändern? Nur Bootstrap/Retry-Logik; keine Wallpaper- oder Player-UI hier.
// =============================================================================
import { startExtensionRuntime, stopExtensionRuntime } from "./modules/extension-runtime";

const EXTENSION_NAME = "ZuKaTo Core";
const READY_CHECK_INTERVAL_MS = 100;
const MAX_START_RETRY_DELAY_MS = 5_000;

let isStarted = false;
let shuttingDown = false;
let failedStartAttempts = 0;
let retryTimeout: number | null = null;

/** Nie zwei zeitgleiche Bootstrap-Versuche planen, auch nicht bei API-Flattern. */
function scheduleRetry(delayMs: number): void {
  if (shuttingDown || isStarted || retryTimeout !== null) return;
  retryTimeout = window.setTimeout(() => {
    retryTimeout = null;
    bootstrap();
  }, delayMs);
}

/** Die minimal benötigten APIs müssen tatsächlich Methoden bereitstellen. */
function isSpicetifyReady(): boolean {
  if (typeof Spicetify === "undefined") return false;
  return Boolean(
    Spicetify.Player &&
    typeof Spicetify.Player.addEventListener === "function" &&
    typeof Spicetify.Player.removeEventListener === "function" &&
    Spicetify.Platform?.LocalStorageAPI &&
    typeof Spicetify.Platform.LocalStorageAPI.getItem === "function" &&
    typeof Spicetify.Platform.LocalStorageAPI.setItem === "function"
  );
}

/** Stoppt auch geplante Neustarts, wenn das Spotify-Fenster geschlossen wird. */
function stopExtension(): void {
  shuttingDown = true;
  if (retryTimeout !== null) {
    window.clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  if (!isStarted) return;
  isStarted = false;
  try {
    stopExtensionRuntime();
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] Shutdown fehlgeschlagen:`, error);
  }
}

/** Ein temporärer Fehler beim Initialisieren darf die Extension nicht dauerhaft deaktivieren. */
function bootstrap(): void {
  if (shuttingDown || isStarted) return;
  if (!isSpicetifyReady()) {
    // Die APIs sind noch nicht verfügbar: schnell und ohne Fehlermeldungsflut prüfen.
    scheduleRetry(READY_CHECK_INTERVAL_MS);
    return;
  }
  try {
    startExtensionRuntime();
    isStarted = true;
    failedStartAttempts = 0;
    console.info(`[${EXTENSION_NAME}] Extension erfolgreich gestartet.`);
  } catch (error: unknown) {
    console.error(`[${EXTENSION_NAME}] Start fehlgeschlagen; erneuter Versuch folgt:`, error);
    // Auch ein teilweise gestartetes Modul darf keine Listener/Intervalle behalten.
    try { stopExtensionRuntime(); }
    catch (cleanupError) { console.warn(`[${EXTENSION_NAME}] Start-Cleanup fehlgeschlagen:`, cleanupError); }
    failedStartAttempts += 1;
    // Begrenztes Backoff verhindert dauerhaftes 100-ms-Feuer bei Client-Fehlern.
    const delay = Math.min(MAX_START_RETRY_DELAY_MS,
      READY_CHECK_INTERVAL_MS * 2 ** Math.min(failedStartAttempts, 6));
    scheduleRetry(delay);
  }
}

window.addEventListener("beforeunload", stopExtension);
bootstrap();
