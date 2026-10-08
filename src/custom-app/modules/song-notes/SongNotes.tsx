// =============================================================================
// Datei: src/custom-app/modules/song-notes/SongNotes.tsx
// Zweck: Gerüst für das spätere Song-Notizen-Modul.
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
// Datenvertrag `SongNotesProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface SongNotesProps {
  t: Translator;
}

// -----------------------------------------------------------------------------
// Funktion `SongNotes` kapselt einen eigenständigen Arbeitsschritt dieses Moduls.
// -----------------------------------------------------------------------------
export function SongNotes({
  t,
}: SongNotesProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}