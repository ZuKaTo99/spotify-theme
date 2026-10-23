// =============================================================================
// Datei: src/shared/playlist-workspace-tabs.ts
// Zweck: Stabile, tastaturbedienbare Unterbereiche der Playlist-Werkzeuge.
// Wo ändern? IDs/Reihenfolge hier; Beschriftungen in shared/i18n.ts und
// Darstellung in custom-app/modules/playlist-tools/PlaylistTools.tsx.
// =============================================================================

/** Feste IDs ändern sich nicht mit Sprache oder angepassten Modulnamen. */
export const PLAYLIST_WORKSPACE_TABS = ["queue", "import", "manage", "transfer"] as const;
export type PlaylistWorkspaceTab = typeof PLAYLIST_WORKSPACE_TABS[number];
export const PLAYLIST_WORKSPACE_TAB_STORAGE_KEY = "zukato:playlist-workspace-tab";

/** Alte oder manipulierte Sitzungswerte dürfen keinen leeren Bereich öffnen. */
export function normalizePlaylistWorkspaceTab(value: unknown): PlaylistWorkspaceTab {
  return typeof value === "string" &&
    (PLAYLIST_WORKSPACE_TABS as readonly string[]).includes(value)
    ? value as PlaylistWorkspaceTab : "queue";
}

/** Pfeiltasten laufen zyklisch; Home/End springen direkt zum Rand. */
export function nextPlaylistWorkspaceTab(current: PlaylistWorkspaceTab, key: string): PlaylistWorkspaceTab | null {
  const index = PLAYLIST_WORKSPACE_TABS.indexOf(current);
  if (key === "Home") return PLAYLIST_WORKSPACE_TABS[0];
  if (key === "End") return PLAYLIST_WORKSPACE_TABS[PLAYLIST_WORKSPACE_TABS.length - 1];
  if (key === "ArrowRight") return PLAYLIST_WORKSPACE_TABS[(index + 1) % PLAYLIST_WORKSPACE_TABS.length];
  if (key === "ArrowLeft") return PLAYLIST_WORKSPACE_TABS[(index - 1 + PLAYLIST_WORKSPACE_TABS.length) % PLAYLIST_WORKSPACE_TABS.length];
  return null;
}
