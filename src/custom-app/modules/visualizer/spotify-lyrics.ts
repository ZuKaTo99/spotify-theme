// =============================================================================
// Datei: spotify-lyrics.ts
// Zweck: Original-Lyrics aus dem BEREITS angemeldeten Spotify-Client lesen.
//
// Spicetifys offizielle Lyrics-Plus-Custom-App verwendet ebenfalls eine
// clientinterne Spotify-Lyrics-Quelle. Sie ist KEIN öffentlicher API-Vertrag;
// Spotify-Updates können sie jederzeit ändern oder sperren. Daher ist der
// Provider optional und jedes Fehlschlagen führt zur externen LRCLIB-Suche.
//
// Datenschutz: Nur die Spotify-Track-ID wird an Spotifys eigenen Endpunkt
// gesendet. Keine Tokens, Cookies oder fremden Texte werden persistiert.
// Wo ändern? Parser und URL hier, Providerreihenfolge in Visualizer.tsx.
// =============================================================================

export type SpotifyLyricsResult =
  | { kind: "synced"; text: string }
  | { kind: "plain"; lines: string[] }
  | { kind: "unavailable" };

const BASE = "https://spclient.wg.spotify.com/color-lyrics/v2/track/";

interface NativeLine { startTimeMs?: unknown; words?: unknown }

/**
 * Spotify/Cosmos-Wrapper unterscheiden sich je nach Client-Version.
 * Manche geben JSON unmittelbar zurück, andere unter `body` bzw. `data`.
 * Maximal zwei Hüllen abwickeln und keine unbeschränkten JSON-Strings parsen.
 */
export function unwrapSpotifyLyricsResponse(data: unknown): unknown {
  let value = data;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof value === "string") {
      if (value.length > 400_000) return null;
      try { value = JSON.parse(value) as unknown; }
      catch { return null; }
    }
    if (!value || typeof value !== "object") return null;
    const obj = value as Record<string, unknown>;
    if (obj.lyrics && typeof obj.lyrics === "object") return obj;
    value = obj.body ?? obj.data;
  }
  return null;
}

/** Spotify verwendet derzeit LINE_SYNCED bzw. UNSYNCED. Beides wird geprüft. */
export function parseSpotifyLyricsPayload(data: unknown): SpotifyLyricsResult {
  const unwrapped = unwrapSpotifyLyricsResponse(data);
  if (!unwrapped || typeof unwrapped !== "object") return { kind: "unavailable" };
  const lyrics = (unwrapped as { lyrics?: unknown }).lyrics;
  if (!lyrics || typeof lyrics !== "object") return { kind: "unavailable" };
  const source = lyrics as { lines?: unknown; syncType?: unknown };
  if (!Array.isArray(source.lines)) return { kind: "unavailable" };
  const lines = (source.lines as NativeLine[]).slice(0, 350).map((entry) => ({
    text: typeof entry?.words === "string" ? entry.words.trim().slice(0, 800) : "",
    ms: typeof entry?.startTimeMs === "string" || typeof entry?.startTimeMs === "number"
      ? Number(entry.startTimeMs) : NaN,
  })).filter((line) => Boolean(line.text));
  if (!lines.length) return { kind: "unavailable" };
  if (source.syncType === "LINE_SYNCED" && lines.some((line) => Number.isFinite(line.ms))) {
    const timed = lines.filter((line) => Number.isFinite(line.ms) && line.ms >= 0 && line.ms < 8 * 3600_000);
    const text = timed.map((line) => {
      const minutes = Math.floor(line.ms / 60000);
      const seconds = ((line.ms % 60000) / 1000).toFixed(3).padStart(6, "0");
      return `[${String(minutes).padStart(2, "0")}:${seconds}]${line.text}`;
    }).join("\n");
    if (text) return { kind: "synced", text };
  }
  // Keine erfundenen Zeitmarken bei UNSYNCED oder unbekanntem syncType.
  return { kind: "plain", lines: lines.map((line) => line.text) };
}

/** Spotify-Cosmos ist optional; ein Fehler blockiert niemals andere Quellen. */
export async function lookupSpotifyLyrics(uri: string, request?: (url: string) => Promise<unknown>): Promise<SpotifyLyricsResult> {
  const match = /^spotify:track:([A-Za-z0-9]{1,30})$/.exec(uri);
  if (!match) return { kind: "unavailable" };
  const get = request ?? ((url: string): Promise<unknown> => {
    const cosmos = Spicetify.CosmosAsync;
    if (!cosmos?.get) return Promise.resolve(null);
    return cosmos.get(url);
  });
  try {
    // Manche Spotify-Clients lassen interne Aufrufe hängen. Nach 5 Sekunden
    // die unabhängige LRCLIB-Quelle ausprobieren, statt die UI zu blockieren.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        get(`${BASE}${match[1]}?format=json&vocalRemoval=false&market=from_token`),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 5000); }),
      ]);
      return parseSpotifyLyricsPayload(result);
    } finally { if (timer) clearTimeout(timer); }
  } catch {
    return { kind: "unavailable" };
  }
}
