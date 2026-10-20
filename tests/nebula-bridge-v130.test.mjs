// =============================================================================
// Datei: tests/nebula-bridge-v130.test.mjs
// Zweck: Sicherheit und tatsächliche Audiodaten der Spotify→HTML-Brücke.
// Die Engines selbst haben zusätzliche eigene 35 Laufzeittests pro Projekt.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

async function moduleSource(path) {
  const text = await readFile(new URL(path, import.meta.url), 'utf8');
  return import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(text, {mode:'strip'}))}`);
}
const audio = await moduleSource('../src/custom-app/modules/visualizer/audio-capture.ts');
const bridge = await moduleSource('../src/custom-app/modules/visualizer/wallpaper-host-bridge.ts');

test('Frequenzen: leises reales Signal bleibt vom leeren Analyser unterscheidbar', () => {
  const zero = audio.spectrum64FromByteBins(new Uint8Array(1024));
  assert.equal(zero.length, 64);
  assert.ok(zero.every(x => x === 0));
  const values = audio.spectrum64FromByteBins(new Uint8Array(1024).fill(180));
  assert.equal(values.length, 64);
  assert.ok(values.every(x => x > .69 && x < .72));
});

test('Audio-Paket: nur 64 begrenzte, endliche FFT-Werte', () => {
  assert.equal(bridge.wallpaperAudioPacket(Array.from({length:63},()=>.5)), null);
  assert.equal(bridge.wallpaperAudioPacket(Array.from({length:64},(_,i)=>i===23?NaN:.3)), null);
  const packet = bridge.wallpaperAudioPacket([5,-2, ...Array(62).fill(.25)]);
  assert.equal(packet.zukatoWallpaperAudio, true);
  assert.equal(packet.spectrum[0], 1);
  assert.equal(packet.spectrum[1], 0);
});

test('Player-Paket enthält nur freigegebene Songanzeige-Werte', () => {
  const packet = bridge.wallpaperPlayerPacket('Song', 'Artist', true, 11, 3000, 180000);
  assert.deepEqual(Object.keys(packet).sort(),
    ['artist','durationMs','playing','positionMs','run','title','zukatoWallpaper'].sort());
  assert.equal(packet.title,'Song');
  assert.equal(packet.playing,true);
  assert.equal(bridge.wallpaperPlayerPacket('x','y',false,-3,-500,Infinity).positionMs,0);
});
