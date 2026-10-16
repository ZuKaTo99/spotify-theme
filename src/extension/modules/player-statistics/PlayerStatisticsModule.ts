// =============================================================================
// Datei: src/extension/modules/player-statistics/PlayerStatisticsModule.ts
// Zweck: Lokalen Hörverlauf EINMAL pro echtem Spotify-Songdurchlauf erfassen.
// Wo ändern? Wiederholungen und Playback-Identität hier; der kanonische
//            Songdurchlauf wird in src/shared/song-session.ts verwaltet.
// =============================================================================
import { currentTrack, recordTrack } from "../../../shared/library";
import { loadSongSession } from "../../../shared/song-session";
import type { ExtensionModule } from "../ExtensionModule";

let lastRecordedRun = "";

/**
 * Spotify kann beim Fortsetzen eine neue playbackId vergeben, ohne einen neuen
 * Song zu starten. Eine playbackId ist deshalb KEIN verlässlicher Schlüssel
 * für die Statistik. Der dauerhafte Song-Session-Zähler wird schon vor diesem
 * Modul von der Extension aktualisiert und zählt nur echte Titel/Durchläufe.
 */
function handleSongChange(): void {
  const track = currentTrack();
  if (!track || !Spicetify.Player.isPlaying()) return;
  const session = loadSongSession();
  // Ist der Storage vorübergehend nicht erreichbar, lieber denselben Titel
  // nicht doppelt zählen. Nach erfolgreichem Storage wird der Session-Index
  // wieder als eindeutige Abspielidentität verwendet.
  const identity = session?.uri === track.uri
    ? `${track.uri}:${session.index}` : track.uri;
  if (identity === lastRecordedRun) return;
  try {
    recordTrack(track);
    // Erst nach erfolgreichem Speichern als erfasst markieren. Andernfalls
    // soll ein späteres Player-Ereignis das Speichern erneut versuchen dürfen.
    lastRecordedRun = identity;
  } catch (error) {
    console.warn("[ZuKaTo] Der lokale Hörverlauf konnte nicht gespeichert werden.", error);
  }
}

export const playerStatisticsModule: ExtensionModule = {
  id: "player-statistics",
  start(): void {
    lastRecordedRun = "";
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
