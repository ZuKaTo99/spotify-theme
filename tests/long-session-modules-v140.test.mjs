// =============================================================================
// Datei: tests/long-session-modules-v140.test.mjs
// Zweck: Echte Sleep-Timer-/Statistik-Modul-Runtimes gegen simuliertes Spotify
//        prüfen, statt nur nach Code-Text oder Timer-Namen zu suchen.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

/** Nur fest eingebundene interne Quellen; Laufzeitimporte explizit als Mocks. */
function loadExtensionModule(code, exportedName, globals) {
  const stripped = stripTypeScriptTypes(code, { mode: "strip" });
  const standalone = stripped
    .replace(/^import\s+[^;]+;\s*$/gm, "")
    .replace(new RegExp(`export const ${exportedName}\\b`), `const ${exportedName}`);
  return runInNewContext(`${standalone}\n${exportedName};`, globals, { timeout: 1000 });
}

const sleepPolicy = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(
  await source("../src/extension/modules/sleep-timer/sleep-timer-policy.ts"), { mode: "strip" },
))}`);
const sleepSource = await source("../src/extension/modules/sleep-timer/SleepTimerModule.ts");
const statsSource = await source("../src/extension/modules/player-statistics/PlayerStatisticsModule.ts");

function createSleepFixture(initial = null, options = {}) {
  let now = 1_800_000_000_000;
  let nextTimer = 0;
  let pauses = 0;
  const scheduled = new Map();
  const storage = new Map(initial === null ? [] : [["zukato-toolkit.sleep-until", initial]]);
  const windowEvents = new Map();
  const documentEvents = new Map();
  let menu;
  const notifications = [];
  class TestDate extends Date { static now() { return now; } }
  class Item {
    constructor(name, selected, callback) { this.name = name; this.callback = callback; }
    setName(value) { this.name = value; }
  }
  class SubMenu {
    constructor(name, items) { this.name = name; this.items = items; menu = this; }
    register() { this.registered = true; }
    deregister() { this.registered = false; }
  }
  const on = (target, type, callback) => { target.set(type, callback); };
  const off = (target, type, callback) => { if (target.get(type) === callback) target.delete(type); };
  const module = loadExtensionModule(sleepSource, "sleepTimerModule", {
    Date: TestDate,
    console,
    normalizeSleepDeadline: sleepPolicy.normalizeSleepDeadline,
    sleepTimerNextDelayMs: sleepPolicy.sleepTimerNextDelayMs,
    runtimeText: (key) => key,
    Spicetify: {
      Menu: { Item, SubMenu },
      Platform: { LocalStorageAPI: { getItem: (key) => { if (options.failRead) throw new Error("Profil gesperrt"); return storage.get(key); },
        setItem: (key, value) => { if (options.failWrite) throw new Error("Profil gesperrt"); storage.set(key, value); } } },
      Player: { pause: () => { pauses++; return options.pause?.(pauses); } },
      showNotification: (text) => notifications.push(text),
    },
    window: {
      setTimeout(fn, delay) { const id = ++nextTimer; scheduled.set(id, { fn, at: now + delay, delay }); return id; },
      clearTimeout(id) { scheduled.delete(id); },
      addEventListener(type, callback) { on(windowEvents, type, callback); },
      removeEventListener(type, callback) { off(windowEvents, type, callback); },
    },
    document: {
      hidden: false,
      addEventListener(type, callback) { on(documentEvents, type, callback); },
      removeEventListener(type, callback) { off(documentEvents, type, callback); },
    },
  });
  return {
    module, storage, scheduled, windowEvents, documentEvents, notifications,
    get menu() { return menu; },
    get pauses() { return pauses; },
    focus() { windowEvents.get("focus")?.(); },
    advance(ms) {
      const target = now + ms;
      while (true) {
        const due = [...scheduled.entries()].filter(([, timer]) => timer.at <= target).sort((a,b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        scheduled.delete(due[0]);
        due[1].fn();
      }
      now = target;
    },
  };
}

test("Sleep-Timer: keine Hintergrundabfrage im Leerlauf, sauberer Start/Stop", () => {
  const x = createSleepFixture();
  x.module.start();
  assert.equal(x.scheduled.size, 0, "Ohne Deadline existiert kein Timer");
  assert.equal(x.windowEvents.size, 1);
  assert.equal(x.documentEvents.size, 1);
  x.module.stop();
  assert.equal(x.scheduled.size, 0);
  assert.equal(x.windowEvents.size, 0);
  assert.equal(x.documentEvents.size, 0);
});

test("Sleep-Timer: nur 60-s-Ticks, einmal Pause nach Ablauf, keine Doppelmeldungen", () => {
  const x = createSleepFixture();
  x.module.start();
  x.menu.items[0].callback(); // 15 Minuten
  assert.equal(x.scheduled.size, 1);
  assert.equal([...x.scheduled.values()][0].delay, 60_000);
  x.advance(14 * 60_000);
  assert.equal(x.pauses, 0);
  assert.equal(x.menu.items[4].name, "Restzeit: 1 min");
  x.advance(60_000);
  assert.equal(x.pauses, 1);
  assert.equal(x.storage.get("zukato-toolkit.sleep-until"), 0);
  assert.equal(x.scheduled.size, 0);
  x.focus();
  assert.equal(x.pauses, 1);
  assert.equal(x.notifications.filter((value) => value === "runtime.sleepPaused").length, 1);
  x.module.stop();
});

test("Sleep-Timer: String-Deadline aus Storage und Standby-Rückkehr", () => {
  const x = createSleepFixture(String(1_800_000_000_000 + 30_000));
  x.module.start();
  assert.equal(x.scheduled.size, 1);
  assert.equal([...x.scheduled.values()][0].delay, 30_000);
  x.advance(20_000);
  x.focus();
  assert.equal([...x.scheduled.values()][0].delay, 10_000);
  x.advance(10_000);
  assert.equal(x.pauses, 1);
  x.module.stop();
});

test("Sleep-Timer: unzugänglicher Storage verhindert den Timer nicht", () => {
  const x = createSleepFixture(null, { failRead: true, failWrite: true });
  x.module.start();
  x.menu.items[0].callback();
  assert.equal(x.scheduled.size, 1, "Timer bleibt ohne Storage nutzbar");
  x.advance(15 * 60_000);
  assert.equal(x.pauses, 1);
  x.module.stop();
});

test("Sleep-Timer: vorzeitiger Abbruch stoppt alle Ticks", () => {
  const x = createSleepFixture();
  x.module.start();
  x.menu.items[2].callback();
  assert.equal(x.scheduled.size, 1);
  x.menu.items[3].callback();
  assert.equal(x.scheduled.size, 0);
  x.advance(61 * 60_000);
  assert.equal(x.pauses, 0);
  x.module.stop();
});

test("Sleep-Timer: kaputte Storage-Daten werden ohne Timer verworfen", () => {
  for (const raw of ["", "unbekannt", -1, Infinity, {}, "1e999"]) {
    const x = createSleepFixture(raw);
    x.module.start();
    assert.equal(x.scheduled.size, 0);
    x.module.stop();
  }
});

function createStatisticsFixture() {
  const listeners = new Map();
  const storage = new Map();
  let sessionIndex = 3;
  let playing = true;
  let writes = 0;
  let failWrites = false;
  const track = { uri: "spotify:track:ABCD123", title: "Test", artist: "Test", album: "Test" };
  const module = loadExtensionModule(statsSource, "playerStatisticsModule", {
    console,
    currentTrack: () => track,
    recordTrack() { if (failWrites) throw new Error("Speicher voll"); writes++; },
    loadSongSession: () => ({ uri: track.uri, index: sessionIndex }),
    Spicetify: {
      Player: {
        isPlaying: () => playing,
        addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) ?? []), fn]); },
        removeEventListener(name, fn) { listeners.set(name, (listeners.get(name) ?? []).filter((item) => item !== fn)); },
      },
      Platform: { LocalStorageAPI: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) } },
    },
  });
  return {
    module, storage, listeners,
    get writes() { return writes; },
    set index(value) { sessionIndex = value; },
    set playing(value) { playing = value; },
    set failWrites(value) { failWrites = value; },
    emit(name) { for (const listener of listeners.get(name) ?? []) listener(); },
  };
}

test("Hörverlauf: beim Extension-Neustart keine doppelte Songerfassung", () => {
  const x = createStatisticsFixture();
  x.module.start();
  assert.equal(x.writes, 1);
  x.emit("onplaypause");
  assert.equal(x.writes, 1);
  x.module.stop();
  x.module.start();
  assert.equal(x.writes, 1, "Gespeicherte Lauf-ID überlebt den Modul-Neustart");
  x.index = 4;
  x.emit("songchange");
  assert.equal(x.writes, 2, "Neuer Songdurchlauf wird weiterhin erfasst");
  x.module.stop();
  assert.equal(x.listeners.get("songchange").length, 0);
  assert.equal(x.listeners.get("onplaypause").length, 0);
});

test("Hörverlauf: fehlerhafter Speichervorgang wird beim nächsten Event wiederholt", () => {
  const x = createStatisticsFixture();
  x.failWrites = true;
  x.module.start();
  assert.equal(x.writes, 0);
  assert.equal(x.storage.size, 0);
  x.failWrites = false;
  x.emit("onplaypause");
  assert.equal(x.writes, 1);
  x.module.stop();
});

// -----------------------------------------------------------------------------
// v1.58: Regressionstests für fehlgeschlagene/asynchrone Pause-Aktionen.
// Ein abgelaufener Timer darf erst nach bestätigtem Pause-Erfolg verschwinden.
// -----------------------------------------------------------------------------
test("Sleep-Timer: synchrone Player-Fehler behalten Deadline und versuchen erneut", () => {
  const x = createSleepFixture(null, {
    pause: (attempt) => { if (attempt === 1) throw new Error("Player gerade offline"); },
  });
  x.module.start();
  x.menu.items[0].callback();
  const expectedDeadline = x.storage.get("zukato-toolkit.sleep-until");
  x.advance(15 * 60_000);
  assert.equal(x.pauses, 1);
  assert.equal(x.storage.get("zukato-toolkit.sleep-until"), expectedDeadline);
  assert.deepEqual([...x.scheduled.values()].map((item) => item.delay), [5000]);
  x.focus();
  assert.equal(x.pauses, 1, "Fokus darf den Backoff nicht umgehen");
  x.advance(5000);
  assert.equal(x.pauses, 2);
  assert.equal(x.storage.get("zukato-toolkit.sleep-until"), 0);
  assert.equal(x.scheduled.size, 0);
  assert.equal(x.notifications.filter((text) => text === "runtime.sleepPaused").length, 1);
  x.module.stop();
});

test("Sleep-Timer: Promise-Rejection wird kontrolliert wiederholt", async () => {
  let rejectPause;
  const x = createSleepFixture(null, {
    pause: (attempt) => attempt === 1
      ? new Promise((_, reject) => { rejectPause = reject; }) : undefined,
  });
  x.module.start();
  x.menu.items[0].callback();
  x.advance(15 * 60_000);
  x.focus();
  assert.equal(x.pauses, 1, "Während einer offenen Pause nur ein Aufruf");
  rejectPause(new Error("Spotify kurz nicht erreichbar"));
  // Promise aus dem isolierten VM-Kontext erst bis zum nächsten Task auswerten.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(x.scheduled.size, 1);
  x.advance(5000);
  assert.equal(x.pauses, 2);
  assert.equal(x.storage.get("zukato-toolkit.sleep-until"), 0);
  x.module.stop();
});

test("Sleep-Timer: verspätete Pause-Antwort löscht keinen neu gesetzten Timer", async () => {
  let resolvePause;
  const x = createSleepFixture(null, {
    pause: (attempt) => attempt === 1
      ? new Promise((resolve) => { resolvePause = resolve; }) : undefined,
  });
  x.module.start();
  x.menu.items[0].callback();
  x.advance(15 * 60_000);
  x.menu.items[1].callback(); // Während der offenen Pause neuen 30-Minuten-Timer setzen.
  const laterDeadline = x.storage.get("zukato-toolkit.sleep-until");
  resolvePause();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(x.storage.get("zukato-toolkit.sleep-until"), laterDeadline);
  assert.equal(x.notifications.filter((text) => text === "runtime.sleepPaused").length, 0);
  x.advance(30 * 60_000);
  assert.equal(x.pauses, 2);
  assert.equal(x.storage.get("zukato-toolkit.sleep-until"), 0);
  x.module.stop();
});

test("Sleep-Timer: Stop räumt Retry auf und ignoriert verspätete Promise-Antwort", async () => {
  let rejectPause;
  const x = createSleepFixture(null, {
    pause: () => new Promise((_, reject) => { rejectPause = reject; }),
  });
  x.module.start();
  x.menu.items[0].callback();
  x.advance(15 * 60_000);
  const saved = x.storage.get("zukato-toolkit.sleep-until");
  x.module.stop();
  rejectPause(new Error("Client beendet"));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(x.scheduled.size, 0);
  assert.equal(x.storage.get("zukato-toolkit.sleep-until"), saved);
  assert.equal(x.notifications.filter((text) => text === "runtime.sleepPaused").length, 0);
});


test("Sleep-Timer: Storage-Lesefehler nach Modul-Neustart erhält RAM-Deadline", () => {
  const options = { failRead: false };
  const x = createSleepFixture(null, options);
  x.module.start();
  x.menu.items[0].callback();
  const saved = x.storage.get("zukato-toolkit.sleep-until");
  x.module.stop();
  options.failRead = true;
  x.module.start();
  assert.equal(x.storage.get("zukato-toolkit.sleep-until"), saved);
  assert.equal(x.scheduled.size, 1, "Vorhandener Timer bleibt trotz Lesefehler aktiv");
  x.advance(15 * 60_000);
  assert.equal(x.pauses, 1);
  x.module.stop();
});
