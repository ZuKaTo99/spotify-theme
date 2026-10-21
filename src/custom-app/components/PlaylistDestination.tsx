// =============================================================================
// Datei: src/custom-app/components/PlaylistDestination.tsx
// Zweck: Wiederverwendbarer Export ausgewählter Titel in eine Spotify-Playlist.
// Einfügen: Favoriten, Hörverlauf und Playlist-Werkzeuge. Kein Auto-Senden.
// Die Spotify-Cosmos-API kann je nach Account/Berechtigungen 403 zurückgeben.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../shared/i18n";
import {
  addItemsToSpotifyPlaylist, parseSpotifyPlaylistInput, PlaylistTransferError,
} from "../../shared/spotify-playlist-transfer";

const ReactRuntime = Spicetify.React as typeof import("react");

interface Props {
  t: Translator;
  /** Ausschließlich explizit ausgewählte Titel; keine automatische Übernahme. */
  uris: readonly string[];
  disabled?: boolean;
}

export function PlaylistDestination({ t, uris, disabled = false }: Props): ReactElement {
  const [destination, setDestination] = ReactRuntime.useState("");
  const [busy, setBusy] = ReactRuntime.useState(false);
  const [message, setMessage] = ReactRuntime.useState("");
  const inFlight = ReactRuntime.useRef(false);
  const mounted = ReactRuntime.useRef(true);
  ReactRuntime.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const parsed = parseSpotifyPlaylistInput(destination);
  const canSend = !disabled && !busy && Boolean(parsed) && uris.length > 0;

  async function transfer(): Promise<void> {
    // Der synchrone Ref sperrt Doppelklicks, bevor React neu gerendert hat.
    if (inFlight.current || !canSend || !parsed) return;
    if (!window.confirm(t("playlistTransfer.confirm", { count: uris.length }))) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await addItemsToSpotifyPlaylist(parsed, uris, (url, body) =>
        Spicetify.CosmosAsync.post(url, body));
      if (mounted.current) setMessage(t("playlistTransfer.success", { count: result.added }) +
        (result.skipped ? ` ${t("playlistTransfer.skipped", { count: result.skipped })}` : ""));
    } catch (error) {
      console.error("[ZuKaTo] Spotify-Playlist konnte nicht aktualisiert werden", error);
      if (mounted.current) setMessage(error instanceof PlaylistTransferError && error.added > 0
        ? t("playlistTransfer.partial", { count: error.added, total: error.totalValid })
        : t("playlistTransfer.failed"));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <div className="zukato-playlist-destination">
    <label htmlFor="zukato-playlist-destination">{t("playlistTransfer.destination")}</label>
    <div className="zukato-playlist-destination__row">
      <input id="zukato-playlist-destination" type="text" value={destination}
        placeholder="https://open.spotify.com/playlist/…" maxLength={320}
        aria-invalid={destination.trim() ? !parsed : undefined}
        disabled={busy || disabled}
        onChange={(event) => { setDestination(event.currentTarget.value); setMessage(""); }} />
      <button type="button" disabled={!canSend} onClick={() => { void transfer(); }}>
        {busy ? t("playlistTransfer.working") : t("playlistTransfer.add", { count: uris.length })}
      </button>
    </div>
    {destination.trim() && !parsed && <small className="zukato-error">{t("playlistTransfer.invalid")}</small>}
    <small>{t("playlistTransfer.hint")}</small>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </div>;
}
