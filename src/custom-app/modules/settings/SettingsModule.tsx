// =============================================================================
// Datei: src/custom-app/modules/settings/SettingsModule.tsx
// Zweck: Container der Einstellungen mit interner Navigation zwischen Übersicht und Tastenkürzeln.
// =============================================================================
import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import type {
  AppSettings,
} from "../../../shared/settings";

import type {
  SettingsChanges,
} from "../../hooks/useSettings";

import {
  FeatureManager,
} from "./FeatureManager";

import {
  KeyboardShortcutsSettings,
} from "./KeyboardShortcutsSettings";

import {
  SettingsPanel,
} from "./SettingsPanel";

// -----------------------------------------------------------------------------
// Typisierte Referenz auf die von Spicetify bereitgestellte React-Laufzeit.
// -----------------------------------------------------------------------------
const ReactRuntime =
  Spicetify.React as typeof import("react");

// -----------------------------------------------------------------------------
// Gemeinsamer Typ `SettingsView` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
type SettingsView =
  | "overview"
  | "keyboard-shortcuts";

// -----------------------------------------------------------------------------
// Datenvertrag `SettingsModuleProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface SettingsModuleProps {
  settings: AppSettings;

  t: Translator;

  onChange: (
    changes: SettingsChanges,
  ) => void;
}

// -----------------------------------------------------------------------------
// Wechselt intern zwischen Einstellungsübersicht und separater Shortcut-Seite.
// -----------------------------------------------------------------------------
export function SettingsModule({
  settings,
  t,
  onChange,
}: SettingsModuleProps): ReactElement {
  const [
    activeView,
    setActiveView,
  ] =
    ReactRuntime.useState<SettingsView>(
      "overview",
    );

  if (
    activeView ===
    "keyboard-shortcuts"
  ) {
    return (
      <KeyboardShortcutsSettings
        keyboardShortcuts={
          settings.keyboardShortcuts
        }
        t={t}
        onChange={onChange}
        onBack={() => {
          setActiveView(
            "overview",
          );
        }}
      />
    );
  }

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

      <section
        className="zukato-shortcuts-link"
        aria-labelledby={
          "shortcut-settings-heading"
        }
      >
        <h2
          id="shortcut-settings-heading"
        >
          {t("shortcuts.heading")}
        </h2>

        <p>
          {t("shortcuts.description")}
        </p>

        <button
          type="button"
          onClick={() => {
            setActiveView(
              "keyboard-shortcuts",
            );
          }}
        >
          {t("shortcuts.open")}
        </button>
      </section>

      <FeatureManager
        features={settings.features}
        t={t}
        onChange={onChange}
      />
    </>
  );
}