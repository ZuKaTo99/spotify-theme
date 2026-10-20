// =============================================================================
// Datei: src/extension/modules/copy-track-info/CopyTrackInfoModule.ts
// Zweck: Titeldaten aus dem Spotify-Kontextmenü in die Zwischenablage kopieren.
// =============================================================================
import { currentTrack } from "../../../shared/library";
import { runtimeText } from "../../../shared/runtime-i18n";
import type { ExtensionModule } from "../ExtensionModule";

let contextItem: Spicetify.ContextMenu.Item | null = null;
let profileItem: Spicetify.Menu.Item | null = null;

/** Async Clipboard ist ggf. gesperrt: Fehler werden sichtbar kommuniziert. */
async function copyText(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); Spicetify.showNotification(runtimeText("runtime.copied")); }
  catch { Spicetify.showNotification(runtimeText("runtime.clipboardError"), true); }
}

export const copyTrackInfoModule: ExtensionModule = {
  id: "copy-track-info",
  start(): void {
    contextItem = new Spicetify.ContextMenu.Item(
      "ZuKaTo: Titel-URI kopieren",
      // Bei einer Auswahl mit unterschiedlichen URIs nur echte Titel/Episoden kopieren.
      (uris) => {
        const uri = uris.find((value) => /^spotify:(track|episode):[A-Za-z0-9]+$/.test(value));
        if (uri) void copyText(uri);
      },
      (uris) => uris.some((uri) => /^spotify:(track|episode):[A-Za-z0-9]+$/.test(uri)),
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
