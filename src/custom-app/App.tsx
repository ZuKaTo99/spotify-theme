// =============================================================================
// Datei: src/custom-app/App.tsx
// Zweck: Hauptkomponente der Custom App: verbindet Einstellungen, Sprache, Navigation und aktives Modul.
// =============================================================================
import type {
  ReactElement,
} from "react";
import { BACKGROUND_CHANGED_EVENT, applyGlobalBackgroundPalette, applyGlobalPalette,
  applyPalette, loadBackgroundPalette, loadPalette, paletteColor,
  type PaletteSelection } from "../shared/appearance";

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
import { automaticMiniWindowAllowed, closeAutomaticVisualizerMiniWindow, closeVisualizerMiniWindow,
  openVisualizerMiniWindow, resetAutomaticMiniWindowSuppression } from "./modules/visualizer/mini-window";
import { spotifyMiniPlayerButton } from "./modules/visualizer/native-mini-player";
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

  // Eine Farbwahl für Workspace und Spotify-Hülle.
  const rootRef = ReactRuntime.useRef<HTMLElement>(null);
  const [selectedPalette, setSelectedPalette] = ReactRuntime.useState<PaletteSelection>(loadPalette);
  const [selectedBackground, setSelectedBackground] = ReactRuntime.useState<PaletteSelection>(loadBackgroundPalette);
  const desktopStageRef = ReactRuntime.useRef<HTMLElement | null>(null);
  const [dockHost] = ReactRuntime.useState(() => {
    const host = document.createElement("div");
    host.className = "zukato-now-dock-host";
    return host;
  });
  ReactRuntime.useEffect(() => {
    const refresh = (): void => {
      const palette = loadPalette();
      applyPalette(rootRef.current, palette);
      applyGlobalPalette(palette);
      setSelectedPalette(palette);
      const background = loadBackgroundPalette();
      applyGlobalBackgroundPalette(background);
      setSelectedBackground(background);
    };
    const onPalette = (event: Event): void => {
      const palette = (event as CustomEvent<PaletteSelection>).detail;
      if (palette) {
        applyPalette(rootRef.current, palette);
        applyGlobalPalette(palette);
        setSelectedPalette(palette);
      }
    };
    const onBackground = (event: Event): void => {
      const background = (event as CustomEvent<PaletteSelection>).detail;
      if (background) {
        applyGlobalBackgroundPalette(background);
        setSelectedBackground(background);
      }
    };
    refresh();
    window.addEventListener("zukato-toolkit:appearance-changed", onPalette);
    window.addEventListener(BACKGROUND_CHANGED_EVENT, onBackground);
    return () => {
      window.removeEventListener("zukato-toolkit:appearance-changed", onPalette);
      window.removeEventListener(BACKGROUND_CHANGED_EVENT, onBackground);
    };
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
  ReactRuntime.useEffect(() => {
    if (!visualizerAvailable) return;
    let pending = false;
    const attach = (): void => {
      const sidebar = document.getElementById("Desktop_PanelContainer_Id") ??
        document.querySelector<HTMLElement>('[data-testid="right-sidebar"]');
      const parent = sidebar ?? document.body;
      dockHost.classList.toggle("zukato-now-dock-host--floating", !sidebar);
      if (dockHost.parentElement !== parent) parent.prepend(dockHost);
    };
    attach();
    // Spotify ersetzt die Seitenleiste beim Navigieren. Der Portal-Knoten
    // bleibt derselbe, damit Player und laufende Wallpaper-Bühne erhalten bleiben.
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(() => { pending = false; attach(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); dockHost.remove(); };
  }, [visualizerAvailable, dockHost]);
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
    const onSpotifyMiniPlayer = (event: MouseEvent): void => {
      if (!spotifyMiniPlayerButton(event.target) ||
          !(document.querySelector(".zukato-viz__stage") ?? desktopStageRef.current)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openDesktop(false);
    };
    // Im Workspace öffnet auch Spotifys eigener Mini-Player-Knopf dieselbe
    // ZuKaTo-Ansicht. Außerhalb bleibt Spotifys Originalfunktion erreichbar.
    document.addEventListener("click", onSpotifyMiniPlayer, true);
    const onVisibility = (): void => {
      if (document.hidden) {
        if (automaticMiniWindowAllowed()) openDesktop(true);
      } else {
        resetAutomaticMiniWindowSuppression();
        closeAutomaticVisualizerMiniWindow();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const mediaSession = navigator.mediaSession as (MediaSession & {
      setActionHandler(action: "enterpictureinpicture", handler: (() => void) | null): void;
    }) | undefined;
    let registered = false;
    try {
      if (mediaSession?.setActionHandler) {
        mediaSession.setActionHandler("enterpictureinpicture", () => {
          if (automaticMiniWindowAllowed()) openDesktop(true);
        });
        registered = true;
      }
    } catch { /* Spotify-Webviews können diese Aktion sperren. */ }
    return () => {
      document.removeEventListener("click", onSpotifyMiniPlayer, true);
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
        <div className="zukato-app__header-actions">
          {visibleFeatureId === "dashboard" && navigationItems.some((item) => item.id === "theme-studio") &&
            <button type="button" className="zukato-app__colors" onClick={() => navigate("theme-studio")}
              title={t("dashboard.actionTheme")}>
              <span className="zukato-app__color-dot" style={{ background: `linear-gradient(90deg, ${paletteColor(selectedBackground)} 50%, ${paletteColor(selectedPalette)} 50%)` }} />
              {t("dashboard.actionTheme")}
            </button>}
          <button type="button" className="zukato-primary zukato-app__quick-action"
            title={`${t("quick.commandHint")} · Ctrl+Shift+F`}
            onClick={() => setQuickOpen(true)}>
            {t("quick.open")} <kbd>Ctrl+Shift+F</kbd>
          </button>
        </div>
      </header>
      <div className="zukato-app__navigation-slot">
        <AppNavigation
          items={navigationItems}
          activeFeatureId={visibleFeatureId}
          ariaLabel={settings.workspaceTitle}
          t={t}
          onSelect={navigate}
        />
      </div>
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
          onOpenDesktop={() => openDesktop(false)} />, dockHost)}
      {quickOpen && <QuickTrackPanel t={t} onClose={closeQuick} />}
    </main>
  );
}
