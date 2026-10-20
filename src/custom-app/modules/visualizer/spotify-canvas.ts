// =============================================================================
// Datei: spotify-canvas.ts
// Zweck: Bereits sichtbares Spotify Canvas in der Now-Playing-Seitenleiste
//        defensiv erkennen, OHNE private APIs, Downloads oder DOM-Verschieben.
//
// Spotify stellt Canvas nicht über die öffentliche Web-API bereit. Auch
// data-testid und CSS-Klassen sind nicht stabil. Diese Erkennung ist deshalb
// bewusst best-effort und unterscheidet Fehlschläge zur Diagnose.
//
// Wo ändern? Spotify-DOM-Selektoren und Titelabgleich hier.
// =============================================================================

export interface NativeCanvasSource { src: string }
export type CanvasLookup =
  | { kind: "ready"; source: NativeCanvasSource }
  | { kind: "no-sidebar" | "different-track" | "no-video" | "unreadable-source" };

const SIDEBAR_SELECTOR = [
  '[data-testid="now-playing-view"]',
  '[data-testid="right-sidebar"]',
  '[data-testid="now-playing-widget"]',
  '[class*="nowPlayingView"]',
  '[class*="NowPlayingView"]',
].join(",");

/** Nur aus dem Spotify-Client kopierbare Quellen übernehmen, kein data:/file:. */
export function validCanvasUrl(value: string): boolean {
  if (!value || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "blob:";
  } catch { return false; }
}

/** Kompletter Titel statt Teilwort: "Buster" darf nicht "Busters" treffen. */
export function belongsToTrack(text: string, title: string): boolean {
  const needle = title.normalize("NFKC").toLocaleLowerCase().trim().replace(/\s+/g, " ");
  const haystack = text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");
  if (!needle) return false;
  let position = haystack.indexOf(needle);
  while (position !== -1) {
    const before = haystack[position - 1] ?? " ";
    const after = haystack[position + needle.length] ?? " ";
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return true;
    position = haystack.indexOf(needle, position + 1);
  }
  return false;
}

/**
 * Einen Zustand liefern statt nur `null`, damit die Bedienoberfläche
 * verlässlich erklären kann, WARUM die Canvas-Wiedergabe nicht klappt.
 */
export function inspectNativeCanvas(root: ParentNode, title: string, artist = ""): CanvasLookup {
  const regions = root.querySelectorAll<HTMLElement>(SIDEBAR_SELECTOR);
  if (!regions.length) return { kind: "no-sidebar" };
  let matchedTrack = false;
  let foundVideo = false;
  for (const region of regions) {
    if (region.closest(".zukato-app")) continue;
    const visibleText = region.textContent ?? "";
    if (!belongsToTrack(visibleText, title)) continue;
    // Zwei unterschiedliche Songs können denselben Titel haben. Der
    // Künstlerabgleich vermeidet die Übernahme eines noch alten Canvas nach
    // schnellem Songwechsel. Bei mehreren Künstlern die erste Nennung nehmen.
    const primaryArtist = artist.split(/,|\s+feat\.?\s+/i)[0].trim();
    if (primaryArtist && !belongsToTrack(visibleText, primaryArtist)) continue;
    matchedTrack = true;
    const videos = region.querySelectorAll<HTMLVideoElement>("video");
    // Die Spotify-Seitenleiste kann sowohl Canvas als auch andere Videos
    // enthalten. Videos mit explizitem Canvas-Test-ID bevorzugen.
    const candidates = Array.from(videos).filter((video) => !video.closest(".zukato-app"));
    candidates.sort((a, b) => {
      const canvasScore = (video: HTMLVideoElement): number =>
        /canvas/i.test(`${video.getAttribute?.("data-testid") ?? ""} ${video.className ?? ""}`) ? 1 : 0;
      return canvasScore(b) - canvasScore(a);
    });
    if (candidates.length) foundVideo = true;
    for (const video of candidates) {
      // Die Desktop-Webview kann eine nicht lesbare currentSrc melden,
      // während ein <source>-Tag eine gültige HTTPS-/Blob-Quelle enthält.
      // Deshalb ALLE Kandidaten prüfen, statt beim ersten nichtleeren Wert
      // abzubrechen. Niemals data:, file:, javascript: oder http: übernehmen.
      const sources = [video.currentSrc, video.getAttribute?.("src"),
        ...Array.from(video.querySelectorAll?.("source") ?? [], (element) => element.src)];
      for (const source of sources) {
        if (source && validCanvasUrl(source)) return { kind: "ready", source: { src: source } };
      }
    }
  }
  if (!matchedTrack) return { kind: "different-track" };
  return { kind: foundVideo ? "unreadable-source" : "no-video" };
}

/** Kompatibilitäts-API für bisherige UI- und Integrationstests. */
export function findNativeCanvas(root: ParentNode, title: string, artist = ""): NativeCanvasSource | null {
  const result = inspectNativeCanvas(root, title, artist);
  return result.kind === "ready" ? result.source : null;
}
