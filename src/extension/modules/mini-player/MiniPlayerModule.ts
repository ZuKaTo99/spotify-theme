// =============================================================================
// Datei: src/extension/modules/mini-player/MiniPlayerModule.ts
// Zweck: Optionales, frei verschiebbares Mini-Fenster innerhalb von Spotify.
// =============================================================================
import { currentTrack } from "../../../shared/library";
import { clampMiniPlayerPosition } from "./mini-player-position";
import type { ExtensionModule } from "../ExtensionModule";

let panel: HTMLDivElement | null = null;
let menuItem: Spicetify.Menu.Item | null = null;
let visible = false;

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
function refresh(): void {
  if (!panel) return;
  const track = currentTrack();
  const label = panel.querySelector<HTMLElement>("[data-zukato-mini-track]");
  const toggle = panel.querySelector<HTMLButtonElement>("[data-zukato-mini-toggle]");
  if (label) label.textContent = track ? `${track.title} — ${track.artist}` : "Kein Titel";
  if (toggle) {
    const playing = Spicetify.Player.isPlaying();
    toggle.replaceChildren(createMiniIcon(playing ? "pause" : "play"));
    toggle.setAttribute("aria-label", playing ? "Pausieren" : "Wiedergeben");
    toggle.title = playing ? "Pausieren" : "Wiedergeben";
  }
}

/** DOM bewusst mit createElement aufbauen, um Spicetify und CSP zu respektieren. */
function createPanel(): HTMLDivElement {
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
  const title = document.createElement("div");
  title.textContent = "☰ ZuKaTo Mini-Player";
  Object.assign(title.style, {
    cursor: "move", fontWeight: "bold", marginBottom: "10px",
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
    { icon: "close", label: "Mini-Player ausblenden", click: () => setVisible(false) },
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
  // Pointer Capture erlaubt Verschieben ohne globale, zurückbleibende Listener.
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
  menuItem?.setState(next);
}

export const miniPlayerModule: ExtensionModule = {
  id: "mini-player",
  start(): void {
    menuItem = new Spicetify.Menu.Item("ZuKaTo Mini-Player", false, () => setVisible(!visible));
    menuItem.register();
    Spicetify.Player.addEventListener("songchange", refresh);
    Spicetify.Player.addEventListener("onplaypause", refresh);
    window.addEventListener("resize", keepPanelOnScreen);
  },
  stop(): void {
    Spicetify.Player.removeEventListener("songchange", refresh);
    Spicetify.Player.removeEventListener("onplaypause", refresh);
    window.removeEventListener("resize", keepPanelOnScreen);
    menuItem?.deregister(); menuItem = null;
    setVisible(false);
  },
};
