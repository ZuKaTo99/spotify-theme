// =============================================================================
// Datei: src/extension/modules/volume-scroll/VolumeScrollModule.ts
// Zweck: Lautstärke nur beim Scrollen direkt über dem Spotify-Volume-Regler.
// Wo ändern? Regler-Selektoren und Schrittweite ausschließlich hier.
// =============================================================================
import type { ExtensionModule } from "../ExtensionModule";

const VOLUME_SELECTOR =
  '[data-testid="volume-bar"], [data-testid="volume-bar-container"], .main-nowPlayingBar-volumeBar';
const VOLUME_STEP = 0.05;

/**
 * Nicht auf Seiten-Scroll, Browser-Zoom oder bereits behandelte Wheel-Events
 * reagieren. Bei temporär defektem Spotify-Player wird KEIN NaN gesetzt.
 */
function wheelOnVolume(event: WheelEvent): void {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || !event.cancelable) return;
  if (!(event.target instanceof Element) || !event.target.closest(VOLUME_SELECTOR)) return;
  if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return;

  try {
    const current = Spicetify.Player.getVolume();
    if (!Number.isFinite(current) || current < 0 || current > 1) return;
    const direction = event.deltaY < 0 ? VOLUME_STEP : -VOLUME_STEP;
    const next = Math.max(0, Math.min(1, current + direction));
    // An der Unter-/Obergrenze keinen unnötigen Spotify-Aufruf ausführen.
    if (next !== current) Spicetify.Player.setVolume(next);
    // Standard-Scroll nur bei gültigem, gezielt auf dem Regler befindlichem Event verhindern.
    event.preventDefault();
  } catch (error) {
    // Wenn Spotify kurzfristig keine Player-API bietet, weiter normal scrollen.
    console.warn("[ZuKaTo] Lautstärke konnte nicht verändert werden", error);
  }
}

export const volumeScrollModule: ExtensionModule = {
  id: "volume-scroll",
  start(): void {
    // `passive: false` ist nötig, damit nur über dem Regler Scrollen unterdrückt wird.
    document.addEventListener("wheel", wheelOnVolume, { passive: false });
  },
  stop(): void {
    document.removeEventListener("wheel", wheelOnVolume);
  },
};
