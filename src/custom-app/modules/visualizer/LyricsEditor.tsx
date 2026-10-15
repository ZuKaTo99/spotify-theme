// =============================================================================
// Datei: src/custom-app/modules/visualizer/LyricsEditor.tsx
// Zweck: Eigenen LRC-Songtext einfügen, nachjustieren und wieder exportieren.
// Wo ändern? Textarea, Zeitmarken und Validierungsfeedback werden hier betreut.
// KEINE automatische Songtextbeschaffung; Rechte an importierten Texten bleiben
// beim Nutzer. Es werden keine Textdaten an externe Server übertragen.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { formatLrcTimestamp, parseLrc } from "./lyrics";
import { loadLyrics, MAX_LRC_BYTES, saveLyrics } from "./media-store";
const ReactRuntime = Spicetify.React as typeof import("react");

/** Bearbeiten ist optional und beeinflusst weder das Videofile noch Presets. */
export function LyricsEditor({ t, uri, revision, progressMs, onUpdated, onError }: {
  t: Translator;
  uri: string;
  revision: number;
  progressMs: number;
  onUpdated: () => void;
  onError: (message: string) => void;
}): ReactElement {
  const [draft, setDraft] = ReactRuntime.useState("");
  const [original, setOriginal] = ReactRuntime.useState("");
  const [busy, setBusy] = ReactRuntime.useState(false);
  const [saved, setSaved] = ReactRuntime.useState(false);
  const textArea = ReactRuntime.useRef<HTMLTextAreaElement>(null);

  // Titelwechsel und Import von außen laden neu; abgebrochene Promises dürfen
  // die Eingabe zum nächsten Titel nicht mit alten Daten überschreiben.
  ReactRuntime.useEffect(() => {
    let active = true;
    setDraft(""); setOriginal(""); setSaved(false);
    if (uri) void loadLyrics(uri).then((text) => {
      if (active) { setDraft(text ?? ""); setOriginal(text ?? ""); }
    }).catch((cause: unknown) => { if (active) onError(String(cause)); });
    return () => { active = false; };
  }, [uri, revision]);

  const lines = parseLrc(draft);
  const bytes = new Blob([draft]).size;
  const valid = Boolean(uri) && lines.length > 0 && bytes <= MAX_LRC_BYTES;
  const changed = draft !== original;

  /** Die Zeitmarke an der Cursorstelle einsetzen, nicht pauschal am Dateiende. */
  function insertTimestamp(): void {
    const mark = `${formatLrcTimestamp(progressMs)} `;
    const input = textArea.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? start;
    const next = draft.slice(0, start) + mark + draft.slice(end);
    setDraft(next);
    setSaved(false);
    // Cursorposition wird nach dem State-Update per requestAnimationFrame gesetzt,
    // damit wir die native Spotify-Textauswahl nicht bei jedem Tick ändern.
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + mark.length, start + mark.length);
    });
  }

  async function persist(): Promise<void> {
    if (!valid) return;
    setBusy(true);
    try {
      await saveLyrics(uri, draft, "zukato-editor.lrc");
      setOriginal(draft);
      setSaved(true);
      onUpdated();
    } catch (cause) { onError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  /** Lokaler Export zur Weiterbearbeitung in eigenen Programmen. */
  function exportDraft(): void {
    const url = URL.createObjectURL(new Blob([draft], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zukato-${uri.replace(/[^a-z0-9-]/gi, "-") || "lyrics"}.lrc`;
    document.body.append(anchor);
    anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return <details className="zukato-viz__lyrics-editor">
    <summary>{t("viz.editorHeading")}</summary>
    <p className="zukato-viz__hint">{t("viz.editorHelp")}</p>
    <textarea ref={textArea} spellCheck={false} rows={8} value={draft}
      disabled={!uri || busy} maxLength={200_000} placeholder="[00:12.40] ..."
      onChange={(event) => { setDraft(event.currentTarget.value); setSaved(false); }} />
    <p className="zukato-viz__hint">{t("viz.editorStats", { count: String(lines.length), bytes: String(bytes) })}</p>
    <div className="zukato-viz__library-actions">
      <button type="button" disabled={!uri || busy} onClick={insertTimestamp}>{t("viz.editorTimestamp")}</button>
      <button type="button" disabled={!valid || !changed || busy} onClick={() => void persist()}>{t("viz.editorSave")}</button>
      <button type="button" disabled={!draft || busy} onClick={exportDraft}>{t("viz.editorExport")}</button>
    </div>
    {bytes > MAX_LRC_BYTES && <p role="alert" className="zukato-error">{t("viz.largeLyrics")}</p>}
    {draft.trim() && lines.length === 0 && <p role="alert" className="zukato-error">{t("viz.invalidLyrics")}</p>}
    {saved && <p role="status">{t("viz.saved")}</p>}
  </details>;
}
