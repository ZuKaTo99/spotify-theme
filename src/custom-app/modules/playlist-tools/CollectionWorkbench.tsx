// =============================================================================
// Datei: src/custom-app/modules/playlist-tools/CollectionWorkbench.tsx
// Zweck: Favoriten und Hörverlauf in benannten, lokalen Sammlungen organisieren.
// Wo ändern? Speicherregeln in NamedCollections.ts, Spotify-Versand in den
// vorhandenen queue-batches- und spotify-playlist-transfer-Modulen.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import type { TrackInfo } from "../../../shared/library";
import { collectionPage, filterCollection } from "../../../shared/collection-view";
import { QueueBatchError, enqueueQueueBatches } from "../../../shared/queue-batches";
import { addItemsToSpotifyPlaylist, createSpotifyPlaylist, PlaylistExportReviewError } from "../../../shared/spotify-playlist-transfer";
import { useToolkitData } from "../../hooks/useToolkitData";
import { PlaylistDestination } from "../../components/PlaylistDestination";
import {
  CollectionConflictError, NAMED_COLLECTIONS_STORAGE_KEY, NamedCollectionsStore,
  type CollectionsDocument, type PlaylistExportPlan,
} from "../../../extension/modules/playlist-tools/named-collections/NamedCollections";
import {
  mountNamedCollectionsPanel, type NamedCollectionsPanelController,
} from "../../../extension/modules/playlist-tools/named-collections/NamedCollectionsPanel";

const ReactRuntime = Spicetify.React as typeof import("react");
type Source = "favorites" | "history" | "both";

/** Doppelte Hördurchgänge sind für die Quellliste nur ein auswählbarer Song. */
function uniqueTracks(tracks: readonly TrackInfo[]): TrackInfo[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (!/^spotify:track:[A-Za-z0-9]{22}$/.test(track.uri) || seen.has(track.uri)) return false;
    seen.add(track.uri);
    return true;
  });
}

/** Ein bereits bestätigter Spotify-Request wird bei unklarer API-Antwort nie wiederholt. */
const EXPORT_GUARD_KEY = "zukato:collections:export-guard:v1";

/** Ein Exportauftrag ist an Sammlung, Namen und Songreihenfolge gebunden. */
function exportGuardId(plan: PlaylistExportPlan): string {
  return `${plan.collectionId}:${JSON.stringify([plan.name, plan.trackUris])}`;
}

/** Beschädigte Wächterdaten niemals durch einen leeren Zustand ersetzen. */
function readExportGuards(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(EXPORT_GUARD_KEY);
    const guarded = raw ? JSON.parse(raw) as Record<string, string> : {};
    if (!guarded || Array.isArray(guarded) || typeof guarded !== "object" ||
        Object.values(guarded).some((value) => typeof value !== "string")) throw Error();
    return guarded;
  } catch {
    throw new Error("Der Exportstatus konnte nicht gelesen werden. Es wurde nichts an Spotify gesendet.");
  }
}

export function CollectionWorkbench({ t }: { t: Translator }): ReactElement {
  const { favorites, history } = useToolkitData();
  const storeRef = ReactRuntime.useRef<NamedCollectionsStore | null>(null);
  // Storage erst beim jeweiligen Zugriff öffnen: ein gesperrter Browser-Speicher
  // wird so im Store als lesbarer Fehler angezeigt und bricht React nicht ab.
  if (!storeRef.current) storeRef.current = new NamedCollectionsStore({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  });
  const store = storeRef.current;
  const panelHost = ReactRuntime.useRef<HTMLDivElement | null>(null);
  const panelRef = ReactRuntime.useRef<NamedCollectionsPanelController | null>(null);
  const queueBusy = ReactRuntime.useRef(false);
  const exportGuard = ReactRuntime.useRef(new Set<string>());
  const [snapshot, setSnapshot] = ReactRuntime.useState<CollectionsDocument | null>(null);
  const [error, setError] = ReactRuntime.useState("");
  const [message, setMessage] = ReactRuntime.useState("");
  const [source, setSource] = ReactRuntime.useState<Source>("both");
  const [sourceQuery, setSourceQuery] = ReactRuntime.useState("");
  const [workQuery, setWorkQuery] = ReactRuntime.useState("");
  const [sourcePage, setSourcePage] = ReactRuntime.useState(0);
  const [workPage, setWorkPage] = ReactRuntime.useState(0);
  const [sourceSelection, setSourceSelection] = ReactRuntime.useState<Set<string>>(new Set());
  const [workSelection, setWorkSelection] = ReactRuntime.useState<Set<string>>(new Set());
  const [copyTarget, setCopyTarget] = ReactRuntime.useState("");
  const [busy, setBusy] = ReactRuntime.useState(false);

  /** Das eigenständige Panel lebt genau so lange wie dieser Playlist-Bereich. */
  ReactRuntime.useEffect(() => {
    if (!panelHost.current) return;
    const controller = mountNamedCollectionsPanel(panelHost.current, {
      store,
      // Dieser Checkout besitzt keine v1.75-Arbeitsliste. Ein unbekannter
      // Speicherschlüssel wird nicht geraten und daher nicht überschrieben.
      legacyTrackUris: () => [],
      onCollectionChanged: (next) => {
        setSnapshot(next);
        setWorkSelection(new Set());
        setWorkPage(0);
        setCopyTarget("");
        setError("");
      },
      onExportConfirmed: exportCollection,
      onExportGuardReset: releaseExportGuard,
    });
    panelRef.current = controller;
    return () => { controller.destroy(); panelRef.current = null; };
  }, [store]);

  /** Andere Spotify-Fenster und Backup-Imports in ihnen dürfen die sichtbare
   * Liste nicht veralten lassen. Bei defekten externen Daten stoppen wir die
   * Werkbank, statt mit einer alten Kopie darüberzuschreiben. */
  ReactRuntime.useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== NAMED_COLLECTIONS_STORAGE_KEY) return;
      try {
        const next = store.reload();
        setSnapshot(next);
        setWorkSelection(new Set());
        setWorkPage(0);
        setCopyTarget("");
        setError("");
        panelRef.current?.refresh();
      } catch (cause) {
        setSnapshot(null);
        setError(cause instanceof Error ? cause.message : "Die Sammlungen konnten nicht neu geladen werden.");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);

  /** Jede lokale Änderung geht zuerst durch den gemeinsamen Store. */
  function change(action: () => CollectionsDocument): boolean {
    try {
      const next = action();
      setSnapshot(next);
      setError("");
      setMessage("");
      panelRef.current?.refresh();
      return true;
    } catch (cause) {
      // Der Store hat einen neueren Speicherstand erkannt. Erst ihn laden,
      // dann kann der Nutzer seine Aktion bewusst noch einmal ausführen.
      if (cause instanceof CollectionConflictError) {
        try {
          setSnapshot(store.reload());
          setWorkSelection(new Set());
          setWorkPage(0);
          setCopyTarget("");
          panelRef.current?.refresh();
        } catch (reloadError) {
          setSnapshot(null);
          setError(reloadError instanceof Error ? reloadError.message : "Die Sammlungen konnten nicht neu geladen werden.");
          return false;
        }
      }
      setError(cause instanceof Error ? cause.message : "Die Sammlung konnte nicht gespeichert werden.");
      return false;
    }
  }

  /** Zweistufiger Spotify-Export verwendet die bereits geprüften API-Funktionen.
   * Nach einer unklaren Antwort blockiert ein dauerhafter Wächter erneutes
   * Erstellen derselben Playlist. Der Nutzer prüft sie dann zuerst in Spotify. */
  async function exportCollection(plan: PlaylistExportPlan): Promise<void> {
    const guardId = exportGuardId(plan);
    const guarded = readExportGuards();
    if (guarded[guardId] || exportGuard.current.has(guardId)) {
      throw new PlaylistExportReviewError("Dieser Export wurde bereits gestartet. Bitte die Playlist in Spotify prüfen, bevor du erneut exportierst.");
    }
    // Den Auftrag schon vor dem ersten Spotify-POST dauerhaft markieren.
    // Gerade die Playlist-Erstellung kann serverseitig gelungen sein, obwohl
    // die Antwort verloren geht. Ohne diesen Schritt würde ein neuer Klick
    // eine zweite Playlist anlegen. Scheitert das lokale Speichern, senden wir
    // überhaupt keinen Request.
    guarded[guardId] = "pending";
    try { window.localStorage.setItem(EXPORT_GUARD_KEY, JSON.stringify(guarded)); }
    catch { throw new Error("Der Exportstatus konnte nicht gespeichert werden. Es wurde nichts an Spotify gesendet."); }
    exportGuard.current.add(guardId);
    let playlistUri: string;
    try {
      playlistUri = await createSpotifyPlaylist(plan.name, "ZuKaTo Sammlung", false,
        (url, body) => Spicetify.CosmosAsync.post(url, body));
    } catch {
      throw new PlaylistExportReviewError("Die Playlist-Erstellung ist unklar. Bitte zuerst in Spotify prüfen; ein erneuter Export ist gesperrt.");
    }
    // Während der Spotify-Anfrage kann ein anderes Fenster weitere Exporte
    // sperren. Den Wächter daher erneut lesen und nur unseren Eintrag ändern.
    // Ein veränderter eigener Auftrag bleibt gesperrt und braucht Prüfung.
    try {
      const latest = readExportGuards();
      if (latest[guardId] !== "pending") throw Error();
      latest[guardId] = playlistUri;
      window.localStorage.setItem(EXPORT_GUARD_KEY, JSON.stringify(latest));
    } catch { throw new PlaylistExportReviewError(`Playlist ${playlistUri} wurde erstellt. Der Exportstatus konnte nicht gespeichert werden; bitte manuell in Spotify prüfen.`); }
    try {
      await addItemsToSpotifyPlaylist(playlistUri, plan.trackUris,
        (url, body) => Spicetify.CosmosAsync.post(url, body));
    } catch {
      throw new PlaylistExportReviewError(`Playlist ${playlistUri} wurde erstellt. Die Titelübertragung ist unklar; bitte in Spotify prüfen.`);
    }
    // Nach Erfolg nur unseren Eintrag entfernen. Fremde Sperren, die während
    // des Titelversands entstanden sind, müssen erhalten bleiben.
    try {
      const latest = readExportGuards();
      if (latest[guardId] === playlistUri) {
        delete latest[guardId];
        window.localStorage.setItem(EXPORT_GUARD_KEY, JSON.stringify(latest));
      }
    }
    catch { /* Der Export war erfolgreich; ein verbliebener Wächter ist sicher. */ }
    exportGuard.current.delete(guardId);
  }

  /** Nach Prüfung in Spotify darf der Nutzer genau diesen Auftrag freigeben.
   * Erst den dauerhaft gespeicherten Wächter entfernen; bei Speicherfehlern
   * bleibt auch die Sperre dieser laufenden Sitzung erhalten. */
  function releaseExportGuard(plan: PlaylistExportPlan): void {
    const guardId = exportGuardId(plan);
    const guarded = readExportGuards();
    if (!guarded[guardId]) throw new Error("Für diese Sammlung liegt kein gesperrter Export vor.");
    delete guarded[guardId];
    try { window.localStorage.setItem(EXPORT_GUARD_KEY, JSON.stringify(guarded)); }
    catch { throw new Error("Der Exportstatus konnte nicht freigegeben werden."); }
    exportGuard.current.delete(guardId);
  }

  /** Alle Songansichten lesen denselben aktiven Datensatz; keine zweite Arbeitsliste. */
  const sources = uniqueTracks(source === "favorites" ? favorites
    : source === "history" ? history : [...favorites, ...history]);
  const details = new Map<string, TrackInfo>();
  for (const track of uniqueTracks([...favorites, ...history])) details.set(track.uri, track);
  const active = snapshot?.collections.find((item) => item.id === snapshot.activeCollectionId);
  const workTracks = active?.trackUris.map((uri) => {
    const saved = snapshot?.trackDetails?.[uri];
    return details.get(uri) ?? {uri, title: saved?.title ?? uri, artist: saved?.artist ?? "Unbekannter Künstler", album: saved?.album ?? ""};
  }) ?? [];
  // Die gemeinsame Seitennavigation hält auch lange Hörverläufe im DOM klein.
  // „Alle Suchtreffer“ bezieht sich bewusst auf alle Seiten des Filters.
  const visibleSources = filterCollection(sources, sourceQuery);
  const visibleWork = filterCollection(workTracks, workQuery);
  const sourceView = collectionPage(sources, sourceQuery, sourcePage);
  const workView = collectionPage(workTracks, workQuery, workPage);
  const selectedWork = workTracks.filter((track) => workSelection.has(track.uri));

  /** Checkboxen ändern nur die Auswahl der jeweiligen Liste. */
  function toggle(current: Set<string>, update: (value: Set<string>) => void, uri: string): void {
    const next = new Set(current);
    if (next.has(uri)) next.delete(uri); else next.add(uri);
    update(next);
  }

  /** Spotify Queue bekommt die gespeicherte Reihenfolge in begrenzten Blöcken. */
  async function queueSelected(): Promise<void> {
    if (queueBusy.current || !selectedWork.length) return;
    queueBusy.current = true;
    setBusy(true);
    try {
      const result = await enqueueQueueBatches(selectedWork.map((track) => track.uri),
        (uris) => Spicetify.addToQueue(uris.map((uri) => ({uri}))));
      setMessage(`${result.queued} Songs eingereiht.`);
    } catch (cause) {
      setError(cause instanceof QueueBatchError && cause.queued > 0
        ? `${cause.queued} Songs eingereiht; weitere Titel konnten nicht übertragen werden.`
        : "Die ausgewählten Songs konnten nicht eingereiht werden.");
    } finally { queueBusy.current = false; setBusy(false); }
  }

  return <div className="zukato-workbench">
    <div ref={panelHost} />
    {error && <p className="zukato-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!snapshot || !active ? <p>Sammlungen werden geladen oder können nicht gelesen werden.</p> : <>
      <div className="zukato-workbench__columns">
        <section className="zukato-workbench__column" aria-label="Quellen">
          <h4>Favoriten und Hörverlauf</h4>
          <label>Quelle <select value={source} onChange={(event) => { setSource(event.currentTarget.value as Source); setSourceSelection(new Set()); setSourcePage(0); }}>
            <option value="both">Beide Quellen</option><option value="favorites">Favoriten</option><option value="history">Hörverlauf</option>
          </select></label>
          <label>Quellen durchsuchen <input type="search" value={sourceQuery} onChange={(event) => { setSourceQuery(event.currentTarget.value); setSourcePage(0); }} /></label>
          <div className="zukato-workbench__actions">
            <button type="button" disabled={!visibleSources.length} onClick={() => setSourceSelection(new Set(visibleSources.map((track) => track.uri)))}>Alle Suchtreffer auswählen</button>
            <button type="button" disabled={!sourceSelection.size} onClick={() => setSourceSelection(new Set())}>Auswahl leeren</button>
            <button type="button" disabled={!sourceSelection.size} onClick={() => {
              if (change(() => store.addTrackInfos(active.id, sources.filter((track) => sourceSelection.has(track.uri)))))
                setSourceSelection(new Set());
            }}>Zur Sammlung hinzufügen</button>
          </div>
          <p>{visibleSources.length} Treffer · {sourceSelection.size} ausgewählt</p>
          <ul className="zukato-workbench__list">{sourceView.items.map((track) => <li key={track.uri}>
            <label><input type="checkbox" checked={sourceSelection.has(track.uri)} onChange={() => toggle(sourceSelection, setSourceSelection, track.uri)} />
              <span><strong>{track.title}</strong><small>{track.artist}{track.album ? ` · ${track.album}` : ""}</small></span></label>
          </li>)}</ul>
          {sourceView.pages > 1 && <div className="zukato-workbench__pages">
            <button type="button" disabled={sourceView.page === 0} onClick={() => setSourcePage(sourceView.page - 1)}>Zurück</button>
            <span>Seite {sourceView.page + 1} von {sourceView.pages}</span>
            <button type="button" disabled={sourceView.page + 1 >= sourceView.pages} onClick={() => setSourcePage(sourceView.page + 1)}>Weiter</button>
          </div>}
        </section>
        <section className="zukato-workbench__column" aria-label="Aktive Sammlung">
          <h4>{active.name} · {workTracks.length} Songs</h4>
          <label>Sammlung durchsuchen <input type="search" value={workQuery} onChange={(event) => { setWorkQuery(event.currentTarget.value); setWorkPage(0); }} /></label>
          <div className="zukato-workbench__actions">
            <button type="button" disabled={!visibleWork.length} onClick={() => setWorkSelection(new Set(visibleWork.map((track) => track.uri)))}>Alle Suchtreffer auswählen</button>
            <button type="button" disabled={!workSelection.size} onClick={() => setWorkSelection(new Set())}>Auswahl leeren</button>
            <button type="button" disabled={!selectedWork.length} onClick={() => {
              if (change(() => store.removeTracks(active.id, selectedWork.map((track) => track.uri))))
                setWorkSelection(new Set());
            }}>Nur lokal entfernen</button>
            <button type="button" disabled={busy || !selectedWork.length} onClick={() => void queueSelected()}>In Warteschlange</button>
          </div>
          <div className="zukato-workbench__actions">
            <label>In Sammlung kopieren <select value={copyTarget} onChange={(event) => setCopyTarget(event.currentTarget.value)}>
              <option value="">Ziel wählen</option>{snapshot.collections.filter((item) => item.id !== active.id).map((item) =>
                <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <button type="button" disabled={!copyTarget || !selectedWork.length} onClick={() =>
              change(() => store.copyTracks(active.id, copyTarget, selectedWork.map((track) => track.uri)))}>Auswahl kopieren</button>
          </div>
          <p>{visibleWork.length} Treffer · {selectedWork.length} ausgewählt</p>
          <ul className="zukato-workbench__list">{workView.items.map((track) => <li key={track.uri}>
            <label><input type="checkbox" checked={workSelection.has(track.uri)} onChange={() => toggle(workSelection, setWorkSelection, track.uri)} />
              <span><strong>{track.title}</strong><small>{track.artist}{track.album ? ` · ${track.album}` : ""}</small></span></label>
            <div className="zukato-workbench__move">
              <button type="button" aria-label={`${track.title} nach oben`} disabled={active.trackUris[0] === track.uri} onClick={() => change(() => store.moveTrack(active.id, track.uri, "up"))}>↑</button>
              <button type="button" aria-label={`${track.title} nach unten`} disabled={active.trackUris.at(-1) === track.uri} onClick={() => change(() => store.moveTrack(active.id, track.uri, "down"))}>↓</button>
            </div>
          </li>)}</ul>
          {workView.pages > 1 && <div className="zukato-workbench__pages">
            <button type="button" disabled={workView.page === 0} onClick={() => setWorkPage(workView.page - 1)}>Zurück</button>
            <span>Seite {workView.page + 1} von {workView.pages}</span>
            <button type="button" disabled={workView.page + 1 >= workView.pages} onClick={() => setWorkPage(workView.page + 1)}>Weiter</button>
          </div>}
        </section>
      </div>
      {selectedWork.length > 0 && <div className="zukato-workbench__transfer">
        <h4>Auswahl in vorhandene Spotify-Playlist übertragen</h4>
        <PlaylistDestination t={t} uris={selectedWork.map((track) => track.uri)} disabled={busy} idPrefix="zukato-collection-target" />
      </div>}
    </>}
  </div>;
}
