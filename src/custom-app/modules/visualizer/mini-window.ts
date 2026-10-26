// Die laufende Visualizer-Bühne wird in ein frei verschiebbares Desktop-Fenster
// versetzt. Beim Schließen kehrt genau dasselbe DOM-Element zurück.
import { currentTrack } from "../../../shared/library";

interface PictureInPictureHost extends Window {
  documentPictureInPicture?: { requestWindow(options: { width: number; height: number }): Promise<Window> };
}

let popup: Window | null = null;
let opening = false;
let restorePopup: (() => void) | null = null;

export function miniWindowSupported(): boolean {
  return typeof (window as PictureInPictureHost).documentPictureInPicture?.requestWindow === "function";
}

/** Muss direkt aus einem Klick erfolgen: Document PiP verlangt eine Nutzergeste. */
export async function openVisualizerMiniWindow(stage: HTMLElement): Promise<boolean> {
  const api = (window as PictureInPictureHost).documentPictureInPicture;
  if (!api || !stage?.parentNode) return false;
  if (popup && !popup.closed) { popup.focus(); return true; }
  if (opening) return false;
  opening = true;
  const originalParent = stage.parentNode;
  const following = stage.nextSibling;
  let next: Window | null = null;
  try {
    // Der Aufruf bleibt vor dem ersten await innerhalb des Click-Handlers.
    next = await api.requestWindow({ width: 440, height: 310 });
    popup = next;
    const doc = next.document;
    doc.title = "ZuKaTo Wallpaper-Player";
    // Die Bühne verwendet die vorhandenen App-Styles und CSS-Variablen.
    for (const sheet of document.head.querySelectorAll('link[rel="stylesheet"], style')) {
      doc.head.append(sheet.cloneNode(true));
    }
    const style = doc.createElement("style");
    style.textContent = `
      html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#080d17;color:#fff}
      body.zukato-app{padding:0;min-height:0;line-height:1.2}
      .zukato-mini-window{width:100%;height:100%;display:flex;flex-direction:column}
      .zukato-mini-window .zukato-viz{flex:1;min-height:0;width:100%}
      .zukato-mini-window .zukato-viz__stage{width:100%;height:100%;min-height:0;aspect-ratio:auto;border:0;border-radius:0}
      .zukato-mini-window .zukato-viz__stage-controls,.zukato-mini-window .zukato-viz__mini-actions{display:none!important}
      .zukato-mini-window__bar{height:58px;flex:none;display:flex;align-items:center;gap:9px;padding:7px 11px;background:#111a2a}
      .zukato-mini-window__track{flex:1;min-width:0;display:grid;gap:2px}
      .zukato-mini-window__track strong,.zukato-mini-window__track small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .zukato-mini-window__track small{color:#aab9cb}
      .zukato-mini-window__bar button{width:38px;height:38px;flex:none;padding:0;border:1px solid #526882;border-radius:10px;background:#25344b;color:#fff;cursor:pointer;font-size:17px}
      .zukato-mini-window__bar button.primary{background:#348ed1;border-color:#62b8f2;color:#071a2a}
      .zukato-mini-window__bar button.return{width:auto;padding:0 9px;font-size:12px}
      .zukato-mini-window__bar button:focus-visible{outline:2px solid #79c7ff;outline-offset:2px}`;
    doc.head.append(style);
    doc.body.className = "zukato-app";
    const shell = doc.createElement("div"); shell.className = "zukato-mini-window";
    const scene = doc.createElement("section"); scene.className = "zukato-viz zukato-viz--mini";
    scene.append(stage);
    const bar = doc.createElement("div"); bar.className = "zukato-mini-window__bar";
    const track = doc.createElement("div"); track.className = "zukato-mini-window__track";
    const title = doc.createElement("strong");
    const artist = doc.createElement("small");
    track.append(title, artist);
    const button = (label: string, symbol: string, action: () => void): HTMLButtonElement => {
      const control = doc.createElement("button");
      control.type = "button"; control.textContent = symbol;
      control.title = label; control.setAttribute("aria-label", label);
      control.addEventListener("click", action); bar.append(control);
      return control;
    };
    bar.append(track);
    button("Vorheriger Titel", "⏮", () => Spicetify.Player.back());
    const toggle = button("Pausieren", "Ⅱ", () => Spicetify.Player.togglePlay());
    toggle.className = "primary";
    button("Nächster Titel", "⏭", () => Spicetify.Player.next());
    const returnButton = button("Spotify-Fenster öffnen", "Spotify öffnen", () => {
      // focus() aus dem Klick heraus kann das minimierte Hauptfenster anheben.
      window.focus();
      closeVisualizerMiniWindow();
    });
    returnButton.className = "return";
    shell.append(scene, bar);
    doc.body.append(shell);

    const refresh = (): void => {
      const current = currentTrack();
      title.textContent = current?.title || "Kein Titel";
      artist.textContent = current?.artist || "";
      const playing = Spicetify.Player.isPlaying();
      toggle.textContent = playing ? "Ⅱ" : "▶";
      toggle.title = playing ? "Pausieren" : "Wiedergeben";
      toggle.setAttribute("aria-label", toggle.title);
    };
    const restore = (): void => {
      Spicetify.Player.removeEventListener("songchange", refresh);
      Spicetify.Player.removeEventListener("onplaypause", refresh);
      if (stage.parentNode === scene) {
        originalParent.insertBefore(stage, following?.parentNode === originalParent ? following : null);
      }
      if (restorePopup === restore) restorePopup = null;
      if (popup === next) popup = null;
    };
    restorePopup = restore;
    Spicetify.Player.addEventListener("songchange", refresh);
    Spicetify.Player.addEventListener("onplaypause", refresh);
    next.addEventListener("pagehide", restore, { once: true });
    refresh();
    return true;
  } catch {
    restorePopup?.();
    if (stage.parentNode !== originalParent) {
      originalParent.insertBefore(stage, following?.parentNode === originalParent ? following : null);
    }
    next?.close();
    popup = null;
    return false;
  }
  finally { opening = false; }
}

export function closeVisualizerMiniWindow(): void {
  const current = popup;
  restorePopup?.();
  if (current && !current.closed) current.close();
}
