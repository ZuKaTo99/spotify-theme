// =============================================================================
// Datei: video-sync.ts
// Zweck: Berechnet die Videoposition beim Spotify-Seek / Songneustart.
// Wo ändern? Drift-Toleranz und Loop-Mathematik stehen ausschließlich hier.
// Wichtig: Das ist zeitliche Player-Synchronisierung, KEINE Audioanalyse.
// =============================================================================
import type { VideoClip } from "./media-store";

/** Ungültige Decoder-Zeiten dürfen keine NaN-Seeks auslösen. */
export function syncedVideoTime(clip: VideoClip, duration: number, spotifyMs: number, speed: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(spotifyMs) ||
      !Number.isFinite(speed) || speed <= 0) return null;
  const start = Math.min(Math.max(0, clip.start), Math.max(0, duration - 0.1));
  const end = clip.end === null ? duration : Math.min(duration, clip.end);
  if (end - start <= 0.2) return start;
  const elapsed = Math.max(0, spotifyMs) / 1000;
  // Math.floor(elapsed / period) würde bei sehr langen Titeln mehr Rundungsfehler erzeugen.
  return start + ((elapsed * speed) % (end - start));
}

/** Auf der Seek-Schwelle außerhalb tolerierter Drift verhindern wir Ruckeln. */
export function shouldSyncVideo(current: number, expected: number | null, tolerance = 0.8): boolean {
  return expected !== null && Number.isFinite(current) && !Number.isNaN(expected) &&
    Math.abs(current - expected) > tolerance;
}
