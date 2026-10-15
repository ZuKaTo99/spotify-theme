// =============================================================================
// Datei: src/custom-app/modules/playlist-tools/PlaylistTools.tsx
// Zweck: Warteschlange befüllen; URI-Eingaben validieren, keine Spotify-Playlist ändern.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { currentTrack } from "../../../shared/library";
import { useToolkitData } from "../../hooks/useToolkitData";

const ReactRuntime = Spicetify.React as typeof import("react");

/** Einfache, explizit bestätigte Queue-Aktionen ohne ungefragte Änderungen. */
export function PlaylistTools({ t }: { t: Translator }): ReactElement {
  const { favorites } = useToolkitData();
  const [uri, setUri] = ReactRuntime.useState("");
  const [working, setWorking] = ReactRuntime.useState(false);
  async function queue(uris: string[]): Promise<void> {
    const valid = uris.filter((item) => /^spotify:(track|episode):[A-Za-z0-9]+$/.test(item));
    if (!valid.length) { Spicetify.showNotification(t("playlist.noValid"), true); return; }
    setWorking(true);
    try {
      await Spicetify.addToQueue(valid.map((item) => ({ uri: item })));
      Spicetify.showNotification(t("playlist.done", { count: valid.length }));
    } catch (error) {
      console.error("[ZuKaTo] Queue fehlgeschlagen:", error);
      Spicetify.showNotification(t("playlist.failed"), true);
    } finally { setWorking(false); }
  }
  return <section className="zukato-panel">
    <p>{t("playlist.intro")}</p>
    <div className="zukato-toolbar">
      <button type="button" disabled={working} onClick={() => { const track = currentTrack(); if (track) void queue([track.uri]); else Spicetify.showNotification(t("playlist.noCurrent"), true); }}>{t("playlist.current")}</button>
      <button type="button" disabled={working || favorites.length === 0} onClick={() => void queue(favorites.map((item) => item.uri))}>{t("playlist.allFavorites", { count: favorites.length })}</button>
    </div>
    <label htmlFor="zukato-queue-uri">{t("playlist.label")}</label>
    <div className="zukato-toolbar">
      <input id="zukato-queue-uri" placeholder="spotify:track:…" value={uri} onChange={(event) => setUri(event.target.value)} />
      <button type="button" disabled={working || !uri} onClick={() => void queue([uri.trim()])}>{t("playlist.queue")}</button>
    </div>
  </section>;
}
