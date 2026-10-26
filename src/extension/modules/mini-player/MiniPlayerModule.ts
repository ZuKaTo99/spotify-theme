// =============================================================================
// Datei: src/extension/modules/mini-player/MiniPlayerModule.ts
// Zweck: Optionaler Mini-Player im Spotify-Fenster oder als eigenes PiP-Fenster.
// =============================================================================
import { currentTrack } from "../../../shared/library";
import { clampMiniPlayerPosition } from "./mini-player-position";
import type { ExtensionModule } from "../ExtensionModule";

let panel: HTMLDivElement | null = null;
let menuItem: Spicetify.Menu.Item | null = null;
let visible = false;
let miniWindow: Window | null = null;
let miniWindowPanel: HTMLDivElement | null = null;
let started = false;

interface DocumentPictureInPictureHost extends Window {
  documentPictureInPicture?: {
    requestWindow(options: { width: number; height: number }): Promise<Window>;
  };
}

/**
 * Ein verschobener Mini-Player darf auch nach Verkleinern des Spotify-Fensters
 * nicht außerhalb des sichtbaren Bereichs hängen bleiben.
 */
function keepPanelOnScreen(): void {
  if (!panel || !panel.isConnected) return;
  const bounds = panel.getBoundingClientRect();
  const position = clampMiniPlayerPosition(
    bounds.left, bounds.top, bounds.width, bounds.height,
    window.innerWidth, window.innerHeight,
  );
  panel.style.left = `${position.left}px`;
  panel.style.top = `${position.top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}


/**
 * Die Mini-Player-Icons werden als echte SVG-Elemente erzeugt.
 * Keine Emoji-Schrift: Windows, Linux und macOS zeigen dieselben Konturen.
 * DOM-APIs statt innerHTML vermeiden HTML-/Script-Injektion.
 */
type MiniIcon = "previous" | "play" | "pause" | "next" | "close";
function createMiniIcon(kind: MiniIcon): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "21");
  svg.setAttribute("height", "21");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const paths: Record<MiniIcon, string[]> = {
    previous: ["M5.5 5v14", "m18 6-11 6 11 6V6Z"],
    play: ["m8 5 11 7-11 7V5Z"],
    pause: ["M8.5 5v14", "M15.5 5v14"],
    next: ["M18.5 5v14", "m5 6 11 6-11 6V6Z"],
    close: ["M6 6l12 12", "M18 6 6 18"],
  };
  for (const d of paths[kind]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    if (kind === "play" || kind === "previous" || kind === "next") {
      // Dreiecke werden gefüllt statt als dünner Strich gezeichnet.
      if (d.endsWith("Z")) { path.setAttribute("fill", "currentColor"); path.setAttribute("stroke", "none"); }
    }
    svg.append(path);
  }
  return svg;
}

/** Player-Daten nur als textContent verwenden, nie als unsicheres HTML. */
function refreshPanel(target: HTMLDivElement | null): void {
  if (!target) return;
  const track = currentTrack();
  const label = target.querySelector<HTMLElement>("[data-zukato-mini-track]");
  const toggle = target.querySelector<HTMLButtonElement>("[data-zukato-mini-toggle]");
  if (label) label.textContent = track ? `${track.title} — ${track.artist}` : "Kein Titel";
  if (toggle) {
    const playing = Spicetify.Player.isPlaying();
    toggle.replaceChildren(createMiniIcon(playing ? "pause" : "play"));
    toggle.setAttribute("aria-label", playing ? "Pausieren" : "Wiedergeben");
    toggle.title = playing ? "Pausieren" : "Wiedergeben";
  }
}

function refresh(): void {
  refreshPanel(panel);
  refreshPanel(miniWindowPanel);
}

/** Ein separates Fenster ist nur nach einem direkten Klick und bei API-Support möglich. */
async function openMiniWindow(): Promise<void> {
  const api = (window as DocumentPictureInPictureHost).documentPictureInPicture;
  if (!api) return;
  try {
    // Vor dem ersten await aufrufen: Chromium verlangt eine Nutzeraktion.
    const popup = await api.requestWindow({ width: 320, height: 190 });
    if (!started) { popup.close(); return; }
    closeMiniWindow();
    miniWindow = popup;
    popup.document.body.style.margin = "0";
    popup.document.body.style.background = "#222";
    miniWindowPanel = createPanel(true);
    popup.document.body.append(miniWindowPanel);
    popup.addEventListener("pagehide", () => {
      if (miniWindow !== popup) return;
      miniWindow = null;
      miniWindowPanel = null;
      if (started) setVisible(true);
    }, { once: true });
    setVisible(false);
    refresh();
  } catch {
    const status = panel?.querySelector<HTMLElement>("[data-zukato-mini-status]");
    if (status) status.textContent = "Mini-Fenster konnte hier nicht geöffnet werden.";
  }
}

function closeMiniWindow(): void {
  const popup = miniWindow;
  miniWindow = null;
  miniWindowPanel?.remove();
  miniWindowPanel = null;
  popup?.close();
  menuItem?.setState(visible);
}

/** DOM bewusst mit createElement aufbauen, um Spicetify und CSP zu respektieren. */
function createPanel(external = false): HTMLDivElement {
  const root = document.createElement("div");
  root.id = "zukato-mini-player";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "ZuKaTo Mini-Player");
  Object.assign(root.style, {
    position: "fixed", right: "20px", bottom: "112px", zIndex: "10000",
    width: "min(260px, calc(100vw - 16px))", boxSizing: "border-box",
    padding: "12px", borderRadius: "14px", border: "1px solid #565656",
    color: "#fff", background: "#222", boxShadow: "0 8px 26px #0008",
  });
  if (external) Object.assign(root.style, {
    position: "relative", inset: "auto", width: "100%", height: "100%",
    border: "0", borderRadius: "0", boxShadow: "none",
  });
  const title = document.createElement("div");
  title.textContent = external ? "ZuKaTo Mini-Player" : "☰ ZuKaTo Mini-Player";
  Object.assign(title.style, {
    cursor: external ? "default" : "move", fontWeight: "bold", marginBottom: "10px",
    userSelect: "none", touchAction: "none",
  });
  const track = document.createElement("div");
  track.dataset.zukatoMiniTrack = "";
  Object.assign(track.style, { fontSize: "12px", marginBottom: "10px", overflowWrap: "anywhere" });
  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", justifyContent: "space-around" });
  // Einheitliche Control-Flächen mit sprechenden ARIA-Namen.
  const commands = [
    { icon: "previous", label: "Vorheriger Titel", click: () => Spicetify.Player.back() },
    { icon: "play", label: "Wiedergeben", click: () => Spicetify.Player.togglePlay() },
    { icon: "next", label: "Nächster Titel", click: () => Spicetify.Player.next() },
    { icon: "close", label: "Mini-Player ausblenden", click: () => external ? closeMiniWindow() : setVisible(false) },
  ] as const;
  for (const command of commands) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", command.label);
    button.title = command.label;
    button.append(createMiniIcon(command.icon));
    if (command.icon === "play") button.dataset.zukatoMiniToggle = "";
    Object.assign(button.style, {
      display: "grid", placeItems: "center", padding: "0", width: "42px", height: "42px",
      borderRadius: "50%", border: "1px solid #496384", color: "#dfefff",
      background: command.icon === "play" ? "linear-gradient(135deg,#236a9e,#6a44ac)" : "#182338",
      cursor: "pointer",
    });
    button.addEventListener("click", command.click);
    actions.append(button);
  }
  root.append(title, track, actions);
  if (!external) {
    const popout = document.createElement("button");
    popout.type = "button";
    popout.textContent = "Als Mini-Fenster öffnen";
    const supported = Boolean((window as DocumentPictureInPictureHost).documentPictureInPicture);
    popout.disabled = !supported;
    popout.title = supported ? "Bleibt beim Minimieren von Spotify sichtbar"
      : "Die Spotify-Webview unterstützt kein separates Mini-Fenster";
    Object.assign(popout.style, { width: "100%", marginTop: "10px", padding: "7px",
      borderRadius: "8px", border: "1px solid #496384", color: "#dfefff",
      background: "#182338", cursor: supported ? "pointer" : "not-allowed" });
    popout.addEventListener("click", () => void openMiniWindow());
    const status = document.createElement("div");
    status.dataset.zukatoMiniStatus = "";
    status.setAttribute("role", "status");
    Object.assign(status.style, { fontSize: "11px", marginTop: "6px", color: "#cbd6e7" });
    if (!supported) status.textContent = "Eigenes Fenster nicht verfügbar. Spotify MiniPlayer: unten rechts neben der Lautstärke.";
    root.append(popout, status);
  }
  // Pointer Capture erlaubt Verschieben ohne globale, zurückbleibende Listener.
  if (external) return root;
  let dragX = 0; let dragY = 0;
  title.addEventListener("pointerdown", (event) => {
    // Nur die primäre Taste darf einen Drag starten (kein Rechtsklick).
    if (event.button !== 0 || !event.isPrimary) return;
    dragX = event.clientX - root.getBoundingClientRect().left;
    dragY = event.clientY - root.getBoundingClientRect().top;
    title.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  title.addEventListener("pointermove", (event) => {
    if (!title.hasPointerCapture(event.pointerId)) return;
    // Auch die rechte und untere Bildschirmkante begrenzen.
    const position = clampMiniPlayerPosition(
      event.clientX - dragX, event.clientY - dragY,
      root.getBoundingClientRect().width, root.getBoundingClientRect().height,
      window.innerWidth, window.innerHeight,
    );
    root.style.left = `${position.left}px`;
    root.style.top = `${position.top}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
  });
  return root;
}

/** Benutzer bestimmt die Sichtbarkeit über das Spotify-Profilmenü. */
function setVisible(next: boolean): void {
  visible = next;
  if (next && (!panel || !panel.isConnected)) {
    // Spotify kann Teile des DOM neu aufbauen: ein abgetrenntes Panel
    // wird beim erneuten Öffnen vollständig neu erstellt.
    panel?.remove();
    panel = createPanel();
    document.body.append(panel);
    keepPanelOnScreen();
    refresh();
  }
  if (!next) { panel?.remove(); panel = null; }
  menuItem?.setState(next || Boolean(miniWindow));
}

export const miniPlayerModule: ExtensionModule = {
  id: "mini-player",
  start(): void {
    started = true;
    menuItem = new Spicetify.Menu.Item("ZuKaTo Mini-Player", false, () => {
      if (miniWindow) closeMiniWindow();
      else setVisible(!visible);
    });
    menuItem.register();
    Spicetify.Player.addEventListener("songchange", refresh);
    Spicetify.Player.addEventListener("onplaypause", refresh);
    window.addEventListener("resize", keepPanelOnScreen);
  },
  stop(): void {
    started = false;
    Spicetify.Player.removeEventListener("songchange", refresh);
    Spicetify.Player.removeEventListener("onplaypause", refresh);
    window.removeEventListener("resize", keepPanelOnScreen);
    menuItem?.deregister(); menuItem = null;
    closeMiniWindow();
    setVisible(false);
  },
};
