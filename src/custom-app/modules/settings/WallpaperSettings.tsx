// =============================================================================
// Datei: WallpaperSettings.tsx
// Zweck: Nur ein Quellen-Schalter im einfachen Modus; optionaler HTML-Import
// und Reihenfolgenverwaltung liegen eingeklappt im erweiterten Bereich.
// Originalclips werden NICHT automatisch von Spotify heruntergeladen.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import {
  loadScenePreferences, saveScenePreferences, SCENE_PLAYLIST_CHANGED_EVENT,
} from "../../../shared/scene-playlists";
import { SceneManager } from "../visualizer/SceneManager";
const ReactRuntime = Spicetify.React as typeof import("react");

export function WallpaperSettings({ t, simpleOnly = false }: { t: Translator; simpleOnly?: boolean }): ReactElement {
  const [settings, setSettings] = ReactRuntime.useState(loadScenePreferences);
  const [error, setError] = ReactRuntime.useState("");
  ReactRuntime.useEffect(() => {
    const sync = (): void => setSettings(loadScenePreferences());
    window.addEventListener(SCENE_PLAYLIST_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SCENE_PLAYLIST_CHANGED_EVENT, sync);
  }, []);

  function toggleSource(original: boolean): void {
    try {
      setError("");
      setSettings(saveScenePreferences({ ...settings, mode: original ? "original" : "wallpapers" }));
    } catch (cause) { setError(String(cause)); }
  }

  return <section className="zukato-wallpaper-settings">
    <div className="zukato-preferences__setting-row">
      <div>
        <h4>{t("settings.useOriginalClips")}</h4>
        <p>{t("settings.useOriginalClipsHelp")}</p>
      </div>
      <label className="zukato-toggle">
        <input type="checkbox" checked={settings.mode === "original"}
          onChange={(event) => toggleSource(event.currentTarget.checked)} />
        <span>{settings.mode === "original" ? t("settings.on") : t("settings.off")}</span>
      </label>
    </div>
    <div className="zukato-preferences__tip" role="note">{settings.mode === "original"
      ? t("viz.originalAutoNote") : t("settings.wallpapersActive")}</div>
    {!simpleOnly && <details className="zukato-preferences__advanced">
      <summary>{t("settings.manageWallpapers")}</summary>
      <p>{t("settings.manageWallpapersHelp")}</p>
      <div className="zukato-viz">
        <SceneManager t={t} trackUri="" settings={settings} showModeToggle={false}
          onChange={setSettings} onError={setError} />
      </div>
    </details>}
    {error && <p role="alert" className="zukato-error">{error}</p>}
  </section>;
}
