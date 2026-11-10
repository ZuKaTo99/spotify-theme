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

export function WallpaperSettings({ t }: { t: Translator }): ReactElement {
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
      // Bestehende Playliständerungen aus dem Visualizer nicht durch einen
      // alten React-State überschreiben.
      setSettings(saveScenePreferences({ ...loadScenePreferences(), mode: original ? "original" : "wallpapers" }));
    } catch (cause) { setError(String(cause)); }
  }

  return <section className="zukato-wallpaper-settings">
    <div className="zukato-wallpaper-settings__source">
      <h4>{t("settings.useOriginalClips")}</h4>
      <div className="zukato-wallpaper-settings__choices" role="group" aria-label={t("settings.useOriginalClips")}>
        <button type="button" aria-pressed={settings.mode !== "original"}
          className={settings.mode !== "original" ? "is-active" : ""}
          onClick={() => toggleSource(false)}>{t("settings.sourceWallpapers")}</button>
        <button type="button" aria-pressed={settings.mode === "original"}
          className={settings.mode === "original" ? "is-active" : ""}
          onClick={() => toggleSource(true)}>{t("settings.sourceOriginal")}</button>
      </div>
    </div>
    <p className="zukato-wallpaper-settings__source-hint" aria-live="polite">{settings.mode === "original"
      ? t("settings.originalClipsActive") : t("settings.wallpapersActive")}</p>
    <details className="zukato-preferences__advanced">
      <summary>{t("settings.manageWallpapers")}</summary>
      <p>{t("settings.manageWallpapersHelp")}</p>
      <div className="zukato-viz">
        <SceneManager t={t} trackUri="" settings={settings} showModeToggle={false}
          onChange={setSettings} onError={setError} />
      </div>
    </details>
    {error && <p role="alert" className="zukato-error">{error}</p>}
  </section>;
}
