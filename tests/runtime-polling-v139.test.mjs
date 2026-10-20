// =============================================================================
// Datei: runtime-polling-v139.test.mjs
// Zweck: Langzeit-Performance ohne Spotify-Client reproduzierbar pruefen.
// Getestet wird der tatsaechlich ausgelieferte reine TypeScript-Quellcode.
// =============================================================================
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('../src/custom-app/modules/visualizer/visualizer-runtime.ts', import.meta.url), 'utf8');
const policy = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source, {mode:'strip'}))}`);
const visualizer = await readFile(new URL('../src/custom-app/modules/visualizer/Visualizer.tsx', import.meta.url), 'utf8');
const canvas = await readFile(new URL('../src/custom-app/modules/visualizer/SpotifyCanvasBackdrop.tsx', import.meta.url), 'utf8');

test('Der sichtbare laufende Player behaelt die bisherige zeitliche Genauigkeit', () => {
  assert.equal(policy.playerPollDelayMs(true, false), 250);
});

test('Pause und Hintergrund reduzieren unnoetiges Player-Polling', () => {
  assert.equal(policy.playerPollDelayMs(false, false), 1000);
  assert.equal(policy.playerPollDelayMs(true, true), 2000);
  assert.equal(policy.playerPollDelayMs(false, true), 2000);
});

test('Session-Fortschritt erzeugt ohne Songwechsel keine neue React-Session', () => {
  const a = {uri:'spotify:track:A', index:17, updatedAt:1234, progressMs:100};
  const b = {uri:'spotify:track:A', index:17, updatedAt:9000, progressMs:999};
  assert.equal(policy.sameVisibleSongRun(a,b), true);
  assert.equal(policy.sameVisibleSongRun(null,null), true);
  assert.equal(policy.sameVisibleSongRun(null,b), false);
  assert.equal(policy.sameVisibleSongRun(a,null), false);
});

test('Repeat der gleichen URI und Trackwechsel aktualisieren den Songlauf', () => {
  const current = {uri:'spotify:track:A',index:17};
  assert.equal(policy.sameVisibleSongRun(current,{...current,index:18}),false);
  assert.equal(policy.sameVisibleSongRun(current,{uri:'spotify:track:B',index:17}),false);
});

test('Spotify-Lyrics-Fallback scannt ausschliesslich wenn sichtbar und benoetigt', () => {
  assert.equal(policy.shouldReadNativeLyrics(true,false,false,false),true);
  assert.equal(policy.shouldReadNativeLyrics(false,false,false,false),false);
  assert.equal(policy.shouldReadNativeLyrics(true,true,false,false),false);
  assert.equal(policy.shouldReadNativeLyrics(true,false,true,false),false);
  assert.equal(policy.shouldReadNativeLyrics(true,false,false,true),false);
});

test('Sofortige Player-Events und Sichtbarkeits-Rueckkehr mit Timer-Cleanup', () => {
  assert.match(visualizer,/Spicetify\.Player\.addEventListener\("songchange", refreshAndSchedule\)/);
  assert.match(visualizer,/Spicetify\.Player\.addEventListener\("onplaypause", refreshAndSchedule\)/);
  assert.match(visualizer,/document\.addEventListener\("visibilitychange", refreshAndSchedule\)/);
  assert.match(visualizer,/document\.removeEventListener\("visibilitychange", refreshAndSchedule\)/);
  assert.match(visualizer,/window\.clearTimeout\(timer\)/);
  assert.match(visualizer,/setSession\(\(previous\) => sameVisibleSongRun\(previous, next\) \? previous : next\)/);
  assert.match(visualizer,/shouldReadNativeLyrics\(/);
});

test('Canvas-DOM-Suche schlaeft im Hintergrund und wacht beim Zurueckkehren auf', () => {
  assert.match(canvas,/if \(stopped \|\| document\.hidden\) return;/);
  assert.match(canvas,/document\.addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(canvas,/document\.removeEventListener\("visibilitychange", onVisibility\)/);
  assert.match(canvas,/observer\?\.disconnect\(\)/);
});
