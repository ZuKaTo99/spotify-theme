// =============================================================================
// Datei: src/shared/artwork.ts
// Zweck: Spicetify-Metadaten in sichere Cover-URLs umwandeln. Das Dashboard
// zeigt nur Bilder vom offiziellen Spotify-CDN, niemals beliebige HTML-URLs.
// =============================================================================

/** Vermeidet fremde Bildserver und ungültige/JavaScript-URLs im img-Element. */
export function spotifyArtworkUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const candidate = input.trim();
  const spotifyImage = /^spotify:image:([a-fA-F0-9]{40})$/.exec(candidate);
  if (spotifyImage) return `https://i.scdn.co/image/${spotifyImage[1]}`;
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
      url.hostname === "i.scdn.co" && /^\/image\/[a-fA-F0-9]{40}$/.test(url.pathname)) {
      return url.href;
    }
  } catch { /* Unbekanntes URL-Format erhält das neutrale Cover. */ }
  return null;
}
