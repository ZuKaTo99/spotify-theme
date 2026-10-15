// =============================================================================
// Datei: WallpaperSettings.tsx
// Zweck: Wallpaper-Ordner und AN/AUS-Schalter direkt in den ZuKaTo-Einstellungen.
// Wo ändern? Nur die Einbindung des vorhandenen SceneManager-Dialogs hier;
// Speicherlogik, Ordnerimport, Song-Reihenfolge bleiben in ihren Fachmodulen.
// Die gleiche Szene-Verwaltung ist zusätzlich im Visualizer erreichbar.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import {
  loadScenePreferences, SCENE_PLAYLIST_CHANGED_EVENT,
} from "../../../shared/scene-playlists";
import { SceneManager } from "../visualizer/SceneManager";

const ReactRuntime = Spicetify.React as typeof import("react");

export function WallpaperSettings({ t }: { t: Translator }): ReactElement {
  const [settings, setSettings] = ReactRuntime.useState(loadScenePreferences);
  const [error, setError] = ReactRuntime.useState("");

  // Einstellungen und Visualizer bleiben auch bei paralleler Ansicht synchron.
  ReactRuntime.useEffect(() => {
    const sync = (): void => setSettings(loadScenePreferences());
    window.addEventListener(SCENE_PLAYLIST_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SCENE_PLAYLIST_CHANGED_EVENT, sync);
  }, []);

  return <section className="zukato-wallpaper-settings zukato-viz">
    <SceneManager t={t} trackUri="" settings={settings} onChange={setSettings} onError={setError} />
    {error && <p role="alert" className="zukato-error">{error}</p>}
  </section>;
}
