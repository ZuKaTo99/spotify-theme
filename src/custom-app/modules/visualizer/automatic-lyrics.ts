// =============================================================================
// Datei: src/custom-app/modules/visualizer/automatic-lyrics.ts
// Zweck: Songtexte automatisch zum aktuellen Spotify-Titel suchen.
// Quelle: Öffentliche, CORS-fähige LRCLIB-API (https://lrclib.net/docs).
//
// Prinzipien:
//   1. Keine inoffiziellen Spotify-Endpunkte und keine erfundenen Textzeilen.
//   2. Zeitgesteuerte Lyrics bevorzugen; ansonsten unsynchronisierten Text zeigen.
//   3. Genaue Metadaten prüfen, damit kein Songtext eines anderen Titels erscheint.
//   4. LRCLIB-Limits einhalten; HTTP 429 respektieren, nicht automatisch umgehen.
//   5. Fremde Lyrics ausschließlich kurz im RAM halten, nicht in IndexedDB/Backup.
//   6. Lokale Nutzer-LRC-Dateien werden separat verwaltet und haben Vorrang.
//
// Wo ändern? API-Matching / Cache / HTTP-Schutz hier, React-Anzeige in Visualizer.
// =============================================================================

export interface LyricsLookupTrack {
  uri: string;
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
}

export type AutomaticLyrics =
  | { kind: "synced"; text: string; sourceId: number }
  | { kind: "plain"; lines: string[]; sourceId: number }
  | { kind: "instrumental" }
  | { kind: "not-found" }
  | { kind: "rate-limited"; retryAfterMs: number }
  | { kind: "error"; reason: "network" | "server" | "invalid-response" };

interface LyricsRecord {
  id?: unknown;
  trackName?: unknown;
  artistName?: unknown;
  duration?: unknown;
  instrumental?: unknown;
  syncedLyrics?: unknown;
  plainLyrics?: unknown;
}

/** Der Nutzer soll auf die jeweilige Quelle zurückgreifen können. */
export const LYRICS_PROVIDER_URL = "https://lrclib.net";
const API = `${LYRICS_PROVIDER_URL}/api`;
const CLIENT_ID = "ZuKaTo-Spicetify/1.11 (https://github.com/ZuKaTo99/spotify-theme)";
const MAX_RESPONSE_CHARS = 1_000_000;
const MAX_LYRICS_CHARS = 200_000;
const CACHE_MS = 30 * 60_000;
const NEGATIVE_CACHE_MS = 3 * 60_000;
const MAX_CACHE_ITEMS = 35;

// Nur flüchtiger RAM-Cache: speichert keine urheberrechtlich geschützten
// Fremdtexte in lokalen Datenbanken und verhindert unnötige API-Anfragen.
const cache = new Map<string, { until: number; result: AutomaticLyrics }>();
let nextAllowedRequest = 0;
let rateLimitedUntil = 0;

/** Normalisierung ausschließlich zum Vergleich; der eigentliche Titel bleibt unverändert. */
function normalized(value: string): string {
  return value.toLocaleLowerCase("en").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(?:remaster(?:ed)?|mono|stereo|live|radio edit|explicit|version)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Mindestens identischer Songtitel + Künstler, bei vorhandener Dauer auch ähnliche Laufzeit. */
export function matchesLyricsRecord(track: LyricsLookupTrack, record: LyricsRecord): boolean {
  if (typeof record.trackName !== "string" || typeof record.artistName !== "string") return false;
  const title = normalized(track.title);
  const candidateTitle = normalized(record.trackName);
  if (!title || !candidateTitle || title !== candidateTitle) return false;
  const artists = track.artist.split(/,|\s+(?:feat\.?|ft\.?|&|and)\s+/i).map(normalized).filter(Boolean);
  const candidateArtist = normalized(record.artistName);
  if (!artists.length || !candidateArtist || !artists.some((artist) =>
    artist === candidateArtist || artist.includes(candidateArtist) || candidateArtist.includes(artist))) return false;
  const seconds = Math.round(track.durationMs / 1000);
  if (seconds > 0 && typeof record.duration === "number" && Number.isFinite(record.duration)) {
    // 6 s Toleranz erlaubt manche Editionen, verhindert aber falsche Live-Mixe.
    if (Math.abs(seconds - record.duration) > 6) return false;
  }
  return true;
}

/** Text und Datensätze defensiv prüfen, bevor sie im Spotify-Webview landen. */
export function parseLyricsRecord(record: LyricsRecord): AutomaticLyrics | null {
  if (record.instrumental === true) return { kind: "instrumental" };
  if (typeof record.id !== "number" || !Number.isSafeInteger(record.id) || record.id < 0) return null;
  if (typeof record.syncedLyrics === "string") {
    const text = record.syncedLyrics.slice(0, MAX_LYRICS_CHARS);
    if (/\[\d{1,3}:\d{2}[.:]\d{1,3}\]/.test(text)) return { kind: "synced", text, sourceId: record.id };
  }
  if (typeof record.plainLyrics === "string") {
    const lines = record.plainLyrics.slice(0, MAX_LYRICS_CHARS).split(/\r?\n/)
      .map((line) => line.trim().slice(0, 500)).filter(Boolean).slice(0, 250);
    if (lines.length) return { kind: "plain", lines, sourceId: record.id };
  }
  return null;
}

/** HTTP 429 verlangt ausdrücklich Ruhezeit; Retry-After kann Sekunden oder HTTP-Date sein. */
export function parseRetryAfter(header: string | null, now: number): number {
  if (!header) return 60_000;
  const seconds = Number(header);
  const delay = Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1000 : Date.parse(header) - now;
  return Number.isFinite(delay) ? Math.max(1000, Math.min(60 * 60_000, delay)) : 60_000;
}

/** Statuswerte sind ausdrücklich keine Texte: keine Render-Crashes bei Netzausfall. */
async function requestJson(url: string, fetcher: typeof fetch, signal: AbortSignal, now: () => number): Promise<{
  status: "ok"; data: unknown
} | { status: "missing" } | { status: "rate-limited"; retryAfterMs: number } |
  { status: "error"; reason: "network" | "server" | "invalid-response" }> {
  let response: Response;
  // Manche eingebetteten Webviews lassen Netzwerk-Anfragen minutenlang offen.
  // 10-s-Timeout und Eltern-Abbruchsignal verhindern hängende Spinner.
  const requestController = new AbortController();
  const abortRequest = (): void => requestController.abort();
  const timeout = setTimeout(abortRequest, 10_000);
  signal.addEventListener("abort", abortRequest, { once: true });
  try {
    response = await fetcher(url, {
      method: "GET", signal: requestController.signal, cache: "no-store",
      headers: { "Lrclib-Client": CLIENT_ID, "Accept": "application/json" },
    });
  } catch (cause) {
    if (signal.aborted) throw cause;
    return { status: "error", reason: "network" };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abortRequest);
  }
  if (response.status === 404) return { status: "missing" };
  if (response.status === 429) {
    const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"), now());
    rateLimitedUntil = Math.max(rateLimitedUntil, now() + retryAfterMs);
    return { status: "rate-limited", retryAfterMs };
  }
  if (!response.ok) return { status: "error", reason: "server" };
  try {
    // Obergrenze schon anhand Header prüfen und nach dem Lesen erneut prüfen.
    if (Number(response.headers.get("Content-Length")) > MAX_RESPONSE_CHARS) return { status: "error", reason: "invalid-response" };
    const raw = await response.text();
    if (raw.length > MAX_RESPONSE_CHARS) return { status: "error", reason: "invalid-response" };
    return { status: "ok", data: JSON.parse(raw) as unknown };
  } catch (cause) {
    if (signal.aborted) throw cause;
    return { status: "error", reason: "invalid-response" };
  }
}

/** Reihenfolge der Requests und leichte Drosselung, damit LRCLIB nicht belastet wird. */
async function pauseBeforeRequest(now: () => number, sleep: (ms: number) => Promise<void>, signal: AbortSignal): Promise<void> {
  const wait = Math.max(0, nextAllowedRequest - now());
  // Zeit wird beim START reserviert, um schnelle Songwechsel zu entschärfen.
  nextAllowedRequest = Math.max(now(), nextAllowedRequest) + 400;
  if (wait > 0) await sleep(wait);
  if (signal.aborted) throw new DOMException("Abgebrochen", "AbortError");
}

/** Neue Titel werden bevorzugt per genauer Signatur gesucht; Suche ist 404-Fallback. */
export async function lookupAutomaticLyrics(track: LyricsLookupTrack, options: {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  skipCache?: boolean;
} = {}): Promise<AutomaticLyrics> {
  if (!/^spotify:track:[A-Za-z0-9]+$/.test(track.uri) || !track.title.trim() || !track.artist.trim()) {
    return { kind: "not-found" };
  }
  const now = options.now ?? Date.now;
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const signal = options.signal ?? new AbortController().signal;
  if (signal.aborted) throw new DOMException("Abgebrochen", "AbortError");
  if (rateLimitedUntil > now()) return { kind: "rate-limited", retryAfterMs: rateLimitedUntil - now() };
  const key = `${track.uri}|${track.title}|${track.artist}|${Math.round(track.durationMs / 1000)}`;
  const cached = cache.get(key);
  if (!options.skipCache && cached && cached.until > now()) return cached.result;

  const params = new URLSearchParams({ track_name: track.title, artist_name: track.artist.split(",")[0].trim() });
  if (track.album?.trim()) params.set("album_name", track.album.trim());
  const durationSeconds = Math.round(track.durationMs / 1000);
  if (durationSeconds > 0 && durationSeconds <= 3600) params.set("duration", String(durationSeconds));

  /** Weder bei 429 noch bei Netzwerkfehlern weitere Anbieter bombardieren. */
  async function fetchCandidate(url: string): Promise<{ kind: "found"; result: AutomaticLyrics } | { kind: "missing" } | { kind: "other"; result: AutomaticLyrics }> {
    await pauseBeforeRequest(now, sleep, signal);
    const response = await requestJson(url, fetcher, signal, now);
    if (response.status === "rate-limited") return { kind: "other", result: { kind: "rate-limited", retryAfterMs: response.retryAfterMs ?? 60_000 } };
    if (response.status === "error") return { kind: "other", result: { kind: "error", reason: response.reason ?? "server" } };
    if (response.status === "missing") return { kind: "missing" };
    const records = (Array.isArray(response.data) ? response.data : [response.data]) as LyricsRecord[];
    // Bei mehreren Treffern synchronisierte Varianten bevorzugen.
    const candidates = records.filter((record) => record && typeof record === "object" && matchesLyricsRecord(track, record))
      .map(parseLyricsRecord).filter((value): value is AutomaticLyrics => value !== null);
    const result = candidates.find((value) => value.kind === "synced") ?? candidates.find((value) => value.kind === "plain") ?? candidates[0];
    return result ? { kind: "found", result } : { kind: "missing" };
  }

  const exact = await fetchCandidate(`${API}/get?${params}`);
  let outcome = exact;
  if (exact.kind === "missing") {
    // Kein Treffer mit genauer Dauer/Album: strukturierten Fallback probieren.
    const searchParams = new URLSearchParams({ track_name: track.title, artist_name: track.artist.split(",")[0].trim() });
    outcome = await fetchCandidate(`${API}/search?${searchParams}`);
  }
  const result: AutomaticLyrics = outcome.kind === "found" || outcome.kind === "other" ? outcome.result : { kind: "not-found" };
  if (result.kind !== "error" && result.kind !== "rate-limited" && !signal.aborted) {
    cache.set(key, { result, until: now() + (result.kind === "not-found" ? NEGATIVE_CACHE_MS : CACHE_MS) });
    if (cache.size > MAX_CACHE_ITEMS) cache.delete(cache.keys().next().value!);
  }
  return result;
}
