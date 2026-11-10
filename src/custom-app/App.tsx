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
import { NowPlayingDock, restoreNowPlayingDockStage } from "./components/NowPlayingDock";
import { Visualizer } from "./modules/visualizer/Visualizer";
import { closeAutomaticVisualizerMiniWindow, closeVisualizerMiniWindow, openVisualizerMiniWindow } from "./modules/visualizer/mini-window";
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
  const desktopStageRef = ReactRuntime.useRef<HTMLElement | null>(null);
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
    if (feature === "visualizer") {
      closeVisualizerMiniWindow();
      restoreNowPlayingDockStage();
    }
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
  function openDesktop(automatic: boolean): void {
    const stage = document.querySelector<HTMLElement>(".zukato-viz__stage") ?? desktopStageRef.current;
    if (!stage) return;
    desktopStageRef.current = stage;
    void openVisualizerMiniWindow(stage, { automatic }).then((opened) => {
      if (!opened && !automatic) Spicetify.showNotification(t("viz.miniWindowFailed"), true);
    });
  }
  // Chromium kann die Media-Session beim Verbergen automatisch nach PiP
  // fragen. Bei Webviews ohne Auto-PiP bleibt der sichtbare Desktop-Knopf.
  ReactRuntime.useEffect(() => {
    if (!visualizerAvailable) return;
    const onVisibility = (): void => {
      if (document.hidden) openDesktop(true);
      else closeAutomaticVisualizerMiniWindow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const mediaSession = navigator.mediaSession as (MediaSession & {
      setActionHandler(action: "enterpictureinpicture", handler: (() => void) | null): void;
    }) | undefined;
    let registered = false;
    try {
      if (mediaSession?.setActionHandler) {
        mediaSession.setActionHandler("enterpictureinpicture", () => openDesktop(true));
        registered = true;
      }
    } catch { /* Spotify-Webviews können diese Aktion sperren. */ }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (registered) {
        try { mediaSession?.setActionHandler("enterpictureinpicture", null); } catch { /* no-op */ }
      }
    };
  }, [visualizerAvailable]);

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
      className={`zukato-app zukato-app--${visibleFeatureId}`}
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
        {visualizerAvailable && <div className={`zukato-viz-host${visibleFeatureId === "visualizer" ? "" : " zukato-viz-host--mini"}`}>
          <Visualizer t={t} compact={visibleFeatureId !== "visualizer"}
            onOpenFull={() => navigate("visualizer")} />
        </div>}
      </ModulePage>
      {visualizerAvailable && visibleFeatureId !== "visualizer" &&
        Spicetify.ReactDOM?.createPortal?.(<NowPlayingDock
          onOpenVisualizer={() => navigate("visualizer")}
          onOpenDesktop={() => openDesktop(false)} />, document.body)}
      {quickOpen && <QuickTrackPanel t={t} onClose={closeQuick} />}
    </main>
  );
}
