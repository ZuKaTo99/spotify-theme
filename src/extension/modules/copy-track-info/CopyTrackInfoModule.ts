// =============================================================================
// Datei: src/extension/modules/copy-track-info/CopyTrackInfoModule.ts
// Zweck: Titeldaten aus dem Spotify-Kontextmenü in die Zwischenablage kopieren.
// Wo ändern? URI-Prüfung in shared/track-search.ts; Clipboard-Fallback hier.
// =============================================================================
import { currentTrack } from "../../../shared/library";
import { parseSpotifyTrackInput } from "../../../shared/track-search";
import { runtimeText } from "../../../shared/runtime-i18n";
import type { ExtensionModule } from "../ExtensionModule";

let contextItem: Spicetify.ContextMenu.Item | null = null;
let profileItem: Spicetify.Menu.Item | null = null;

/** Gültige Titel/Episoden einschließlich Spotify-Links einheitlich normalisieren. */
function selectedTrackUri(uris: string[]): string | null {
  for (const uri of uris) {
    const normalized = parseSpotifyTrackInput(uri);
    if (normalized) return normalized;
  }
  return null;
}

/**
 * Einige Spotify-/Chromium-Konfigurationen sperren navigator.clipboard.
 * Die ältere DOM-Kopiermethode wird nur bei einem tatsächlichen Fehler probiert.
 * Temporäre DOM-Knoten werden auch bei Exceptions wieder entfernt.
 */
function legacyCopy(text: string): boolean {
  if (!document.body || typeof document.execCommand !== "function") return false;
  const previousFocus = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  field.style.pointerEvents = "none";
  try {
    document.body.appendChild(field);
    field.select();
    return document.execCommand("copy") === true;
  } catch (error) {
    console.warn("[ZuKaTo] Clipboard-Fallback fehlgeschlagen", error);
    return false;
  } finally {
    field.remove();
    // Den Fokus des vorher bedienten Spotify-Elements wiederherstellen.
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      try { previousFocus.focus(); } catch { /* Kopieren darf nicht an Fokus-Restore scheitern. */ }
    }
  }
}

/** Erfolg nur melden, wenn tatsächlich eine Kopiermethode bestätigt wurde. */
async function copyText(text: string): Promise<void> {
  let copied = false;
  try {
    if (typeof navigator.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (error) {
    console.warn("[ZuKaTo] Async Clipboard nicht verfügbar", error);
  }
  if (!copied) copied = legacyCopy(text);
  Spicetify.showNotification(runtimeText(copied ? "runtime.copied" : "runtime.clipboardError"), !copied);
}

export const copyTrackInfoModule: ExtensionModule = {
  id: "copy-track-info",
  start(): void {
    contextItem = new Spicetify.ContextMenu.Item(
      "ZuKaTo: Titel-URI kopieren",
      (uris) => {
        const uri = selectedTrackUri(uris);
        if (uri) void copyText(uri);
      },
      (uris) => selectedTrackUri(uris) !== null,
    );
    contextItem.register();
    profileItem = new Spicetify.Menu.Item("ZuKaTo: aktuellen Titel kopieren", false, () => {
      const info = currentTrack();
      if (!info) { Spicetify.showNotification(runtimeText("runtime.noCurrent"), true); return; }
      void copyText(`${info.title} — ${info.artist}\n${info.uri}`);
    });
    profileItem.register();
  },
  stop(): void {
    contextItem?.deregister(); contextItem = null;
    profileItem?.deregister(); profileItem = null;
  },
};
