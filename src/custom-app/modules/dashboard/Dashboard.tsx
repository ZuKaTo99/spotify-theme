// =============================================================================
// Datei: src/custom-app/modules/dashboard/Dashboard.tsx
// Zweck: Dashboard mit einer Übersicht über aktivierte Custom-App- und Extension-Module.
// =============================================================================
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

// -----------------------------------------------------------------------------
// Datenvertrag `DashboardProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface DashboardProps {
  features: FeaturePreferences;
  t: Translator;
}

// -----------------------------------------------------------------------------
// Zeigt eine kompakte Übersicht über aktivierte Custom-App- und Extension-Features.
// -----------------------------------------------------------------------------
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