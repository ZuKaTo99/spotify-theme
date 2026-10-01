import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import {
  ModulePlaceholder,
} from "../../components/ModulePlaceholder";

interface VisualizerProps {
  t: Translator;
}

export function Visualizer({
  t,
}: VisualizerProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}