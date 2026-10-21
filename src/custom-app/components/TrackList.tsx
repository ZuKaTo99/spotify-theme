// =============================================================================
// Datei: src/custom-app/components/TrackList.tsx
// Zweck: Wiederverwendbare Titel-Liste mit optionalen Aktionen.
// =============================================================================
import type { ReactElement } from "react";
import { playTrack, type TrackInfo } from "../../shared/library";

interface TrackListProps {
  tracks: readonly TrackInfo[];
  emptyText: string;
  /** Lokalisierte, barrierefreie Beschriftung der Wiedergabeschaltfläche. */
  playLabel?: string;
  action?: (track: TrackInfo) => void;
  actionLabel?: string;
  /** Lokalisierte Fehlermeldung bei fehlgeschlagener Aktion. */
  actionErrorLabel?: string;
  details?: (track: TrackInfo, index: number) => string;
  /** Optional: Sammelbearbeitung aktiviert eine echte Tastatur-Checkbox je Zeile. */
  selectedUris?: ReadonlySet<string>;
  onSelectionChange?: (uri: string, selected: boolean) => void;
  selectLabel?: string;
}

/** Buttons statt unkontrollierter Spotify-Link-Navigation: barrierearm und testbar. */
export function TrackList({ tracks, emptyText, playLabel = "Abspielen", action, actionLabel, actionErrorLabel, details, selectedUris, onSelectionChange, selectLabel = "Auswählen" }: TrackListProps): ReactElement {
  // Direkt im Eventhandler aufrufen, damit eine Nutzeraktion synchron bleibt.
  // Speicherfehler dürfen weder React-Callbacks abbrechen noch als Erfolg gelten.
  function runAction(track: TrackInfo): void {
    if (!action) return;
    const failed = (error: unknown): void => {
      console.error("[ZuKaTo] Titelaktion fehlgeschlagen", error);
      Spicetify.showNotification(actionErrorLabel ?? "Aktion fehlgeschlagen.", true);
    };
    try {
      // Auch künftig asynchrone Aktionen fangen wir ab; vorhandene synchrone
      // Favoritenaktionen laufen weiterhin unmittelbar beim Klick.
      const result: unknown = action(track);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        void Promise.resolve(result).catch(failed);
      }
    } catch (error) { failed(error); }
  }
  if (!tracks.length) return <p className="zukato-empty">{emptyText}</p>;
  return <ul className="zukato-track-list">
    {tracks.map((track, index) => <li key={`${track.uri}-${index}`} className="zukato-track">
      {onSelectionChange && <label className="zukato-track__select" title={`${selectLabel}: ${track.title}`}>
        <input type="checkbox" aria-label={`${selectLabel}: ${track.title} – ${track.artist}`}
          checked={selectedUris?.has(track.uri) ?? false}
          onChange={(event) => onSelectionChange(track.uri, event.currentTarget.checked)} />
      </label>}
      <div className="zukato-track__info">
        <strong>{track.title}</strong>
        <span>{track.artist}{track.album ? ` · ${track.album}` : ""}</span>
        {details && <small>{details(track, index)}</small>}
      </div>
      <div className="zukato-track__actions">
        <button type="button" aria-label={`${playLabel}: ${track.title} – ${track.artist}`}
          title={`${playLabel}: ${track.title}`} onClick={() => { void playTrack(track.uri).catch(() => Spicetify.showNotification("Wiedergabe nicht möglich", true)); }}>▶</button>
        {action && <button type="button" onClick={() => runAction(track)}>{actionLabel ?? "Aktion"}</button>}
      </div>
    </li>)}
  </ul>;
}
