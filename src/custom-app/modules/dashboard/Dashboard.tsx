import type {
  ReactElement,
} from "react";

import type {
  FeaturePreferences,
} from "../../../shared/feature-preferences";

import {
  getEnabledFeaturesBySurface,
} from "../../../shared/features";

import type {
  Translator,
} from "../../../shared/i18n";

interface DashboardProps {
  features: FeaturePreferences;
  t: Translator;
}

export function Dashboard({
  features,
  t,
}: DashboardProps): ReactElement {
  const workspaceModuleCount =
    getEnabledFeaturesBySurface(
      "custom-app",
      features,
    ).length;

  const extensionModuleCount =
    getEnabledFeaturesBySurface(
      "extension",
      features,
    ).length;

  return (
    <section>
      <p>
        {t("dashboard.description")}
      </p>

      <dl>
        <dt>
          {t(
            "dashboard.workspaceModules",
          )}
        </dt>
        <dd>
          {workspaceModuleCount}
        </dd>

        <dt>
          {t(
            "dashboard.extensionModules",
          )}
        </dt>
        <dd>
          {extensionModuleCount}
        </dd>
      </dl>
    </section>
  );
}