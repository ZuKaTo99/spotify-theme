// =============================================================================
// Datei: canvas-and-lyrics-recovery-v132.test.mjs
// Zweck: End-to-End-nahe Regressionen mit dem PRODUKTIVEN TypeScript-Code.
//         Keine externe Spotify-API und keine fremden Lyrics werden abgerufen.
// =============================================================================
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

async function importSource(name) {
  const source = await readFile(new URL(`../src/custom-app/modules/visualizer/${name}`, import.meta.url), 'utf8');
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(stripTypeScriptTypes(source, { mode: 'strip' }))}`);
}
const preview = await importSource('spotify-lyrics-preview.ts');
const canvas = await importSource('spotify-canvas.ts');
const playback = await importSource('canvas-playback.ts');
const local = await importSource('lyrics-local-recovery.ts');
const lyrics = await importSource('automatic-lyrics.ts');

test('Lyrics-Vorschau: gleicher Songtitel, anderer Künstler => KEIN fremder Text', () => {
  assert.equal(preview.previewBelongsToTrack('Home – Alice', 'Home', 'Bob'), false);
  assert.equal(preview.previewBelongsToTrack('Home – Bob', 'Home', 'Bob'), true);
  assert.equal(preview.previewBelongsToTrack('Home – Bob', 'Home', 'Bob feat. Carol'), true);
  assert.equal(preview.previewBelongsToTrack('Homestead – Bob', 'Home', 'Bob'), false);
  assert.equal(preview.previewBelongsToTrack('Home – Joanna', 'Home', 'Anna'), false);
  assert.equal(preview.previewBelongsToTrack('Home – Anna', 'Home', 'Anna'), true);
  assert.equal(preview.previewBelongsToTrack('Home – Álice', 'Home', 'Alice'), false);
});

test('Lyrics-Vorschau: gesamte Spotify-Seitenleiste nach Künstler filtern', () => {
  const makeRegion = (info, words) => ({
    textContent: info, closest: () => null,
    querySelectorAll: () => [{
      children: [], textContent: 'Lyrics preview',
      parentElement: { querySelectorAll: () => words.map((word) => ({
        children: [], textContent: word,
      })) },
    }],
  });
  const unrelated = makeRegion('Home — Alice', ['Lyrics from another song']);
  const matched = makeRegion('Home — Bob', ['Correct lyrics appear here']);
  const root = { querySelectorAll: () => [unrelated, matched] };
  assert.deepEqual(preview.readSpotifyLyricsPreview(root, 'Home', 'Bob'), ['Correct lyrics appear here']);
  assert.deepEqual(preview.readSpotifyLyricsPreview(root, 'Home', 'Charlie'), []);
});

test('Canvas: ungültiger currentSrc blockiert eine gültige lokale source-URL nicht', () => {
  const video = {
    currentSrc: 'data:video/mp4;base64,AAAA', closest: () => null,
    getAttribute: () => 'file:///C:/bad.mp4',
    querySelectorAll: () => [{src: 'https://cdn.example.test/actual-canvas.mp4'}],
  };
  const region = { textContent: 'Home — Bob', closest: () => null, querySelectorAll: () => [video] };
  const root = { querySelectorAll: () => [region] };
  assert.equal(canvas.inspectNativeCanvas(root, 'Home', 'Bob').source.src, 'https://cdn.example.test/actual-canvas.mp4');
  video.querySelectorAll = () => [{src: 'javascript:alert(1)'}];
  assert.equal(canvas.inspectNativeCanvas(root, 'Home', 'Bob').kind, 'unreadable-source');
});

test('Canvas-Playback: wartet auf Medien, startet beim canplay und pausiert jederzeit', async () => {
  let plays = 0, pauses = 0, failures = 0;
  const video = { readyState: 0, play: async () => { plays++; }, pause: () => { pauses++; } };
  playback.syncCanvasVideoPlayback(video, true, () => { failures++; });
  assert.equal(plays, 0, 'kein Video vor HAVE_CURRENT_DATA abspielen');
  video.readyState = 3;
  playback.syncCanvasVideoPlayback(video, true, () => { failures++; });
  assert.equal(plays, 1);
  playback.syncCanvasVideoPlayback(video, false, () => { failures++; });
  assert.equal(pauses, 1);
  assert.equal(failures, 0);
});

test('Canvas-Playback: Browser-Play-Sperren und synchrone Fehler werden abgefangen', async () => {
  let failures = 0;
  const blocked = { readyState: 4, pause: () => {}, play: async () => { throw Error('autoplay blocked'); } };
  playback.syncCanvasVideoPlayback(blocked, true, () => { failures++; });
  await new Promise((resolve) => setImmediate(resolve));
  const broken = { readyState: 4, pause: () => {}, play: () => { throw Error('codec'); } };
  playback.syncCanvasVideoPlayback(broken, true, () => { failures++; });
  assert.equal(failures, 2);
});

test('Lyrics-Titel: Remix, Live und Acoustic bleiben andere Songs; Remaster darf übereinstimmen', () => {
  const song = { uri: 'spotify:track:ABCDE', title: 'Polka Bounce (Bailo Remix)',
    artist: 'CJ', durationMs: 192_000 };
  const record = { id: 8, trackName: 'Polka Bounce', artistName: 'CJ', duration: 192 };
  assert.equal(lyrics.matchesLyricsRecord(song, record), false);
  assert.equal(lyrics.matchesLyricsRecord({ ...song, title: 'Polka Bounce (Live)' }, record), false);
  assert.equal(lyrics.matchesLyricsRecord({ ...song, title: 'Polka Bounce (Acoustic)' }, record), false);
  assert.equal(lyrics.matchesLyricsRecord({ ...song, title: 'Polka Bounce (Remastered)' }, record), true);
  assert.equal(lyrics.matchesLyricsRecord({ ...song, title: 'Polka Bounce' }, { ...record, trackName: 'Polka Bounce (Live)' }), false);
});

test('LRC: defekte Zeitmarken nicht als synchronisierte Lyrics ausgeben', () => {
  const record = { id: 39, plainLyrics: 'Real plain text',
    syncedLyrics: '[00:99.80]Impossible timestamp', instrumental: false };
  assert.deepEqual(lyrics.parseLyricsRecord(record), { kind: 'plain', sourceId: 39, lines: ['Real plain text'] });
  assert.equal(lyrics.parseLyricsRecord({...record, syncedLyrics: '[00:01.00]'}).kind, 'plain');
  assert.equal(lyrics.parseLyricsRecord({...record, syncedLyrics: '[00:01.00]Real line'}).kind, 'synced');
});

test('Lyrics: kaputte lokale Datenbank verhindert Spotify-/LRCLIB-Fallback nicht', async () => {
  const failures = [];
  const fallback = await local.loadLocalLyricsWithFallback('spotify:track:EXAMPLE',
    async () => { throw new Error('IndexedDB blocked'); }, (cause) => failures.push(cause.message));
  assert.equal(fallback, null);
  assert.deepEqual(failures, ['IndexedDB blocked']);
  assert.equal(await local.loadLocalLyricsWithFallback('spotify:track:EXAMPLE',
    async () => '[00:01.00]Local', () => { throw Error('no error expected'); }), '[00:01.00]Local');
});

test('Integration: Wiedergabe wartet auf canplay und native Vorschau wird mit Künstler abgeglichen', async () => {
  const visualizer = await readFile(new URL('../src/custom-app/modules/visualizer/Visualizer.tsx', import.meta.url), 'utf8');
  const nativeCanvas = await readFile(new URL('../src/custom-app/modules/visualizer/SpotifyCanvasBackdrop.tsx', import.meta.url), 'utf8');
  assert.match(visualizer, /readSpotifyLyricsPreview\(document, player.title, player.artist\)/);
  assert.match(visualizer, /nativePreviewState.key === nativePreviewKey/);
  assert.match(visualizer, /loadLocalLyricsWithFallback\(player.uri, loadLyrics/);
  assert.match(nativeCanvas, /onCanPlay=\{\(event\) => \{/);
  assert.match(nativeCanvas, /synchronizeVideo\(event.currentTarget\)/);
  assert.doesNotMatch(nativeCanvas, /\bautoPlay\b/);
});
