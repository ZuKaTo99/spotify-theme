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
import { Visualizer } from "./modules/visualizer/Visualizer";
import { readWorkspaceFeature, rememberWorkspaceFeature, resolveWorkspaceFeature } from "../shared/workspace-navigation";
import { shouldToggleQuickTrackPanel } from "../shared/workspace-shortcuts";

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
  const miniHostRef = ReactRuntime.useRef<HTMLDivElement>(null);
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
      // Keine Eingabefelder, Fremddialoge oder wiederholten Tastendrücke stören.
      if (!shouldToggleQuickTrackPanel(event)) return;
      event.preventDefault();
      setQuickOpen((open) => !open);
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

  const visualizerAvailable = navigationItems.some((item) => item.id === "visualizer");

  // Spotify kann "fixed" auf die mittlere Webview statt den Bildschirm
  // beziehen. Die gemessene Kante richtet das Dock am rechten Fensterende aus.
  ReactRuntime.useLayoutEffect(() => {
    const host = miniHostRef.current;
    const root = rootRef.current;
    if (!host || !root || !visualizerAvailable || visibleFeatureId === "visualizer") return;
    const position = (): void => {
      host.style.right = "18px";
      const actualRight = host.getBoundingClientRect().right;
      host.style.right = `${18 - (window.innerWidth - 18 - actualRight)}px`;
    };
    position();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(position) : null;
    observer?.observe(root);
    window.addEventListener("resize", position);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", position);
      host.style.removeProperty("right");
    };
  }, [visibleFeatureId, visualizerAvailable]);

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
        <div className="zukato-app__identity">
          <span className="zukato-app__label">{t("app.productLabel")}</span>
          <h1>{settings.workspaceTitle}</h1>
          {greeting && <span className="zukato-app__greeting">{greeting}</span>}
        </div>
        {/* Die globale Aktion gehört zum Kopf; eine zweite Textleiste würde
            auf jeder Modulseite Platz vor dem eigentlichen Inhalt verbrauchen. */}
        <button type="button" className="zukato-primary zukato-app__quick-action"
          title={`${t("quick.commandHint")} · Ctrl+Shift+F`}
          onClick={() => setQuickOpen(true)}>
          {t("quick.open")} <kbd>Ctrl+Shift+F</kbd>
        </button>
      </header>
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
        {visibleFeatureId !== "visualizer" && <ModuleContent
          featureId={visibleFeatureId}
          settings={settings}
          t={t}
          onSettingsChange={update}
          onNavigate={navigate}
        />}
        {visualizerAvailable && <div ref={miniHostRef} className={`zukato-viz-host${visibleFeatureId === "visualizer" ? "" : " zukato-viz-host--mini"}`}>
          <Visualizer t={t} compact={visibleFeatureId !== "visualizer"}
            onOpenFull={() => navigate("visualizer")} />
        </div>}
      </ModulePage>
      {quickOpen && <QuickTrackPanel t={t} onClose={closeQuick} />}
    </main>
  );
}
