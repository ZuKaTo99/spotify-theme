// =============================================================================
// Datei: src/extension/modules/sleep-timer/SleepTimerModule.ts
// Zweck: Persistenter Sleep-Timer mit ressourcenschonender Deadline-Prüfung.
// Wo ändern? Menüs und Benachrichtigungen hier; Zeitregeln in sleep-timer-policy.ts.
// =============================================================================
import { runtimeText } from "../../../shared/runtime-i18n";
import { normalizeSleepDeadline, sleepTimerNextDelayMs } from "./sleep-timer-policy";
import type { ExtensionModule } from "../ExtensionModule";

const STORAGE_KEY = "zukato-toolkit.sleep-until";
// Spotify kann beim Ablauf vorübergehend keine Pause-Aktion ausführen.
// Statt den Auftrag zu verlieren, probieren wir nach einer kurzen Pause erneut.
const PAUSE_RETRY_DELAY_MS = 5_000;
let deadline = 0;
let timeout: number | null = null;
let menu: Spicetify.Menu.SubMenu | null = null;
const items: Spicetify.Menu.Item[] = [];
let lastMenuLabel = "";
let pausePending = false;
let retryNotBefore = 0;
// Jede manuelle Timer-Änderung macht eine noch ausstehende Pause-Antwort ungültig.
let timerRevision = 0;

/** Aktualisiert das Menü nur dann, wenn sich die sichtbare Minutenzahl ändert. */
function refreshMenu(): void {
  const minutes = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 60_000)) : 0;
  const label = deadline ? `Restzeit: ${minutes} min` : "Kein Timer aktiv";
  if (label !== lastMenuLabel) {
    items[4]?.setName(label);
    lastMenuLabel = label;
  }
}

/** Entfernt einen geplanten Tick auch beim Deaktivieren des Feature-Moduls. */
function clearScheduledTick(): void {
  if (timeout !== null) window.clearTimeout(timeout);
  timeout = null;
}

/** Bei inaktivem Timer gibt es KEINEN Hintergrundtimer. */
function scheduleNextTick(): void {
  clearScheduledTick();
  const delay = sleepTimerNextDelayMs(deadline, Date.now());
  if (delay !== null) {
    timeout = window.setTimeout(() => {
      timeout = null;
      tick();
    }, delay);
  }
}

/**
 * Änderungen sofort im Arbeitsspeicher übernehmen. Ein Storage-Fehler darf
 * einen bereits gesetzten Sleep-Timer nicht versehentlich deaktivieren.
 */
function persist(value: number): void {
  timerRevision += 1;
  pausePending = false;
  retryNotBefore = 0;
  deadline = value;
  try {
    Spicetify.Platform.LocalStorageAPI.setItem(STORAGE_KEY, value);
  } catch (error) {
    console.warn("[ZuKaTo] Sleep-Timer konnte nicht dauerhaft gespeichert werden.", error);
  }
  refreshMenu();
  scheduleNextTick();
}

/**
 * Beim Ablauf MUSS Spotifys Pause-Aktion tatsächlich erfolgreich sein.
 * Ein synchroner Fehler oder ein abgewiesenes Promise darf die Deadline nicht
 * löschen. Eine Revision schützt neue/abgebrochene Timer vor alten Antworten.
 */
function pauseAtDeadline(): void {
  if (pausePending || !deadline) return;
  pausePending = true;
  clearScheduledTick();
  const expectedRevision = timerRevision;
  const expectedDeadline = deadline;

  const stillCurrent = (): boolean =>
    timerRevision === expectedRevision && deadline === expectedDeadline;

  const onSuccess = (): void => {
    if (!stillCurrent()) return;
    persist(0);
    Spicetify.showNotification(runtimeText("runtime.sleepPaused"));
  };
  const onFailure = (error: unknown): void => {
    if (!stillCurrent()) return;
    pausePending = false;
    console.warn("[ZuKaTo] Sleep-Timer konnte Spotify nicht pausieren; neuer Versuch folgt.", error);
    retryNotBefore = Date.now() + PAUSE_RETRY_DELAY_MS;
    // Keine 1-ms-Fehlerschleife, auch wenn die Deadline längst überschritten ist.
    clearScheduledTick();
    timeout = window.setTimeout(() => {
      timeout = null;
      tick();
    }, PAUSE_RETRY_DELAY_MS);
  };

  try {
    // Die Spicetify-Typen deklarieren pause() als void; manche Clients geben
    // tatsächlich ein Promise zurück. Beide Fälle müssen behandelt werden.
    const result: unknown = Spicetify.Player.pause();
    if (result !== null && typeof result === "object" &&
      typeof (result as PromiseLike<unknown>).then === "function") {
      void Promise.resolve(result).then(onSuccess, onFailure);
    } else {
      onSuccess();
    }
  } catch (error) {
    onFailure(error);
  }
}

/** Auch nach Standby/gedrosselten Timern die echte Deadline prüfen. */
function tick(): void {
  if (deadline && Date.now() >= deadline) {
    // Ein Fokusereignis während des Backoffs darf die Sperre nicht umgehen.
    if (pausePending || Date.now() < retryNotBefore) return;
    pauseAtDeadline();
    return;
  }
  refreshMenu();
  scheduleNextTick();
}

function startTimer(minutes: number): void {
  persist(Date.now() + minutes * 60_000);
  Spicetify.showNotification(runtimeText("runtime.sleepStarted", { minutes }));
}

/** Hintergrund-Drosselung durch Chromium beim Zurückkehren sofort ausgleichen. */
function onVisibilityChange(): void {
  if (!document.hidden) tick();
}

export const sleepTimerModule: ExtensionModule = {
  id: "sleep-timer",
  start(): void {
    // Asynchrone Antworten eines vorherigen Modul-Laufs ignorieren.
    timerRevision += 1;
    pausePending = false;
    retryNotBefore = 0;
    clearScheduledTick();
    let saved: unknown;
    let readFailed = false;
    try {
      saved = Spicetify.Platform.LocalStorageAPI.getItem(STORAGE_KEY);
    } catch (error) {
      readFailed = true;
      // Beim Reaktivieren den im RAM noch vorhandenen Timer behalten,
      // statt einen temporären Lesefehler als "kein Timer" auszulegen.
      console.warn("[ZuKaTo] Sleep-Timer-Deadline konnte nicht gelesen werden.", error);
    }
    if (!readFailed) deadline = normalizeSleepDeadline(saved);
    lastMenuLabel = "";
    items.push(
      new Spicetify.Menu.Item("15 Minuten", false, () => startTimer(15)),
      new Spicetify.Menu.Item("30 Minuten", false, () => startTimer(30)),
      new Spicetify.Menu.Item("60 Minuten", false, () => startTimer(60)),
      new Spicetify.Menu.Item("Sleep-Timer abbrechen", false, () => {
        persist(0);
        Spicetify.showNotification(runtimeText("runtime.sleepStopped"));
      }),
      new Spicetify.Menu.Item("Kein Timer aktiv", false, () => {
        const minutes = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 60_000)) : 0;
        Spicetify.showNotification(minutes
          ? runtimeText("runtime.sleepRemaining", { minutes })
          : runtimeText("runtime.sleepNone"));
      }),
    );
    menu = new Spicetify.Menu.SubMenu("ZuKaTo Sleep-Timer", items);
    menu.register();
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisibilityChange);
    tick();
  },
  stop(): void {
    timerRevision += 1;
    pausePending = false;
    retryNotBefore = 0;
    clearScheduledTick();
    window.removeEventListener("focus", tick);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    menu?.deregister();
    menu = null;
    items.length = 0;
    lastMenuLabel = "";
    // Deadline bleibt absichtlich gespeichert für den nächsten Extension-Start.
  },
};
