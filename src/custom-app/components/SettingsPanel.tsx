import type {
  ChangeEvent,
  ReactElement,
} from "react";

import type {
  AppLocale,
} from "../../shared/settings";

import type {
  SettingsChanges,
} from "../hooks/useSettings";

interface SettingsPanelProps {
  workspaceTitle: string;
  displayName: string;
  showGreeting: boolean;
  locale: AppLocale;

  onChange: (
    changes: SettingsChanges,
  ) => void;
}

export function SettingsPanel(
  props: SettingsPanelProps,
): ReactElement {
  function handleWorkspaceTitleChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    props.onChange({
      workspaceTitle: event.target.value,
    });
  }

  function handleDisplayNameChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    props.onChange({
      displayName: event.target.value,
    });
  }

  function handleGreetingChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    props.onChange({
      showGreeting: event.target.checked,
    });
  }

  function handleLocaleChange(
    event: ChangeEvent<HTMLSelectElement>,
  ): void {
    props.onChange({
      locale: event.target.value as AppLocale,
    });
  }

  return (
    <section
      className="zukato-settings"
      aria-labelledby="zukato-settings-heading"
    >
      <h2 id="zukato-settings-heading">
        Einstellungen
      </h2>

      <div className="zukato-settings__field">
        <label htmlFor="workspace-title">
          Workspace-Titel
        </label>

        <input
          id="workspace-title"
          type="text"
          maxLength={60}
          value={props.workspaceTitle}
          onChange={handleWorkspaceTitleChange}
        />
      </div>

      <div className="zukato-settings__field">
        <label htmlFor="display-name">
          Anzeigename
        </label>

        <input
          id="display-name"
          type="text"
          maxLength={40}
          value={props.displayName}
          onChange={handleDisplayNameChange}
          placeholder="Optional"
        />
      </div>

      <div className="zukato-settings__field">
        <label htmlFor="application-language">
          Sprache
        </label>

        <select
          id="application-language"
          value={props.locale}
          onChange={handleLocaleChange}
        >
          <option value="auto">
            Automatisch
          </option>

          <option value="de">
            Deutsch
          </option>

          <option value="en">
            English
          </option>
        </select>
      </div>

      <div className="zukato-settings__field">
        <label>
          <input
            type="checkbox"
            checked={props.showGreeting}
            onChange={handleGreetingChange}
          />

          Persönliche Begrüßung anzeigen
        </label>
      </div>
    </section>
  );
}