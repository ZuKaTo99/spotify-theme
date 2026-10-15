// =============================================================================
// Datei: src/extension/modules/player-statistics/PlayerStatisticsModule.ts
// Zweck: Titelwechsel für die lokale Historie erfassen; keine Spotify-API-Abfrage.
// =============================================================================
import { currentTrack, recordTrack } from "../../../shared/library";
import type { ExtensionModule } from "../ExtensionModule";

let lastUri = "";
let lastPlaybackId = "";

/** Ein Songwechsel zählt genau einmal, auch wenn Spotify das Event doppelt sendet. */
function handleSongChange(): void {
  const track = currentTrack();
  if (!track || !Spicetify.Player.isPlaying()) return;
  const playbackId = Spicetify.Player?.data?.playbackId ?? "";
  // Gleiche Titel dürfen später erneut gezählt werden, wenn eine neue Playback-ID vorliegt.
  if (lastUri === track.uri && (!playbackId || playbackId === lastPlaybackId)) return;
  lastUri = track.uri;
  lastPlaybackId = playbackId;
  try { recordTrack(track); }
  catch (error) { console.warn("[ZuKaTo] Der lokale Hörverlauf konnte nicht gespeichert werden.", error); }
}

export const playerStatisticsModule: ExtensionModule = {
  id: "player-statistics",
  start(): void {
    lastUri = "";
    lastPlaybackId = "";
    Spicetify.Player.addEventListener("songchange", handleSongChange);
    // Beim Fortsetzen eines zuvor pausierten neuen Titels ebenfalls aufzeichnen.
    Spicetify.Player.addEventListener("onplaypause", handleSongChange);
    // Erster laufender Titel wird ebenfalls aufgenommen; vergangene Titel nicht nachträglich.
    handleSongChange();
  },
  stop(): void {
    Spicetify.Player.removeEventListener("songchange", handleSongChange);
    Spicetify.Player.removeEventListener("onplaypause", handleSongChange);
    lastUri = "";
    lastPlaybackId = "";
  },
};
