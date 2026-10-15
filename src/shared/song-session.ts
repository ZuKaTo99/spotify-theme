// =============================================================================
// Datei: src/shared/song-session.ts
// Zweck: Dauerhafter Song-/Wallpaper-Zähler, unabhängig von der geöffneten Seite.
// Wo ändern? Repeat-Erkennung, Reihenfolgeverhalten und Speicherschlüssel hier.
//
// WICHTIG:
// - Pro tatsächlich neuem Titel/Durchlauf genau EINEN Schritt vorwärts.
// - Pause, Fortschritt und Seek dürfen den Wallpaper-Zähler NICHT ändern.
// - Der Extension-Kern bleibt auch beim Verlassen der Visualizer-Seite aktiv.
// - Eine zweite Beobachtung (z.B. aus der Custom App) ist idempotent.
// =============================================================================

export const SONG_SESSION_EVENT = "zukato-toolkit:song-session-changed";
const STORAGE_KEY = "zukato-toolkit.song-session.v1";
const MAX_COUNT = Number.MAX_SAFE_INTEGER - 1;
const VALID_URI = /^spotify:(?:track|episode):[A-Za-z0-9]+$/;

export interface SongSession {
  /** Spotify-URI des zuletzt beobachteten Songs. */
  uri: string;
  /** Falls vom Spotify-Client geliefert: Identität des Abspieldurchlaufs. */
  playbackId: string;
  /** Laufender, persistenter Index für die Standard-Wallpaperliste. */
  index: number;
  /** Nur als Vergleichswert zur Repeat-Erkennung; kein Abspielprotokoll. */
  progressMs: number;
  /** Zuletzt beobachteter Zeitpunkt; erleichtert spätere Diagnosen. */
  updatedAt: number;
}

export interface SongObservation {
  uri: string;
  playbackId: string;
  progressMs: number;
  now: number;
}

/** Session lesen, ohne sich auf gültige/manuell unberührte Daten zu verlassen. */
export function normalizeSongSession(raw: unknown): SongSession | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.uri !== "string" || !VALID_URI.test(value.uri) ||
    !Number.isSafeInteger(value.index) || (value.index as number) < 0 || (value.index as number) > MAX_COUNT)
    return null;
  return {
    uri: value.uri,
    playbackId: typeof value.playbackId === "string" ? value.playbackId.slice(0, 200) : "",
    index: value.index as number,
    progressMs: typeof value.progressMs === "number" && Number.isFinite(value.progressMs)
      ? Math.max(0, value.progressMs) : 0,
    updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? Math.max(0, value.updatedAt) : 0,
  };
}

/**
 * Reine Funktion: unveränderliches Song-Snapshot in neue Session umwandeln.
 * `songchange` ist die einzige zuverlässige Information für einen Repeat
 * derselben URI. Bei Polls zählt nur ein tatsächlicher URI-Wechsel; ein Seek
 * oder eine neu vergebene Playback-ID allein dürfen NICHT weiterzählen.
 */
export function reduceSongSession(
  previous: SongSession | null, observation: SongObservation, signal: "songchange" | "poll",
): { state: SongSession | null; advanced: boolean } {
  if (!VALID_URI.test(observation.uri)) return { state: previous, advanced: false };
  const progressMs = Number.isFinite(observation.progressMs) ? Math.max(0, observation.progressMs) : 0;
  const playbackId = observation.playbackId.slice(0, 200);
  const changedUri = Boolean(previous && previous.uri !== observation.uri);
  // Bei Spotify-Repeat darf eine neue Playback-ID als Hinweis dienen. Ohne
  // ID beweist ein Rücksprung am echten songchange-Event den neuen Durchlauf.
  const repeated = Boolean(previous && !changedUri && signal === "songchange" && (
    (playbackId && previous.playbackId && playbackId !== previous.playbackId) ||
    (previous.progressMs > 10_000 && progressMs < 3_000)
  ));
  const advanced = changedUri || repeated;
  const nextIndex = previous ? (advanced ? (previous.index < MAX_COUNT ? previous.index + 1 : 0) : previous.index) : 0;
  return { advanced, state: {
    uri: observation.uri, playbackId: playbackId || (changedUri ? "" : previous?.playbackId ?? ""),
    index: nextIndex, progressMs,
    updatedAt: Number.isFinite(observation.now) ? observation.now : 0,
  } };
}

/**
 * Manche Spicetify-Clients expose die Storage-Abkürzung, andere nutzen die
 * Plattform-API. Beides wird unterstützt, ohne den Extension-Start zu blockieren.
 */
function readStoredSession(): unknown {
  const shortcut = Spicetify.LocalStorage;
  if (shortcut?.get) return shortcut.get(STORAGE_KEY);
  return Spicetify.Platform?.LocalStorageAPI?.getItem(STORAGE_KEY);
}

function writeStoredSession(state: SongSession): void {
  if (Spicetify.LocalStorage?.set) Spicetify.LocalStorage.set(STORAGE_KEY, JSON.stringify(state));
  else Spicetify.Platform.LocalStorageAPI.setItem(STORAGE_KEY, state);
}

/** Nur bei Änderungen alle Zuhörer benachrichtigen, nicht bei jeder Millisekunde. */
export function loadSongSession(): SongSession | null {
  try {
    const raw: unknown = readStoredSession();
    return normalizeSongSession(typeof raw === "string" ? JSON.parse(raw) : raw);
  } catch { return null; }
}

/** Wert schreiben und die Oberfläche über einen echten Songwechsel informieren. */
export function saveSongSession(state: SongSession, announce: boolean): void {
  try { writeStoredSession(state); }
  catch (cause) {
    // Volles/unzugängliches LocalStorage ist kein Grund, Spotify oder andere
    // ZuKaTo-Funktionen zu blockieren. Nur die Persistenz fällt dann zurück.
    console.warn("[ZuKaTo] Songposition konnte nicht gespeichert werden.", cause);
  }
  if (announce && typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(SONG_SESSION_EVENT, { detail: state }));
}

/** Der Beobachter nutzt die echten Spicetify-Playerdaten, nicht erfundene Events. */
export function observeSongSession(signal: "songchange" | "poll" = "poll"): SongSession | null {
  const previous = loadSongSession();
  const item = Spicetify.Player?.data?.item;
  const observation: SongObservation = {
    uri: item?.uri ?? "",
    playbackId: Spicetify.Player?.data?.playbackId ?? "",
    progressMs: Spicetify.Player?.getProgress?.() ?? 0,
    now: Date.now(),
  };
  const { state, advanced } = reduceSongSession(previous, observation, signal);
  if (!state) return previous;
  // Erste Beobachtung sowie ein echter Wechsel müssen sofort persistiert
  // werden. Reine Fortschrittswerte brauchen keine 250-ms-Schreibfrequenz.
  const first = !previous;
  if (first || advanced || previous.uri !== state.uri ||
    state.updatedAt - previous.updatedAt >= 2000) saveSongSession(state, first || advanced);
  return state;
}

let active = false;
let polling: number | null = null;
const onSongChange = (): void => { observeSongSession("songchange"); };
const onPlayPause = (): void => { observeSongSession("poll"); };

/** Einmaliger globaler Listener, auch wenn die Visualizer-Seite geschlossen ist. */
export function startSongSessionTracker(): void {
  if (active) return;
  active = true;
  Spicetify.Player.addEventListener("songchange", onSongChange);
  Spicetify.Player.addEventListener("onplaypause", onPlayPause);
  observeSongSession("poll");
  // Sicherheitsnetz für verpasste Events (z.B. beim Wiederverbinden des Clients).
  polling = window.setInterval(() => { observeSongSession("poll"); }, 1000);
}

/** Alle Registrierungen kontrolliert beim Beenden der Extension aufräumen. */
export function stopSongSessionTracker(): void {
  if (!active) return;
  active = false;
  Spicetify.Player.removeEventListener("songchange", onSongChange);
  Spicetify.Player.removeEventListener("onplaypause", onPlayPause);
  if (polling !== null) window.clearInterval(polling);
  polling = null;
}
