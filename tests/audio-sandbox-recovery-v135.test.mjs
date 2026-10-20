// =============================================================================
// Datei: audio-sandbox-recovery-v135.test.mjs
// Zweck: Regression gegen verlorenes Initial-Audio bei HTML-Wallpaper-Reloads.
// Reine Source-Vertragsprüfung, da Spicetify.React außerhalb des Spotify-Clients
// nicht verfügbar ist. Laufzeitprüfung separat im Desktop-Client durchführen.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/custom-app/modules/visualizer/SceneBackdrop.tsx', import.meta.url), 'utf8');

test('HTML-Szene überträgt Audio häufiger, ohne den Browser bei 60fps zu überlasten', () => {
  assert.match(source, /WALLPAPER_AUDIO_INTERVAL_MS = 50/);
  assert.match(source, /window\.setInterval\(send, WALLPAPER_AUDIO_INTERVAL_MS\)/);
  assert.doesNotMatch(source, /window\.setInterval\(send, 100\)/);
});

test('Alte HTML-Szene erhält nach iframe-load aktuelle Daten und Audiosignal', () => {
  const onLoad = source.slice(source.indexOf('onLoad={() => {'));
  assert.match(onLoad, /frame\.postMessage\(playerPacketRef\.current, "\*"\)/);
  assert.match(onLoad, /audioGate\.current\.reset\(\)/);
  assert.match(onLoad, /getSpectrumRef\.current\(\), playerPacketRef\.current\.playing/);
  assert.match(onLoad, /frame\.postMessage\(packet, "\*"\)/);
});

test('Auch Projekt-Wallpapers erhalten Audio erst nach erfolgreichem Mount', () => {
  const mounted = source.slice(source.indexOf('if (event.data?.zukatoProjectMounted === true)'));
  assert.match(mounted, /frame\.postMessage\(playerPacketRef\.current, "\*"\)/);
  assert.match(mounted, /audioGate\.current\.next/);
});
