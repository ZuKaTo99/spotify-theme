import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../shared/i18n";

interface ModulePlaceholderProps {
  t: Translator;
}

export function ModulePlaceholder({
  t,
}: ModulePlaceholderProps): ReactElement {
  return (
    <p>
      {t("module.underDevelopment")}
    </p>
  );
}