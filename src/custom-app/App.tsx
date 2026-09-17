import type {
  ReactElement,
} from "react";

import {
  getFeatureTitle,
} from "../shared/feature-titles";

import {
  getEnabledFeaturesBySurface,
  type FeatureId,
} from "../shared/features";

import {
  createTranslator,
  resolveLocale,
} from "../shared/i18n";

import {
  AppNavigation,
} from "./components/AppNavigation";

import {
  FeatureManager,
} from "./components/FeatureManager";

import {
  ModuleContent,
} from "./components/ModuleContent";

import {
  ModulePage,
} from "./components/ModulePage";

import {
  SettingsPanel,
} from "./components/SettingsPanel";

import {
  useSettings,
} from "./hooks/useSettings";

const ReactRuntime =
  Spicetify.React as typeof import("react");

export function App(): ReactElement {
  const {
    settings,
    update,
  } = useSettings();

  const [
    activeFeatureId,
    setActiveFeatureId,
  ] =
    ReactRuntime.useState<FeatureId>(
      "settings",
    );

  const resolvedLocale =
    resolveLocale(settings.locale);

  const t =
    createTranslator(resolvedLocale);

  const navigationItems =
    getEnabledFeaturesBySurface(
      "custom-app",
      settings.features,
    ).map((feature) => ({
      id: feature.id,
      title: getFeatureTitle(
        feature.id,
        settings.features[
          feature.id
        ].customTitle,
        t,
      ),
    }));

  const settingsTitle =
    getFeatureTitle(
      "settings",
      settings.features.settings
        .customTitle,
      t,
    );

  const activeNavigationItem =
    navigationItems.find(
      (item) =>
        item.id === activeFeatureId,
    );

  const visibleFeatureId =
    activeNavigationItem?.id ??
    "settings";

  const visibleFeatureTitle =
    activeNavigationItem?.title ??
    settingsTitle;

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

      <AppNavigation
        items={navigationItems}
        activeFeatureId={
          visibleFeatureId
        }
        ariaLabel={
          settings.workspaceTitle
        }
        onSelect={
          setActiveFeatureId
        }
      />
        <ModulePage
          title={visibleFeatureTitle}
        >
          <ModuleContent
            featureId={visibleFeatureId}
            t={t}
            settingsContent={
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
                  onChange={update}
                />

                <FeatureManager
                  features={
                    settings.features
                  }
                  t={t}
                  onChange={update}
                />
              </>
            }
          />
        </ModulePage>
    </main>
  );
}
