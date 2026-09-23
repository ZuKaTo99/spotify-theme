import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import {
  ModulePlaceholder,
} from "../../components/ModulePlaceholder";

interface StatisticsProps {
  t: Translator;
}

export function Statistics({
  t,
}: StatisticsProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}