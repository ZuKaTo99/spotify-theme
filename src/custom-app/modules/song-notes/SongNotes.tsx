// =============================================================================
// Datei: src/custom-app/modules/song-notes/SongNotes.tsx
// Zweck: Persönliche Notizen zur laufenden Spotify-URI, gerätespezifisch gespeichert.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { currentTrack, setSongNote } from "../../../shared/library";
import { useToolkitData } from "../../hooks/useToolkitData";
import { TrackSearch } from "../../components/TrackSearch";

const ReactRuntime = Spicetify.React as typeof import("react");

export function SongNotes({ t }: { t: Translator }): ReactElement {
  const data = useToolkitData();
  const [active, setActive] = ReactRuntime.useState(currentTrack);
  const [draft, setDraft] = ReactRuntime.useState("");
  // Songwechsel aktualisieren die Editor-Auswahl; lokale Entwürfe werden nicht automatisch gespeichert.
  ReactRuntime.useEffect(() => {
    const sync = (): void => setActive(currentTrack());
    Spicetify.Player.addEventListener("songchange", sync);
    return () => Spicetify.Player.removeEventListener("songchange", sync);
  }, []);
  // Bei Titelwechsel oder einem importierten Backup laden, nicht bei jedem Tastenanschlag.
  const storedNote = data.notes.find((note) => note.uri === active?.uri);
  ReactRuntime.useEffect(() => {
    setDraft(storedNote?.text ?? "");
  }, [active?.uri, storedNote?.updatedAt]);
  const selected = active;
  return <section className="zukato-panel">
    <p>{t("notes.intro")}</p>
    <button type="button" onClick={() => setActive(currentTrack())}>{t("notes.choose")}</button>
    <TrackSearch t={t} actionLabel={t("search.notes")} onChoose={(track) => setActive(track)} />
    {selected ? <div className="zukato-note-editor">
      <h3>{selected.title} — {selected.artist}</h3>
      <label htmlFor="zukato-note">{t("notes.label")}</label>
      <textarea id="zukato-note" rows={6} maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <div className="zukato-toolbar"><small>{t("notes.count", { count: draft.length })}</small>
        <button type="button" onClick={() => { setSongNote(selected, draft); Spicetify.showNotification(t("notes.saved")); }}>{t("common.save")}</button>
      </div>
    </div> : <p className="zukato-empty">{t("notes.empty")}</p>}
    <h3>{t("notes.savedCount", { count: data.notes.length })}</h3>
    <ul className="zukato-track-list">{data.notes.map((note) => <li className="zukato-track" key={note.uri}>
      <div className="zukato-track__info"><strong>{note.title}</strong><span>{note.artist}</span><small>{note.text.slice(0, 120)}</small></div>
      <button type="button" onClick={() => setActive(note)}>{t("notes.edit")}</button>
    </li>)}</ul>
  </section>;
}
