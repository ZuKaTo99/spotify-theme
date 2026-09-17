import type {
  ReactElement,
  ReactNode,
} from "react";

import type {
  FeatureId,
} from "../../shared/features";

import type {
  Translator,
} from "../../shared/i18n";

interface ModuleContentProps {
  featureId: FeatureId;
  settingsContent: ReactNode;
  t: Translator;
}

export function ModuleContent({
  featureId,
  settingsContent,
  t,
}: ModuleContentProps): ReactElement {
  if (featureId === "settings") {
    return <>{settingsContent}</>;
  }

  return (
    <p>
      {t("module.underDevelopment")}
    </p>
  );
}
