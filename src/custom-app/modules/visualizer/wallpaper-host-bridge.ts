// =============================================================================
// Datei: wallpaper-host-bridge.ts
// Zweck: Kleine, absichtlich beschränkte Brücke vom Spotify-Player zur
//        isolierten HTML-Wallpaper-Sandbox.
// Sicherheit: KEINE Tokens, Song-URI, Album-URLs oder Roh-Audiodaten senden.
// Wo ändern? Nachrichtenformat hier; Versand in SceneBackdrop.tsx.
// =============================================================================

/** Nur der aktuelle Titel und der Abspielzustand, keine geheimen Daten. */
export function wallpaperPlayerPacket(
  title: string, artist: string, playing: boolean,
  run: number, positionMs: number, durationMs: number,
) {
  return {
    zukatoWallpaper: true as const,
    title: title.slice(0, 180), artist: artist.slice(0, 180), playing,
    run: Number.isFinite(run) ? Math.max(0, run) : 0,
    positionMs: Number.isFinite(positionMs) ? Math.max(0, positionMs) : 0,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0,
  };
}

/** Nur normierte Frequenzenergie der explizit freigegebenen Audioquelle. */
export function wallpaperAudioPacket(spectrum: number[]): {
  zukatoWallpaperAudio: true; spectrum: number[];
} | null {
  if (spectrum.length !== 64 || spectrum.some((value) => !Number.isFinite(value))) return null;
  return {
    zukatoWallpaperAudio: true,
    spectrum: spectrum.map((value) => Math.min(1, Math.max(0, value))),
  };
}

/** Stille hat einen definierten Frame: 64 Nullen, niemals Demodaten. */
export const EMPTY_WALLPAPER_SPECTRUM = Object.freeze(Array<number>(64).fill(0));

/**
 * Audio-Lifecycle pro geladener HTML-Szene.
 * Ohne Freigabe/Pause genau EIN Stillepaket senden und nicht ständig 64 Nullen
 * über die Bridge pumpen. Sobald eine echte Tonquelle zurückkehrt, werden
 * wieder alle gültigen Momentanwerte weitergereicht.
 *
 * Wo ändern? Nachrichten-Drosselung ausschließlich hier, nicht im React-UI.
 */
export class WallpaperAudioGate {
  private silent = false;

  reset(): void { this.silent = false; }

  next(spectrum: number[] | null, playing: boolean): ReturnType<typeof wallpaperAudioPacket> {
    if (playing && spectrum) {
      const packet = wallpaperAudioPacket(spectrum);
      if (!packet) return this.next(null, false);
      this.silent = false;
      return packet;
    }
    if (this.silent) return null;
    this.silent = true;
    return wallpaperAudioPacket([...EMPTY_WALLPAPER_SPECTRUM]);
  }
}
