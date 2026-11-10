// =============================================================================
// Datei: audio-performance.ts
// Zweck: Reine, testbare Performance-Regeln fuer den Spotify-Audio-Visualizer.
// Wo ändern? Nur hier die Bedingungen fuer RAF- und Wallpaper-Audio-Ticks.
// Sicher: Weder Audiofreigaben noch persistierte Effekte werden veraendert.
// =============================================================================
import type { SpectrumStyle } from "../../../shared/visualizer-config";

/**
 * Der Canvas zeichnet nur, wenn die Wiedergabe laeuft, der Effekt sichtbar ist
 * und der Browser die Spotify-Ansicht nicht in den Hintergrund gelegt hat.
 * Bei einer Pause gibt es weiterhin EINEN leeren Frame, aber keinen Dauer-RAF.
 */
export function shouldDrawSpectrum(style: SpectrumStyle, playing: boolean, hidden: boolean): boolean {
  return style !== "off" && playing && !hidden;
}

/**
 * Ohne aktive und spielende Audioquelle hat WallpaperAudioGate bereits ein
 * einmaliges Stillepaket gesendet. Daher sind keine 20 Polls/Sekunde noetig.
 * Freigabe und Play/Pause starten den Tick ueber React erneut.
 */
export function shouldPollWallpaperAudio(playing: boolean, captureActive: boolean): boolean {
  return playing && captureActive;
}

/** Vollbild-Canvas höchstens in 1600 × 900 malen; CSS skaliert die Effekte. */
export function spectrumCanvasScale(width: number, height: number, deviceRatio: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(Math.max(1, deviceRatio || 1), 2, 1600 / width, 900 / height);
}

/** Große Bühnen brauchen konstante 30 Zeichenbilder/s; kleine bleiben bei 60. */
export function spectrumFrameIntervalMs(width: number, height: number): number {
  return width * height >= 1_000_000 ? 1000 / 30 : 1000 / 60;
}
