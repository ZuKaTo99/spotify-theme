// =============================================================================
// Datei: visualizer-diagnostics.ts
// Zweck: Technischen Status der drei Medienquellen PRIVAT und reproduzierbar
//        darstellen. Nützlich, wenn Spotify/Spicetify die Webview verändert.
//
// DATENSCHUTZ: KEINE URIs, Titel, Konto-IDs, Cookies, Tokens, Lyrics oder
// URL-Adressen exportieren. Nur booleans und endliche feste Zustandsnamen.
// Wo ändern? Neue Diagnosekategorien hier; UI in Visualizer.tsx.
// =============================================================================

export type VideoCheck = "searching" | "available" | "unavailable" | "unsupported";
export type AudioCheck = "idle" | "waiting" | "detected" | "silent" | "paused";
export type LyricsCheck = "idle" | "loading" | "waiting-metadata" | "local" |
  "synced" | "plain" | "spotify-synced" | "spotify-plain" |
  "instrumental" | "not-found" | "rate-limited" | "error";

export interface VisualizerDiagnostics {
  hasTrack: boolean;
  metadataReady: boolean;
  originalMode: boolean;
  canvas: VideoCheck;
  canvasReason: "ready" | "no-sidebar" | "different-track" | "no-video" |
    "unreadable-source" | "unsupported";
  lyricsEnabled: boolean;
  lyrics: LyricsCheck;
  spectrumEnabled: boolean;
  audioSource: "system" | "microphone" | null;
  audioSignal: AudioCheck;
  displayCaptureSupported: boolean;
  microphoneSupported: boolean;
}

/** Einfache Statusbewertung für UI und Regressionstests. */
export function diagnosticSummary(value: VisualizerDiagnostics): string[] {
  if (!value.hasTrack) return ["Kein Spotify-Titel aktiv."];
  return [
    value.originalMode
      ? value.canvas === "available" ? "Canvas: Wiedergabe verfügbar."
        : `Canvas: ${value.canvasReason}; Albumcover als Ersatz.`
      : "Canvas: nicht aktiv – eigene Wallpapers ausgewählt.",
    !value.lyricsEnabled ? "Lyrics: ausgeschaltet."
      : value.lyrics === "waiting-metadata" ? "Lyrics: warte auf vollständige Songdaten."
      : `Lyrics: ${value.lyrics}.`,
    !value.spectrumEnabled ? "Audio: Effekt ausgeschaltet."
      : value.audioSource === null ? "Audio: keine Tonquelle freigegeben."
      : value.audioSignal === "silent" ? "Audio: Quelle verbunden, aber kein Signal messbar."
      : value.audioSignal === "detected" ? "Audio: Signal messbar."
      : value.audioSignal === "paused" ? "Audio: Spotify ist pausiert."
      : "Audio: prüfe die freigegebene Quelle.",
  ];
}

/**
 * Textbericht ohne Rohfehler und ohne Song-/Konto-/Netzwerkdaten. Das Kopieren
 * erfolgt NUR durch einen expliziten Klick in der UI.
 */
export function buildSafeDiagnosticReport(value: VisualizerDiagnostics): string {
  return [
    "ZuKaTo Visualizer – lokaler Diagnosebericht v1.16.0",
    ...diagnosticSummary(value),
    `Song vorhanden: ${value.hasTrack ? "ja" : "nein"}`,
    `Metadaten vollständig: ${value.metadataReady ? "ja" : "nein"}`,
    `Bildschirmton-Freigabe verfügbar: ${value.displayCaptureSupported ? "ja" : "nein"}`,
    `Mikrofon-Freigabe verfügbar: ${value.microphoneSupported ? "ja" : "nein"}`,
    "Enthält keine Songtitel, URIs, Tokens, Kontodaten oder Lyrics.",
  ].join("\n");
}
