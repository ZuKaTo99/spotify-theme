// =============================================================================
// Datei: src/custom-app/modules/settings/SettingsPanel.tsx
// Zweck: Formular für allgemeine Einstellungen wie Titel, Anzeigename, Sprache und Begrüßung.
// =============================================================================
import type { ChangeEvent, ReactElement } from "react";

// React bleibt die von Spicetify bereitgestellte Instanz.
const ReactRuntime = Spicetify.React as typeof import("react");

import type {
  Translator,
} from "../../../shared/i18n";

import type {
  AppLocale,
} from "../../../shared/settings";

import type {
  SettingsChanges,
} from "../../hooks/useSettings";

// -----------------------------------------------------------------------------
// Datenvertrag `SettingsPanelProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface SettingsPanelProps {
  workspaceTitle: string;
  displayName: string;
  showGreeting: boolean;
  locale: AppLocale;
  t: Translator;

  onChange: (
    changes: SettingsChanges,
  ) => void;
}

// -----------------------------------------------------------------------------
// Rendert die allgemeinen benutzerspezifischen Einstellungen.
// -----------------------------------------------------------------------------
export function SettingsPanel(
  props: SettingsPanelProps,
): ReactElement {
  // Lokale Entwürfe erlauben Leerzeichen und Backspace, bevor trim() beim Blur greift.
  const [titleDraft, setTitleDraft] = ReactRuntime.useState(props.workspaceTitle);
  const [nameDraft, setNameDraft] = ReactRuntime.useState(props.displayName);
  ReactRuntime.useEffect(() => setTitleDraft(props.workspaceTitle), [props.workspaceTitle]);
  ReactRuntime.useEffect(() => setNameDraft(props.displayName), [props.displayName]);

  // Speichert Änderungen am Workspace-Titel erst beim Verlassen des Feldes.
  function handleWorkspaceTitleChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    setTitleDraft(event.target.value);
  }

  // Speichert den Anzeigenamen für die persönliche Begrüßung.
  function handleDisplayNameChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    setNameDraft(event.target.value);
  }

  // Schaltet die persönliche Begrüßung ein oder aus.
  function handleGreetingChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    props.onChange({
      showGreeting: event.target.checked,
    });
  }

  // Speichert die ausgewählte Anwendungssprache.
  function handleLocaleChange(
    event: ChangeEvent<HTMLSelectElement>,
  ): void {
    const locale =
      event.target.value as AppLocale;

    props.onChange({
      locale,
    });
  }

  return (
    <section
      className="zukato-settings"
      aria-labelledby="settings-heading"
    >
      <h2 id="settings-heading">
        {props.t("settings.heading")}
      </h2>

      <div className="zukato-settings__field">
        <label htmlFor="workspace-title">
          {props.t(
            "settings.workspaceTitle",
          )}
        </label>

        <input
          id="workspace-title"
          type="text"
          maxLength={60}
          value={titleDraft}
          onBlur={() => props.onChange({ workspaceTitle: titleDraft })}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          onChange={
            handleWorkspaceTitleChange
          }
        />
      </div>

      <div className="zukato-settings__field">
        <label htmlFor="display-name">
          {props.t(
            "settings.displayName",
          )}
        </label>

        <input
          id="display-name"
          type="text"
          maxLength={40}
          value={nameDraft}
          onBlur={() => props.onChange({ displayName: nameDraft })}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          onChange={
            handleDisplayNameChange
          }
          placeholder={
            props.t(
              "settings.displayNamePlaceholder",
            )
          }
        />
      </div>

      <div className="zukato-settings__field">
        <label htmlFor="application-language">
          {props.t(
            "settings.language",
          )}
        </label>

        <select
          id="application-language"
          value={props.locale}
          onChange={
            handleLocaleChange
          }
        >
          <option value="auto">
            {props.t(
              "settings.languageAuto",
            )}
          </option>

          <option value="de">
            {props.t(
              "settings.languageGerman",
            )}
          </option>

          <option value="en">
            {props.t(
              "settings.languageEnglish",
            )}
          </option>
        </select>
      </div>

      <div className="zukato-settings__field">
        <label>
          <input
            type="checkbox"
            checked={props.showGreeting}
            onChange={
              handleGreetingChange
            }
          />

          {props.t(
            "settings.showGreeting",
          )}
        </label>
      </div>
    </section>
  );
}