import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import {
  ModulePlaceholder,
} from "../../components/ModulePlaceholder";

interface SongNotesProps {
  t: Translator;
}

export function SongNotes({
  t,
}: SongNotesProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}