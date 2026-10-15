// =============================================================================
// Datei: src/extension/modules/mini-player/MiniPlayerModule.ts
// Zweck: Optionales, frei verschiebbares Mini-Fenster innerhalb von Spotify.
// =============================================================================
import { currentTrack } from "../../../shared/library";
import type { ExtensionModule } from "../ExtensionModule";

let panel: HTMLDivElement | null = null;
let menuItem: Spicetify.Menu.Item | null = null;
let visible = false;

/** Player-Daten nur als textContent verwenden, nie als unsicheres HTML. */
function refresh(): void {
  if (!panel) return;
  const track = currentTrack();
  const label = panel.querySelector<HTMLElement>("[data-zukato-mini-track]");
  const toggle = panel.querySelector<HTMLButtonElement>("[data-zukato-mini-toggle]");
  if (label) label.textContent = track ? `${track.title} — ${track.artist}` : "Kein Titel";
  if (toggle) toggle.textContent = Spicetify.Player.isPlaying() ? "⏸" : "▶";
}

/** DOM bewusst mit createElement aufbauen, um Spicetify und CSP zu respektieren. */
function createPanel(): HTMLDivElement {
  const root = document.createElement("div");
  root.id = "zukato-mini-player";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "ZuKaTo Mini-Player");
  Object.assign(root.style, {
    position: "fixed", right: "20px", bottom: "112px", zIndex: "10000", width: "260px",
    padding: "12px", borderRadius: "14px", border: "1px solid #565656",
    color: "#fff", background: "#222", boxShadow: "0 8px 26px #0008",
  });
  const title = document.createElement("div");
  title.textContent = "☰ ZuKaTo Mini-Player";
  Object.assign(title.style, { cursor: "move", fontWeight: "bold", marginBottom: "10px" });
  const track = document.createElement("div");
  track.dataset.zukatoMiniTrack = "";
  Object.assign(track.style, { fontSize: "12px", marginBottom: "10px", overflowWrap: "anywhere" });
  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", justifyContent: "space-around" });
  const commands = [
    ["⏮", () => Spicetify.Player.back()],
    ["▶", () => Spicetify.Player.togglePlay()],
    ["⏭", () => Spicetify.Player.next()],
    ["✕", () => setVisible(false)],
  ] as const;
  for (const [caption, click] of commands) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = caption;
    button.setAttribute("aria-label", caption === "✕" ? "Mini-Player ausblenden" : caption);
    if (caption === "▶") button.dataset.zukatoMiniToggle = "";
    Object.assign(button.style, { padding: "6px 10px", borderRadius: "8px", border: "0", color: "#fff", background: "#383838", cursor: "pointer" });
    button.addEventListener("click", click);
    actions.append(button);
  }
  root.append(title, track, actions);
  // Pointer Capture erlaubt Verschieben ohne globale, zurückbleibende Listener.
  let dragX = 0; let dragY = 0;
  title.addEventListener("pointerdown", (event) => {
    dragX = event.clientX - root.getBoundingClientRect().left;
    dragY = event.clientY - root.getBoundingClientRect().top;
    title.setPointerCapture(event.pointerId);
  });
  title.addEventListener("pointermove", (event) => {
    if (!title.hasPointerCapture(event.pointerId)) return;
    root.style.left = `${Math.max(0, event.clientX - dragX)}px`;
    root.style.top = `${Math.max(0, event.clientY - dragY)}px`;
    root.style.right = "auto"; root.style.bottom = "auto";
  });
  return root;
}

/** Benutzer bestimmt die Sichtbarkeit über das Spotify-Profilmenü. */
function setVisible(next: boolean): void {
  visible = next;
  if (next && !panel) { panel = createPanel(); document.body.append(panel); refresh(); }
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
  },
  stop(): void {
    Spicetify.Player.removeEventListener("songchange", refresh);
    Spicetify.Player.removeEventListener("onplaypause", refresh);
    menuItem?.deregister(); menuItem = null;
    setVisible(false);
  },
};
