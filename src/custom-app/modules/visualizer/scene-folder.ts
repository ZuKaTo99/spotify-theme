// =============================================================================
// Datei: scene-folder.ts
// Zweck: Vollständige Wallpaper-Engine-Webprojektordner sicher erkennen.
// Wo ändern? Nur hier werden Ordnergrenzen und Projektgruppen bestimmt.
//
// WICHTIG: Ein index.html gehört mit ALLEN Geschwisterverzeichnissen zusammen.
// Ein einzelnes HTML aus dem Dateidialog ist kein zulässiger Projektimport.
// Ein Sammelordner mit mehreren Wallpaper-Verzeichnissen wird nach deren
// oberster Verzeichnisebene getrennt; Assets werden nie still ausgelassen.
// =============================================================================

export interface WallpaperFolderItem {
  name: string;
  /** Die Originaldateien inklusive webkitRelativePath und sämtlicher Assets. */
  files: File[];
}

/** Die Liste im Importdialog entspricht der natürlichen Windows-Sortierung. */
function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Beseitigt gefährliche Pfadbestandteile VOR einer IndexedDB-Transaktion. */
function relativePath(file: File): string {
  const value = (file.webkitRelativePath || "").replace(/\\/g, "/");
  if (!value || value.startsWith("/") || value.includes("\0") ||
      value.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Unsicherer Dateipfad oder nur einzelne HTML-Datei. Bitte vollständigen Wallpaper-Ordner auswählen.");
  }
  return value;
}

const html = (name: string): boolean => /\.html?$/i.test(name);
const video = (name: string): boolean => /\.(?:mp4|webm|ogv)$/i.test(name);
const indexFile = (name: string): boolean => /(?:^|\/)index\.html?$/i.test(name);

/**
 * Der Browser liefert z. B. Sammlung/01/index.html. Nur der gemeinsame
 * ausgewählte Oberordner wird entfernt, niemals zusätzlich 01/ oder web/.
 */
export function groupWallpaperFolderFiles(files: readonly File[]): WallpaperFolderItem[] {
  if (!files.length) throw new Error("Der gewählte Wallpaper-Ordner ist leer.");
  const sources = files.map((file) => ({ file, path: relativePath(file) }));
  const first = sources[0].path.split("/")[0];
  if (!sources.every(({ path }) => path.startsWith(`${first}/`))) {
    throw new Error("Die Dateien stammen nicht aus demselben gewählten Wallpaper-Ordner.");
  }
  const entries = sources.map(({ file, path }) => ({ file, path: path.slice(first.length + 1) }));
  const filePaths = new Set(entries.map(({ path }) => path.toLowerCase()));
  if (filePaths.size !== entries.length) throw new Error("Doppelte Dateipfade im Wallpaper-Ordner.");

  // Hat die gewählte Wurzel eine eigene Einstiegseite oder project.json,
  // gehören web/, assets/, js/, model/ usw. ALLE zum selben Webprojekt.
  const rootEntry = entries.some(({ path }) => indexFile(path) && !path.includes("/"));
  const rootMetadata = entries.some(({ path }) => /^project\.json$/i.test(path));
  if ((rootEntry || rootMetadata) && entries.some(({ path }) => html(path))) {
    return [{ name: first, files: entries.map(({ file }) => file) }];
  }

  // Unabhängige Wallpaper-Projekte in einem Sammelordner haben eigene
  // erste Unterverzeichnisse, auch bei Szenen/01/web/index.html.
  const htmlRoots = [...new Set(entries.filter(({ path }) => html(path) && path.includes("/"))
    .map(({ path }) => path.split("/")[0]))].sort(compareNames);
  if (htmlRoots.length === 1) {
    const root = htmlRoots[0];
    const siblings = entries.some(({ path }) => !path.startsWith(`${root}/`));
    const ownsMetadata = entries.some(({ path }) =>
      path.toLowerCase() === `${root.toLowerCase()}/project.json`);
    // Wird ein Sammelordner mit nur EINER Szene gewählt, erhält diese ihren
    // Unterordnernamen. Bei web/index.html + assets/ behalten wir hingegen
    // bewusst das gesamte gewählte Projekt als Einheit.
    const nestedName = !siblings && (ownsMetadata || /^\d+[\s._-]/.test(root));
    return [{ name: nestedName ? root : first, files: entries.map(({ file }) => file) }];
  }
  if (htmlRoots.length > 1) {
    const projects = htmlRoots.map((root) => ({
      name: root,
      files: entries.filter(({ path }) => path.startsWith(`${root}/`))
        .map(({ file }) => file),
    }));
    const orphans = entries.filter(({ path }) => !htmlRoots.some((root) => path.startsWith(`${root}/`)));
    // Gemeinsame Root-Dateien können sonst fälschlich verloren gehen oder
    // nur EINEM von mehreren unabhängigen Projekten zugeordnet werden.
    if (orphans.length) {
      throw new Error("Sammelordner enthält Dateien außerhalb der Wallpaper-Projekte. Bitte Projekte einzeln importieren oder die Ordnerstruktur prüfen.");
    }
    return projects;
  }

  // Ein Hauptordner darf auch fertige Video-Dateien enthalten. Der Import
  // einzelner HTML-Dateien (ohne kompletten Ordner) bleibt hingegen verboten.
  const videos = entries.filter(({ path }) => video(path));
  if (videos.length && videos.length === entries.length) {
    return videos.map(({ file, path }) => ({ name: path, files: [file] }))
      .sort((a, b) => compareNames(a.name, b.name));
  }
  throw new Error("Kein vollständiges HTML-Wallpaper-Projekt gefunden. Der Ordner muss eine HTML-Startseite und sämtliche Projektdateien enthalten.");
}
