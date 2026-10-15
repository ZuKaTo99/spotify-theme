// =============================================================================
// Datei: src/custom-app/components/TrackList.tsx
// Zweck: Wiederverwendbare Titel-Liste mit optionalen Aktionen.
// =============================================================================
import type { ReactElement } from "react";
import { playTrack, type TrackInfo } from "../../shared/library";

interface TrackListProps {
  tracks: readonly TrackInfo[];
  emptyText: string;
  action?: (track: TrackInfo) => void;
  actionLabel?: string;
  details?: (track: TrackInfo, index: number) => string;
}

/** Buttons statt unkontrollierter Spotify-Link-Navigation: barrierearm und testbar. */
export function TrackList({ tracks, emptyText, action, actionLabel, details }: TrackListProps): ReactElement {
  if (!tracks.length) return <p className="zukato-empty">{emptyText}</p>;
  return <ul className="zukato-track-list">
    {tracks.map((track, index) => <li key={`${track.uri}-${index}`} className="zukato-track">
      <div className="zukato-track__info">
        <strong>{track.title}</strong>
        <span>{track.artist}{track.album ? ` · ${track.album}` : ""}</span>
        {details && <small>{details(track, index)}</small>}
      </div>
      <div className="zukato-track__actions">
        <button type="button" onClick={() => { void playTrack(track.uri).catch(() => Spicetify.showNotification("Wiedergabe nicht möglich", true)); }}>▶</button>
        {action && <button type="button" onClick={() => action(track)}>{actionLabel ?? "Aktion"}</button>}
      </div>
    </li>)}
  </ul>;
}
