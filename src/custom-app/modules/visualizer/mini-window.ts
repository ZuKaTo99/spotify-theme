// Die laufende Visualizer-Bühne wird in ein Desktop-PiP-Fenster
// versetzt. Beim Schließen kehrt genau dasselbe DOM-Element zurück.
import { currentTrack } from "../../../shared/library";
import { spotifyArtworkUrl } from "../../../shared/artwork";
import { formatPlayerTime } from "../../../shared/player-progress";
import { inspectNativeCanvas } from "./spotify-canvas";
import { VISUALIZER_HOST_CHANGED_EVENT } from "./visualizer-host";

interface PictureInPictureHost extends Window {
  documentPictureInPicture?: { requestWindow(options: { width: number; height: number }): Promise<Window> };
}

let popup: Window | null = null;
let opening = false;
let restorePopup: (() => void) | null = null;
let openedAutomatically = false;

export function miniWindowSupported(): boolean {
  return typeof (window as PictureInPictureHost).documentPictureInPicture?.requestWindow === "function";
}

/** Automatisches PiP gelingt nur, wenn die Webview eine Media-Session-Aktion zulässt. */
export async function openVisualizerMiniWindow(stage: HTMLElement, options: { automatic?: boolean } = {}): Promise<boolean> {
  const api = (window as PictureInPictureHost).documentPictureInPicture;
  if (!api || !stage?.parentNode) return false;
  if (popup && !popup.closed) { if (!options.automatic) popup.focus(); return true; }
  if (opening) return false;
  opening = true;
  const originalParent = stage.parentNode;
  const following = stage.nextSibling;
  let next: Window | null = null;
  try {
    // Der Aufruf bleibt vor dem ersten await innerhalb der Nutzergeste.
    next = await api.requestWindow({ width: 520, height: 400 });
    popup = next;
    openedAutomatically = Boolean(options.automatic);
    const doc = next.document;
    doc.title = "ZuKaTo Wallpaper-Player";
    // Spotify hält das Custom-App-CSS nicht immer als Link im Dokumentkopf.
    // Das Build-Bundle liefert deshalb exakt das kompilierte CSS als Text.
    const bundledCss = (window as Window & { __zukatoCustomAppCss?: string }).__zukatoCustomAppCss;
    if (bundledCss) {
      const appStyle = doc.createElement("style");
      appStyle.textContent = bundledCss;
      doc.head.append(appStyle);
    } else {
      for (const sheet of document.head.querySelectorAll('link[rel="stylesheet"], style')) {
        const copy = sheet.cloneNode(true) as HTMLLinkElement | HTMLStyleElement;
        if (sheet instanceof HTMLLinkElement && copy instanceof HTMLLinkElement) copy.href = sheet.href;
        doc.head.append(copy);
      }
    }
    const style = doc.createElement("style");
    style.textContent = `
      html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#080d17;color:#fff}
      body.zukato-app{padding:0;min-height:0;line-height:1.2;font:13px/1.3 Arial,sans-serif}
      .zukato-mini-window{width:100%;height:100%;display:flex;flex-direction:column}
      .zukato-mini-window__header{flex:none;height:30px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 12px;background:#101827;color:#dbe8f7;border-bottom:1px solid #2a3950;cursor:move;user-select:none;-webkit-user-select:none;touch-action:none}
      .zukato-mini-window__header strong{flex:1;font:700 11px Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;pointer-events:none}
      .zukato-mini-window__header span{font:12px Arial,sans-serif;color:#89a6c4;pointer-events:none}
      .zukato-mini-window .zukato-mini-window__close{width:23px;height:23px;display:grid;place-items:center;flex:none;padding:0;border:1px solid #42536c;border-radius:7px;background:#243147;color:#fff;font:17px Arial,sans-serif;line-height:1;cursor:pointer}
      .zukato-mini-window .zukato-mini-window__close:hover{background:#b82231;border-color:#ed5a68}
      .zukato-mini-window .zukato-mini-window__close:focus-visible{outline:2px solid #81ccff;outline-offset:1px}
      .zukato-mini-window .zukato-viz{flex:1;min-height:0;width:100%;overflow:hidden;position:relative}
      .zukato-app .zukato-mini-window .zukato-viz--popup .zukato-viz__stage{position:absolute;inset:0;width:100%;height:100%;min-height:0;aspect-ratio:auto;border:0;border-radius:0}
      .zukato-app .zukato-mini-window .zukato-viz__track{display:none}
      .zukato-mini-window__mirror{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:7;background:#080d17}
      .zukato-mini-window .zukato-viz__stage-controls,.zukato-mini-window .zukato-viz__mini-actions{display:none!important}
      .zukato-mini-window [hidden]{display:none!important}
      .zukato-mini-window__media{flex:1;min-height:0;position:relative;display:grid;place-items:center;background:#292b32}
      .zukato-mini-window__media img,.zukato-mini-window__media video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
      .zukato-mini-window__media video{background:#111}
      .zukato-mini-window__bar{flex:none;display:grid;gap:7px;padding:9px 12px 11px;background:linear-gradient(155deg,#172237,#0a1120);border-top:1px solid #334864;box-sizing:border-box}
      .zukato-mini-window__track{flex:1;min-width:0;display:grid;gap:2px}
      .zukato-mini-window__track strong,.zukato-mini-window__track small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .zukato-mini-window__track strong{font-size:14px;letter-spacing:-.02em}
      .zukato-mini-window__track small{color:#aab9cb}
      .zukato-mini-window__seek{display:flex;align-items:center;gap:7px;color:#aab9cb;font:11px Arial,sans-serif;font-variant-numeric:tabular-nums}
      .zukato-mini-window__seek span{min-width:29px;text-align:center}
      .zukato-mini-window__seek input[type=range]{flex:1;min-width:50px;width:100%;height:16px;padding:0;border:0;background:transparent;accent-color:#50aefa;cursor:pointer}
      .zukato-mini-window__buttons{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;min-width:0}
      .zukato-mini-window__bar button{width:37px;height:37px;flex:none;padding:0;border:1px solid #455a78;border-radius:12px;background:linear-gradient(145deg,#304562,#1b2940);box-shadow:inset 0 1px 0 #ffffff25,0 5px 12px #0005;color:#fff;cursor:pointer;font:17px Arial,sans-serif;transition:transform .16s,box-shadow .16s,border-color .16s}
      .zukato-mini-window__bar button:hover{transform:translateY(-2px);border-color:#86cdff;box-shadow:inset 0 1px 0 #ffffff45,0 9px 18px #0008}
      .zukato-mini-window__bar button:active{transform:scale(.96)}
      .zukato-mini-window__bar button.primary{width:42px;height:42px;border-radius:50%;background:linear-gradient(140deg,#93e3ff,#4099ee 68%,#2869c8);border-color:#a1e6ff;color:#061728;box-shadow:0 5px 18px #2b9dfa88}
      .zukato-mini-window__bar button.active{color:#a5e2ff;border-color:#72c7ff;background:linear-gradient(145deg,#254e76,#1a334d)}
      .zukato-mini-window__bar button.switch{width:89px;padding:0 5px;font-size:11px}
      .zukato-mini-window__bar button.return{width:81px;padding:0 5px;font-size:11px}
      .zukato-mini-window__bar button:focus-visible{outline:2px solid #79c7ff;outline-offset:2px}`;
    doc.head.append(style);
    doc.body.className = "zukato-app";
    // Projekt-Wallpapers melden Ready, Mounted und Speicheraktionen an ihr
    // jeweiliges Parent-Window. Im PiP ist das nun `next` statt Spotify.
    // Die bestehende, tokengeprüfte SceneBackdrop-Logik bleibt der Empfänger.
    let relocationReset = false;
    const relayWallpaperMessage = (event: MessageEvent): void => {
      const frame = stage.querySelector("iframe");
      if (!frame || event.source !== frame.contentWindow) return;
      if (!relocationReset && event.data?.zukatoProjectReady === true) {
        relocationReset = true;
        window.dispatchEvent(new CustomEvent("zukato-toolkit:wallpaper-relocated", { detail: frame }));
        return;
      }
      window.dispatchEvent(new MessageEvent("message", {
        data: event.data, source: event.source, origin: event.origin,
      }));
    };
    next.addEventListener("message", relayWallpaperMessage);
    const shell = doc.createElement("div"); shell.className = "zukato-mini-window";
    const header = doc.createElement("div"); header.className = "zukato-mini-window__header";
    header.setAttribute("aria-label", "Fenster hier verschieben");
    const headerTitle = doc.createElement("strong"); headerTitle.textContent = "ZuKaTo Player";
    const headerHandle = doc.createElement("span"); headerHandle.textContent = "⠿";
    const closeButton = doc.createElement("button");
    closeButton.type = "button"; closeButton.className = "zukato-mini-window__close";
    closeButton.textContent = "×"; closeButton.title = "Fenster schließen";
    closeButton.setAttribute("aria-label", "Fenster schließen");
    closeButton.addEventListener("click", () => closeVisualizerMiniWindow());
    header.append(headerTitle, headerHandle, closeButton);
    // Spotify Desktop erlaubt moveTo für sein PiP-Fenster. Pointer Capture
    // hält den Zug auch dann aktiv, wenn das Fenster unter dem Cursor wandert.
    let drag: { pointerId: number; x: number; y: number; left: number; top: number } | null = null;
    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target === closeButton || typeof next?.moveTo !== "function") return;
      drag = { pointerId: event.pointerId, x: event.screenX, y: event.screenY,
        left: next.screenX, top: next.screenY };
      header.setPointerCapture(event.pointerId);
    });
    header.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      next?.moveTo(drag.left + event.screenX - drag.x, drag.top + event.screenY - drag.y);
    });
    const stopDrag = (): void => { drag = null; };
    header.addEventListener("pointerup", stopDrag);
    header.addEventListener("pointercancel", stopDrag);
    const scene = doc.createElement("section"); scene.className = "zukato-viz zukato-viz--popup";
    scene.append(stage);
    // Ein Video verliert beim Document-PiP-Dokumentwechsel oft seinen Decoder.
    // Eine zweite, synchronisierte Video-Instanz zeigt den laufenden Frame.
    const mirror = doc.createElement("video");
    mirror.className = "zukato-mini-window__mirror";
    mirror.muted = true; mirror.playsInline = true; mirror.loop = true;
    mirror.hidden = true;
    mirror.addEventListener("loadeddata", () => { mirror.hidden = false; });
    mirror.addEventListener("error", () => { mirror.hidden = true; });
    scene.append(mirror);
    const media = doc.createElement("div"); media.className = "zukato-mini-window__media";
    media.hidden = true;
    const cover = doc.createElement("img"); cover.alt = "";
    const clip = doc.createElement("video"); clip.muted = true; clip.loop = true; clip.playsInline = true;
    clip.hidden = true;
    clip.addEventListener("canplay", () => {
      if (!media.hidden) {
        clip.hidden = false;
        if (Spicetify.Player.isPlaying()) void clip.play().catch(() => { clip.hidden = true; });
      }
    });
    clip.addEventListener("error", () => { clip.hidden = true; });
    media.append(cover, clip);
    const bar = doc.createElement("div"); bar.className = "zukato-mini-window__bar";
    const track = doc.createElement("div"); track.className = "zukato-mini-window__track";
    const title = doc.createElement("strong");
    const artist = doc.createElement("small");
    track.append(title, artist);
    const seekRow = doc.createElement("div"); seekRow.className = "zukato-mini-window__seek";
    const elapsed = doc.createElement("span");
    const seek = doc.createElement("input"); seek.type = "range";
    seek.min = "0"; seek.step = "1000"; seek.setAttribute("aria-label", "Wiedergabeposition");
    seek.addEventListener("input", () => {
      Spicetify.Player.seek(Number(seek.value));
      elapsed.textContent = formatPlayerTime(Number(seek.value));
    });
    const total = doc.createElement("span");
    seekRow.append(elapsed, seek, total);
    const controls = doc.createElement("div"); controls.className = "zukato-mini-window__buttons";
    const button = (label: string, symbol: string, action: () => void): HTMLButtonElement => {
      const control = doc.createElement("button");
      control.type = "button"; control.textContent = symbol;
      control.title = label; control.setAttribute("aria-label", label);
      control.addEventListener("click", action); controls.append(control);
      return control;
    };
    bar.append(track, seekRow, controls);
    const shuffle = button("Zufallswiedergabe", "⤨", () => { Spicetify.Player.toggleShuffle(); refresh(); });
    button("Vorheriger Titel", "⏮", () => Spicetify.Player.back());
    const toggle = button("Pausieren", "Ⅱ", () => Spicetify.Player.togglePlay());
    toggle.className = "primary";
    button("Nächster Titel", "⏭", () => Spicetify.Player.next());
    const repeat = button("Wiederholen", "↻", () => { Spicetify.Player.toggleRepeat(); refresh(); });
    const switchView = button("Cover oder Video anzeigen", "Cover/Video", () => {
      const showMedia = media.hidden;
      media.hidden = !showMedia;
      scene.hidden = showMedia;
      switchView.textContent = showMedia ? "Wallpaper" : "Cover/Video";
      switchView.title = showMedia ? "Wallpaper anzeigen" : "Cover oder Video anzeigen";
      switchView.setAttribute("aria-label", switchView.title);
      if (!showMedia) clip.pause();
      else if (!clip.hidden && Spicetify.Player.isPlaying()) void clip.play().catch(() => { clip.hidden = true; });
    });
    switchView.className = "switch";
    const returnButton = button("Spotify-Fenster öffnen", "Spotify öffnen", () => {
      // focus() aus dem Klick heraus kann das minimierte Hauptfenster anheben.
      window.focus();
      closeVisualizerMiniWindow();
    });
    returnButton.className = "return";
    shell.append(header, scene, media, bar);
    doc.body.append(shell);
    window.dispatchEvent(new Event(VISUALIZER_HOST_CHANGED_EVENT));
    // Beim Wechsel in ein anderes Document verwirft Chromium den geladenen
    // Inhalt eines sandboxed srcdoc-Frames. Ein explizites Reload löst dessen
    // vorhandenen React-onLoad-Handler und Projekt-Initialisierung erneut aus.
    for (const frame of stage.querySelectorAll<HTMLIFrameElement>('iframe[srcdoc]')) {
      frame.srcdoc = frame.srcdoc;
    }

    const refresh = (): void => {
      const sourceVideo = Array.from(stage.querySelectorAll<HTMLVideoElement>("video"))
        .find((video) => video !== mirror && (video.currentSrc || video.src) &&
          Number(getComputedStyle(video).opacity) > 0.5);
      // Der Decoder-Ersatz gehört in denselben Hintergrund-Layer wie das
      // Original. Als Geschwister der gesamten Bühne würde er Spektrum,
      // Lyrics und Titel verdecken.
      if (sourceVideo?.parentElement && mirror.parentElement !== sourceVideo.parentElement)
        sourceVideo.parentElement.append(mirror);
      const mirrorSource = sourceVideo?.currentSrc || sourceVideo?.src || "";
      if (mirror.src !== mirrorSource) {
        mirror.hidden = true;
        mirror.src = mirrorSource;
        mirror.style.objectFit = sourceVideo ? getComputedStyle(sourceVideo).objectFit : "cover";
        if (mirrorSource) mirror.load();
      }
      if (sourceVideo && mirror.readyState >= 1 && Math.abs(mirror.currentTime - sourceVideo.currentTime) > 2) {
        try { mirror.currentTime = sourceVideo.currentTime; } catch { /* Decoder lädt noch. */ }
      }
      if (mirrorSource && Spicetify.Player.isPlaying()) void mirror.play().catch(() => { mirror.hidden = true; });
      else mirror.pause();
      const current = currentTrack();
      title.textContent = current?.title || "Kein Titel";
      artist.textContent = current?.artist || "";
      const duration = Math.max(0, Spicetify.Player.getDuration() || 0);
      const progress = Math.max(0, Spicetify.Player.getProgress() || 0);
      seek.max = String(Math.max(1, duration));
      seek.value = String(Math.min(progress, Math.max(1, duration)));
      seek.disabled = !current || duration <= 0;
      elapsed.textContent = formatPlayerTime(progress);
      total.textContent = formatPlayerTime(duration);
      const artwork = spotifyArtworkUrl(Spicetify.Player?.data?.item?.metadata?.image_large_url);
      cover.src = artwork || "";
      cover.hidden = !artwork;
      const canvas = current && typeof document.querySelectorAll === "function"
        ? inspectNativeCanvas(document, current.title, current.artist) : null;
      const source = canvas?.kind === "ready" ? canvas.source.src : "";
      if (clip.src !== source) { clip.hidden = true; clip.src = source; }
      if (!source || media.hidden || !Spicetify.Player.isPlaying()) clip.pause();
      const playing = Spicetify.Player.isPlaying();
      toggle.textContent = playing ? "Ⅱ" : "▶";
      toggle.title = playing ? "Pausieren" : "Wiedergeben";
      toggle.setAttribute("aria-label", toggle.title);
      const shuffled = Spicetify.Player.getShuffle?.() ?? false;
      const repeatMode = Spicetify.Player.getRepeat?.() ?? 0;
      shuffle.classList.toggle("active", shuffled);
      shuffle.setAttribute("aria-pressed", String(shuffled));
      repeat.classList.toggle("active", repeatMode > 0);
      repeat.textContent = repeatMode === 2 ? "↻¹" : "↻";
      repeat.title = repeatMode === 2 ? "Einen Titel wiederholen" : repeatMode === 1 ? "Alle wiederholen" : "Wiederholen aus";
      repeat.setAttribute("aria-label", repeat.title);
      repeat.setAttribute("aria-pressed", String(repeatMode > 0));
    };
    const refreshTimer = next.setInterval(refresh, 1000);
    const restore = (): void => {
      next?.clearInterval(refreshTimer);
      next?.removeEventListener("message", relayWallpaperMessage);
      Spicetify.Player.removeEventListener("songchange", refresh);
      Spicetify.Player.removeEventListener("onplaypause", refresh);
      if (mirror.parentNode && mirror.parentNode !== scene) scene.append(mirror);
      if (stage.parentNode === scene) {
        originalParent.insertBefore(stage, following?.parentNode === originalParent ? following : null);
        window.dispatchEvent(new Event(VISUALIZER_HOST_CHANGED_EVENT));
      }
      if (restorePopup === restore) restorePopup = null;
      if (popup === next) { popup = null; openedAutomatically = false; }
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
    openedAutomatically = false;
    return false;
  }
  finally { opening = false; }
}

export function closeVisualizerMiniWindow(): void {
  const current = popup;
  restorePopup?.();
  if (current && !current.closed) current.close();
  openedAutomatically = false;
}

export function closeAutomaticVisualizerMiniWindow(): void {
  if (openedAutomatically) closeVisualizerMiniWindow();
}
