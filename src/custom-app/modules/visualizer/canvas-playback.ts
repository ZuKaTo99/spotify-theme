// =============================================================================
// Datei: canvas-playback.ts
// Zweck: Play/Pause eines nativen Spotify-Canvas ohne Lade- oder Pausen-Races.
//
// WARUM? React rendert ein <video>, BEVOR dessen Decoder bereits Mediendaten
// besitzt. Ein einmaliges play() im Effect kann deshalb zu früh kommen oder
// abgelehnt werden. Das Event "canplay" löst später dieselbe Prüfung erneut aus.
// Der Aufrufer prüft zusätzlich die aktuelle Track-/Video-Identität, bevor
// ein verzögertes Promise einen UI-Fehler anzeigen darf.
// =============================================================================

/** Nur die Funktionen verwenden, die für die Wiedergabe wirklich nötig sind. */
export type CanvasPlayable = Pick<HTMLVideoElement, "readyState" | "pause" | "play">;

/**
 * Pausieren hat immer Vorrang. Nicht geladene Videos warten auf "canplay";
 * ein fehlgeschlagener Play-Versuch darf keinen unhandled Promise-Rejection
 * auslösen. Spotify selbst liefert keine garantierte Canvas-Medienquelle.
 */
export function syncCanvasVideoPlayback(
  video: CanvasPlayable, playing: boolean, onFailure: () => void,
): void {
  if (!playing) {
    video.pause();
    return;
  }
  // HAVE_CURRENT_DATA ist Level 2. Vorher ist noch kein Bild zum Abspielen
  // vorhanden; das folgende "canplay"-Event übernimmt den Start.
  if (video.readyState < 2) return;
  try {
    void Promise.resolve(video.play()).catch(onFailure);
  } catch {
    onFailure();
  }
}
