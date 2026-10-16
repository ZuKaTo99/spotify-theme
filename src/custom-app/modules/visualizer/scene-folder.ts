// =============================================================================
// Datei: scene-folder.ts
// Zweck: Aus einem gewählten Windows-/Chromium-Ordner komplette HTML-Projekte
//        erkennen, statt einzelne index.html-Dateien als Wallpapers zu behandeln.
// Wo ändern? Projekterkennung, Dateigruppierung und Sortierung genau hier.
// Wichtig: Dateiinhalte werden nicht verändert; der Browser importiert Kopien.
// =============================================================================

export interface WallpaperFolderItem {
  /** Anzeigename für die Bibliothek; nicht als Dateipfad verwenden. */
  name: string;
  /** Alle Dateien einschließlich Unterordnern und binären Assets einer Szene. */
  files: File[];
}

/** Natürlich sortieren: 02 kommt vor 10, unabhängig vom Dateisystem. */
function sortedNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

/** Traversal und ungültige Verzeichnisse vor dem Import verhindern. */
function safePath(file: File): string {
  const path = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
  if (!path || path.startsWith("/") || path.split("/").some((part) =>
      !part || part === "." || part === "..")) {
    throw new Error("Unsicherer Dateipfad im Wallpaper-Ordner.");
  }
  return path;
}

/** Eine HTML-Datei kann eine Webprojekt-Hauptseite oder eine Unterseite sein. */
const htmlFile = (name: string): boolean => /\.html?$/i.test(name);
const videoFile = (name: string): boolean => /\.(?:mp4|webm|ogv)$/i.test(name);

/**
 * Projektwurzel finden: project.json gilt auch dann, wenn die HTML-Einstiegsdatei
 * z. B. unter "web/index.html" liegt. Eine Unterseite mit eigener index.html
 * darf dabei niemals ein zweites Wallpaper derselben Projektwurzel erzeugen.
 */
function projectDirectories(paths: readonly string[]): string[] {
  const htmlDirectories = [...new Set(paths.filter(htmlFile).map((path) =>
    path.slice(0, path.lastIndexOf("/") + 1)))];
  const metadataDirectories = [...new Set(paths.filter((path) => /(^|\/)project\.json$/i.test(path))
    .map((path) => path.slice(0, path.lastIndexOf("/") + 1)))];
  const indexDirectories = htmlDirectories.filter((directory) => paths.some((path) =>
    path.startsWith(directory) && /(^|\/)index\.html?$/i.test(path) &&
    path.slice(0, path.lastIndexOf("/") + 1) === directory));
  const candidates = [...new Set([
    ...metadataDirectories.filter((directory) => paths.some((path) =>
      path.startsWith(directory) && htmlFile(path))),
    ...indexDirectories,
    ...htmlDirectories.filter((directory) => !indexDirectories.some((parent) =>
      directory.startsWith(parent)) && !metadataDirectories.some((parent) =>
      directory.startsWith(parent))),
  ])].sort((a, b) => a.length - b.length || sortedNames(a, b));

  // Eine übergeordnete index.html oder project.json besitzt ihre Unterseiten.
  return candidates.filter((directory, index) =>
    !candidates.slice(0, index).some((parent) => directory.startsWith(parent)));
}

/**
 * Hauptordner in vollständige Wallpaper-Projekte aufteilen.
 *
 * A) Set/01/index.html + Set/02/index.html  -> zwei Wallpapers
 * B) Wallpaper/web/index.html + Wallpaper/assets/hero.png -> EIN Wallpaper
 * C) Wallpaper/index.html + Wallpaper/docs/index.html -> EIN Wallpaper
 *
 * Variante B ist für größere Webprojekte wichtig: Bilder, Fonts und Models
 * liegen häufig neben "web" statt darin. Diese Dateien dürfen nicht still
 * verloren gehen. Enthält der Ordner hingegen mehrere unabhängige Projekte,
 * werden Dateien niemals zwischen ihnen ausgetauscht.
 */
export function groupWallpaperFolderFiles(files: readonly File[]): WallpaperFolderItem[] {
  if (!files.length) throw new Error("Wallpaper-Ordner ist leer.");
  const paths = files.map((file) => ({ file, path: safePath(file) }));
  const root = paths[0].path.split("/")[0];
  const prefix = paths.every((item) => item.path.startsWith(`${root}/`)) ? `${root}/` : "";
  const entries = paths.map(({ file, path }) => ({ file, path: path.slice(prefix.length) }));
  const directories = projectDirectories(entries.map((entry) => entry.path));

  // Spezialfall "web/index.html" und "assets/": Es handelt sich um EIN
  // ausgewähltes Webprojekt, nicht um eine unvollständige Szene "web".
  // Der Sonderfall greift nur, wenn es keine zweite HTML-Projektwurzel gibt.
  const orphanAssets = entries.some((entry) =>
    !directories.some((directory) => entry.path.startsWith(directory)) &&
    !htmlFile(entry.path));
  if (directories.length === 1 && directories[0] !== "" && orphanAssets) {
    const main = directories[0];
    const firstSection = main.split("/").filter(Boolean);
    if (firstSection.length === 1) directories.splice(0, 1, "");
  }

  const grouped = new Map<string, WallpaperFolderItem>();
  for (const directory of directories) {
    const display = directory
      ? directory.replace(/\/$/, "").split("/").at(-1)!
      : prefix ? root : "HTML-Wallpaper";
    grouped.set(`project:${directory}`, { name: display, files: [] });
  }

  for (const entry of entries) {
    // Ein Projekt darf seine kompletten Unterordner enthalten; nicht an
    // einer weiteren index.html oder einem 3D-Viewer-Unterordner auftrennen.
    const directory = directories.find((value) => entry.path.startsWith(value));
    if (directory !== undefined) {
      grouped.get(`project:${directory}`)!.files.push(entry.file);
    } else if (htmlFile(entry.path)) {
      // Einzelne HTML-Datei außerhalb bekannter Projekte nicht verlieren.
      grouped.set(`html:${entry.path}`, {
        name: entry.path.replace(/\.html?$/i, ""), files: [entry.file],
      });
    } else if (videoFile(entry.path)) {
      grouped.set(`video:${entry.path}`, { name: entry.path, files: [entry.file] });
    }
  }

  const result = [...grouped.values()].filter((item) => item.files.length)
    .sort((a, b) => sortedNames(a.name, b.name));
  if (!result.length) throw new Error("Kein HTML-Wallpaper (index.html) oder Video im Ordner gefunden.");
  return result;
}
