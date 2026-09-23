import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import {
  ModulePlaceholder,
} from "../../components/ModulePlaceholder";

interface ListeningHistoryProps {
  t: Translator;
}

export function ListeningHistory({
  t,
}: ListeningHistoryProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}