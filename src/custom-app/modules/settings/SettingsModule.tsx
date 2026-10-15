// =============================================================================
// Datei: src/custom-app/modules/settings/SettingsModule.tsx
// Zweck: Vereinfachte Einstellungen mit fünf klaren Bereichen statt einer
//        endlosen Seite voller unterschiedlicher Formulare.
// Wo ändern? Tab-Reihenfolge und Einleitung hier; einzelne Optionen bleiben
// in SettingsPanel, WallpaperSettings, FeatureManager, Shortcuts und DataBackup.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import type { AppSettings } from "../../../shared/settings";
import type { SettingsChanges } from "../../hooks/useSettings";
import { FeatureManager } from "./FeatureManager";
import { KeyboardShortcutsSettings } from "./KeyboardShortcutsSettings";
import { SettingsPanel } from "./SettingsPanel";
import { DataBackup } from "./DataBackup";
import { WallpaperSettings } from "./WallpaperSettings";
import { getEnabledFeaturesBySurface } from "../../../shared/features";
import { useToolkitData } from "../../hooks/useToolkitData";

const ReactRuntime = Spicetify.React as typeof import("react");

type SettingsView = "overview" | "general" | "wallpapers" | "modules" | "shortcuts" | "data";
interface SettingsModuleProps {
  settings: AppSettings;
  t: Translator;
  onChange: (changes: SettingsChanges) => void;
}

/** Nur der aktive Bereich ist im DOM – reduziert Ablenkung und unnötige Arbeit. */
export function SettingsModule({ settings, t, onChange }: SettingsModuleProps): ReactElement {
  const [view, setView] = ReactRuntime.useState<SettingsView>("overview");
  const library = useToolkitData();
  const tabs: Array<{ id: SettingsView; title: string; description: string }> = [
    { id: "overview", title: t("settings.tabOverview"), description: t("settings.tabOverviewHelp") },
    { id: "general", title: t("settings.tabGeneral"), description: t("settings.tabGeneralHelp") },
    { id: "wallpapers", title: t("settings.tabWallpapers"), description: t("settings.tabWallpapersHelp") },
    { id: "modules", title: t("settings.tabModules"), description: t("settings.tabModulesHelp") },
    { id: "shortcuts", title: t("settings.tabShortcuts"), description: t("settings.tabShortcutsHelp") },
    { id: "data", title: t("settings.tabData"), description: t("settings.tabDataHelp") },
  ];
  const current = tabs.find((item) => item.id === view) ?? tabs[0];

  return <section className="zukato-preferences">
    <div className="zukato-preferences__heading">
      <div>
        <p className="zukato-eyebrow">ZUKATO · {t("settings.heading")}</p>
        <h3>{t("settings.simpleHeading")}</h3>
        <p>{t("settings.simpleIntro")}</p>
      </div>
    </div>
    <div className="zukato-preferences__layout">
      <nav className="zukato-preferences__tabs" aria-label={t("settings.heading")}>
        {tabs.map((item) => <button key={item.id} type="button"
          aria-current={view === item.id ? "page" : undefined}
          className={view === item.id ? "is-current" : ""} onClick={() => setView(item.id)}>
          {item.title}
        </button>)}
      </nav>
      <div className="zukato-preferences__content">
        <header className="zukato-preferences__section-heading">
          <h3>{current.title}</h3><p>{current.description}</p>
        </header>
        {view === "overview" && <div className="zukato-preferences__overview">
          <p className="zukato-preferences__lead">{t("settings.overviewIntro")}</p>
          <WallpaperSettings t={t} simpleOnly />
          <div className="zukato-preferences__overview-grid">
            {tabs.filter((item) => item.id !== "overview").map((item) => <button type="button" key={item.id}
              onClick={() => setView(item.id)}>
              <strong>{item.title} <span aria-hidden="true">→</span></strong>
              <small>{item.description}</small>
            </button>)}
          </div>
          <p className="zukato-preferences__summary" aria-live="polite">
            {t("settings.overviewStats", {
              modules: getEnabledFeaturesBySurface("custom-app", settings.features).length,
              favorites: library.favorites.length, notes: library.notes.length,
            })}
          </p>
        </div>}
        {view === "general" && <SettingsPanel
          workspaceTitle={settings.workspaceTitle} displayName={settings.displayName}
          showGreeting={settings.showGreeting} locale={settings.locale}
          t={t} onChange={onChange} />}
        {view === "wallpapers" && <WallpaperSettings t={t} />}
        {view === "modules" && <FeatureManager features={settings.features} t={t} onChange={onChange} />}
        {view === "shortcuts" && <KeyboardShortcutsSettings
          keyboardShortcuts={settings.keyboardShortcuts} t={t} onChange={onChange}
          onBack={() => setView("general")} />}
        {view === "data" && <DataBackup t={t} />}
      </div>
    </div>
  </section>;
}
