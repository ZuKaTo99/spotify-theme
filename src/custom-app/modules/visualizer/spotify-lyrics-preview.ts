// =============================================================================
// Datei: spotify-lyrics-preview.ts
// Zweck: Nur die schon im Now-Playing-Bereich sichtbare Lyrics-Vorschau lesen.
//
// Die Vorschau ist NICHT der vollständige Originalsongtext und besitzt KEINE
// Zeitmarken. Sie dient ausschließlich als kurzer Fallback, wenn LRCLIB im
// eingebetteten Spotify-Webview nicht erreichbar ist. Kein Speichern, kein
// Senden an Server, kein Zugriff auf private Spotify-APIs.
// Wo ändern? Erkennung der Card-Überschrift / Spotify DOM hier.
// =============================================================================

/** Spotify ändert die Sprachbezeichnung je nach Client/Locale. */
const LABELS = ["vorschau der lyrics", "lyrics preview", "vorschau des songtexts"];

export function isLyricsPreviewLabel(text: string): boolean {
  return LABELS.includes(text.toLocaleLowerCase().trim());
}

/**
 * Eine Lyrics-Karte muss zur aktuell gehörten Spotify-URI/Titelanzeige gehören.
 * Bei schnellen Songwechseln kann die Sidebar noch den vorherigen Titel zeigen.
 * Dann lieber KEIN Text als fremde Lyrics einblenden.
 */
/** Vollständige Wortgrenzen prüfen, nicht Teilnamen wie "Anna" in "Joanna". */
function includesWholePhrase(content: string, phrase: string): boolean {
  const needle = phrase.normalize("NFKC").toLocaleLowerCase().trim().replace(/\s+/g, " ");
  const text = content.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");
  if (!needle) return false;
  let at = text.indexOf(needle);
  while (at !== -1) {
    if (!/[\p{L}\p{N}]/u.test(text[at - 1] ?? " ") &&
        !/[\p{L}\p{N}]/u.test(text[at + needle.length] ?? " ")) return true;
    at = text.indexOf(needle, at + 1);
  }
  return false;
}

/**
 * Titel und Hauptkünstler müssen in derselben Spotify-Now-Playing-Region
 * stehen. Sonst kann der Titel "Home" beim Wechsel zwischen zwei Künstlern
 * versehentlich die letzten Lyrics des vorherigen Songs übernehmen.
 */
export function previewBelongsToTrack(regionText: string, songTitle: string, artist = ""): boolean {
  if (!includesWholePhrase(regionText, songTitle)) return false;
  const primaryArtist = artist.split(/,|\s+(?:feat\.?|ft\.?)\s+/i)[0].trim();
  return !primaryArtist || includesWholePhrase(regionText, primaryArtist);
}

export function readSpotifyLyricsPreview(root: ParentNode, title?: string, artist = ""): string[] {
  const regions = root.querySelectorAll<HTMLElement>(
    '[data-testid="now-playing-view"], [class*="nowPlayingView"], [class*="NowPlayingView"]',
  );
  for (const region of regions) {
    if (region.closest(".zukato-app")) continue;
    // Wenn ein Spotify-Titel bekannt ist, fremde/stale Sidebar ignorieren.
    if (title !== undefined && !previewBelongsToTrack(region.textContent ?? "", title, artist)) continue;
    const elements = region.querySelectorAll<HTMLElement>("h2,h3,h4,span,div,p");
    for (const heading of elements) {
      if (heading.children.length > 0 || !isLyricsPreviewLabel(heading.textContent ?? "")) continue;
      // Auf die kleine Karte begrenzen, nie die gesamte rechte Seitenleiste
      // auslesen. Die Vorschau wird NICHT als synchronisiert deklariert.
      let card: Element | null = heading.parentElement;
      for (let depth = 0; depth < 3 && card; depth += 1, card = card.parentElement) {
        const snippets = [...card.querySelectorAll("p,span")].filter((node) =>
          node.children.length === 0 && node !== heading,
        ).map((node) => (node.textContent ?? "").trim()).filter((text) =>
          text.length > 3 && text.length < 200 && !isLyricsPreviewLabel(text),
        );
        if (snippets.length >= 1 && snippets.length <= 6) return [...new Set(snippets)].slice(0, 4);
      }
    }
  }
  return [];
}
