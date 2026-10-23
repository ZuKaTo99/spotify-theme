// =============================================================================
// Datei: src/custom-app/components/BulkLinkImporter.tsx
// Zweck: Beliebig getrennte Spotify-Track-Links vor dem Senden analysieren,
//        Duplikate und Fehler anzeigen und bewusst in Queue/Playlist übertragen.
// Wo ändern? Parser / Limits in shared/spotify-playlist-transfer.ts,
//             Textbausteine in shared/i18n.ts, UI hier.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../shared/i18n";
import {
  analyzePastedSpotifyLinks, PASTE_CHARACTER_LIMIT, PASTE_LIMIT,
  orderPastedTracks, movePastedTrack, selectedPastedTracks, pagePastedTracks,
  PASTE_WORKBENCH_PAGE_SIZE,
} from
  "../../shared/spotify-playlist-transfer";
import { PlaylistDestination } from "./PlaylistDestination";

const ReactRuntime = Spicetify.React as typeof import("react");

interface Props {
  t: Translator;
  disabled?: boolean;
  onQueue: (uris: string[]) => Promise<void>;
}

export function BulkLinkImporter({ t, disabled = false, onQueue }: Props): ReactElement {
  const [raw, setRaw] = ReactRuntime.useState("");
  const [busy, setBusy] = ReactRuntime.useState(false);
  const [excluded, setExcluded] = ReactRuntime.useState<string[]>([]);
  const [preferredOrder, setPreferredOrder] = ReactRuntime.useState<string[]>([]);
  const [filter, setFilter] = ReactRuntime.useState("");
  const [pageIndex, setPageIndex] = ReactRuntime.useState(0);
  const inFlight = ReactRuntime.useRef(false);
  const result = analyzePastedSpotifyLinks(raw);
  // Nur geprüfte Einträge aus der aktuellen Eingabe dürfen an Spotify gehen.
  // Ein altes Häkchen oder eine alte Reihenfolge ergänzt niemals einen Song.
  const ordered = orderPastedTracks(result.uris, preferredOrder);
  const selected = selectedPastedTracks(ordered, excluded);
  const paged = pagePastedTracks(ordered, filter, pageIndex);
  const valid = selected.length > 0 && result.issue === null;
  const locked = disabled || busy;

  function changeRaw(value: string): void {
    // Beim Bearbeiten der Texteingabe startet die Auswahl für den NEUEN Inhalt.
    setRaw(value);
    setExcluded([]);
    setPreferredOrder([]);
    setFilter("");
    setPageIndex(0);
  }

  function toggleItem(uri: string): void {
    if (locked) return;
    setExcluded((before) => before.includes(uri)
      ? before.filter((item) => item !== uri)
      : [...before, uri]);
  }

  function moveItem(uri: string, direction: -1 | 1): void {
    if (locked) return;
    setPreferredOrder(movePastedTrack(ordered, uri, direction));
  }

  function keepSelection(): void {
    if (locked || result.issue || !selected.length) return;
    // Bewusste Textbearbeitung: Diese Aktion entfernt ausgeschlossene UND
    // nicht erkannte Einträge. Ohne Bestätigung bleibt die Quelle erhalten.
    if (!window.confirm(t("playlistPaste.keepConfirm", { count: selected.length }))) return;
    changeRaw(selected.join("\n"));
  }

  async function queueAll(): Promise<void> {
    // In-flight-Sperre muss synchron gesetzt werden (Doppelklick vor Re-Render).
    if (inFlight.current || locked || !valid) return;
    if (selected.length > 25 && !window.confirm(t("playlistPaste.queueConfirm", {
      count: selected.length,
    }))) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await onQueue([...selected]);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <section className="zukato-panel zukato-playlist-destination">
    <h3>{t("playlistPaste.heading")}</h3>
    <p>{t("playlistPaste.description", { count: PASTE_LIMIT })}</p>
    <label htmlFor="zukato-playlist-paste">{t("playlistPaste.label")}</label>
    <textarea id="zukato-playlist-paste" rows={7} value={raw}
      maxLength={PASTE_CHARACTER_LIMIT + 1} disabled={locked}
      placeholder="spotify:track:…&#10;https://open.spotify.com/track/…"
      onChange={(event) => changeRaw(event.currentTarget.value)} />
    <div role="status" aria-live="polite">
      {result.issue ? <p className="zukato-error">{t(`playlistPaste.${result.issue}`)}</p>
        : <p>{t("playlistPaste.summary", {
          count: result.uris.length, invalid: result.invalid, duplicates: result.duplicates,
        })}</p>}
    </div>
    {/* Bestehende Hauptaktionen zuerst lassen: deren Bedeutung bleibt unverändert. */}
    <div className="zukato-toolbar">
      <button type="button" disabled={locked || !valid}
        onClick={() => { void queueAll(); }}>{t("playlistPaste.queue", { count: selected.length })}</button>
      <button type="button" disabled={locked || !raw} onClick={() => changeRaw("")}>{t("playlistPaste.clear")}</button>
    </div>
    {ordered.length > 0 && !result.issue && <div className="zukato-import-workbench">
      <h4>{t("playlistPaste.workbench")}</h4>
      <p role="status" aria-live="polite">{t("playlistPaste.selected", {
        count: selected.length, total: ordered.length,
      })}</p>
      <div className="zukato-toolbar">
        <button type="button" disabled={locked || selected.length === ordered.length}
          onClick={() => setExcluded([])}>{t("playlistPaste.selectAll")}</button>
        <button type="button" disabled={locked || selected.length === 0}
          onClick={() => setExcluded([...ordered])}>{t("playlistPaste.selectNone")}</button>
        <button type="button" disabled={locked || !selected.length}
          onClick={keepSelection}>{t("playlistPaste.keepOnly")}</button>
      </div>
      <label htmlFor="zukato-import-filter">{t("playlistPaste.filter")}</label>
      <input id="zukato-import-filter" type="search" value={filter} disabled={locked}
        placeholder={t("playlistPaste.filterHint")}
        onChange={(event) => { setFilter(event.currentTarget.value); setPageIndex(0); }} />
      <small>{t("playlistPaste.filtered", { count: paged.filteredTotal })}</small>
      <ol className="zukato-import-workbench__items" start={paged.page * PASTE_WORKBENCH_PAGE_SIZE + 1}>
        {paged.items.map((item) => {
          const index = ordered.indexOf(item);
          return <li key={item}>
            <label className="zukato-import-workbench__check">
              <input type="checkbox" checked={!excluded.includes(item)} disabled={locked}
                aria-label={t("playlistPaste.selectItem", { item })}
                onChange={() => toggleItem(item)} />
              <code title={item}>{item}</code>
            </label>
            <div className="zukato-import-workbench__move">
              <button type="button" disabled={locked || index === 0} title={t("playlistPaste.moveUp")}
                aria-label={t("playlistPaste.moveItemUp", { item })}
                onClick={() => moveItem(item, -1)}>↑</button>
              <button type="button" disabled={locked || index === ordered.length - 1}
                title={t("playlistPaste.moveDown")}
                aria-label={t("playlistPaste.moveItemDown", { item })}
                onClick={() => moveItem(item, 1)}>↓</button>
            </div>
          </li>;
        })}
      </ol>
      {paged.pages > 1 && <div className="zukato-collection__pages">
        <button type="button" disabled={locked || paged.page === 0}
          onClick={() => setPageIndex(paged.page - 1)}>{t("playlistPaste.previous")}</button>
        <span>{t("playlistPaste.page", { page: paged.page + 1, total: paged.pages })}</span>
        <button type="button" disabled={locked || paged.page >= paged.pages - 1}
          onClick={() => setPageIndex(paged.page + 1)}>{t("playlistPaste.next")}</button>
      </div>}
    </div>}
    {/* Dieselbe Momentaufnahme / Reihenfolge wie bei der Queue verwenden. */}
    <PlaylistDestination t={t} uris={result.issue ? [] : selected} disabled={locked}
      idPrefix="zukato-paste-playlist" />
  </section>;
}
