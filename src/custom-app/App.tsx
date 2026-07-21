import type { ReactElement } from "react";

/**
 * Hauptkomponente unserer Custom App.
 *
 * Später kommen hier unter anderem hinein:
 * - Dashboard
 * - Hörverlauf
 * - Statistiken
 * - Playlist-Werkzeuge
 * - Visualizer
 * - Song-Notizen
 * - Einstellungen
 */
export function App(): ReactElement {
  return (
    <main className="zukato-app">
      <header className="zukato-app__header">
        <p className="zukato-app__label">
          ZuKaTo Spicetify
        </p>

        <h1>Development Workspace</h1>

        <p>
          Die eigene Custom App wurde erfolgreich geladen.
        </p>
      </header>
    </main>
  );
}