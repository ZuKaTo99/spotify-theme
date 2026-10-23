// =============================================================================
// Datei: src/custom-app/components/CollectionControls.tsx
// Zweck: Gemeinsame, zugängliche Such-/Sortierleiste mit kompakter Ansicht.
// Wo ändern? Listen-Controls hier; Datenordnung in shared/collection-display.ts.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../shared/i18n";
import type { CollectionKind, CollectionDisplay, CollectionSort } from "../../shared/collection-display";

interface Props {
  t: Translator;
  kind: CollectionKind;
  filter: string;
  results: number;
  display: CollectionDisplay;
  onSearch: (value: string) => void;
  onDisplay: (next: CollectionDisplay) => void;
}

/** Wird nur gerendert, wenn Einträge existieren. Alle Aktionen bleiben lokal:
 * Auswahl, Favoriten-Datenbank und Spotify-Wiedergabe werden nicht verändert. */
export function CollectionControls({ t, kind, filter, results, display, onSearch, onDisplay }: Props): ReactElement {
  const sortOptions: Array<{ value: CollectionSort; text: string }> = [
    { value: "original", text: t("collection.sortOriginal") },
    { value: "title", text: t("collection.sortTitle") },
    { value: "artist", text: t("collection.sortArtist") },
  ];
  if (kind !== "favorites") {
    sortOptions.push({ value: "recent", text: t("collection.sortRecent") });
    sortOptions.push({ value: "oldest", text: t("collection.sortOldest") });
  }
  return <div className="zukato-collection__controls">
    <div className="zukato-collection__filter">
      <label htmlFor={`zukato-${kind}-filter`}>{t("collection.filter")}</label>
      <input id={`zukato-${kind}-filter`} type="search" maxLength={150}
        value={filter} placeholder={kind === "notes" ? t("notes.searchPlaceholder") : t("collection.placeholder")}
        onChange={(event) => onSearch(event.currentTarget.value)} />
      <small aria-live="polite">{t("collection.results", { count: results })}</small>
      <button type="button" disabled={!filter} onClick={() => onSearch("")}>{t("collection.clearSearch")}</button>
    </div>
    <div className="zukato-collection__view-options">
      <label htmlFor={`zukato-${kind}-sort`}>{t("collection.sortLabel")}</label>
      <select id={`zukato-${kind}-sort`} value={display.sort}
        onChange={(event) => onDisplay({ ...display, sort: event.currentTarget.value as CollectionSort })}>
        {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.text}</option>)}
      </select>
      <button type="button" aria-pressed={display.compact}
        onClick={() => onDisplay({ ...display, compact: !display.compact })}>
        {display.compact ? t("collection.comfortable") : t("collection.compact")}
      </button>
    </div>
  </div>;
}
