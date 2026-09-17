import type {
  ReactElement,
  ReactNode,
} from "react";

import type {
  FeaturePreferences,
} from "../../shared/feature-preferences";

import type {
  FeatureId,
} from "../../shared/features";

import type {
  Translator,
} from "../../shared/i18n";

import {
  Dashboard,
} from "./Dashboard";

interface ModuleContentProps {
  featureId: FeatureId;
  features: FeaturePreferences;
  settingsContent: ReactNode;
  t: Translator;
}

export function ModuleContent({
  featureId,
  features,
  settingsContent,
  t,
}: ModuleContentProps): ReactElement {
  if (featureId === "settings") {
    return <>{settingsContent}</>;
  }

  if (featureId === "dashboard") {
    return (
      <Dashboard
        features={features}
        t={t}
      />
    );
  }

  return (
    <p>
      {t("module.underDevelopment")}
    </p>
  );
}