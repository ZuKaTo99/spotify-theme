// Die laufende Visualizer-Bühne wird in ein frei verschiebbares Desktop-Fenster
// versetzt. Beim Schließen kehrt genau dasselbe DOM-Element zurück.
import { currentTrack } from "../../../shared/library";
import { spotifyArtworkUrl } from "../../../shared/artwork";
import { formatPlayerTime } from "../../../shared/player-progress";
import { inspectNativeCanvas } from "./spotify-canvas";

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
    // Der Aufruf bleibt vor dem ersten await innerhalb des Click-Handlers.
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
      .zukato-mini-window .zukato-viz{flex:1;min-height:0;width:100%;overflow:hidden;position:relative}
      .zukato-mini-window .zukato-viz__stage{position:absolute;inset:0;width:100%;height:100%;min-height:0;aspect-ratio:auto;border:0;border-radius:0}
      .zukato-mini-window__mirror{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:7;background:#080d17}
      .zukato-mini-window .zukato-viz__stage-controls,.zukato-mini-window .zukato-viz__mini-actions{display:none!important}
      .zukato-mini-window [hidden]{display:none!important}
      .zukato-mini-window__media{flex:1;min-height:0;position:relative;display:grid;place-items:center;background:#292b32}
      .zukato-mini-window__media img,.zukato-mini-window__media video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
      .zukato-mini-window__media video{background:#111}
      .zukato-mini-window__bar{flex:none;display:grid;gap:5px;padding:6px 9px;background:#111a2a;box-sizing:border-box}
      .zukato-mini-window__track{flex:1;min-width:0;display:grid;gap:2px}
      .zukato-mini-window__track strong,.zukato-mini-window__track small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .zukato-mini-window__track small{color:#aab9cb}
      .zukato-mini-window__seek{display:flex;align-items:center;gap:7px;color:#aab9cb;font:11px Arial,sans-serif;font-variant-numeric:tabular-nums}
      .zukato-mini-window__seek span{min-width:29px;text-align:center}
      .zukato-mini-window__seek input[type=range]{flex:1;min-width:50px;width:100%;height:16px;padding:0;border:0;background:transparent;accent-color:#50aefa;cursor:pointer}
      .zukato-mini-window__buttons{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:5px;min-width:0}
      .zukato-mini-window__bar button{width:35px;height:34px;flex:none;padding:0;border:1px solid #526882;border-radius:8px;background:#25344b;color:#fff;cursor:pointer;font:17px Arial,sans-serif}
      .zukato-mini-window__bar button.primary{background:#348ed1;border-color:#62b8f2;color:#071a2a}
      .zukato-mini-window__bar button.active{color:#72c7ff;border-color:#72c7ff}
      .zukato-mini-window__bar button.switch{width:82px;padding:0 4px;font-size:11px}
      .zukato-mini-window__bar button.return{width:72px;padding:0 4px;font-size:11px}
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
    const scene = doc.createElement("section"); scene.className = "zukato-viz zukato-viz--mini";
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
    shell.append(scene, media, bar);
    doc.body.append(shell);
    // Beim Wechsel in ein anderes Document verwirft Chromium den geladenen
    // Inhalt eines sandboxed srcdoc-Frames. Ein explizites Reload löst dessen
    // vorhandenen React-onLoad-Handler und Projekt-Initialisierung erneut aus.
    for (const frame of stage.querySelectorAll<HTMLIFrameElement>('iframe[srcdoc]')) {
      frame.srcdoc = frame.srcdoc;
    }

    const refresh = (): void => {
      const sourceVideo = Array.from(stage.querySelectorAll<HTMLVideoElement>("video"))
        .find((video) => (video.currentSrc || video.src) && Number(getComputedStyle(video).opacity) > 0.5);
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
    const refreshTimer = window.setInterval(refresh, 1000);
    const restore = (): void => {
      window.clearInterval(refreshTimer);
      next?.removeEventListener("message", relayWallpaperMessage);
      Spicetify.Player.removeEventListener("songchange", refresh);
      Spicetify.Player.removeEventListener("onplaypause", refresh);
      if (stage.parentNode === scene) {
        originalParent.insertBefore(stage, following?.parentNode === originalParent ? following : null);
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
