// =============================================================================
// Datei: src/extension/modules/volume-scroll/VolumeScrollModule.ts
// Zweck: Lautstärke nur beim Scrollen direkt über dem Spotify-Volume-Regler.
// =============================================================================
import type { ExtensionModule } from "../ExtensionModule";

/** WICHTIG: Der allgemeine Seiten-Scroll darf NICHT abgefangen werden. */
function wheelOnVolume(event: WheelEvent): void {
  if (!(event.target instanceof Element)) return;
  const selector = '[data-testid="volume-bar"], [data-testid="volume-bar-container"], .main-nowPlayingBar-volumeBar';
  if (!event.target.closest(selector)) return;
  if (!event.deltaY) return;
  event.preventDefault();
  const direction = event.deltaY < 0 ? 0.05 : -0.05;
  const next = Math.max(0, Math.min(1, Spicetify.Player.getVolume() + direction));
  Spicetify.Player.setVolume(next);
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
