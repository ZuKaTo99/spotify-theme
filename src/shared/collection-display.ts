// =============================================================================
// Datei: src/shared/collection-display.ts
// Zweck: Einheitliche, lokale Sortierung und dauerhafte Listenansicht für
//        Favoriten, Hörverlauf und Song-Notizen.
// Wo ändern? Neue Sortierarten hier; Beschriftungen in shared/i18n.ts.
// Wichtig: Sortierung schreibt niemals in die gespeicherte Bibliothek.
// =============================================================================
import type { TrackInfo } from "./library";

export type CollectionKind = "favorites" | "history" | "notes";
export type CollectionSort = "original" | "title" | "artist" | "recent" | "oldest";
export interface CollectionDisplay { sort: CollectionSort; compact: boolean; }
export const COLLECTION_DISPLAY_KEY = "zukato-toolkit.collection-display.v1";

const KINDS: readonly CollectionKind[] = ["favorites", "history", "notes"];
const SORTS: readonly CollectionSort[] = ["original", "title", "artist", "recent", "oldest"];

/** Gespeicherte Ansichten strikt prüfen, damit manipulierte JSON-Werte weder die
 * UI beschädigen noch andere lokale Nutzerdaten beeinflussen. */
export function normalizeCollectionDisplay(value: unknown, kind: CollectionKind): CollectionDisplay {
  const object = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const requested = object.sort;
  const sort = typeof requested === "string" && SORTS.includes(requested as CollectionSort)
    && (requested !== "recent" && requested !== "oldest" || kind !== "favorites")
    ? requested as CollectionSort : "original";
  return { sort, compact: object.compact === true };
}

/** Der Original- und der Zeitstempel-Modus sortieren ohne mutation. Für gleiche
 * Namen/Timestamps garantiert der Index einen stabilen Fallback. */
export function orderCollection<T extends TrackInfo>(items: readonly T[], sort: CollectionSort): T[] {
  if (sort === "original") return items.slice();
  const normalize = (value: string): string => value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const timestamp = (entry: T): number => {
    const data = entry as T & { playedAt?: unknown; updatedAt?: unknown };
    const stamp = typeof data.playedAt === "number" ? data.playedAt : data.updatedAt;
    return typeof stamp === "number" && Number.isFinite(stamp) ? stamp : 0;
  };
  return items.map((item, index) => ({ item, index })).sort((a, b) => {
    let compare = 0;
    if (sort === "title" || sort === "artist") {
      const field = sort === "title" ? "title" : "artist";
      compare = normalize(a.item[field]).localeCompare(normalize(b.item[field]));
      if (!compare) compare = normalize(a.item.title).localeCompare(normalize(b.item.title));
    } else if (sort === "recent" || sort === "oldest") {
      compare = sort === "recent"
        ? timestamp(b.item) - timestamp(a.item)
        : timestamp(a.item) - timestamp(b.item);
    }
    return compare || a.index - b.index;
  }).map(({ item }) => item);
}

/** Bewusst lokal pro Gerät, nicht Bestandteil des Nutzerdaten-Backups.
 * Fehler (Privatmodus, blockierter Storage) dürfen Ansichten nicht deaktivieren. */
export function readCollectionDisplay(kind: CollectionKind): CollectionDisplay {
  try {
    const raw = window.localStorage.getItem(COLLECTION_DISPLAY_KEY);
    if (!raw || raw.length > 2048) return normalizeCollectionDisplay(null, kind);
    const data: unknown = JSON.parse(raw);
    const record = data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown> : {};
    return normalizeCollectionDisplay(record[kind], kind);
  } catch { return normalizeCollectionDisplay(null, kind); }
}

/** Jedes Update liest die anderen Listenansichten frisch; so überschreibt
 * ein Wechsel im Hörverlauf nicht unabsichtlich die Favoriten-Einstellungen. */
export function rememberCollectionDisplay(kind: CollectionKind, display: CollectionDisplay): void {
  try {
    const raw = window.localStorage.getItem(COLLECTION_DISPLAY_KEY);
    const parsed: unknown = raw && raw.length <= 2048 ? JSON.parse(raw) : {};
    const data = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
    const next: Record<string, CollectionDisplay> = {};
    for (const item of KINDS) next[item] = item === kind
      ? normalizeCollectionDisplay(display, item) : normalizeCollectionDisplay(data[item], item);
    window.localStorage.setItem(COLLECTION_DISPLAY_KEY, JSON.stringify(next));
  } catch { /* Gesperrter Speicher: die laufende React-Ansicht bleibt nutzbar. */ }
}
