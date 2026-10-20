// =============================================================================
// Datei: src/custom-app/modules/song-notes/SongNotes.tsx
// Zweck: Persönliche, lokale Notizen pro Spotify-Titel.
// Neue Bedienung: Offene Entwürfe bleiben auch nach Song-/Modulwechsel erhalten,
// werden aber erst nach einem ausdrücklichen Klick dauerhaft gespeichert.
// Wo ändern? UI hier, sichere Sitzungsspeicherung in shared/song-note-drafts.ts.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { currentTrack, setSongNote, type TrackInfo } from "../../../shared/library";
import { readSongNoteDraft, rememberSongNoteDraft, clearSongNoteDraft } from "../../../shared/song-note-drafts";
import { useToolkitData } from "../../hooks/useToolkitData";
import { TrackSearch } from "../../components/TrackSearch";
import { collectionPage } from "../../../shared/collection-view";

const ReactRuntime = Spicetify.React as typeof import("react");

/** Eigener Editor je URI verhindert, dass beim Songwechsel der alte Text kurz
 * unter einem neuen Song angezeigt und versehentlich falsch gespeichert wird. */
function NoteEditor({ t, selected, savedText, savedVersion }: {
  t: Translator;
  selected: TrackInfo;
  savedText: string;
  savedVersion: number;
}): ReactElement {
  const [draft, setDraft] = ReactRuntime.useState(() =>
    readSongNoteDraft(selected.uri, savedText, savedVersion));
  const [saveError, setSaveError] = ReactRuntime.useState(false);

  // Backup-Import oder Speicherung in einer zweiten Ansicht berücksichtigen.
  ReactRuntime.useEffect(() => {
    setDraft(readSongNoteDraft(selected.uri, savedText, savedVersion));
    setSaveError(false);
  }, [selected.uri, savedText, savedVersion]);

  const changed = draft !== savedText;
  function edit(text: string): void {
    setDraft(text);
    setSaveError(false);
    rememberSongNoteDraft(selected.uri, text, savedText, savedVersion);
  }

  function save(): void {
    try {
      setSongNote(selected, draft);
      clearSongNoteDraft(selected.uri);
      setSaveError(false);
      Spicetify.showNotification(t("notes.saved"));
    } catch (error) {
      // Bei Storage-Fehler den Entwurf NICHT löschen oder als gespeichert melden.
      console.error("[ZuKaTo] Song-Notiz konnte nicht gespeichert werden:", error);
      setSaveError(true);
      Spicetify.showNotification(t("notes.saveFailed"), true);
    }
  }

  function discard(): void {
    clearSongNoteDraft(selected.uri);
    setDraft(savedText);
    setSaveError(false);
  }

  return <div className="zukato-note-editor">
    <h3>{selected.title} — {selected.artist}</h3>
    <label htmlFor="zukato-note">{t("notes.label")}</label>
    <textarea id="zukato-note" rows={6} maxLength={4000} value={draft}
      onChange={(event) => edit(event.currentTarget.value)} />
    <div className="zukato-toolbar">
      <small>{t("notes.count", { count: draft.length })}</small>
      <button type="button" onClick={save}>{t("common.save")}</button>
      <button type="button" disabled={!changed} onClick={discard}>{t("notes.discard")}</button>
    </div>
    {changed && <p role="status" className="zukato-viz__hint">{t("notes.draftHint")}</p>}
    {saveError && <p role="alert" className="zukato-error">{t("notes.saveFailed")}</p>}
  </div>;
}

export function SongNotes({ t }: { t: Translator }): ReactElement {
  const data = useToolkitData();
  const [active, setActive] = ReactRuntime.useState(currentTrack);
  const [filter, setFilter] = ReactRuntime.useState("");
  const [requestedPage, setRequestedPage] = ReactRuntime.useState(0);
  // Auch den NotizTEXT durchsuchbar machen, ohne gespeicherte Daten zu ändern.
  const view = collectionPage(data.notes, filter, requestedPage, undefined, (note) => note.text);
  ReactRuntime.useEffect(() => {
    if (requestedPage !== view.page) setRequestedPage(view.page);
  }, [requestedPage, view.page]);
  // Ein bewusst gewählter alter Titel darf nicht vom automatischen Songwechsel
  // überschrieben werden. Über „Aktuellen Titel wählen“ zurückwechseln.
  const manualSelection = ReactRuntime.useRef(false);

  ReactRuntime.useEffect(() => {
    const sync = (): void => {
      if (!manualSelection.current) setActive(currentTrack());
    };
    Spicetify.Player.addEventListener("songchange", sync);
    return () => Spicetify.Player.removeEventListener("songchange", sync);
  }, []);

  const selected = active;
  const storedNote = data.notes.find((note) => note.uri === selected?.uri);
  return <section className="zukato-panel">
    <p>{t("notes.intro")}</p>
    <button type="button" onClick={() => {
      manualSelection.current = false;
      setActive(currentTrack());
    }}>{t("notes.choose")}</button>
    <TrackSearch t={t} actionLabel={t("search.notes")} onChoose={(track) => {
      manualSelection.current = true;
      setActive(track);
    }} />
    {selected ? <NoteEditor key={selected.uri} t={t} selected={selected}
      savedText={storedNote?.text ?? ""} savedVersion={storedNote?.updatedAt ?? 0} />
      : <p className="zukato-empty">{t("notes.empty")}</p>}
    <h3>{t("notes.savedCount", { count: data.notes.length })}</h3>
    {data.notes.length > 0 && <div className="zukato-collection__filter">
      <label htmlFor="zukato-notes-filter">{t("collection.filter")}</label>
      <input id="zukato-notes-filter" type="search" maxLength={150} value={filter}
        placeholder={t("notes.searchPlaceholder")}
        onChange={(event) => { setFilter(event.currentTarget.value); setRequestedPage(0); }} />
      <small aria-live="polite">{t("collection.results", { count: view.total })}</small>
    </div>}
    {data.notes.length > 0 && view.total === 0 &&
      <p className="zukato-empty">{t("collection.noResults")}</p>}
    <ul className="zukato-track-list">{view.items.map((note) => <li className="zukato-track" key={note.uri}>
      <div className="zukato-track__info"><strong>{note.title}</strong><span>{note.artist}</span><small>{note.text.slice(0, 120)}</small></div>
      <button type="button" onClick={() => {
        manualSelection.current = true;
        setActive(note);
      }}>{t("notes.edit")}</button>
    </li>)}</ul>
    {view.pages > 1 && <nav className="zukato-collection__pages" aria-label={t("collection.pagesLabel")}>
      <button type="button" disabled={view.page === 0}
        onClick={() => setRequestedPage(view.page - 1)}>{t("collection.previous")}</button>
      <span aria-live="polite">{t("collection.page", { page: view.page + 1, pages: view.pages })}</span>
      <button type="button" disabled={view.page >= view.pages - 1}
        onClick={() => setRequestedPage(view.page + 1)}>{t("collection.next")}</button>
    </nav>}
  </section>;
}
