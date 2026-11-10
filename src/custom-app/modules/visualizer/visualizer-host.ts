/** Der Visualizer kann zwischen Spotify und dem Document-PiP-Dokument wechseln. */
export const VISUALIZER_HOST_CHANGED_EVENT = "zukato-toolkit:visualizer-host-changed";

export function visualizerHostWindow(node: Node | null): Window {
  return node?.ownerDocument?.defaultView ?? window;
}

export function visualizerHostHidden(node: Node | null): boolean {
  return (node?.ownerDocument ?? (typeof document !== "undefined" ? document : null))?.hidden ?? false;
}
