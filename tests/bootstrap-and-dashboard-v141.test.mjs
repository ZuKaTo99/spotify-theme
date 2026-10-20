// =============================================================================
// Datei: tests/bootstrap-and-dashboard-v141.test.mjs
// Zweck: Fehler im Spotify-Bootstrap und Dashboard-Polling reproduzierbar testen.
// Getestet werden die echten TS-Implementierungen in isolierter Node-Virtual-Machine.
// =============================================================================
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const load = async (relative) => readFile(new URL(relative, import.meta.url), 'utf8');
const bootstrapSource = await load('../src/extension/index.ts');
const sessionSource = await load('../src/shared/song-session.ts');
const dashboardSource = await load('../src/custom-app/modules/dashboard/dashboard-polling.ts');
const dashboard = await load('../src/custom-app/modules/dashboard/Dashboard.tsx');

/** Bootstrap wird sofort ausgeführt und plant bei Fehlern einen erneuten Versuch. */
function createBootstrapFixture({ ready = true, fails = 0 } = {}) {
  let pendingId = 0;
  let nextId = 0;
  let startCalls = 0;
  let stopCalls = 0;
  const planned = new Map();
  const listeners = new Map();
  const logs = [];
  const player = ready ? { addEventListener() {}, removeEventListener() {} } : {};
  const storage = { getItem() {}, setItem() {} };
  const environment = {
    Spicetify: { Player: player, Platform: { LocalStorageAPI: storage } },
    startExtensionRuntime() {
      startCalls++;
      if (startCalls <= fails) throw new Error('Spotify API zeitweise nicht bereit');
    },
    stopExtensionRuntime() { stopCalls++; },
    console: {
      info: (...args) => logs.push(args),
      warn: (...args) => logs.push(args),
      error: (...args) => logs.push(args),
    },
    window: {
      setTimeout(callback, delay) { const id = ++nextId; planned.set(id, { callback, delay }); return id; },
      clearTimeout(id) { planned.delete(id); },
      addEventListener(name, callback) { listeners.set(name, callback); },
    },
  };
  const code = stripTypeScriptTypes(bootstrapSource, { mode: 'strip' })
    .replace(/^import\s+[^;]+;\s*$/gm, '');
  runInNewContext(code, environment, { timeout: 1500 });
  return {
    player, planned, listeners, logs,
    get startCalls() { return startCalls; },
    get stopCalls() { return stopCalls; },
    get lastDelay() { return [...planned.values()][0]?.delay; },
    tick() {
      assert.equal(planned.size, 1, 'Exakt ein Retry-Timeout');
      const [id, value] = planned.entries().next().value;
      planned.delete(id);
      pendingId = id;
      value.callback();
      return pendingId;
    },
    unload() { listeners.get('beforeunload')?.(); },
  };
}

test('Bootstrap: unfertige Player-API wird ohne Endlosschleife nachgeprüft', () => {
  const f = createBootstrapFixture({ ready: false });
  assert.equal(f.startCalls, 0);
  assert.equal(f.lastDelay, 100);
  f.tick();
  assert.equal(f.lastDelay, 100);
  f.player.addEventListener = () => {};
  f.player.removeEventListener = () => {};
  f.tick();
  assert.equal(f.startCalls, 1);
  assert.equal(f.planned.size, 0);
  f.unload();
  assert.equal(f.stopCalls, 1);
});

test('Bootstrap: nach einem temporären Startfehler sauber aufräumen und neu starten', () => {
  const f = createBootstrapFixture({ fails: 2 });
  assert.equal(f.startCalls, 1);
  assert.equal(f.stopCalls, 1, 'Fehlgeschlagene Teilinitialisierung wird bereinigt');
  assert.equal(f.lastDelay, 200);
  f.tick();
  assert.equal(f.startCalls, 2);
  assert.equal(f.lastDelay, 400);
  f.tick();
  assert.equal(f.startCalls, 3);
  assert.equal(f.planned.size, 0);
  f.unload();
  assert.equal(f.stopCalls, 3);
});

test('Bootstrap: ein Fenster-Shutdown beseitigt geplante Neustarts', () => {
  const f = createBootstrapFixture({ fails: 10 });
  assert.equal(f.planned.size, 1);
  f.unload();
  assert.equal(f.planned.size, 0);
  assert.equal(f.startCalls, 1);
  assert.equal(f.stopCalls, 1);
});

test('Bootstrap: Retry-Abstand bei dauerhaftem API-Fehler begrenzen', () => {
  const f = createBootstrapFixture({ fails: 20 });
  for (let i = 0; i < 12; i++) {
    assert.ok(f.lastDelay <= 5000);
    f.tick();
  }
  assert.equal(f.lastDelay, 5000);
  f.unload();
});

test('Song-Session: teilweise registrierte Listener werden beim Startfehler entfernt', () => {
  const callbacks = new Map();
  let bad = true;
  const timers = new Map();
  const storage = new Map();
  const code = stripTypeScriptTypes(sessionSource, { mode: 'strip' })
    .replace(/^export\s+/gm, '') + '\n({startSongSessionTracker, stopSongSessionTracker});';
  const api = runInNewContext(code, {
    console,
    Date,
    Spicetify: {
      LocalStorage: null,
      Platform: { LocalStorageAPI: {
        getItem: (key) => storage.get(key),
        setItem: (key,value) => storage.set(key,value),
      } },
      Player: {
        data: null,
        addEventListener(name, callback) {
          if (name === 'onplaypause' && bad) throw new Error('Spotify noch nicht startklar');
          callbacks.set(name, callback);
        },
        removeEventListener(name, callback) {
          if (callbacks.get(name) === callback) callbacks.delete(name);
        },
        getProgress: () => 0,
      },
    },
    window: {
      setInterval(callback, delay) { timers.set(1, {callback, delay}); return 1; },
      clearInterval(id) { timers.delete(id); },
      dispatchEvent() {},
    },
  }, { timeout: 1500 });
  assert.throws(() => api.startSongSessionTracker(), /noch nicht startklar/);
  assert.equal(callbacks.size, 0, 'Kein übrig gebliebener Songwechsel-Listener');
  assert.equal(timers.size, 0);
  bad = false;
  api.startSongSessionTracker();
  api.startSongSessionTracker();
  assert.equal(callbacks.size, 2);
  assert.equal(timers.size, 1);
  api.stopSongSessionTracker();
  assert.equal(callbacks.size, 0);
  assert.equal(timers.size, 0);
});

const polling = await import(`data:text/javascript,${encodeURIComponent(
  stripTypeScriptTypes(dashboardSource, {mode:'strip'}),
)}`);

test('Dashboard: Wiedergabe weiterhin sekündlich, Pause/Hintergrund sparsamer', () => {
  assert.equal(polling.dashboardProgressDelayMs(true, false), 1000);
  assert.equal(polling.dashboardProgressDelayMs(false, false), 3000);
  assert.equal(polling.dashboardProgressDelayMs(true, true), 4000);
  assert.equal(polling.dashboardProgressDelayMs(false, true), 4000);
});

test('Dashboard: identischer Fortschritt erzeugt keine erneute React-Aktualisierung', () => {
  const previous = { elapsed: '1:00', total: '3:00', percent: 33.333 };
  assert.equal(polling.sameDashboardProgress(previous, {...previous}), true);
  assert.equal(polling.sameDashboardProgress(previous, {...previous, percent: 35}), false);
});

test('Dashboard: Player-, Pause- und Sichtbarkeitsevents räumen Timer und Listener auf', () => {
  for (const name of ['songchange', 'onplaypause']) {
    assert.ok(dashboard.includes(`addEventListener("${name}", refreshAndSchedule)`));
    assert.ok(dashboard.includes(`removeEventListener("${name}", refreshAndSchedule)`));
  }
  assert.match(dashboard, /document\.addEventListener\("visibilitychange", refreshAndSchedule\)/);
  assert.match(dashboard, /document\.removeEventListener\("visibilitychange", refreshAndSchedule\)/);
  assert.match(dashboard, /window\.clearTimeout\(timer\)/);
  assert.match(dashboard, /sameDashboardProgress\(previous, next\)/);
});
