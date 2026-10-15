// =============================================================================
// Datei: src/custom-app/components/QuickTrackPanel.tsx
// Zweck: EIN zentraler Einstieg zum Finden, Merken und Einreihen von Titeln.
// Wo ändern? Suchfeld/Resultate: TrackSearch.tsx, Spotify-API: track-search.ts.
// Datenschutzhinweis: kein externer Server und keine neuen Zugangstoken.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../shared/i18n";
import { addFavorite, currentTrack, type TrackInfo } from "../../shared/library";
import { TrackSearch } from "./TrackSearch";

const ReactRuntime = Spicetify.React as typeof import("react");
interface Props { t: Translator; onClose: () => void }

/** Spotify-Warteschlange ist eine bewusst vom Nutzer ausgelöste Aktion. */
async function queueTrack(track: TrackInfo): Promise<void> {
  await Spicetify.addToQueue([{ uri: track.uri }]);
}

export function QuickTrackPanel({ t, onClose }: Props): ReactElement {
  const container = ReactRuntime.useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = ReactRuntime.useState("");
  const [working, setWorking] = ReactRuntime.useState(false);
  const [nowPlaying, setNowPlaying] = ReactRuntime.useState<TrackInfo | null>(currentTrack);

  // Autofokus sowie ESC und Fokus-Einfassung verhindern, dass sich eine
  // Tastatureingabe versehentlich im Spotify-Hauptfenster fortsetzt.
  ReactRuntime.useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    container.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const nodes = Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
      if (!nodes.length) return;
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, [onClose]);

  async function act(track: TrackInfo, action: "favorite" | "queue"): Promise<void> {
    setWorking(true);
    try {
      if (action === "favorite") {
        setFeedback(addFavorite(track) ? t("quick.saved") : t("quick.alreadySaved"));
      } else { await queueTrack(track); setFeedback(t("quick.queued")); }
    } catch (error) {
      console.error("[ZuKaTo] Schnellaktion fehlgeschlagen", error);
      setFeedback(t("quick.failed"));
    } finally { setWorking(false); }
  }

  return <div className="zukato-quick__scrim" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div className="zukato-quick" ref={container} role="dialog" aria-modal="true" aria-labelledby="zukato-quick-title">
      <div className="zukato-quick__heading">
        <div><p className="zukato-eyebrow">ZUKATO</p><h2 id="zukato-quick-title">{t("quick.title")}</h2>
          <p>{t("quick.help")}</p></div>
        <button type="button" aria-label={t("quick.close")} onClick={onClose}>✕</button>
      </div>
      <TrackSearch t={t} actionLabel={t("quick.save")} onChoose={(track) => act(track, "favorite")}
        actions={[{ label: t("quick.save"), onChoose: (track) => act(track, "favorite") },
          { label: t("quick.queue"), onChoose: (track) => act(track, "queue") }]} />
      {nowPlaying && <div className="zukato-quick__current">
        <div><small>{t("quick.current")}</small><strong>{nowPlaying.title}</strong><span>{nowPlaying.artist}</span></div>
        <button type="button" disabled={working} onClick={() => { void act(nowPlaying, "favorite"); }}>{t("quick.save")}</button>
        <button type="button" disabled={working} onClick={() => { void act(nowPlaying, "queue"); }}>{t("quick.queue")}</button>
      </div>}
      {feedback && <p className="zukato-quick__feedback" role="status">{feedback}</p>}
    </div>
  </div>;
}
