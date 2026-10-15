// =============================================================================
// Datei: src/custom-app/components/TrackSearch.tsx
// Zweck: Eine gemeinsame, normale Titelsuche für Favoriten, Warteschlange und
// Song-Notizen. Unterstützt Künstler/Titel sowie kopierte Spotify-Links.
// Wo ändern? Darstellung hier; API/Validierung in shared/track-search.ts.
// =============================================================================
import type { FormEvent, ReactElement } from "react";
import type { Translator } from "../../shared/i18n";
import type { TrackInfo } from "../../shared/library";
import { findSpotifyTrack, parseSpotifyTrackInput, searchSpotifyTracks } from "../../shared/track-search";

const ReactRuntime = Spicetify.React as typeof import("react");

export interface TrackSearchAction { label: string; onChoose: (track: TrackInfo) => void | Promise<void> }

export function TrackSearch({ t, actionLabel, onChoose, actions }: {
  t: Translator;
  actionLabel: string;
  onChoose: (track: TrackInfo) => void | Promise<void>;
  /** Mehrere direkte Aktionen sparen das Wechseln zwischen Modulen. */
  actions?: readonly TrackSearchAction[];
}): ReactElement {
  const [query, setQuery] = ReactRuntime.useState("");
  const [results, setResults] = ReactRuntime.useState<TrackInfo[]>([]);
  const [busy, setBusy] = ReactRuntime.useState(false);
  const [error, setError] = ReactRuntime.useState("");
  const [chosenUri, setChosenUri] = ReactRuntime.useState("");
  const requestNumber = ReactRuntime.useRef(0);

  // Ein neuer Request entwertet die Ergebnisse älterer, langsamerer Suchen.
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const value = query.trim();
    const request = ++requestNumber.current;
    setResults([]);
    setError("");
    if (!value) return;
    setBusy(true);
    try {
      const uri = parseSpotifyTrackInput(value);
      let tracks: TrackInfo[];
      if (uri) {
        // Direkte Spotify-Links sollen selbst bei nicht verfügbarer Detail-API
        // hinzufügbar bleiben. Metadaten sind in diesem Sonderfall unvollständig.
        let detail: TrackInfo | null = null;
        try { detail = await findSpotifyTrack(uri); } catch (cause) {
          console.warn("[ZuKaTo] Spotify-Link ohne Metadaten:", cause);
        }
        tracks = [detail ?? {
          uri, title: `${t("search.linkTrack")} · ${uri.slice(-8)}`,
          artist: t("search.unknownArtist"), album: "",
        }];
      } else {
        tracks = await searchSpotifyTracks(value);
      }
      if (request === requestNumber.current) {
        setResults(tracks);
        if (!tracks.length) setError(t("search.empty"));
      }
    } catch (cause) {
      console.warn("[ZuKaTo] Spotify-Suche:", cause);
      if (request === requestNumber.current) setError(t("search.failed"));
    } finally {
      if (request === requestNumber.current) setBusy(false);
    }
  }

  async function choose(track: TrackInfo, callback: (track: TrackInfo) => void | Promise<void>): Promise<void> {
    setChosenUri(track.uri);
    setError("");
    try { await callback(track); }
    catch (cause) {
      console.warn("[ZuKaTo] Song-Aktion:", cause);
      setError(t("search.actionFailed"));
    } finally { setChosenUri(""); }
  }

  return <section className="zukato-track-search" aria-label={t("search.heading")}>
    <h3>{t("search.heading")}</h3>
    <p className="zukato-viz__hint">{t("search.help")}</p>
    <form className="zukato-toolbar" onSubmit={(event) => { void submit(event); }}>
      <input type="search" aria-label={t("search.placeholder")} value={query} maxLength={150}
        placeholder={t("search.placeholder")} onChange={(event) => {
          // Schon beim Editieren ältere laufende Requests und deren Treffer verwerfen.
          requestNumber.current++;
          setQuery(event.currentTarget.value);
          setResults([]);
          setError("");
          setBusy(false);
        }} />
      <button type="submit" disabled={busy || !query.trim()}>{busy ? t("search.loading") : t("search.button")}</button>
    </form>
    {error && <p role="alert" className="zukato-error">{error}</p>}
    {results.length > 0 && <ul className="zukato-track-list" aria-label={t("search.results")}>
      {results.map((track) => <li className="zukato-track" key={track.uri}>
        <div className="zukato-track__info"><strong>{track.title}</strong><span>{track.artist}{track.album ? ` · ${track.album}` : ""}</span></div>
        <div className="zukato-track__actions">{(actions ?? [{ label: actionLabel, onChoose }]).map((action) =>
          <button key={action.label} type="button" disabled={Boolean(chosenUri)}
            onClick={() => { void choose(track, action.onChoose); }}>{action.label}</button>)}</div>
      </li>)}
    </ul>}
  </section>;
}
