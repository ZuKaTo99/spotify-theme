// =============================================================================
// Datei: tests/visualizer.test.mjs
// Zweck: Eigenständige Unit-Tests des Video-/Lyrics-Unterbaus ohne Spotify-Client.
// Quelle: Der Node-22-Parser entfernt TS-Typen direkt aus den aktuellen Quelldateien.
// =============================================================================
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { readFile } from "node:fs/promises";

/** Isolierte TS-Dateien ohne Runtime-Imports direkt und OHNE Code-Duplikat testen. */
async function sourceModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const js = stripTypeScriptTypes(source, { mode: "strip", sourceUrl: path });
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`);
}

const lyrics = await sourceModule("../src/custom-app/modules/visualizer/lyrics.ts");
const config = await sourceModule("../src/shared/visualizer-config.ts");
const media = await sourceModule("../src/custom-app/modules/visualizer/media-store.ts");

/** Parse-Reihenfolge und Zeitwerte einschließlich Offset und Mehrfachmarken prüfen. */
test("Lyrics: .lrc-Parser beherrscht Offset, mehrere Marken und Zeitpräzision", () => {
  const lines = lyrics.parseLrc(`
[ar:Example]
[offset:+300]
[00:01.50][00:02.005]Hallo Welt
[00:00.1]Erste Zeile
[00:77.00]Ungültige Zeit
[00:04.000]Letzte Zeile`);
  assert.deepEqual(lines.map((line) => [line.timeMs, line.text]), [
    [400, "Erste Zeile"], [1800, "Hallo Welt"], [2305, "Hallo Welt"], [4300, "Letzte Zeile"],
  ]);
  assert.equal(lyrics.activeLyricIndex(lines, 399), -1);
  assert.equal(lyrics.activeLyricIndex(lines, 400), 0);
  assert.equal(lyrics.activeLyricIndex(lines, 2305), 2);
  assert.equal(lyrics.activeLyricIndex(lines, 9000), 3);
  assert.equal(lyrics.activeLyricIndex(lines, NaN), -1);
});

/** Keine fehlerhaften Daten aus alten/neuen Konfigurationsständen übernehmen. */
test("Visualizer-Konfiguration: ungültige Werte werden normalisiert", () => {
  const result = config.normalizeVisualizerConfig({
    bars: 9999, dim: -3, blur: "20", spectrum: "fakeSpectrum", sensitivity: NaN,
    wallpaperFit: "contain", lyricsEnabled: false, videoSpeed: 10, lyricOffsetMs: -99999,
  });
  assert.equal(result.version, 1);
  assert.equal(result.bars, 128);
  assert.equal(result.dim, 0);
  assert.equal(result.blur, 0);
  assert.equal(result.spectrum, "off");
  assert.equal(result.wallpaperFit, "contain");
  assert.equal(result.lyricsEnabled, false);
  assert.equal(result.videoSpeed, 2);
  assert.equal(result.lyricOffsetMs, -5000);
  assert.equal(result.sensitivity, 1.7);
  // Bestehende dunkle v1.19-Konfigurationen werden für eigene Web-Szenen
  // standardmäßig farbtreu dargestellt; die Werte selbst bleiben erhalten.
  assert.equal(result.preserveSceneAppearance, true);
  assert.equal(config.normalizeVisualizerConfig({ dim: 85 }).dim, 85);
  assert.equal(config.normalizeVisualizerConfig({ preserveSceneAppearance: false }).preserveSceneAppearance, false);
  assert.equal(config.DEFAULT_VISUALIZER_CONFIG.dim, 0);
  const olderSettings = config.normalizeVisualizerConfig({dim: 75, videoSaturation: 40, blur: 15, vignette: 90});
  assert.deepEqual(config.effectiveBackdropColorSettings(olderSettings, true),
    {dim: 0, blur: 0, saturation: 100, hue: 0, vignette: 0});
  assert.deepEqual(config.effectiveBackdropColorSettings(olderSettings, false),
    {dim: 75, blur: 15, saturation: 40, hue: 0, vignette: 90});
  const customTint = config.normalizeVisualizerConfig({...olderSettings, preserveSceneAppearance: false});
  assert.equal(config.effectiveBackdropColorSettings(customTint, true).dim, 75);
  assert.equal(result.transitionMs, 700, "Ältere v1.1-Einstellungen bekommen einen Standard-Crossfade.");
  assert.equal(config.normalizeVisualizerConfig({ transitionMs: 4000 }).transitionMs, 3000);
  assert.equal(config.normalizeVisualizerConfig({ transitionMs: -100 }).transitionMs, 0);
});

/** Eine fehlerhafte Zuordnung / falsches Dateiformat darf nicht persistiert werden. */
test("Wallpaper-Sicherheit: Dateiformat und 80-MiB-Grenze", async () => {
  assert.doesNotThrow(() => media.validateWallpaper({ name: "my-wallpaper.webm", size: 1024, type: "video/webm" }));
  assert.throws(() => media.validateWallpaper({ name: "dangerous.exe", size: 50, type: "application/x-msdownload" }));
  assert.throws(() => media.validateWallpaper({ name: "huge.mp4", size: media.MAX_WALLPAPER_BYTES + 1, type: "video/mp4" }));
  assert.throws(() => media.validateWallpaper({ name: "empty.mp4", size: 0, type: "video/mp4" }));
  await assert.rejects(() => media.loadWallpaper("https://invalid.example/"), /Ungültiger Spotify-Titel/);
});

/** Minimale IndexedDB-Attrappe: prüft echte Promise- und Transaktionsabschlüsse. */
function memoryIndexedDB() {
  const content = new Map();
  function transaction() {
    const tx = {
      error: null, oncomplete: null, onabort: null, onerror: null,
      objectStore() {
        return {
          get(key) {
            const request = { result: undefined, error: null, onsuccess: null, onerror: null };
            queueMicrotask(() => { request.result = content.get(key); request.onsuccess?.(); });
            return request;
          },
          getAll() {
            const request = { result: undefined, error: null, onsuccess: null, onerror: null };
            queueMicrotask(() => { request.result = [...content.values()]; request.onsuccess?.(); });
            return request;
          },
          put(asset) { content.set(asset.key, asset); queueMicrotask(() => tx.oncomplete?.()); },
          delete(key) { content.delete(key); queueMicrotask(() => tx.oncomplete?.()); },
        };
      },
    };
    return tx;
  }
  return {
    open() {
      const db = {
        objectStoreNames: { contains: () => false },
        createObjectStore() {}, transaction, close() {},
      };
      const request = { result: db, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
      return request;
    },
    content,
  };
}

/** Titelvideo schlägt Default, Entfernen stellt das Standardvideo wieder her. */
test("Persistenz: Wallpaper-Fallback, LRC-Speicherung und Löschen", async () => {
  const previous = globalThis.indexedDB;
  const fake = memoryIndexedDB();
  globalThis.indexedDB = fake;
  const uri = "spotify:track:ABC123";
  try {
    const standard = new File(["test1"], "background.webm", { type: "video/webm" });
    const song = new File(["test2"], "song.mp4", { type: "video/mp4" });
    await media.saveWallpaper("default", standard);
    assert.equal((await media.loadWallpaper(uri)).filename, "background.webm");
    await media.saveWallpaper(uri, song);
    assert.equal((await media.loadWallpaper(uri)).filename, "song.mp4");
    await media.deleteWallpaper(uri);
    assert.equal((await media.loadWallpaper(uri)).filename, "background.webm");
    // 12 Wallpaper-Zuordnungen sind zulässig, die 13. Zuordnung wird abgelehnt.
    for (let i = 0; i < 11; i += 1) {
      await media.saveWallpaper(`spotify:track:MOCK${i}`, song);
    }
    assert.equal(fake.content.size, 12, "Ein Default-Video plus 11 Songvideos");
    await assert.rejects(() => media.saveWallpaper("spotify:track:ONEEXTRA", song), /Maximal 12/);
    await media.saveLyrics(uri, "[00:01.20]Testzeile", "test.lrc");
    assert.equal(await media.loadLyrics(uri), "[00:01.20]Testzeile");
    await media.deleteLyrics(uri);
    assert.equal(await media.loadLyrics(uri), null);
    await media.deleteWallpaper("default");
    assert.equal(await media.loadWallpaper(uri), null);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

/**
 * Audio-Hook als isoliertes Modul ausführen: Die neue Validierung stammt aus
 * audio-capture.ts. Beides wird hier ohne Paket-Bundler inline transpilert,
 * damit diese Legacy-Unit-Tests unverändert offline laufen können.
 */
async function inlineAudioHookCode() {
  const hook = await readFile(new URL("../src/custom-app/modules/visualizer/useMicrophoneSpectrum.ts", import.meta.url), "utf8");
  const helper = await readFile(new URL("../src/custom-app/modules/visualizer/audio-capture.ts", import.meta.url), "utf8");
  const performancePolicy = await readFile(new URL("../src/custom-app/modules/visualizer/audio-performance.ts", import.meta.url), "utf8");
  const code = stripTypeScriptTypes(hook, { mode: "strip" });
  const helperCode = stripTypeScriptTypes(helper, { mode: "strip" });
  // data:-URL-Module können relative Imports nicht auflösen. Die reinen
  // Hilfsfunktionen werden darum wie audio-capture inline bereitgestellt.
  const withPolicy = code.replace(/import\s*\{[^}]+\}\s*from\s*["']\.\/audio-performance["'];?/,
    stripTypeScriptTypes(performancePolicy, { mode: "strip" }));
  assert.notEqual(withPolicy, code, "Audio-Performance muss für den Test eingebunden sein.");
  const replaced = withPolicy.replace(/import\s*\{[^}]+\}\s*from\s*["']\.\/audio-capture["'];?/, helperCode);
  assert.notEqual(replaced, withPolicy, "Audio-Capture muss für den Test eingebunden sein.");
  return replaced;
}

/** Mikrofon wird ausschließlich nach explizitem start() angefordert und dann beendet. */
test("Audioanalyse: Opt-in und vollständige Freigabe der MediaStream-Ressourcen", async () => {
  const code = await inlineAudioHookCode();
  const previous = {
    spotify: globalThis.Spicetify, context: globalThis.AudioContext,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame,
    win: globalThis.window,
  };
  let requested = 0; let stopped = 0; let closed = 0;
  const track = { readyState: "live", stop() { stopped += 1; }, addEventListener() {}, removeEventListener() {} };
  try {
    globalThis.Spicetify = {
      React: {
        useRef(value) { return { current: value }; },
        useState(value) { return [value, () => {}]; },
        useEffect() {},
        useCallback(callback) { return callback; },
      },
    };
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
      mediaDevices: { async getUserMedia() { requested += 1; return { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] }; } },
    } });
    globalThis.AudioContext = class {
      createAnalyser() { return { fftSize: 0, smoothingTimeConstant: 0,
        frequencyBinCount: 1024, getByteFrequencyData(bytes) { bytes.fill(0); } }; }
      createMediaStreamSource() { return { connect() {} }; }
      async resume() {}
      async close() { closed += 1; }
    };
    globalThis.requestAnimationFrame = () => 123;
    globalThis.cancelAnimationFrame = () => {};
    // Der Signal-Timer läuft inzwischen unabhängig vom versteckten Canvas.
    // Der Browser stellt window.setInterval/clearInterval bereit.
    globalThis.window = { setInterval: () => 5, clearInterval: () => {} };
    const { useMicrophoneSpectrum } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`);
    const controls = useMicrophoneSpectrum("bars", 32, 2, 0.75, true);
    assert.equal(requested, 0, "Ohne Nutzeraktion darf kein Mikrofon angefragt werden.");
    await controls.start();
    assert.equal(requested, 1);
    controls.stop();
    assert.equal(stopped, 1, "Mikrofonspur muss freigegeben werden.");
    await Promise.resolve();
    assert.equal(closed, 1, "AudioContext muss geschlossen werden.");
  } finally {
    globalThis.Spicetify = previous.spotify;
    globalThis.AudioContext = previous.context;
    if (previous.navigator) Object.defineProperty(globalThis, "navigator", previous.navigator);
    else delete globalThis.navigator;
    globalThis.requestAnimationFrame = previous.raf;
    globalThis.cancelAnimationFrame = previous.cancel;
    if (previous.win === undefined) delete globalThis.window; else globalThis.window = previous.win;
  }
});

/**
 * Die neue Bibliothek liefert nur Metadaten, kann Dateien exakt exportieren
 * und kopiert Zuordnungen ohne unbeabsichtigtes Umschreiben des Originals.
 */
test("Wallpaper-Bibliothek: Metadaten, Vorschau-Grundlage und Zuordnungs-Kopien", async () => {
  const previous = globalThis.indexedDB;
  const fake = memoryIndexedDB();
  globalThis.indexedDB = fake;
  const first = "spotify:track:ORIGINAL";
  const second = "spotify:track:COPY123";
  try {
    const movie = new File(["movie-data"], "mein-film.webm", { type: "video/webm" });
    await media.saveWallpaper(first, movie);
    await media.saveWallpaper("default", new File(["abc"], "background.mp4", { type: "video/mp4" }));
    const list = await media.listWallpaperEntries();
    assert.equal(list.length, 2);
    assert.equal(list.find((entry) => entry.scope === first).bytes, movie.size);
    assert.ok(list.every((entry) => !Object.hasOwn(entry, "blob")), "Keine Binärdaten in der Galerieliste");
    assert.ok(list.every((entry) => entry.savedAt > 0));
    assert.equal(await media.loadExactWallpaper(second), null, "Exact darf nie still das Default liefern");
    assert.equal((await media.loadExactWallpaper(first)).filename, "mein-film.webm");
    await media.assignStoredWallpaper(first, second);
    assert.equal((await media.loadExactWallpaper(second)).filename, "mein-film.webm");
    await media.deleteWallpaper(first);
    assert.equal(await (await media.loadExactWallpaper(second)).blob.text(), "movie-data");
    await assert.rejects(() => media.assignStoredWallpaper("spotify:track:NOTTHERE", first), /nicht mehr/);
    await assert.rejects(() => media.assignStoredWallpaper("https://invalid", first), /Ungültiger/);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

/**
 * Dateiname/Medienformat bleibt nach einem Export erhalten, und die
 * Bibliothekskopie beachtet exakt dieselbe Zahl an Slots wie ein Import.
 */
test("Wallpaper-Bibliothek: Kopien respektieren die 12-Slot-Grenze", async () => {
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = memoryIndexedDB();
  try {
    const file = new File(["0123456789"], "loop.webm", { type: "video/webm" });
    await media.saveWallpaper("default", file);
    for (let i = 0; i < 11; i += 1) await media.assignStoredWallpaper("default", `spotify:track:ASSIGN${i}`);
    assert.equal((await media.listWallpaperEntries()).length, 12);
    await assert.rejects(() => media.assignStoredWallpaper("default", "spotify:track:ASSIGNEXTRA"), /Maximal 12/);
    // Ersetzen ist auch bei belegten 12 Slots erlaubt.
    await assert.doesNotReject(() => media.assignStoredWallpaper("default", "spotify:track:ASSIGN0"));
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

/** Eine v1.2-Konfiguration bleibt gültig; neue Textstile werden begrenzt. */
test("Lyrics-Design: Altbestand, Farben, Position und Zeilenanzahl normalisieren", () => {
  const old = config.normalizeVisualizerConfig({ lyricsEnabled: true, lyricScale: 1.2 });
  assert.equal(old.lyricPosition, "middle");
  assert.equal(old.lyricAlign, "center");
  assert.equal(old.lyricLines, 3);
  assert.equal(old.lyricHighlight, "#ffffff");
  const malformed = config.normalizeVisualizerConfig({
    lyricPosition: "<script>", lyricAlign: "diagonal", lyricColor: "red;display:none",
    lyricHighlight: "#Ab12F0", lyricShadow: 999, lyricLines: 100,
  });
  assert.equal(malformed.lyricPosition, "middle");
  assert.equal(malformed.lyricAlign, "center");
  assert.equal(malformed.lyricColor, "#ffffff");
  assert.equal(malformed.lyricHighlight, "#ab12f0");
  assert.equal(malformed.lyricShadow, 100);
  assert.equal(malformed.lyricLines, 3);
  const custom = config.normalizeVisualizerConfig({ lyricLines: 5, lyricPosition: "bottom", lyricAlign: "left" });
  assert.equal(custom.lyricLines, 5);
  assert.equal(custom.lyricPosition, "bottom");
  assert.equal(custom.lyricAlign, "left");
});

/** Media-Thumbnail gehört zur Zuordnung, bleibt bei Kopie und wird atomar gelöscht. */
test("Vorschaubilder: lokal speichern, beim Kopieren erhalten und beim Löschen entfernen", async () => {
  const previous = globalThis.indexedDB;
  const fake = memoryIndexedDB();
  globalThis.indexedDB = fake;
  try {
    const movie = new File(["video"], "mein-video.mp4", { type: "video/mp4" });
    const thumb = new Blob(["jpeg-preview"], { type: "image/jpeg" });
    await media.saveWallpaper("default", movie, thumb);
    assert.equal(await (await media.loadWallpaperThumbnail("default")).text(), "jpeg-preview");
    assert.equal((await media.listWallpaperEntries()).length, 1, "Thumbnail belegt keinen Videoslot");
    const uri = "spotify:track:COPYPREVIEW";
    await media.assignStoredWallpaper("default", uri);
    assert.equal(await (await media.loadWallpaperThumbnail(uri)).text(), "jpeg-preview");
    await media.deleteWallpaper("default");
    assert.equal(await media.loadWallpaperThumbnail("default"), null);
    assert.ok(await media.loadWallpaperThumbnail(uri), "Ziel behält eigenes Thumbnail");
    await media.saveWallpaper(uri, movie);
    assert.equal(await media.loadWallpaperThumbnail(uri), null, "Ersetzen ohne Thumbnail entfernt das veraltete Bild");
    await assert.rejects(() => media.saveWallpaperThumbnail(uri, new Blob(["fake"], { type: "text/html" })), /Ungültiges/);
    await media.saveWallpaperThumbnail(uri, thumb);
    assert.ok(await media.loadWallpaperThumbnail(uri));
    assert.deepEqual([...fake.content.keys()].sort(), [`thumbnail:${uri}`, `wallpaper:${uri}`]);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

/** Eigene Szenen sind auf acht begrenzt, IDs, Namen und CSS-Farben werden validiert. */
test("Szenen-Presets: Vorlage, eigene Namen, Limit und Backup-Normalisierung", () => {
  assert.deepEqual(config.BUILTIN_VISUALIZER_PRESETS.map((item) => item.id), ["cinema", "karaoke", "concert"]);
  assert.equal(config.BUILTIN_VISUALIZER_PRESETS[2].config.spectrum, "ring");
  const initial = config.normalizeVisualizerPresets([
    { id: "custom-old", name: "  Neon Night  ", config: { lyricHighlight: "#FF00AA" } },
    { id: "../../danger", name: "invalid", config: {} },
    { id: "custom-old", name: "duplicate", config: {} },
    { id: "custom-empty", name: "    ", config: {} },
  ]);
  assert.equal(initial.length, 1);
  assert.equal(initial[0].name, "Neon Night");
  assert.equal(initial[0].config.lyricHighlight, "#ff00aa");
  assert.deepEqual(config.normalizeVisualizerPresets("not-json"), []);
  const incoming = Array.from({ length: 20 }, (_, i) => ({ id: `custom-${i}`, name: `Preset ${i}`, config: {} }));
  assert.equal(config.normalizeVisualizerPresets(incoming).length, 8);
});

/** Tatsächlicher Storage-Lifecycle statt nur eine statische Presetliste. */
test("Szenen-Presets: speichern, laden und löschen ohne Überschreiben anderer Daten", () => {
  const former = { spotify: globalThis.Spicetify, win: globalThis.window, custom: globalThis.CustomEvent };
  const local = new Map();
  const changes = [];
  try {
    globalThis.Spicetify = { Platform: { LocalStorageAPI: {
      getItem(key) { return local.get(key); }, setItem(key, value) { local.set(key, value); },
    } } };
    globalThis.window = { dispatchEvent(event) { changes.push(event.type); } };
    globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
    const initial = config.normalizeVisualizerConfig({ lyricPosition: "bottom" });
    let presets = config.saveVisualizerPreset(" My Wallpaper ", initial);
    assert.equal(presets.length, 1);
    assert.equal(presets[0].name, "My Wallpaper");
    assert.equal(config.loadVisualizerPresets()[0].config.lyricPosition, "bottom");
    for (let i = 0; i < 7; i++) config.saveVisualizerPreset(`Look ${i}`, initial);
    assert.throws(() => config.saveVisualizerPreset("ninth", initial), /acht/);
    presets = config.deleteVisualizerPreset(presets[0].id);
    assert.equal(presets.length, 7);
    assert.equal(config.loadVisualizerPresets().length, 7);
    assert.ok(changes.length >= 9);
  } finally {
    if (former.spotify === undefined) delete globalThis.Spicetify; else globalThis.Spicetify = former.spotify;
    if (former.win === undefined) delete globalThis.window; else globalThis.window = former.win;
    if (former.custom === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = former.custom;
  }
});

/** Der Videodecoder nutzt nur einen Frame und gibt Video-/URL-Ressourcen frei. */
test("Miniaturbild-Extraktion: Standbild, Kompression und Blob-URL-Cleanup", async () => {
  const thumbnail = await sourceModule("../src/custom-app/modules/visualizer/video-thumbnail.ts");
  const former = { doc: globalThis.document, url: globalThis.URL.createObjectURL, revoke: globalThis.URL.revokeObjectURL };
  let extracted = 0; let revoked = 0; let videoPaused = 0;
  try {
    globalThis.URL.createObjectURL = () => "blob:local-preview";
    globalThis.URL.revokeObjectURL = () => { revoked += 1; };
    globalThis.document = { createElement(type) {
      if (type === "canvas") return {
        getContext() { return { drawImage() { extracted += 1; } }; },
        toBlob(callback) { callback(new Blob(["jpeg-thumbnail"], { type: "image/jpeg" })); },
      };
      const video = {
        videoWidth: 1920, videoHeight: 1080, duration: 9,
        muted: false, preload: "", playsInline: false, onloadeddata: null, onseeked: null, onerror: null,
        pause() { videoPaused += 1; }, removeAttribute() {},
        load() { queueMicrotask(() => this.onloadeddata?.()); },
        set currentTime(value) { this.position = value; queueMicrotask(() => this.onseeked?.()); },
      };
      return video;
    } };
    const image = await thumbnail.createVideoThumbnail(new Blob(["fake-video"], { type: "video/mp4" }));
    assert.equal(await image.text(), "jpeg-thumbnail");
    assert.equal(extracted, 1, "Nur ein Frame wird gezeichnet");
    assert.equal(revoked, 1, "Temporäre Video-URL muss freigegeben werden");
    assert.equal(videoPaused, 1);
  } finally {
    if (former.doc === undefined) delete globalThis.document; else globalThis.document = former.doc;
    globalThis.URL.createObjectURL = former.url;
    globalThis.URL.revokeObjectURL = former.revoke;
  }
});

/** Ältere v1.3-Wallpapers ohne Clip erhalten automatisch die komplette Laufzeit. */
test("Video-Ausschnitt: Kompatibilität, Validierung und Bereichsgrenzen", () => {
  assert.deepEqual(media.normalizeVideoClip(undefined), { start: 0, end: null });
  assert.deepEqual(media.normalizeVideoClip({ start: -5, end: Infinity }), { start: 0, end: null });
  assert.deepEqual(media.normalizeVideoClip({ start: 12, end: 28 }), { start: 12, end: 28 });
  assert.deepEqual(media.validateVideoClip(5.2, null, 20), { start: 5.2, end: null });
  assert.deepEqual(media.validateVideoClip(12, 28, 40), { start: 12, end: 28 });
  assert.throws(() => media.validateVideoClip(NaN, 2), /Start/);
  assert.throws(() => media.validateVideoClip(-1, 2), /Start/);
  assert.throws(() => media.validateVideoClip(8, 8.1), /Ende/);
  assert.throws(() => media.validateVideoClip(5, Infinity), /Ende/);
  assert.throws(() => media.validateVideoClip(12, null, 11), /außerhalb/);
  assert.throws(() => media.validateVideoClip(2, 28, 15), /außerhalb/);
});

/** Der gespeicherte Videoblob bleibt binär identisch; nur Clip-Metadaten ändern sich. */
test("Video-Ausschnitt: Speichern, kopieren und auf vollständiges Video zurücksetzen", async () => {
  const previous = globalThis.indexedDB;
  const fake = memoryIndexedDB();
  globalThis.indexedDB = fake;
  try {
    const uri = "spotify:track:LOOP123";
    const movie = new File(["original-binary-video"], "original.webm", { type: "video/webm" });
    const thumb = new Blob(["preview"], { type: "image/jpeg" });
    await media.saveWallpaper(uri, movie, thumb);
    assert.deepEqual((await media.loadExactWallpaper(uri)).clip, { start: 0, end: null });
    await media.saveWallpaperClip(uri, { start: 12, end: 28 }, 60);
    assert.deepEqual((await media.loadWallpaper(uri)).clip, { start: 12, end: 28 });
    assert.deepEqual((await media.listWallpaperEntries())[0].clip, { start: 12, end: 28 });
    assert.equal(await (await media.loadExactWallpaper(uri)).blob.text(), "original-binary-video");
    assert.equal(await (await media.loadWallpaperThumbnail(uri)).text(), "preview");
    await media.assignStoredWallpaper(uri, "default");
    assert.deepEqual((await media.loadExactWallpaper("default")).clip, { start: 12, end: 28 });
    await media.saveWallpaperClip(uri, { start: 0, end: null });
    assert.deepEqual((await media.loadExactWallpaper(uri)).clip, { start: 0, end: null });
    assert.deepEqual((await media.loadExactWallpaper("default")).clip, { start: 12, end: 28 },
      "Eine kopierte Zuordnung muss unabhängig bleiben.");
    assert.equal(await (await media.loadExactWallpaper(uri)).blob.text(), "original-binary-video");
    await assert.rejects(() => media.saveWallpaperClip(uri, { start: 100, end: null }, 60), /außerhalb/);
    assert.deepEqual((await media.loadExactWallpaper(uri)).clip, { start: 0, end: null });
    await assert.rejects(() => media.saveWallpaperClip("spotify:track:MISSING", { start: 0, end: null }), /nicht mehr/);
    assert.ok(fake.content.has(`wallpaper:${uri}`));
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

/** Migration ohne Datenbank-Versionswechsel; ältere Binärdateien werden weiterhin geladen. */
test("Video-Ausschnitt: vorhandene v1.3-Datensätze werden ohne Migration gelesen", async () => {
  const previous = globalThis.indexedDB;
  const fake = memoryIndexedDB();
  globalThis.indexedDB = fake;
  try {
    const uri = "spotify:track:LEGACY123";
    fake.content.set(`wallpaper:${uri}`, {
      key: `wallpaper:${uri}`, filename: "legacy.mp4", blob: new Blob(["legacy"], { type: "video/mp4" }), savedAt: 123,
    });
    assert.deepEqual((await media.loadWallpaper(uri)).clip, { start: 0, end: null });
    assert.deepEqual((await media.listWallpaperEntries())[0].clip, { start: 0, end: null });
    await media.saveWallpaperClip(uri, { start: 2.5, end: null });
    assert.equal(await (await media.loadExactWallpaper(uri)).blob.text(), "legacy");
    assert.deepEqual((await media.loadExactWallpaper(uri)).clip, { start: 2.5, end: null });
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

/** Farb- und Alpha-Einstellungen bleiben bei alten Backups abwärtskompatibel. */
test("Audioeffekte: Partikelmodus und Style-Regler sind validiert", () => {
  const old = config.normalizeVisualizerConfig({ spectrum: "bars" });
  assert.equal(old.spectrumColor, "#1ed760");
  assert.equal(old.spectrumOpacity, 90);
  assert.equal(old.spectrumGlow, 6);
  const changed = config.normalizeVisualizerConfig({
    spectrum: "particles", spectrumColor: "#FF2200", spectrumOpacity: 1000, spectrumGlow: -15,
  });
  assert.equal(changed.spectrum, "particles");
  assert.equal(changed.spectrumColor, "#ff2200");
  assert.equal(changed.spectrumOpacity, 100);
  assert.equal(changed.spectrumGlow, 0);
  const malformed = config.normalizeVisualizerConfig({ spectrumColor: "red; url(x)", spectrumOpacity: -4, spectrumGlow: NaN });
  assert.equal(malformed.spectrumColor, "#1ed760");
  assert.equal(malformed.spectrumOpacity, 10);
  assert.equal(malformed.spectrumGlow, 6);
});

/** Partikel werden nur bei Freigabe aus echten Frequenzbins gezeichnet. */
test("Audioeffekte: Partikelzeichnung nutzt Analyser-Buffer und Benutzerfarben", async () => {
  const code = await inlineAudioHookCode();
  const former = {
    spotify: globalThis.Spicetify, audio: globalThis.AudioContext, win: globalThis.window,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame,
  };
  let frame = null; let count = 0; let spectrumRead = 0; let fillColor = ""; let opacity = 0;
  const track = { readyState: "live", stop() {}, addEventListener() {}, removeEventListener() {} };
  const context2d = {
    setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {},
    arc() { count += 1; }, fill() { fillColor = this.fillStyle; opacity = this.globalAlpha; },
  };
  try {
    globalThis.Spicetify = { React: {
      useRef(value) { return { current: value }; }, useState(value) { return [value, () => {}]; },
      useEffect() {}, useCallback(callback) { return callback; },
    } };
    globalThis.window = { devicePixelRatio: 1, setInterval: () => 6, clearInterval: () => {} };
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices: {
      async getUserMedia() { return { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] }; },
    } } });
    globalThis.AudioContext = class {
      createAnalyser() { return {
        frequencyBinCount: 256, smoothingTimeConstant: 0,
        getByteFrequencyData(buffer) { spectrumRead += 1; buffer.fill(200); },
      }; }
      createMediaStreamSource() { return { connect() {} }; }
      async resume() {}
      async close() {}
    };
    globalThis.requestAnimationFrame = (callback) => { frame = callback; return 1; };
    globalThis.cancelAnimationFrame = () => {};
    const { useMicrophoneSpectrum } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`);
    const controls = useMicrophoneSpectrum("particles", 20, 2, 0.7, true, "#12ab34", 45, 9);
    controls.canvasRef.current = { clientWidth: 600, clientHeight: 400, width: 0, height: 0, getContext: () => context2d };
    assert.equal(spectrumRead, 0, "Ohne Opt-in darf der Analyzer nichts lesen.");
    await controls.start();
    assert.equal(typeof frame, "function");
    // Signaldiagnose liest seit v1.31 getrennt vom Zeichnen: Der RAF muss
    // unabhängig davon exakt einen zusätzlichen Analyzer-Snapshot zeichnen.
    const beforePaint = spectrumRead;
    frame();
    assert.equal(spectrumRead, beforePaint + 1);
    assert.equal(count, 20, "Ein visualisiertes Partikel pro Frequenzbereich");
    assert.equal(fillColor, "#12ab34");
    assert.equal(opacity, 0.45);
    controls.stop();
  } finally {
    if (former.spotify === undefined) delete globalThis.Spicetify; else globalThis.Spicetify = former.spotify;
    if (former.audio === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = former.audio;
    if (former.win === undefined) delete globalThis.window; else globalThis.window = former.win;
    if (former.navigator) Object.defineProperty(globalThis, "navigator", former.navigator);
    else delete globalThis.navigator;
    if (former.raf === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = former.raf;
    if (former.cancel === undefined) delete globalThis.cancelAnimationFrame; else globalThis.cancelAnimationFrame = former.cancel;
  }
});

// -----------------------------------------------------------------------------
// v1.5: Echtzeit-Songposition, Live-LRC-Zeitmarken und Song-Szenen.
// Diese Tests verwenden weiterhin den echten TS-Quelltext ohne Code-Duplikate.
// -----------------------------------------------------------------------------
const sync = await sourceModule("../src/custom-app/modules/visualizer/video-sync.ts");

/** Songposition wird in einen nicht-destruktiven Clip inklusive Tempo projiziert. */
test("Video-Sync: Songfortschritt, Clip-Loop und Wiedergabegeschwindigkeit", () => {
  const clip = { start: 12, end: 28 };
  assert.equal(sync.syncedVideoTime(clip, 60, 0, 1), 12);
  assert.equal(sync.syncedVideoTime(clip, 60, 5000, 1), 17);
  assert.equal(sync.syncedVideoTime(clip, 60, 17000, 1), 13);
  assert.equal(sync.syncedVideoTime(clip, 60, 5000, 2), 22);
  assert.equal(sync.syncedVideoTime(clip, 60, 10000, 0.5), 17);
  assert.equal(sync.syncedVideoTime({ start: 0, end: null }, 20, 42000, 1), 2);
  assert.equal(sync.syncedVideoTime({ start: 5, end: 100 }, 10, 7000, 1), 7);
  assert.equal(sync.syncedVideoTime(clip, 0, 5000, 1), null);
  assert.equal(sync.syncedVideoTime(clip, Infinity, 5000, 1), null);
  assert.equal(sync.syncedVideoTime(clip, 60, NaN, 1), null);
  assert.equal(sync.syncedVideoTime(clip, 60, -5000, 1), 12);
  assert.equal(sync.shouldSyncVideo(20, 20.1), false);
  assert.equal(sync.shouldSyncVideo(20, 21), true);
  assert.equal(sync.shouldSyncVideo(0, null), false);
});

/** Individuelle Styles dürfen globale Werte und Backup-Altformat nicht brechen. */
test("Visualizer v1.5: neue Video-Parameter sind begrenzt und abwärtskompatibel", () => {
  const old = config.normalizeVisualizerConfig({ spectrum: "ring", dim: 25 });
  assert.equal(old.videoSync, "free");
  assert.equal(old.videoSaturation, 100);
  assert.equal(old.videoOffsetMs, 0);
  assert.equal(old.videoHue, 0);
  assert.equal(old.vignette, 0);
  const fresh = config.normalizeVisualizerConfig({
    videoSync: "song", videoOffsetMs: -999999, videoSaturation: 9999, videoHue: -999, vignette: 101,
  });
  assert.equal(fresh.videoSync, "song");
  assert.equal(fresh.videoOffsetMs, -10000);
  assert.equal(fresh.videoSaturation, 200);
  assert.equal(fresh.videoHue, -180);
  assert.equal(fresh.vignette, 100);
  assert.equal(config.normalizeVisualizerConfig({ videoSync: "unsupported" }).videoSync, "free");
  assert.equal(config.normalizeVisualizerConfig({ videoSaturation: "500", videoHue: NaN }).videoSaturation, 100);
});

/** Unbekannte/kaputte Song-URI oder manipulierte Backup-Inhalte ignorieren. */
test("Song-Szenen: Backups validieren URI, Duplikate und Einstellungen", () => {
  const rows = config.normalizeTrackVisualizerScenes([
    { uri: "spotify:track:ABC123", config: { dim: 17, videoSync: "song" } },
    { uri: "spotify:track:ABC123", config: { dim: 49 } },
    { uri: "https://evil.test/x", config: { dim: 5 } },
    { uri: "spotify:episode:XYZ", config: { dim: -90 } },
    {}, null,
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].uri, "spotify:track:ABC123");
  assert.equal(rows[0].config.dim, 17);
  assert.equal(rows[0].config.videoSync, "song");
  assert.equal(rows[1].config.dim, 0);
  assert.deepEqual(config.normalizeTrackVisualizerScenes("invalid JSON"), []);
  assert.equal(config.normalizeTrackVisualizerScenes(Array.from({ length: 150 }, (_, i) => ({
    uri: `spotify:track:X${i}`, config: {},
  }))).length, 100);
});

/** Persistente Scene-Umschaltung darf globale Konfiguration niemals mutieren. */
test("Song-Szenen: Speichern, überschreiben, wechseln, löschen und globale Werte behalten", () => {
  const old = globalThis.Spicetify;
  const oldWindow = globalThis.window;
  const map = new Map();
  globalThis.Spicetify = { Platform: { LocalStorageAPI: {
    setItem: (key, value) => map.set(key, value),
    getItem: (key) => map.get(key),
  } } };
  globalThis.window = { dispatchEvent() {} };
  const oldCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class { constructor(name) { this.type = name; } };
  try {
    const globalConfig = config.saveVisualizerConfig(config.normalizeVisualizerConfig({ dim: 44 }));
    const track1 = "spotify:track:First";
    const track2 = "spotify:track:Second";
    config.saveTrackVisualizerScene(track1, config.normalizeVisualizerConfig({ dim: 20 }));
    config.saveTrackVisualizerScene(track2, config.normalizeVisualizerConfig({ dim: 60 }));
    config.saveTrackVisualizerScene(track1, config.normalizeVisualizerConfig({ dim: 30 }));
    assert.equal(config.loadTrackVisualizerScenes().length, 2);
    assert.equal(config.loadTrackVisualizerScene(track1).dim, 30);
    assert.equal(config.loadTrackVisualizerScene(track2).dim, 60);
    assert.equal(config.loadTrackVisualizerScene("spotify:track:Unknown"), null);
    assert.equal(config.loadVisualizerConfig().dim, globalConfig.dim);
    config.deleteTrackVisualizerScene(track1);
    assert.equal(config.loadTrackVisualizerScene(track1), null);
    assert.equal(config.loadVisualizerConfig().dim, 44);
    assert.throws(() => config.saveTrackVisualizerScene("javascript:alert(1)", globalConfig), /Spotify-Titel/);
    config.replaceTrackVisualizerScenes(config.loadTrackVisualizerScenes());
    assert.equal(config.loadTrackVisualizerScene(track2).dim, 60);
  } finally {
    if (old === undefined) delete globalThis.Spicetify; else globalThis.Spicetify = old;
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldCustomEvent === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = oldCustomEvent;
  }
});

/** Formatierte Zeitmarken lassen sich direkt vom vorhandenen Parser lesen. */
test("LRC-Editor: Zeitstempel sind re-importierbar und gegen NaN abgesichert", () => {
  assert.equal(lyrics.formatLrcTimestamp(0), "[00:00.00]");
  assert.equal(lyrics.formatLrcTimestamp(65432), "[01:05.43]");
  assert.equal(lyrics.formatLrcTimestamp(-25), "[00:00.00]");
  assert.equal(lyrics.formatLrcTimestamp(NaN), "[00:00.00]");
  const stamped = `${lyrics.formatLrcTimestamp(12540)}Eigene Zeile`;
  assert.deepEqual(lyrics.parseLrc(stamped), [{ timeMs: 12540, text: "Eigene Zeile" }]);
});

// -----------------------------------------------------------------------------
// Stabilisierung v1.31: Freigegebene Musik darf eine HTML-Nebula antreiben,
// ohne gleichzeitig den ZuKaTo-Balkenlayer einzuschalten. Der Anzeigeeffekt
// bestimmt niemals mehr, ob eine gültige Audiofreigabe bestehen bleibt.
// -----------------------------------------------------------------------------
test('Nebula: Audio bleibt ohne sichtbare ZuKaTo-Balken aktiv, ohne unsichtbaren RAF', async () => {
  const code = await inlineAudioHookCode();
  const before = {
    spotify: globalThis.Spicetify, audio: globalThis.AudioContext, win: globalThis.window,
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame,
  };
  let rafCount = 0; let timerCount = 0; let timerStops = 0; let trackStops = 0;
  const track = { readyState: 'live', stop() { trackStops++; }, addEventListener() {}, removeEventListener() {} };
  try {
    globalThis.Spicetify = { React: {
      useRef(value) { return { current: value }; }, useState(value) { return [value, () => {}]; },
      useEffect() {}, useCallback(callback) { return callback; },
    } };
    globalThis.window = { setInterval() { timerCount++; return 10; }, clearInterval() { timerStops++; } };
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{
      async getUserMedia() {return {getTracks:()=>[track],getAudioTracks:()=>[track],getVideoTracks:()=>[]};}
    }}});
    globalThis.AudioContext = class {
      createAnalyser() {return {frequencyBinCount:256,smoothingTimeConstant:0,
        getByteFrequencyData(bytes) {bytes.fill(128);} };}
      createMediaStreamSource() {return {connect() {}};}
      async resume() {}
      async close() {}
    };
    globalThis.requestAnimationFrame = () => {rafCount++; return 7;};
    globalThis.cancelAnimationFrame = () => {};
    const {useMicrophoneSpectrum} = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`);
    const control = useMicrophoneSpectrum('off',48,1,0.7,true);
    await control.start();
    assert.equal(rafCount,0,'keine teuren unsichtbaren Animationsframes');
    assert.equal(timerCount,1,'die günstige Audiosignalmessung bleibt aktiv');
    const sound = control.getSpectrum();
    assert.equal(sound.length,64);
    assert.ok(sound.every(value => value > .48 && value < .52));
    control.stop();
    assert.equal(trackStops,1);
    assert.equal(timerStops,1);
  } finally {
    if(before.spotify===undefined) delete globalThis.Spicetify; else globalThis.Spicetify=before.spotify;
    if(before.audio===undefined) delete globalThis.AudioContext; else globalThis.AudioContext=before.audio;
    if(before.win===undefined) delete globalThis.window; else globalThis.window=before.win;
    if(before.navigator) Object.defineProperty(globalThis,'navigator',before.navigator); else delete globalThis.navigator;
    if(before.raf===undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame=before.raf;
    if(before.cancel===undefined) delete globalThis.cancelAnimationFrame; else globalThis.cancelAnimationFrame=before.cancel;
  }
});

test('Audiofehler NACH Streamstart gibt Tracks genau einmal frei und lässt keinen Listener hängen',async()=>{
  const code=await inlineAudioHookCode();
  const previous={spotify:globalThis.Spicetify,audio:globalThis.AudioContext,win:globalThis.window,
    navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),raf:globalThis.requestAnimationFrame,
    cancel:globalThis.cancelAnimationFrame};
  let stops=0,unsubscribed=0,closes=0;
  const track={readyState:'live',stop(){stops++;},addEventListener(){},removeEventListener(){unsubscribed++;}};
  try {
    globalThis.Spicetify={React:{useRef(value){return{current:value};},useState(value){return[value,()=>{}];},
      useEffect(){},useCallback(fn){return fn;}}};
    globalThis.window={setInterval(){return 1;},clearInterval(){}};
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{
      async getUserMedia(){return{getTracks:()=>[track],getAudioTracks:()=>[track],getVideoTracks:()=>[]};}
    }}});
    globalThis.AudioContext=class{
      createAnalyser(){return{frequencyBinCount:64,smoothingTimeConstant:0,
        getByteFrequencyData(){throw new Error('Audio backend failed');}};}
      createMediaStreamSource(){return{connect(){}};}
      async resume(){}
      async close(){closes++;}
    };
    globalThis.requestAnimationFrame=()=>5;
    globalThis.cancelAnimationFrame=()=>{};
    const{useMicrophoneSpectrum}=await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`);
    const controls=useMicrophoneSpectrum('off',48,1,0.75,true);
    await controls.start();
    controls.stop();
    await Promise.resolve();
    assert.equal(stops,1);
    assert.equal(unsubscribed,1);
    assert.equal(closes,1);
  } finally {
    if(previous.spotify===undefined)delete globalThis.Spicetify;else globalThis.Spicetify=previous.spotify;
    if(previous.audio===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=previous.audio;
    if(previous.win===undefined)delete globalThis.window;else globalThis.window=previous.win;
    if(previous.navigator)Object.defineProperty(globalThis,'navigator',previous.navigator);else delete globalThis.navigator;
    if(previous.raf===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previous.raf;
    if(previous.cancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=previous.cancel;
  }
});
