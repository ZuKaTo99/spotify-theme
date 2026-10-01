import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import {
  ModulePlaceholder,
} from "../../components/ModulePlaceholder";

interface FavoritesProps {
  t: Translator;
}

export function Favorites({
  t,
}: FavoritesProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}