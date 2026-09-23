import type {
  ReactElement,
} from "react";

import type {
  FeatureId,
} from "../../shared/features";

import type {
  Translator,
} from "../../shared/i18n";

import type {
  AppSettings,
} from "../../shared/settings";

import {
  ModulePlaceholder,
} from "./ModulePlaceholder";

import type {
  SettingsChanges,
} from "../hooks/useSettings";

import {
  Dashboard,
} from "../modules/dashboard/Dashboard";

import {
  SettingsModule,
} from "../modules/settings/SettingsModule";

interface ModuleContentProps {
  featureId: FeatureId;
  settings: AppSettings;
  t: Translator;

  onSettingsChange: (
    changes: SettingsChanges,
  ) => void;
}

export function ModuleContent({
  featureId,
  settings,
  t,
  onSettingsChange,
}: ModuleContentProps): ReactElement {
  if (featureId === "settings") {
    return (
      <SettingsModule
        settings={settings}
        t={t}
        onChange={onSettingsChange}
      />
    );
  }

  if (featureId === "dashboard") {
    return (
      <Dashboard
        features={settings.features}
        t={t}
      />
    );
  }

  return (
    <ModulePlaceholder
      t={t}
    />
  );
}