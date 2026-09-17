import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import type {
  AppSettings,
} from "../../../shared/settings";

import {
  FeatureManager,
} from "../../components/FeatureManager";

import {
  SettingsPanel,
} from "../../components/SettingsPanel";

import type {
  SettingsChanges,
} from "../../hooks/useSettings";

interface SettingsModuleProps {
  settings: AppSettings;
  t: Translator;

  onChange: (
    changes: SettingsChanges,
  ) => void;
}

export function SettingsModule({
  settings,
  t,
  onChange,
}: SettingsModuleProps): ReactElement {
  return (
    <>
      <SettingsPanel
        workspaceTitle={
          settings.workspaceTitle
        }
        displayName={
          settings.displayName
        }
        showGreeting={
          settings.showGreeting
        }
        locale={
          settings.locale
        }
        t={t}
        onChange={onChange}
      />

      <FeatureManager
        features={settings.features}
        t={t}
        onChange={onChange}
      />
    </>
  );
}