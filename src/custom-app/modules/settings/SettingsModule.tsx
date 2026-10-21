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
import { nextSettingsSection, readSettingsSection, rememberSettingsSection, SETTINGS_SECTIONS, type SettingsSection } from "../../../shared/settings-navigation";

const ReactRuntime = Spicetify.React as typeof import("react");

type SettingsView = SettingsSection;
interface SettingsModuleProps {
  settings: AppSettings;
  t: Translator;
  onChange: (changes: SettingsChanges) => void;
}

/** Nur der aktive Bereich ist im DOM – reduziert Ablenkung und unnötige Arbeit. */
export function SettingsModule({ settings, t, onChange }: SettingsModuleProps): ReactElement {
  // Beim Wechsel zu anderen Workspace-Modulen den zuletzt besuchten Tab merken.
  const [view, setView] = ReactRuntime.useState<SettingsView>(readSettingsSection);
  function selectView(next: SettingsView): void {
    rememberSettingsSection(next);
    setView(next);
  }

  // Die vertikale Navigationsleiste ist auch vollständig per Tastatur nutzbar.
  function onTabKey(event: import("react").KeyboardEvent<HTMLButtonElement>, id: SettingsView): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const next = nextSettingsSection(id, event.key);
    if (!next) return;
    event.preventDefault();
    selectView(next);
    const index = SETTINGS_SECTIONS.indexOf(next);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button[data-settings-section]");
    buttons?.[index]?.focus();
  }
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
          className={view === item.id ? "is-current" : ""}
          data-settings-section={item.id}
          onKeyDown={(event) => onTabKey(event, item.id)}
          onClick={() => selectView(item.id)}>
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
              onClick={() => selectView(item.id)}>
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
          onBack={() => selectView("general")} />}
        {view === "data" && <DataBackup t={t} />}
      </div>
    </div>
  </section>;
}
