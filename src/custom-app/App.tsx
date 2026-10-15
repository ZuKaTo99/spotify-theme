// =============================================================================
// Datei: src/custom-app/App.tsx
// Zweck: Hauptkomponente der Custom App: verbindet Einstellungen, Sprache, Navigation und aktives Modul.
// =============================================================================
import type {
  ReactElement,
} from "react";
import { applyPalette, loadPalette, type PaletteId } from "../shared/appearance";

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
  ModuleContent,
} from "./components/ModuleContent";

import {
  ModulePage,
} from "./components/ModulePage";

import {
  useSettings,
} from "./hooks/useSettings";

// -----------------------------------------------------------------------------
// Typisierte Referenz auf die von Spicetify bereitgestellte React-Laufzeit.
// -----------------------------------------------------------------------------
const ReactRuntime =
  Spicetify.React as typeof import("react");

// -----------------------------------------------------------------------------
// Hauptkomponente der Custom App; koordiniert Einstellungen, Navigation und Modulinhalt.
// -----------------------------------------------------------------------------
export function App(): ReactElement {
  const {
    settings,
    update,
  } = useSettings();

  // Eigene Palette anwenden, ohne CSS anderer Spotify-Seiten zu verändern.
  const rootRef = ReactRuntime.useRef<HTMLElement>(null);
  ReactRuntime.useEffect(() => {
    const refresh = (): void => applyPalette(rootRef.current, loadPalette());
    const onPalette = (event: Event): void => {
      const palette = (event as CustomEvent<PaletteId>).detail;
      if (palette) applyPalette(rootRef.current, palette);
    };
    refresh();
    window.addEventListener("zukato-toolkit:appearance-changed", onPalette);
    return () => window.removeEventListener("zukato-toolkit:appearance-changed", onPalette);
  }, []);

  const [
    activeFeatureId,
    setActiveFeatureId,
  ] =
    ReactRuntime.useState<FeatureId>(
      "dashboard",
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
      ref={rootRef}
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
          settings={settings}
          t={t}
          onSettingsChange={update}
        />
      </ModulePage>
    </main>
  );
}
