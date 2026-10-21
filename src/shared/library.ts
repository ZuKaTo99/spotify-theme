// =============================================================================
// Datei: src/shared/library.ts
// Zweck: Gemeinsamer, defensiv validierter Datenspeicher für Hörverlauf,
//        lokale Favoriten und Song-Notizen (Custom App + Extension).
// =============================================================================

/** Diese Daten verbleiben lokal in Spicetifys Spotify-Profil-Storage. */
const LIBRARY_KEY = "zukato-toolkit.library.v1";
export const LIBRARY_CHANGED_EVENT = "zukato-toolkit:library-changed";
const MAX_HISTORY = 500;
const MAX_FAVORITES = 250;
const MAX_NOTES = 250;

// -----------------------------------------------------------------------------
// Öffentliche Datentypen: weder Spotify-Kontodaten noch externe APIs nötig.
// -----------------------------------------------------------------------------
export interface TrackInfo {
  uri: string;
  title: string;
  artist: string;
  album: string;
}
export interface HistoryEntry extends TrackInfo {
  /** Zeitpunkt des tatsächlich beobachteten Songwechsels in Millisekunden. */
  playedAt: number;
}
export interface SongNote extends TrackInfo {
  text: string;
  updatedAt: number;
}
export interface ToolkitLibrary {
  version: 1;
  history: HistoryEntry[];
  favorites: TrackInfo[];
  notes: SongNote[];
}

// -----------------------------------------------------------------------------
// Laufzeitvalidierung: beschädigte oder fremde Storage-Inhalte nicht übernehmen.
// -----------------------------------------------------------------------------
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function bounded(value: unknown, size: number): string {
  return typeof value === "string" ? value.slice(0, size) : "";
}
function track(value: unknown): TrackInfo | null {
  const item = object(value);
  const uri = bounded(item.uri, 250);
  // Ausschließlich Spotify-Titel und Episoden; nie willkürliche URLs speichern.
  if (!/^spotify:(track|episode):[A-Za-z0-9]+$/.test(uri)) return null;
  return {
    uri,
    title: bounded(item.title, 180) || "Unbekannter Titel",
    artist: bounded(item.artist, 180) || "Unbekannter Künstler",
    album: bounded(item.album, 180),
  };
}
function safeArray<T>(value: unknown, max: number, read: (value: unknown) => T | null): T[] {
  // Alte Backups können ungültige Einträge am Anfang enthalten. Erst gültige
  // Werte zählen: Sonst verdrängen beschädigte Werte spätere Favoriten/Notizen.
  const entries: unknown[] = Array.isArray(value) ? value : [];
  const result: T[] = [];
  for (const entry of entries) {
    const valid = read(entry);
    if (valid !== null) result.push(valid);
    if (result.length >= max) break;
  }
  return result;
}

/** Alte Backups können dieselbe URI mehrfach enthalten. Diese Funktion
 * akzeptiert nur einzigartige Titel; das Limit zählt erst NACH der Bereinigung.
 * Bei Notizen gewinnt im Konflikt der neuere gespeicherte Zeitstempel. */
function uniqueTracks<T extends TrackInfo>(
  values: unknown, max: number, read: (item: unknown) => T | null,
  isNewer?: (candidate: T, previous: T) => boolean,
): T[] {
  const result: T[] = [];
  const indexByUri = new Map<string, number>();
  if (!Array.isArray(values)) return result;
  for (const item of values) {
    const valid = read(item);
    if (!valid) continue;
    const existing = indexByUri.get(valid.uri);
    if (existing !== undefined) {
      if (isNewer?.(valid, result[existing])) result[existing] = valid;
      continue;
    }
    if (result.length >= max) continue;
    indexByUri.set(valid.uri, result.length);
    result.push(valid);
  }
  return result;
}

/** Erstellt jederzeit eine neue, unabhängige leere Datenbank. */
export function emptyLibrary(): ToolkitLibrary {
  return { version: 1, history: [], favorites: [], notes: [] };
}

/** Normalisiert gespeicherte JSON-Daten, auch nach einem App-Update. */
export function normalizeLibrary(value: unknown): ToolkitLibrary {
  const source = object(value);
  return {
    version: 1,
    history: safeArray(source.history, MAX_HISTORY, (entry) => {
      const item = object(entry);
      const base = track(item);
      return base && typeof item.playedAt === "number" && Number.isFinite(item.playedAt)
        ? { ...base, playedAt: Math.max(0, item.playedAt) } : null;
    }),
    favorites: uniqueTracks(source.favorites, MAX_FAVORITES, track),
    notes: uniqueTracks(source.notes, MAX_NOTES, (entry) => {
      const item = object(entry);
      const base = track(item);
      return base ? {
        ...base,
        text: bounded(item.text, 4000),
        updatedAt: typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
          ? item.updatedAt : 0,
      } : null;
    }, (candidate, previous) => candidate.updatedAt > previous.updatedAt),
  };
}

/**
 * Liest die Bibliothek ohne stillen Fallback. Für Schreibvorgänge und Backups
 * darf ein temporärer API-Fehler niemals als "noch keine Daten" gelten:
 * andernfalls würden Favoriten, Verlauf und Notizen überschrieben.
 *
 * Bei einer wirklich unbenutzten Installation liefert die API null/undefined
 * (manche Spicetify-Versionen auch einen leeren String). Das ist sicher leer.
 */
export function loadLibraryStrict(): ToolkitLibrary {
  const stored: unknown = Spicetify.Platform.LocalStorageAPI.getItem(LIBRARY_KEY);
  if (stored === null || stored === undefined || stored === "") return emptyLibrary();
  const parsed: unknown = typeof stored === "string" ? JSON.parse(stored) : stored;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed) ||
      !Array.isArray((parsed as Record<string, unknown>).history) ||
      !Array.isArray((parsed as Record<string, unknown>).favorites) ||
      !Array.isArray((parsed as Record<string, unknown>).notes)) {
    // Ein vorhandenes Objekt mit fehlenden oder falschen Listen ist KEINE
    // leere Neuinstallation. Normalisieren und anschließendes Schreiben würde
    // möglicherweise gespeicherte Sammlungen unwiederbringlich entfernen.
    throw new Error("Bibliotheksdaten sind beschädigt und dürfen nicht überschrieben werden.");
  }
  return normalizeLibrary(parsed);
}

/** Die reine Anzeige bleibt bei kurzzeitig gestörtem Storage benutzbar. */
export function loadLibrary(): ToolkitLibrary {
  try { return loadLibraryStrict(); }
  catch (error) {
    console.warn("[ZuKaTo] Hörverlauf/Favoriten konnten nicht gelesen werden.", error);
    return emptyLibrary();
  }
}

/** Ein zentraler Schreibpfad informiert offene React-Seiten über Änderungen. */
export function saveLibrary(value: ToolkitLibrary): ToolkitLibrary {
  const normalized = normalizeLibrary(value);
  Spicetify.Platform.LocalStorageAPI.setItem(LIBRARY_KEY, normalized);
  window.dispatchEvent(new CustomEvent(LIBRARY_CHANGED_EVENT, { detail: normalized }));
  return normalized;
}

/** Änderungsfunktion verhindert versehentliches Überschreiben anderer Bereiche. */
export function changeLibrary(edit: (previous: ToolkitLibrary) => ToolkitLibrary): ToolkitLibrary {
  const previous = loadLibraryStrict();
  const next = edit(previous);
  // Idempotente Aktionen (z. B. bereits gemerkten Favoriten hinzufügen)
  // dürfen keine überflüssigen Schreibzugriffe oder Change-Events auslösen.
  return next === previous ? previous : saveLibrary(next);
}

/** Wird bei jedem neuen Titel einmal aufgerufen; derselbe URI darf später erneut vorkommen. */
export function recordTrack(info: TrackInfo, playedAt = Date.now()): void {
  if (!track(info)) return;
  changeLibrary((db) => ({
    ...db,
    history: [{ ...info, playedAt }, ...db.history].slice(0, MAX_HISTORY),
  }));
}

/** Favoriten sind lokale ZuKaTo-Lesezeichen, nicht Spotifys Herz/Liked Songs. */
export function toggleFavorite(info: TrackInfo): boolean {
  if (!track(info)) return false;
  let added = false;
  // Die Entscheidung und das Schreiben nutzen denselben geprüften Datenstand.
  changeLibrary((db) => {
    const exists = db.favorites.some((entry) => entry.uri === info.uri);
    added = !exists;
    return {
      ...db,
      favorites: exists
        ? db.favorites.filter((entry) => entry.uri !== info.uri)
        : [info, ...db.favorites].slice(0, MAX_FAVORITES),
    };
  });
  return added;
}

/** Idempotentes Hinzufügen ohne getrennten, möglicherweise veralteten Lesezugriff. */
export function addFavorite(info: TrackInfo): boolean {
  if (!track(info)) return false;
  let added = false;
  changeLibrary((db) => {
    if (db.favorites.some((entry) => entry.uri === info.uri)) return db;
    added = true;
    return { ...db, favorites: [info, ...db.favorites].slice(0, MAX_FAVORITES) };
  });
  return added;
}

/** Entfernt ausschließlich ausdrücklich ausgewählte Favoriten in EINEM Schreibzugriff.
 * Ein Storage-Fehler wirft weiter und darf niemals als erfolgreiche Löschung gelten. */
export function removeFavoritesBatch(uris: readonly string[]): number {
  const wanted = new Set(uris);
  if (!wanted.size) return 0;
  let removed = 0;
  changeLibrary((db) => {
    const remaining = db.favorites.filter((item) => !wanted.has(item.uri));
    removed = db.favorites.length - remaining.length;
    return removed ? { ...db, favorites: remaining } : db;
  });
  return removed;
}

export interface FavoritesBatchResult { added: number; skipped: number }

/** Gemerkte Verlaufstitel in EINEM Schreibvorgang hinzufügen.
 * Bestehende Favoriten werden nicht verdrängt, auch wenn 250 erreicht sind.
 * Doppelte oder unzulässige Einträge werden übersprungen. */
export function addFavoritesBatch(items: readonly TrackInfo[]): FavoritesBatchResult {
  const result = { added: 0, skipped: 0 };
  if (!items.length) return result;
  changeLibrary((db) => {
    const favorites = [...db.favorites];
    const known = new Set(favorites.map((entry) => entry.uri));
    for (const candidate of items) {
      const normalized = track(candidate);
      if (!normalized || known.has(normalized.uri) || favorites.length >= MAX_FAVORITES) {
        result.skipped++;
        continue;
      }
      known.add(normalized.uri);
      favorites.push(normalized);
      result.added++;
    }
    return result.added ? { ...db, favorites } : db;
  });
  return result;
}

/** Notizen werden pro Titel gespeichert, Leertext entfernt die vorhandene Notiz. */
export function setSongNote(info: TrackInfo, text: string): void {
  if (!track(info)) return;
  changeLibrary((db) => ({
    ...db,
    notes: [
      ...(text.trim() ? [{ ...info, text: text.slice(0, 4000), updatedAt: Date.now() }] : []),
      ...db.notes.filter((entry) => entry.uri !== info.uri),
    ].slice(0, MAX_NOTES),
  }));
}

/** React- und Extension-Empfänger melden ihren Listener beim Unmount wieder ab. */
export function subscribeLibrary(listener: (value: ToolkitLibrary) => void): () => void {
  const onChange = (event: Event): void => {
    if (event instanceof CustomEvent) listener(normalizeLibrary(event.detail));
  };
  window.addEventListener(LIBRARY_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, onChange);
}

/** Liest die gerade laufende Wiedergabe, sofern eine echte Spotify-URI vorliegt. */
export function currentTrack(): TrackInfo | null {
  const item = Spicetify.Player?.data?.item;
  if (!item) return null;
  return track({
    uri: item.uri,
    title: item.name,
    artist: item.artists?.map((artist) => artist.name).join(", ") || "",
    album: item.album?.name ?? "",
  });
}

/** Vom Nutzer ausdrücklich angestoßene Wiedergabe eines gespeicherten Titels. */
export async function playTrack(uri: string): Promise<void> {
  if (!/^spotify:(track|episode):[A-Za-z0-9]+$/.test(uri)) throw new Error("Ungültige Spotify-URI");
  await Spicetify.Player.playUri(uri);
}
