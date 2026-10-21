// =============================================================================
// Datei: src/shared/bulk-selection.ts
// Zweck: Auswahl über mehrere Seiten ohne Änderung der gespeicherten Daten.
// Wichtig: Ein URI ist genau EIN Titel; mehrfach gehörte Titel im Verlauf
// werden bei Sammelaktionen nur einmal verarbeitet.
// =============================================================================
import type { TrackInfo } from "./library";

/** Auswahl um eine Seite oder alle Suchtreffer erweitern, ohne den Set-State zu mutieren. */
export function extendTrackSelection(
  selected: ReadonlySet<string>, tracks: readonly TrackInfo[],
): Set<string> {
  const result = new Set(selected);
  for (const item of tracks) if (item.uri) result.add(item.uri);
  return result;
}

/** Einzelne Checkbox umschalten; erzeugt einen unabhängigen React-State. */
export function toggleTrackSelection(
  selected: ReadonlySet<string>, uri: string, checked: boolean,
): Set<string> {
  const result = new Set(selected);
  if (checked) result.add(uri); else result.delete(uri);
  return result;
}

/** Nur aktuell vorhandene Titel verarbeiten, Doppelte im Hörverlauf ignorieren.
 * Der ursprüngliche Eintrag bleibt unverändert, und die Listenreihenfolge bleibt stabil. */
export function resolveSelectedTracks<T extends TrackInfo>(
  source: readonly T[], selected: ReadonlySet<string>,
): T[] {
  const seen = new Set<string>();
  return source.filter((entry) => {
    if (!selected.has(entry.uri) || seen.has(entry.uri)) return false;
    seen.add(entry.uri);
    return true;
  });
}
