// =============================================================================
// Datei: src/extension/modules/mini-player/mini-player-position.ts
// Zweck: Testbare, DOM-unabhängige Begrenzung der Mini-Player-Position.
// =============================================================================

export interface MiniPlayerPosition {
  readonly left: number;
  readonly top: number;
}

/** Ungültige Zahlen nicht als `NaNpx` in CSS schreiben. */
function safeCoordinate(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Hält das Fenster innerhalb der Viewport-Grenzen, auch wenn Spotify verkleinert
 * wird oder ein älterer gespeicherter Wert nicht mehr in den Bildschirm passt.
 * Ist der Viewport kleiner als das Panel, bleibt seine linke obere Ecke sichtbar.
 */
export function clampMiniPlayerPosition(
  left: number,
  top: number,
  panelWidth: number,
  panelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 8,
): MiniPlayerPosition {
  const inset = Math.max(0, safeCoordinate(margin));
  const width = Math.max(0, safeCoordinate(viewportWidth));
  const height = Math.max(0, safeCoordinate(viewportHeight));
  const maximumLeft = Math.max(0, width - Math.max(0, safeCoordinate(panelWidth)) - inset);
  const maximumTop = Math.max(0, height - Math.max(0, safeCoordinate(panelHeight)) - inset);
  const minimumLeft = Math.min(inset, maximumLeft);
  const minimumTop = Math.min(inset, maximumTop);

  return {
    left: Math.min(maximumLeft, Math.max(minimumLeft, safeCoordinate(left))),
    top: Math.min(maximumTop, Math.max(minimumTop, safeCoordinate(top))),
  };
}
