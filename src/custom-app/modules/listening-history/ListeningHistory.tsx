// =============================================================================
// Datei: src/custom-app/modules/listening-history/ListeningHistory.tsx
// Zweck: Gerüst für das spätere Hörverlauf-Modul.
// =============================================================================
import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import {
  ModulePlaceholder,
} from "../../components/ModulePlaceholder";

// -----------------------------------------------------------------------------
// Datenvertrag `ListeningHistoryProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface ListeningHistoryProps {
  t: Translator;
}

// -----------------------------------------------------------------------------
// Funktion `ListeningHistory` kapselt einen eigenständigen Arbeitsschritt dieses Moduls.
// -----------------------------------------------------------------------------
export function ListeningHistory({
  t,
}: ListeningHistoryProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}