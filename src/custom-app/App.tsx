import type {
  ReactElement,
} from "react";

import {
  createTranslator,
  resolveLocale,
} from "../shared/i18n";

import {
  FeatureManager,
} from "./components/FeatureManager";

import {
  SettingsPanel,
} from "./components/SettingsPanel";

import {
  useSettings,
} from "./hooks/useSettings";

export function App(): ReactElement {
  const {
    settings,
    update,
  } = useSettings();

  const resolvedLocale =
    resolveLocale(settings.locale);

  const t =
    createTranslator(resolvedLocale);

  const greeting =
    settings.showGreeting &&
    settings.displayName
      ? t(
          "app.greeting",
          {
            name: settings.displayName,
          },
        )
      : null;

  return (
    <main
      className="zukato-app"
      lang={resolvedLocale}
    >
      <header className="zukato-app__header">
        <p className="zukato-app__label">
          {t("app.productLabel")}
        </p>

        <h1>
          {settings.workspaceTitle}
        </h1>

        {greeting && (
          <p className="zukato-app__greeting">
            {greeting}
          </p>
        )}

        <p>
          {t("app.description")}
        </p>
      </header>

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
        onChange={update}
      />

      <FeatureManager
        features={settings.features}
        t={t}
        onChange={update}
      />
    </main>
  );
}