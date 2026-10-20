// =============================================================================
// Datei: current-wallpaper.ts
// Zweck: Veraltete React-State-Daten eines vorherigen Wallpapers ausblenden.
// Wo ändern? Wenn sich die Identität eines Wiedergabe- oder Vorschau-Frames
// ändert. Bilder/Blob-Transfers dürfen NIEMALS die Song-/Preview-Grenze
// überqueren, auch nicht zwischen React-Render und useEffect-Cleanup.
// =============================================================================

/**
 * React aktualisiert Datenbankinhalte asynchron und räumt alte Effects erst
 * nach einem Renderdurchlauf auf. Ein noch vorhandenes Objekt aus der letzten
 * Szene ist deshalb NICHT automatisch für die neue Song-/Preview-ID gültig.
 * Die Prüfung erfolgt synchron bei jedem Render, ohne lokalen Speicherzugriff.
 */
export function currentWallpaper<T extends { id?: string; key?: string }>(
  value: T | null, active: string, field: "id" | "key",
): T | null {
  return value?.[field] === active ? value : null;
}
