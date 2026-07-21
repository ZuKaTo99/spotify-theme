import type {
  ChangeEvent,
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../shared/i18n";

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
  t: Translator;

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
          value={props.workspaceTitle}
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
          value={props.displayName}
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