// =============================================================================
// Datei: src/shared/settings-navigation.ts
// Zweck: Den zuletzt geöffneten Einstellungsbereich pro Sitzung merken und
//        die Tastatursteuerung der Bereichsnavigation zentral absichern.
// Wo ändern? Bereichsliste hier, visuelle Darstellung in SettingsModule.tsx.
// =============================================================================

/** Die Reihenfolge ist identisch mit der sichtbaren Navigation. */
export const SETTINGS_SECTIONS = [
  "overview", "general", "wallpapers", "modules", "shortcuts", "data",
] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number];

const STORE_KEY = "zukato-toolkit.settings.last-section.v1";
/** Bei gesperrtem sessionStorage wird die Auswahl für diese Laufzeit gemerkt. */
let currentSection: SettingsSection = "overview";

/** Unbekannte/alte gespeicherte Werte dürfen keine leere Einstellungen-Seite erzeugen. */
export function validSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === "string" &&
    SETTINGS_SECTIONS.some((section) => section === value);
}

/** Beim Öffnen der Einstellungen zuletzt gewählten Bereich wiederherstellen. */
export function readSettingsSection(): SettingsSection {
  try {
    const saved = window.sessionStorage.getItem(STORE_KEY);
    if (validSettingsSection(saved)) currentSection = saved;
  } catch {
    // Zugriff auf Sitzungsspeicher kann in privaten Spicetify-Webviews scheitern.
  }
  return currentSection;
}

/** Nur gültige Bereiche speichern; nie unbekannte Werte in die Navigation übernehmen. */
export function rememberSettingsSection(section: SettingsSection): void {
  if (!validSettingsSection(section)) return;
  currentSection = section;
  try {
    window.sessionStorage.setItem(STORE_KEY, section);
  } catch {
    // Bereits gewählte Seite bleibt auch ohne persistenten Sitzungsspeicher aktiv.
  }
}

/** Pfeil-/Home-/End-Tasten bewegen den Fokus entlang der sichtbaren Schaltflächen. */
export function nextSettingsSection(current: SettingsSection, key: string): SettingsSection | null {
  const position = SETTINGS_SECTIONS.indexOf(current);
  if (position === -1) return null;
  switch (key) {
    case "ArrowDown":
    case "ArrowRight": return SETTINGS_SECTIONS[(position + 1) % SETTINGS_SECTIONS.length];
    case "ArrowUp":
    case "ArrowLeft": return SETTINGS_SECTIONS[(position + SETTINGS_SECTIONS.length - 1) % SETTINGS_SECTIONS.length];
    case "Home": return SETTINGS_SECTIONS[0];
    case "End": return SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1];
    default: return null;
  }
}
