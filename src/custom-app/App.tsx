// =============================================================================
// Datei: src/custom-app/App.tsx
// Zweck: Hauptkomponente der Custom App: verbindet Einstellungen, Sprache, Navigation und aktives Modul.
// =============================================================================
import type {
  ReactElement,
} from "react";
import { applyPalette, loadPalette, type PaletteSelection } from "../shared/appearance";

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
import { QuickTrackPanel } from "./components/QuickTrackPanel";
import { readWorkspaceFeature, rememberWorkspaceFeature, resolveWorkspaceFeature } from "../shared/workspace-navigation";

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
      const palette = (event as CustomEvent<PaletteSelection>).detail;
      if (palette) applyPalette(rootRef.current, palette);
    };
    refresh();
    window.addEventListener("zukato-toolkit:appearance-changed", onPalette);
    return () => window.removeEventListener("zukato-toolkit:appearance-changed", onPalette);
  }, []);

  // Letzten Bereich pro Sitzung merken; abgeschaltete Module nie öffnen.
  const [activeFeatureId, setActiveFeatureId] = ReactRuntime.useState<FeatureId>(() =>
    resolveWorkspaceFeature(readWorkspaceFeature(),
      getEnabledFeaturesBySurface("custom-app", settings.features).map((feature) => feature.id)));
  const [quickOpen, setQuickOpen] = ReactRuntime.useState(false);
  const closeQuick = ReactRuntime.useCallback(() => setQuickOpen(false), []);

  function navigate(feature: FeatureId): void {
    setActiveFeatureId(feature);
    rememberWorkspaceFeature(feature);
  }

  // Optionaler Shortcut: Ctrl+Shift+F; Standard-Spotify-Suche nicht überschreiben.
  ReactRuntime.useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.shiftKey && !event.altKey && event.code === "KeyF") {
        event.preventDefault(); setQuickOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // Sicherer Fallback, falls ein Modul in den Einstellungen deaktiviert wurde.
  ReactRuntime.useEffect(() => {
    if (!navigationItems.some((item) => item.id === activeFeatureId)) {
      navigate(resolveWorkspaceFeature(null, navigationItems.map((item) => item.id)));
    }
  }, [activeFeatureId, settings.features]);

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

      <div className="zukato-app__commandbar">
        <span>{t("quick.commandHint")}</span>
        <button type="button" className="zukato-primary" onClick={() => setQuickOpen(true)}>
          {t("quick.open")} <kbd>Ctrl+Shift+F</kbd>
        </button>
      </div>
      <AppNavigation
        items={navigationItems}
        activeFeatureId={
          visibleFeatureId
        }
        ariaLabel={settings.workspaceTitle}
        t={t}
        onSelect={navigate}
      />
      <ModulePage
        title={visibleFeatureTitle}
      >
        <ModuleContent
          featureId={visibleFeatureId}
          settings={settings}
          t={t}
          onSettingsChange={update}
          onNavigate={navigate}
          onOpenQuick={() => setQuickOpen(true)}
        />
      </ModulePage>
      {quickOpen && <QuickTrackPanel t={t} onClose={closeQuick} />}
    </main>
  );
}
