// =============================================================================
// Datei: src/extension/modules/sleep-timer/SleepTimerModule.ts
// Zweck: Schlaf-Timer mit 15/30/60 Minuten und Profilmenü-Steuerung.
// =============================================================================
import { runtimeText } from "../../../shared/runtime-i18n";
import type { ExtensionModule } from "../ExtensionModule";

const STORAGE_KEY = "zukato-toolkit.sleep-until";
let deadline = 0;
let interval: number | null = null;
let menu: Spicetify.Menu.SubMenu | null = null;
const items: Spicetify.Menu.Item[] = [];

/** Timerzustand sichern; ein Browser-Neustart kann ihn wiederherstellen. */
function persist(value: number): void {
  deadline = value;
  Spicetify.Platform.LocalStorageAPI.setItem(STORAGE_KEY, deadline);
  refreshMenu();
}

/** Zeigt die gewählte Zeit in den Toggle-Einträgen an. */
function refreshMenu(): void {
  const remaining = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 60000)) : 0;
  items[4]?.setName(remaining ? `Restzeit: ${remaining} min` : "Kein Timer aktiv");
}

/** Die Minute kann auch verpasst werden, z. B. nach Standby: Deadline prüfen. */
function tick(): void {
  if (!deadline || Date.now() < deadline) return;
  persist(0);
  Spicetify.Player.pause();
  Spicetify.showNotification(runtimeText("runtime.sleepPaused"));
}

function startTimer(minutes: number): void {
  persist(Date.now() + minutes * 60_000);
  Spicetify.showNotification(runtimeText("runtime.sleepStarted", { minutes }));
}

export const sleepTimerModule: ExtensionModule = {
  id: "sleep-timer",
  start(): void {
    const saved: unknown = Spicetify.Platform.LocalStorageAPI.getItem(STORAGE_KEY);
    deadline = typeof saved === "number" && Number.isFinite(saved) && saved > 0 ? saved : 0;
    items.push(
      new Spicetify.Menu.Item("15 Minuten", false, () => startTimer(15)),
      new Spicetify.Menu.Item("30 Minuten", false, () => startTimer(30)),
      new Spicetify.Menu.Item("60 Minuten", false, () => startTimer(60)),
      new Spicetify.Menu.Item("Sleep-Timer abbrechen", false, () => {
        persist(0);
        Spicetify.showNotification(runtimeText("runtime.sleepStopped"));
      }),
      new Spicetify.Menu.Item("Kein Timer aktiv", false, () => {
        const minutes = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 60000)) : 0;
        Spicetify.showNotification(minutes ? runtimeText("runtime.sleepRemaining", { minutes }) : runtimeText("runtime.sleepNone"));
      }),
    );
    menu = new Spicetify.Menu.SubMenu("ZuKaTo Sleep-Timer", items);
    menu.register();
    refreshMenu();
    interval = window.setInterval(() => { tick(); refreshMenu(); }, 1000);
    tick();
  },
  stop(): void {
    if (interval !== null) window.clearInterval(interval);
    interval = null;
    menu?.deregister(); menu = null;
    items.length = 0;
    // Die Deadline bleibt absichtlich gespeichert für einen Neustart der Extension.
  },
};
