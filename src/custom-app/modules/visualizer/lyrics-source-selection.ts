// =============================================================================
// Datei: lyrics-source-selection.ts
// Zweck: Automatische Songtexte nach QUALITÄT auswählen, nicht nur danach,
//        welcher Provider als Erster antwortet.
//
// Entscheidung:
//   1. Synchronisierte Spotify-Lyrics haben Vorrang.
//   2. Synchronisierte, streng metadatengeprüfte LRCLIB-Lyrics gehen vor
//      unsynchronisierten Spotify-Lyrics.
//   3. Ohne Zeitmarken ist Spotify-Text vor LRCLIB-Text zu bevorzugen.
//   4. Status-/Netzwerkfehler dürfen bereits vorhandene Lyrics nicht löschen.
//
// Lokale LRC-Korrekturen werden VOR der Providerwahl in Visualizer.tsx geladen.
// Hier niemals Songtexte speichern oder eigene Zeitmarken erfinden.
// Wo ändern? Provider-Rangfolge hier; Datenabfrage in den Provider-Modulen.
// =============================================================================
import type { SpotifyLyricsResult } from "./spotify-lyrics";
import type { AutomaticLyrics } from "./automatic-lyrics";

export type SelectedLyrics =
  | { kind: "synced"; source: "spotify" | "lrclib"; text: string }
  | { kind: "plain"; source: "spotify" | "lrclib"; lines: string[] }
  | { kind: "missing" };

/** Reine Funktion: leicht testbar, kein Spotify-/DOM-Zugriff und kein Cache. */
export function chooseLyricsSource(spotify: SpotifyLyricsResult,
  community: AutomaticLyrics | null): SelectedLyrics {
  if (spotify.kind === "synced") return { kind: "synced", source: "spotify", text: spotify.text };
  if (community?.kind === "synced") return { kind: "synced", source: "lrclib", text: community.text };
  if (spotify.kind === "plain") return { kind: "plain", source: "spotify", lines: spotify.lines };
  if (community?.kind === "plain") return { kind: "plain", source: "lrclib", lines: community.lines };
  return { kind: "missing" };
}
