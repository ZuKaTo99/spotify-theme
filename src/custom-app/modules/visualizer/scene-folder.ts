// =============================================================================
// Datei: scene-folder.ts
// Zweck: Einen ausgewählten Ordner mit VIELEN HTML-Wallpaper-Projekten erkennen.
// Wo ändern? Gruppierung von index.html, Unterordnern und Sortierreihenfolge.
// Ein Projektordner (index.html, css, js, assets...) wird EIN Wallpaper.
// Im Elternordner können beliebig viele solcher Projektordner liegen.
// Browser-Zugriff: Der gewählte Ordner wird einmal importiert/kopiert; der
// Browser darf ihn danach NICHT dauerhaft oder heimlich überwachen.
// =============================================================================

export interface WallpaperFolderItem {
  /** Sichtbarer Bibliotheksname – standardmäßig Projektordnername. */
  name: string;
  /** Alle Abhängigkeiten EINER HTML-Szene, für packWebWallpaper(). */
  files: File[];
}

/** Natürliche Ordner-Reihenfolge: Wallpaper 2 kommt vor Wallpaper 10. */
function sortedNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

/** Untrusted relative paths dürfen weder absolute noch Traversal-Pfade sein. */
function safePath(file: File): string {
  const path = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
  if (!path || path.startsWith("/") || path.split("/").some((segment) => !segment || segment === ".." || segment === ".")) {
    throw new Error("Unsicherer Dateipfad im Wallpaper-Ordner.");
  }
  return path;
}

/**
 * HTML-Wallpaper-Sammlung in selbständige Projekte aufteilen.
 * Beispiel: Wallpapers/01/index.html, Wallpapers/01/style.css,
 * Wallpapers/02/index.html -> ZWEI Wallpapers in Ordner-Reihenfolge.
 * Falls der ausgewählte Ordner selbst nur ein index.html enthält, bleibt
 * er ein einzelnes vollständiges HTML-Wallpaper.
 */
export function groupWallpaperFolderFiles(files: readonly File[]): WallpaperFolderItem[] {
  if (!files.length) throw new Error("Wallpaper-Ordner ist leer.");
  const paths = files.map((file) => ({ file, path: safePath(file) }));
  // Chromium ergänzt bei webkitdirectory immer den gewählten Ordnernamen.
  const root = paths[0].path.split("/")[0];
  const prefix = paths.every((item) => item.path.startsWith(`${root}/`)) ? `${root}/` : "";
  const entries = paths.map(({ file, path }) => ({ file, path: path.slice(prefix.length) }));
  const indexDirs = [...new Set(entries
    .filter((entry) => /(^|\/)index\.html?$/i.test(entry.path))
    .map((entry) => entry.path.slice(0, entry.path.lastIndexOf("/") + 1)))];
  const grouped = new Map<string, WallpaperFolderItem>();

  // Ein Asset gehört zum tiefsten übergeordneten Verzeichnis mit index.html.
  // Dadurch übernimmt nicht versehentlich Projekt A Dateien von Projekt B.
  for (const directory of indexDirs) {
    const display = directory ? directory.replace(/\/$/, "").split("/").at(-1)! : (prefix ? root : "HTML-Wallpaper");
    grouped.set(`index:${directory}`, { name: display, files: [] });
  }
  for (const item of entries) {
    const directory = indexDirs.filter((dir) => item.path.startsWith(dir))
      .sort((a, b) => b.length - a.length)[0];
    if (directory !== undefined) {
      grouped.get(`index:${directory}`)!.files.push(item.file);
      continue;
    }
    // Eigenständige HTML-Dateien außerhalb eines index.html-Projektordners.
    // Mehrere Dateien werden unabhängig importiert, ohne eine gegenseitige
    // Asset-Zuordnung zu erfinden.
    if (/\.html?$/i.test(item.path)) {
      grouped.set(`html:${item.path}`, { name: item.path.replace(/\.html?$/i, ""), files: [item.file] });
    } else if (/\.(mp4|webm|ogv)$/i.test(item.path) && !indexDirs.some((dir) => item.path.startsWith(dir))) {
      // Auch manuell exportierte Videowallpapers im Sammlungsordner zulassen.
      grouped.set(`video:${item.path}`, { name: item.path, files: [item.file] });
    }
  }
  const results = [...grouped.values()].filter((entry) => entry.files.length > 0)
    .sort((a, b) => sortedNames(a.name, b.name));
  if (!results.length) throw new Error("Kein HTML-Wallpaper (index.html) oder Video im Ordner gefunden.");
  return results;
}
