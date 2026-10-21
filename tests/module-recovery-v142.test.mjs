// =============================================================================
// Datei: tests/module-recovery-v142.test.mjs
// Zweck: Echte Modul-Runtimes (keine reinen Text-Assertions) gegen gescheiterte
//        Initialisierung, Wiederholung, Shutdown und Kontextmenü-Auswahl testen.
// =============================================================================
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { loadPureSharedModule } from './helpers/load-ts-module.mjs';
import path from 'node:path';

// Seit v1.47 nutzt das Kontextmenü dieselben Shared-Helfer wie die Playlist-Seite.
// Der isolierte VM-Test erhält deshalb die echten Hilfsfunktionen statt Mocks.
const root = path.resolve(import.meta.dirname, '..');
const { createSingleFlight } = loadPureSharedModule(root, 'src/shared/single-flight.ts');
const { QueueBatchError, enqueueQueueBatches } = loadPureSharedModule(root, 'src/shared/queue-batches.ts');
const { parseSpotifyTrackInput } = loadPureSharedModule(root, 'src/shared/track-search.ts');

const read = async (relative) => readFile(new URL(relative, import.meta.url), 'utf8');
const managerSource = await read('../src/extension/modules/ExtensionModuleManager.ts');

/** Aus TypeScript eine isolierte Test-Runtime ohne externe Imports erzeugen. */
function loadModule(source, expression, context) {
  const code = stripTypeScriptTypes(source, {mode: 'strip'})
    .replace(/^import\s+[^;]+;\s*$/gm, '')
    .replace(/^export\s+/gm, '');
  return runInNewContext(`${code}\n${expression};`, context, {timeout: 1500});
}

/** Deterministischer Uhr-Adapter ohne echte Wartezeiten oder offene Node-Timer. */
function managerFixture(modules) {
  let nextTimer = 0;
  let now = 0;
  const pending = new Map();
  const logs = [];
  const Manager = loadModule(managerSource, 'ExtensionModuleManager', {
    window: {
      setTimeout(fn, delay) {
        const id = ++nextTimer;
        pending.set(id, {fn, delay, at: now + delay});
        return id;
      },
      clearTimeout(id) { pending.delete(id); },
    },
    console: {error: (...args) => logs.push(args), warn: (...args) => logs.push(args)},
  });
  const manager = new Manager(modules);
  return {
    manager, pending, logs,
    advance(ms) {
      const target = now + ms;
      for (let steps = 0; steps < 200; steps++) {
        const due = [...pending.entries()]
          .filter(([,timer]) => timer.at <= target)
          .sort((a,b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        pending.delete(due[0]);
        due[1].fn();
      }
      now = target;
    },
  };
}

function flakeyModule(id = 'mini-player', failCount = 1) {
  let starts = 0;
  let stops = 0;
  return {
    id,
    start() {
      starts++;
      if (starts <= failCount) throw new Error('Spotify-Menü vorübergehend nicht bereit');
    },
    stop() { stops++; },
    get starts() { return starts; },
    get stops() { return stops; },
  };
}

test('Modul-Retry: nach temporärem Fehler wieder starten und Timer entfernen', () => {
  const item = flakeyModule();
  const x = managerFixture([item]);
  x.manager.applyPreferences({'mini-player': {enabled: true}});
  assert.equal(item.starts, 1);
  assert.equal(item.stops, 1, 'Ein teilweise gestartetes Modul muss aufgeräumt werden');
  assert.equal(x.pending.size, 1);
  assert.equal([...x.pending.values()][0].delay, 500);
  x.advance(500);
  assert.equal(item.starts, 2);
  assert.equal(x.pending.size, 0);
  x.manager.applyPreferences({'mini-player': {enabled: true}});
  assert.equal(item.starts, 2, 'Erfolgreiches Modul darf nicht doppelt starten');
  x.manager.stopAll();
  assert.equal(item.stops, 2);
});

test('Modul-Retry: Deaktivieren vor dem Retry verhindert späte Menüs/Listener', () => {
  const item = flakeyModule('mini-player', 10);
  const x = managerFixture([item]);
  x.manager.start('mini-player');
  assert.equal(x.pending.size, 1);
  x.manager.applyPreferences({'mini-player': {enabled: false}});
  assert.equal(x.pending.size, 0);
  x.advance(90_000);
  assert.equal(item.starts, 1);
});

test('Modul-Retry: Shutdown stoppt auch fehlgeschlagene Starts', () => {
  const item = flakeyModule('mini-player', 10);
  const x = managerFixture([item]);
  x.manager.start('mini-player');
  x.manager.stopAll();
  assert.equal(x.pending.size, 0);
  x.advance(60_000);
  assert.equal(item.starts, 1);
});

test('Modul-Retry: exponentiell begrenzt und bei erneutem Aktivieren zurückgesetzt', () => {
  const item = flakeyModule('mini-player', 100);
  const x = managerFixture([item]);
  x.manager.start('mini-player');
  const observed = [];
  for (let i = 0; i < 8; i++) {
    const {delay} = [...x.pending.values()][0];
    observed.push(delay);
    x.advance(delay);
  }
  assert.deepEqual(observed, [500, 1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  x.manager.stop('mini-player');
  x.manager.start('mini-player');
  assert.equal([...x.pending.values()][0].delay, 500);
  x.manager.stopAll();
});

test('Modul-Retry: Ausfall eines Features blockiert kein anderes Feature', () => {
  const broken = flakeyModule('mini-player', 1);
  const good = flakeyModule('volume-scroll', 0);
  const x = managerFixture([broken, good]);
  x.manager.applyPreferences({'mini-player': {enabled: true}, 'volume-scroll': {enabled: true}});
  assert.equal(good.starts, 1);
  assert.equal(broken.starts, 1);
  x.advance(500);
  assert.equal(broken.starts, 2);
  x.manager.stopAll();
  assert.equal(good.stops, 1);
});

test('Modul-Retry: wenn stop() fehlschlägt, räumt der Manager die übrigen Module auf', () => {
  const bad = {id:'mini-player', start(){}, stop(){throw new Error('stop problem');}};
  const good = flakeyModule('volume-scroll', 0);
  const x = managerFixture([bad, good]);
  x.manager.start('mini-player');
  x.manager.start('volume-scroll');
  x.manager.stopAll();
  assert.equal(good.stops, 1);
  assert.equal(x.pending.size, 0);
});

test('Modul-Registry: doppelte IDs werden ausdrücklich abgelehnt', () => {
  const item = flakeyModule();
  assert.throws(() => managerFixture([item, item]), /Doppelte Extension-Feature-ID/);
});

/** Kleiner Spicetify-Kontextmenü-Adapter zum Testen echter Callbacks. */
function contextFixture(source, name) {
  const entries = [];
  const notifications = [];
  const favorites = [];
  const clipboard = [];
  class Item {
    constructor(label, callback, predicate) {
      this.label = label;
      this.callback = callback;
      this.predicate = predicate;
      entries.push(this);
    }
    register() {this.registered = true;}
    deregister() {this.registered = false;}
  }
  class MenuItem extends Item {}
  const runtime = loadModule(source, name, {
    Spicetify: {
      ContextMenu: {Item}, Menu: {Item:MenuItem},
      Player: {},
      showNotification: (value, error) => notifications.push({value, error}),
      addToQueue: async (tracks) => { clipboard.push(tracks); },
    },
    navigator: {clipboard: {writeText: async (value) => {clipboard.push(value);}}},
    console,
    runtimeText: (id) => id,
    currentTrack: () => null,
    createSingleFlight, QueueBatchError, enqueueQueueBatches, parseSpotifyTrackInput,
    toggleFavorite: (item) => {favorites.push(item); return true;},
  });
  runtime.start();
  return {runtime, contextMenu:entries[0], entries, notifications, favorites, clipboard};
}

test('Kontextmenü: gemischte URI-Auswahl merkt nur gültige Tracks/Episoden', async () => {
  const code = await read('../src/extension/modules/context-actions/ContextActionsModule.ts');
  const x = contextFixture(code, 'contextActionsModule');
  const uris = ['spotify:playlist:BAD123', `spotify:track:${'A'.repeat(22)}`];
  assert.equal(x.contextMenu.predicate(uris), true);
  x.contextMenu.callback(uris);
  assert.equal(x.favorites.length, 1);
  assert.equal(x.favorites[0].uri, `spotify:track:${'A'.repeat(22)}`);
  assert.equal(x.contextMenu.predicate(['spotify:track:INVALID!']), false);
  x.contextMenu.callback(['spotify:track:INVALID!']);
  assert.equal(x.favorites.length, 1);
  x.runtime.stop();
  assert.ok(x.entries.every(entry => !entry.registered));
});

test('Kopieren: gemischte Kontextauswahl kopiert nicht die fremde Playlist-URI', async () => {
  const code = await read('../src/extension/modules/copy-track-info/CopyTrackInfoModule.ts');
  const x = contextFixture(code, 'copyTrackInfoModule');
  assert.equal(x.contextMenu.predicate(['spotify:album:ABC', `spotify:episode:${'E'.repeat(22)}`]), true);
  x.contextMenu.callback(['spotify:album:ABC', `spotify:episode:${'E'.repeat(22)}`]);
  await Promise.resolve();
  assert.deepEqual(x.clipboard, [`spotify:episode:${'E'.repeat(22)}`]);
  x.runtime.stop();
});

test('Warteschlange: Menüangebot und tatsächliche URI-Validierung sind identisch', async () => {
  const code = await read('../src/extension/modules/quick-playlist/QuickPlaylistModule.ts');
  const x = contextFixture(code, 'quickPlaylistModule');
  assert.equal(x.contextMenu.predicate(['spotify:track:WRONG!']), false);
  const validTrack = `spotify:track:${'A'.repeat(22)}`;
  assert.equal(x.contextMenu.predicate(['spotify:track:VALID123']), false, 'Spotify IDs haben 22 Zeichen');
  assert.equal(x.contextMenu.predicate([validTrack]), true);
  x.contextMenu.callback(['spotify:playlist:IGNORE', validTrack]);
  await Promise.resolve();
  assert.equal(x.clipboard.length, 1);
  assert.equal(x.clipboard[0][0].uri, validTrack);
  x.runtime.stop();
});
