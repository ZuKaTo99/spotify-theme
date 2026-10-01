import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import {
  ModulePlaceholder,
} from "../../components/ModulePlaceholder";

interface PlaylistToolsProps {
  t: Translator;
}

export function PlaylistTools({
  t,
}: PlaylistToolsProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}