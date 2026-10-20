// =============================================================================
// Datei: nebula-audio-lifecycle-v131.test.mjs
// Zweck: Reale Audiowerte nur nach Freigabe; Audio bleibt unabhängig vom
// ZuKaTo-Overlay nutzbar. Bei Stopp/Pause einmal 64x Stille statt alter Peaks.
// =============================================================================
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  return import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(source, {mode: 'strip'})));
}
const { WallpaperAudioGate, wallpaperAudioPacket } = await load('../src/custom-app/modules/visualizer/wallpaper-host-bridge.ts');

test('Nebula: aktive Audiofreigabe darf ohne ZuKaTo-Balken Musikdaten senden', () => {
  const gate = new WallpaperAudioGate();
  const values = Array(64).fill(.42);
  assert.deepEqual(gate.next(values, true), wallpaperAudioPacket(values));
  assert.deepEqual(gate.next(values, true).spectrum, values);
});

test('Nebula: Audio-Stopp sendet genau einmal Stille und hält nicht die letzten Peaks', () => {
  const gate = new WallpaperAudioGate();
  assert.equal(gate.next(Array(64).fill(.9), true).spectrum[0], .9);
  assert.deepEqual(gate.next(null, true).spectrum, Array(64).fill(0));
  assert.equal(gate.next(null, true), null, 'keine unnötigen 10-Hz-Stillepakete');
  assert.equal(gate.next(Array(64).fill(.2), true).spectrum[0], .2);
  assert.deepEqual(gate.next(null, false).spectrum, Array(64).fill(0));
  assert.equal(gate.next(null, false), null);
});

test('Nebula: neuer Song und erneutes iframe-Mount erhalten eigenen Anfangszustand', () => {
  const gate = new WallpaperAudioGate();
  assert.equal(gate.next(null, false).spectrum.length, 64);
  assert.equal(gate.next(null, false), null);
  gate.reset();
  assert.deepEqual(gate.next(null, false).spectrum, Array(64).fill(0));
});

test('Nebula: ungültige Audioframes dürfen nicht als Musik angezeigt werden', () => {
  const gate = new WallpaperAudioGate();
  assert.deepEqual(gate.next(Array(63).fill(.8), true).spectrum, Array(64).fill(0));
  assert.equal(gate.next(Array(64).fill(NaN), true), null);
  assert.deepEqual(gate.next(Array(64).fill(.8), true).spectrum, Array(64).fill(.8));
});
