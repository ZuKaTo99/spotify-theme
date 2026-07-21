import type {
  ReactElement,
} from "react";

import {
  SettingsPanel,
} from "./components/SettingsPanel";

import {
  useSettings,
} from "./hooks/useSettings";

export function App(): ReactElement {
  const {
    settings,
    update,
  } = useSettings();

  const greeting =
    settings.showGreeting &&
    settings.displayName
      ? `Hallo, ${settings.displayName}!`
      : null;

  return (
    <main className="zukato-app">
      <header className="zukato-app__header">
        <p className="zukato-app__label">
          Spotify Toolkit
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
          Persönlicher und modularer Spotify-Arbeitsbereich.
        </p>
      </header>

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
        onChange={update}
      />
    </main>
  );
}