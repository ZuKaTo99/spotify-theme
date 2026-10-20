// =============================================================================
// Datei: src/extension/modules/player-statistics/PlayerStatisticsModule.ts
// Zweck: Lokalen Hörverlauf genau einmal pro Songdurchlauf erfassen – auch nach
//        Hot-Reload oder Deaktivierung/Aktivierung der Extension.
// Wo ändern? Lauf-Identität und Persistenz hier; Songzähler in song-session.ts.
// =============================================================================
import { currentTrack, recordTrack } from "../../../shared/library";
import { loadSongSession } from "../../../shared/song-session";
import type { ExtensionModule } from "../ExtensionModule";

const LAST_RECORDED_RUN_KEY = "zukato-toolkit.history-last-run.v1";
let lastRecordedRun = "";

/**
 * Ein Modul-Neustart darf den gerade laufenden Song nicht erneut zählen.
 * Die letzte erfolgreich erfasste Song-Session ist deshalb ebenfalls lokal
 * gespeichert. Kaputte oder unerwartete Storage-Werte ignorieren wir.
 */
function loadRecordedRun(): string {
  try {
    const raw: unknown = Spicetify.Platform.LocalStorageAPI.getItem(LAST_RECORDED_RUN_KEY);
    return typeof raw === "string" && /^spotify:(?:track|episode):[A-Za-z0-9]+(?::\d+)?$/.test(raw)
      ? raw : "";
  } catch (error) {
    console.warn("[ZuKaTo] Letzte Hörverlaufs-Session konnte nicht gelesen werden.", error);
    return "";
  }
}

/** Erst nach erfolgreichem Hörverlauf-Schreiben die Song-Session markieren. */
function rememberRecordedRun(identity: string): void {
  lastRecordedRun = identity;
  try {
    Spicetify.Platform.LocalStorageAPI.setItem(LAST_RECORDED_RUN_KEY, identity);
  } catch (error) {
    // Ein volles Storage darf keine wiederholten Zählungen im selben Lauf auslösen.
    console.warn("[ZuKaTo] Hörverlaufs-Session konnte nicht gespeichert werden.", error);
  }
}

/**
 * Eine playbackId darf kein Statistikschlüssel sein: Spotify vergibt sie teils
 * auch nach Pause/Resume neu. Der dauerhafte Songzähler wird vor diesem Modul
 * vom zentralen Song-Session-Tracker aktualisiert.
 */
function handleSongChange(): void {
  const track = currentTrack();
  if (!track || !Spicetify.Player.isPlaying()) return;
  const session = loadSongSession();
  // Ohne gültige Session nicht mehrfach denselben Titel im laufenden Prozess
  // zählen; eine erneute Erfassung erfolgt beim nächsten validen Songlauf.
  const identity = session?.uri === track.uri
    ? `${track.uri}:${session.index}` : track.uri;
  if (identity === lastRecordedRun) return;
  try {
    recordTrack(track);
    rememberRecordedRun(identity);
  } catch (error) {
    // Bei Schreibfehler erst beim nächsten Player-Event erneut versuchen.
    console.warn("[ZuKaTo] Der lokale Hörverlauf konnte nicht gespeichert werden.", error);
  }
}

export const playerStatisticsModule: ExtensionModule = {
  id: "player-statistics",
  start(): void {
    lastRecordedRun = loadRecordedRun();
    Spicetify.Player.addEventListener("songchange", handleSongChange);
    // Ein neuer pausierter Titel wird beim ersten Play aufgenommen.
    Spicetify.Player.addEventListener("onplaypause", handleSongChange);
    handleSongChange();
  },
  stop(): void {
    Spicetify.Player.removeEventListener("songchange", handleSongChange);
    Spicetify.Player.removeEventListener("onplaypause", handleSongChange);
    lastRecordedRun = "";
  },
};
