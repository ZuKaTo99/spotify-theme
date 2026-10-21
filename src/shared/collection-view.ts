// =============================================================================
// Datei: src/shared/collection-view.ts
// Zweck: Rein lokale Suche und Seitenansicht für Favoriten und Hörverlauf.
// Wo ändern? Seitengröße/Suchfelder stehen nur hier, nicht in den Views.
// =============================================================================
import type { TrackInfo } from "./library";

/** Höchstens 40 Titel gleichzeitig in den DOM einfügen. */
export const COLLECTION_PAGE_SIZE = 40;

export interface CollectionPage<T extends TrackInfo> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

/** Großschreibung und Akzente beeinflussen die Suche nicht. */
function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

/** Gibt die gesamte Trefferliste zurück (nicht nur die aktuelle Seite).
 * Wird für explizite Mehrfachauswahl über alle Ergebnisse benötigt. */
export function filterCollection<T extends TrackInfo>(
  entries: readonly T[], search: string, extraSearchText?: (entry: T) => string,
): T[] {
  const terms = searchable(search).split(/\s+/).filter(Boolean);
  if (!terms.length) return entries.slice();
  return entries.filter((entry) => {
    const content = searchable(`${entry.title} ${entry.artist} ${entry.album} ${extraSearchText?.(entry) ?? ""}`);
    return terms.every((term) => content.includes(term));
  });
}

/**
 * Erst filtern, dann Seiten einteilen. Der ursprüngliche Speicher bleibt
 * unverändert und alle gefundenen Titel bleiben über Seiten erreichbar.
 * Nach Entfernen von Titeln wird eine nicht mehr vorhandene Seite begrenzt.
 */
export function collectionPage<T extends TrackInfo>(
  entries: readonly T[], search: string, requestedPage = 0,
  pageSize = COLLECTION_PAGE_SIZE,
  /** Zusätzlicher lokaler Suchtext, z. B. der Inhalt gespeicherter Notizen. */
  extraSearchText?: (entry: T) => string,
): CollectionPage<T> {
  const filtered = filterCollection(entries, search, extraSearchText);
  // Ungültige/übergroße Seitenwerte dürfen niemals die Listen zerstören.
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : COLLECTION_PAGE_SIZE;
  const total = filtered.length;
  const pages = Math.ceil(total / size);
  const requested = Number.isSafeInteger(requestedPage) ? requestedPage : 0;
  const page = Math.min(Math.max(0, requested), Math.max(0, pages - 1));
  return { items: filtered.slice(page * size, page * size + size), page, pages, total };
}
