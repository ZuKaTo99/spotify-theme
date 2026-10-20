// =============================================================================
// Datei: PlayerControls.tsx
// Zweck: Einheitliche, barrierefreie SVG-Steuerung für den Spotify-Visualizer.
// Warum separat? Unicode/Emoji-Skip-Buttons wurden je nach Plattform als
//                 farbige, unterschiedlich große Symbole gerendert.
// Wo ändern? Icon-Konturen hier; Größen, Kontrast und Fokus in app.scss.
// Hinweis: Die eigentliche Wiedergabe bleibt in der Spotify-Player-API.
// =============================================================================
import type { ReactElement } from "react";

interface PlayerControlsProps {
  playing: boolean;
  disabled?: boolean;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
}

/** Gleiche 24×24-ViewBox für alle drei Aktionen – unabhängig von Systemfonts. */
function ControlIcon({ kind }: { kind: "previous" | "play" | "pause" | "next" }): ReactElement {
  const common = { viewBox: "0 0 24 24", width: 24, height: 24, fill: "none",
    stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, "aria-hidden": true as const, focusable: "false" as const };
  if (kind === "previous") return <svg {...common}>
    <path d="M5.5 5.5v13" />
    <path d="m18.5 5.8-11 6.2 11 6.2V5.8Z" fill="currentColor" stroke="none" />
  </svg>;
  if (kind === "next") return <svg {...common}>
    <path d="M18.5 5.5v13" />
    <path d="m5.5 5.8 11 6.2-11 6.2V5.8Z" fill="currentColor" stroke="none" />
  </svg>;
  if (kind === "pause") return <svg {...common}>
    <path d="M8.5 6.5v11M15.5 6.5v11" strokeWidth="3.5" />
  </svg>;
  return <svg {...common}>
    <path d="m9 5.5 10 6.5-10 6.5v-13Z" fill="currentColor" stroke="none" />
  </svg>;
}

/** Reine Darstellung: Das Komponenten-Mount darf KEINE Songs steuern. */
export function PlayerControls({ playing, disabled = false, onPrevious, onToggle, onNext }: PlayerControlsProps): ReactElement {
  return <div className="zukato-player-monitor__buttons" role="group" aria-label="Spotify-Wiedergabesteuerung">
    <button type="button" className="zukato-player-monitor__control" disabled={disabled}
      title="Vorheriger Titel" aria-label="Vorheriger Titel" onClick={onPrevious}>
      <ControlIcon kind="previous" />
    </button>
    <button type="button" className="zukato-player-monitor__control zukato-player-monitor__control--primary"
      disabled={disabled} aria-label={playing ? "Pause" : "Wiedergabe"}
      title={playing ? "Pausieren" : "Wiedergeben"} onClick={onToggle}>
      <ControlIcon kind={playing ? "pause" : "play"} />
    </button>
    <button type="button" className="zukato-player-monitor__control" disabled={disabled}
      title="Nächster Titel" aria-label="Nächster Titel" onClick={onNext}>
      <ControlIcon kind="next" />
    </button>
  </div>;
}
