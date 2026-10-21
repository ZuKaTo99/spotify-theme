// =============================================================================
// Datei: src/custom-app/components/BulkTrackActions.tsx
// Zweck: Mehrfachaktionen für Favoriten und Hörverlauf (ohne neue Datenbank).
// Die Auswahl gilt auch über Seiten hinweg. Nur ausdrücklich markierte Titel
// werden an Spotify übertragen oder im lokalen Speicher verändert.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../shared/i18n";
import type { TrackInfo } from "../../shared/library";
import { addFavoritesBatch, removeFavoritesBatch } from "../../shared/library";
import { extendTrackSelection, resolveSelectedTracks } from "../../shared/bulk-selection";
import { QueueBatchError, enqueueQueueBatches } from "../../shared/queue-batches";
import { PlaylistDestination } from "./PlaylistDestination";

const ReactRuntime = Spicetify.React as typeof import("react");

interface Props {
  t: Translator;
  /** Ganze Sammlung; damit Auswahl nach Löschen und neuen Daten nie veraltet ist. */
  sourceTracks: readonly TrackInfo[];
  /** Alle Treffer des lokalen Filters, auch außerhalb der aktuellen Seite. */
  filteredTracks: readonly TrackInfo[];
  /** Nur die momentan dargestellte Seite. */
  pageTracks: readonly TrackInfo[];
  selectedUris: ReadonlySet<string>;
  onSelectionChange: (selected: Set<string>) => void;
  mode: "favorites" | "history";
}

/** Auswahl, Versand und Bestätigung sind bewusst in EINER gemeinsamen UI.
 * Keine automatische Wiederholung fehlgeschlagener Queue-Blöcke: Diese könnten
 * bei Spotify trotz abgelehnter Antwort teilweise angekommen sein. */
export function BulkTrackActions({
  t, sourceTracks, filteredTracks, pageTracks, selectedUris, onSelectionChange, mode,
}: Props): ReactElement {
  const [busy, setBusy] = ReactRuntime.useState(false);
  const [feedback, setFeedback] = ReactRuntime.useState("");
  const busyRef = ReactRuntime.useRef(false);
  const mountedRef = ReactRuntime.useRef(true);
  ReactRuntime.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const selected = resolveSelectedTracks(sourceTracks, selectedUris);
  const count = selected.length;

  function choose(tracks: readonly TrackInfo[]): void {
    if (busyRef.current) return;
    onSelectionChange(extendTrackSelection(selectedUris, tracks));
    setFeedback("");
  }

  /** Der Ref sperrt bereits im Eventhandler – vor einem möglichen React-Render. */
  async function run(action: "queue" | "save" | "remove"): Promise<void> {
    if (busyRef.current || !count) return;
    if (action === "remove" && !window.confirm(t("bulk.confirmRemove", { count }))) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback("");
    try {
      if (action === "queue") {
        const result = await enqueueQueueBatches(
          selected.map((track) => track.uri),
          (uris) => Spicetify.addToQueue(uris.map((uri) => ({ uri }))),
        );
        if (mountedRef.current) setFeedback(t("bulk.queued", { count: result.queued }) +
          (result.skipped ? ` ${t("bulk.skipped", { count: result.skipped })}` : ""));
      } else if (action === "save") {
        const result = addFavoritesBatch(selected);
        if (mountedRef.current) setFeedback(t("bulk.saved", { added: result.added, skipped: result.skipped }));
      } else {
        const removed = removeFavoritesBatch(selected.map((track) => track.uri));
        if (mountedRef.current) {
          onSelectionChange(new Set());
          setFeedback(t("bulk.removed", { count: removed }));
        }
      }
    } catch (error) {
      console.error("[ZuKaTo] Sammelaktion fehlgeschlagen", error);
      if (mountedRef.current) {
        setFeedback(error instanceof QueueBatchError && error.queued > 0
          ? t("bulk.partial", { count: error.queued, total: error.totalValid })
          : t("bulk.failed"));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  return <div className="zukato-bulk" aria-label={t("bulk.selected", { count })}>
    <div className="zukato-bulk__controls">
      <strong aria-live="polite">{t("bulk.selected", { count })}</strong>
      <button type="button" disabled={busy || !pageTracks.length}
        onClick={() => choose(pageTracks)}>{t("bulk.selectPage")}</button>
      <button type="button" disabled={busy || !filteredTracks.length}
        onClick={() => choose(filteredTracks)}>{t("bulk.selectResults")}</button>
      <button type="button" disabled={busy || !selectedUris.size}
        onClick={() => { onSelectionChange(new Set()); setFeedback(""); }}>
        {t("bulk.clearSelection")}
      </button>
    </div>
    <div className="zukato-bulk__controls">
      <button type="button" disabled={busy || !count}
        onClick={() => { void run("queue"); }}>{t("bulk.queue")}</button>
      {mode === "favorites"
        ? <button type="button" className="zukato-bulk__destructive" disabled={busy || !count}
            onClick={() => { void run("remove"); }}>{t("bulk.remove")}</button>
        : <button type="button" disabled={busy || !count}
            onClick={() => { void run("save"); }}>{t("bulk.save")}</button>}
    </div>
    {/* Gleiche Ziel-Playlist-Komponente für Favoriten UND Hörverlauf. */}
    {count > 0 && <PlaylistDestination t={t} uris={selected.map((track) => track.uri)} disabled={busy} />}
    {feedback && <p className="zukato-bulk__feedback" role="status">{feedback}</p>}
  </div>;
}
