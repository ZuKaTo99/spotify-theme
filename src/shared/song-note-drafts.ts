// =============================================================================
// Datei: src/shared/song-note-drafts.ts
// Zweck: Ungespeicherte Song-Notizen beim Wechseln von Song oder Modul schützen.
// WICHTIG: Ein Entwurf ist KEINE gespeicherte Song-Notiz. Er bleibt nur in der
//          aktuellen Spotify-Tab-Sitzung; erst „Speichern“ schreibt die Library.
// Wo ändern? Begrenzung/Sitzungsspeicher hier, Editor in SongNotes.tsx.
// =============================================================================

/** Pro Titel wird höchstens ein kurzer Entwurf in dieser Sitzung vorgemerkt. */
const NOTE_DRAFT_KEY = "zukato-toolkit.song-note-drafts.v1";
const MAX_DRAFTS = 30;
const MAX_LENGTH = 4000;

interface NoteDraft {
  text: string;
  /** Dient zur Erkennung externer Änderungen, z. B. durch einen Backup-Import. */
  savedVersion: number;
  /** Schützt zusätzlich vor Backup-Importen ohne aktualisierten Zeitstempel. */
  savedText?: string;
}

type DraftMap = Record<string, NoteDraft>;

/** Fallback bei gesperrtem sessionStorage; die laufende Seite bleibt bedienbar. */
let memoryDrafts: DraftMap = {};
/** Bei fehlgeschlagenem Schreiben darf ein alter persistierter Wert den
 * aktuelleren In-Memory-Entwurf nicht beim nächsten Lesen überschreiben. */
let pendingMemoryWrite = false;

/** Keine unsicheren/überlangen Keys aus fremden JSON-Daten übernehmen. */
function validUri(uri: string): boolean {
  return /^spotify:(?:track|episode):[A-Za-z0-9]{22}$/.test(uri);
}

/** Begrenzte und defensiv validierte Einträge aus dem Sitzungsspeicher lesen. */
function normalizeDrafts(value: unknown): DraftMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: DraftMap = {};
  for (const [uri, raw] of Object.entries(value)) {
    if (!validUri(uri) || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.text !== "string" || item.text.length > MAX_LENGTH ||
      typeof item.savedVersion !== "number" || !Number.isFinite(item.savedVersion) ||
      (item.savedText !== undefined &&
        (typeof item.savedText !== "string" || item.savedText.length > MAX_LENGTH))) continue;
    result[uri] = {
      text: item.text, savedVersion: item.savedVersion,
      ...(typeof item.savedText === "string" ? { savedText: item.savedText } : {}),
    };
    // Erst NACH Validierung begrenzen, damit defekte Altwerte gültige
    // Entwürfe am Ende des Speichers nicht verdrängen können.
    const keys = Object.keys(result);
    if (keys.length > MAX_DRAFTS) delete result[keys[0]];
  }
  return result;
}

function readDrafts(): DraftMap {
  try {
    // sessionStorage ist in manchen eingebetteten/privaten Webviews gesperrt.
    // Nach QuotaExceeded/SecurityError enthält memoryDrafts den neueren Text.
    if (!pendingMemoryWrite) {
      const raw = sessionStorage.getItem(NOTE_DRAFT_KEY);
      memoryDrafts = raw === null ? {} : normalizeDrafts(JSON.parse(raw));
    }
  } catch {
    // Fallback im Arbeitsspeicher. Fehler beim Lesen dürfen keinen Text löschen.
  }
  return memoryDrafts;
}

function writeDrafts(drafts: DraftMap): void {
  memoryDrafts = drafts;
  try {
    sessionStorage.setItem(NOTE_DRAFT_KEY, JSON.stringify(drafts));
    pendingMemoryWrite = false;
  } catch {
    // QuotaExceeded / SecurityError: beim nächsten Lesen nicht durch die
    // alte persistierte Version überschreiben, solange die Sitzung läuft.
    pendingMemoryWrite = true;
  }
}

/** Gespeicherte Notiz verwenden, außer ein passender offener Entwurf existiert. */
export function readSongNoteDraft(uri: string, savedText: string, savedVersion = 0): string {
  if (!validUri(uri)) return savedText;
  const entry = readDrafts()[uri];
  // Externe Updates dürfen nicht von einem veralteten Entwurf verdeckt werden.
  return entry?.savedVersion === savedVersion &&
    (entry.savedText === undefined || entry.savedText === savedText)
    ? entry.text : savedText;
}

/** Nur ABWEICHENDE Texte merken. Beim Zurücktippen auf den Stand entfernen. */
export function rememberSongNoteDraft(uri: string, text: string, savedText: string, savedVersion = 0): void {
  if (!validUri(uri)) return;
  const drafts = { ...readDrafts() };
  if (text === savedText) {
    delete drafts[uri];
  } else {
    // Begrenzung schützt vor unkontrolliertem Wachstum bei langen Sitzungen.
    delete drafts[uri];
    drafts[uri] = { text: text.slice(0, MAX_LENGTH), savedVersion, savedText: savedText.slice(0, MAX_LENGTH) };
    const keys = Object.keys(drafts);
    for (const oldUri of keys.slice(0, -MAX_DRAFTS)) delete drafts[oldUri];
  }
  writeDrafts(drafts);
}

/** Nach bewusstem Speichern oder Verwerfen den temporären Entwurf entfernen. */
export function clearSongNoteDraft(uri: string): void {
  if (!validUri(uri)) return;
  const drafts = { ...readDrafts() };
  delete drafts[uri];
  writeDrafts(drafts);
}
