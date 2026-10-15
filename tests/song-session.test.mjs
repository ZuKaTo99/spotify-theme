// =============================================================================
// Datei: tests/song-session.test.mjs
// Zweck: V1.7-Songzähler unabhängig vom echten Spotify-Client testen.
// Abnahme: Skip/Repeat/Seek/Pause, doppelte Events, Persistenz und Cleanup.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";

/** Dieselbe TypeScript-Quelldatei verwenden, die später gebündelt wird. */
const source = await readFile(new URL("../src/shared/song-session.ts", import.meta.url), "utf8");
const song = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(
  stripTypeScriptTypes(source, { mode: "strip", sourceUrl: "song-session.ts" }))}`);
const A = "spotify:track:ABC123";
const B = "spotify:track:DEF456";
const base = { uri: A, playbackId: "run-a", progressMs: 1000, now: 1000 };

// ----------------------------------------------------------------------------
// Reine Reducer-Tests: liefern ohne Timer/DOM reproduzierbare Vergleiche.
// ----------------------------------------------------------------------------
test("Songsession: erster Titel beginnt bei Wallpaper 1 (Index 0)", () => {
  const result = song.reduceSongSession(null, base, "poll");
  assert.equal(result.state.index, 0);
  assert.equal(result.advanced, false);
});

test("Songsession: URI-Wechsel zählt genau einmal trotz Poll und doppeltem Event", () => {
  const first = song.reduceSongSession(null, base, "poll").state;
  const next = song.reduceSongSession(first, { ...base, uri: B, playbackId: "run-b", now: 2000 }, "songchange");
  assert.equal(next.state.index, 1);
  assert.equal(next.advanced, true);
  assert.equal(song.reduceSongSession(next.state, { ...base, uri: B, playbackId: "run-b", now: 2200 }, "songchange").state.index, 1);
  assert.equal(song.reduceSongSession(next.state, { ...base, uri: B, playbackId: "run-b", now: 2400 }, "poll").state.index, 1);
});

test("Songsession: Pause, Seek und geänderte Playback-ID beim Poll zählen NICHT", () => {
  const old = song.reduceSongSession(null, { ...base, progressMs: 85000 }, "poll").state;
  assert.equal(song.reduceSongSession(old, { ...base, playbackId: "changed", progressMs: 10 }, "poll").state.index, 0);
  assert.equal(song.reduceSongSession(old, { ...base, progressMs: 0 }, "poll").advanced, false);
});

test("Songsession: Repeat derselben URI wird am echten songchange erkannt", () => {
  const prior = song.reduceSongSession(null, { ...base, progressMs: 180000 }, "poll").state;
  const repeat = song.reduceSongSession(prior, { ...base, playbackId: "run-again", progressMs: 20 }, "songchange");
  assert.equal(repeat.state.index, 1);
  // Derselbe Repeat ohne neue Playback-ID wird am Fortschrittsrücksprung erkannt.
  assert.equal(song.reduceSongSession(prior, { ...base, progressMs: 20 }, "songchange").state.index, 1);
  assert.equal(song.reduceSongSession(repeat.state, { ...base, playbackId: "run-again", progressMs: 25 }, "songchange").state.index, 1);
});

test("Songsession: kaputte Daten und fremde URI verwerfen", () => {
  assert.equal(song.normalizeSongSession({ uri: "file:///etc/passwd", index: 0 }), null);
  assert.equal(song.normalizeSongSession({ uri: A, index: -1 }), null);
  assert.equal(song.normalizeSongSession({ uri: A, index: Infinity }), null);
  assert.equal(song.reduceSongSession(null, { ...base, uri: "https://evil.example", now: 1 }, "poll").state, null);
});

test("Songsession: persistenter Zustand nach Seiten-Neustart und Tracker-Cleanup", () => {
  const storage = new Map();
  const listeners = new Map();
  const notifications = [];
  const intervals = new Map();
  let tickId = 0;
  let track = A;
  let playback = "start";
  let progress = 1000;
  globalThis.Spicetify = {
    LocalStorage: {
      get(key) { return storage.get(key) ?? null; },
      set(key, value) { storage.set(key, value); },
    },
    Player: {
      data: { item: { uri: track }, playbackId: playback },
      getProgress: () => progress,
      addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) ?? []), fn]); },
      removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== fn)); },
    },
  };
  globalThis.window = {
    setInterval(fn) { intervals.set(++tickId, fn); return tickId; },
    clearInterval(id) { intervals.delete(id); },
    dispatchEvent(event) { notifications.push(event); },
  };
  const emit = (type) => listeners.get(type)?.forEach((fn) => fn());
  try {
    song.startSongSessionTracker();
    song.startSongSessionTracker();
    assert.equal(listeners.get("songchange").length, 1, "Kein doppelter Eventlistener");
    assert.equal(song.loadSongSession().index, 0);
    track = B;
    playback = "second";
    globalThis.Spicetify.Player.data = { item: { uri: track }, playbackId: playback };
    emit("songchange");
    emit("songchange");
    assert.equal(song.loadSongSession().index, 1);
    // Ansichtswechsel: Lesen allein ist KEIN neuer Titel.
    assert.equal(song.observeSongSession("poll").index, 1);
    progress = 5000;
    intervals.values().next().value();
    assert.equal(song.loadSongSession().index, 1);
    assert.equal(notifications.filter((item) => item.type === song.SONG_SESSION_EVENT).length, 2);
    song.stopSongSessionTracker();
    assert.equal(intervals.size, 0);
    assert.equal(listeners.get("songchange").length, 0);
  } finally {
    song.stopSongSessionTracker();
    delete globalThis.Spicetify;
    delete globalThis.window;
  }
});
