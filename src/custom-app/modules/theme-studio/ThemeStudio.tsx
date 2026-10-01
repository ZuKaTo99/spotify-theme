import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import {
  ModulePlaceholder,
} from "../../components/ModulePlaceholder";

interface ThemeStudioProps {
  t: Translator;
}

export function ThemeStudio({
  t,
}: ThemeStudioProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}