// =============================================================================
// Datei: src/extension/modules/sleep-timer/SleepTimerModule.ts
// Zweck: Persistenter Sleep-Timer mit ressourcenschonender Deadline-Prüfung.
// Wo ändern? Menüs und Benachrichtigungen hier; Zeitregeln in sleep-timer-policy.ts.
// =============================================================================
import { runtimeText } from "../../../shared/runtime-i18n";
import { normalizeSleepDeadline, sleepTimerNextDelayMs } from "./sleep-timer-policy";
import type { ExtensionModule } from "../ExtensionModule";

const STORAGE_KEY = "zukato-toolkit.sleep-until";
let deadline = 0;
let timeout: number | null = null;
let menu: Spicetify.Menu.SubMenu | null = null;
const items: Spicetify.Menu.Item[] = [];
let lastMenuLabel = "";

/** Aktualisiert das Menü nur dann, wenn sich die sichtbare Minutenzahl ändert. */
function refreshMenu(): void {
  const minutes = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 60_000)) : 0;
  const label = minutes ? `Restzeit: ${minutes} min` : "Kein Timer aktiv";
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
  deadline = value;
  try {
    Spicetify.Platform.LocalStorageAPI.setItem(STORAGE_KEY, value);
  } catch (error) {
    console.warn("[ZuKaTo] Sleep-Timer konnte nicht dauerhaft gespeichert werden.", error);
  }
  refreshMenu();
  scheduleNextTick();
}

/** Auch nach Standby/gedrosselten Timern die echte Deadline prüfen. */
function tick(): void {
  if (deadline && Date.now() >= deadline) {
    // Zuerst zurücksetzen: Fokusereignis + Timeout dürfen nicht zweimal pausieren.
    persist(0);
    Spicetify.Player.pause();
    Spicetify.showNotification(runtimeText("runtime.sleepPaused"));
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
    let saved: unknown;
    try {
      saved = Spicetify.Platform.LocalStorageAPI.getItem(STORAGE_KEY);
    } catch (error) {
      // Gesperrter Profil-Storage darf die Menüregistrierung nicht verhindern.
      console.warn("[ZuKaTo] Sleep-Timer-Deadline konnte nicht gelesen werden.", error);
    }
    deadline = normalizeSleepDeadline(saved);
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
