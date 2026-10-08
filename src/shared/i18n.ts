// =============================================================================
// Datei: src/shared/i18n.ts
// Zweck: Zentrales Übersetzungssystem für Deutsch und Englisch.
// =============================================================================

import type {
  AppLocale,
} from "./settings";

// -----------------------------------------------------------------------------
// Alle aktuell unterstützten Sprachen.
// -----------------------------------------------------------------------------
export type SupportedLocale =
  | "de"
  | "en";

// -----------------------------------------------------------------------------
// Deutsches Übersetzungswörterbuch.
//
// Dieses Objekt ist gleichzeitig die zentrale Quelle aller gültigen
// TranslationKey-Werte.
// -----------------------------------------------------------------------------
const germanTranslations = {
  // ---------------------------------------------------------------------------
  // Allgemeine App-Texte.
  // ---------------------------------------------------------------------------
  "app.productLabel":
    "Spotify Toolkit",

  "app.description":
    "Persönlicher und modularer Spotify-Arbeitsbereich.",

  "app.greeting":
    "Hallo, {name}!",

  // ---------------------------------------------------------------------------
  // Allgemeine Modul-Texte.
  // ---------------------------------------------------------------------------
  "module.underDevelopment":
    "Dieses Modul wird noch entwickelt.",

  // ---------------------------------------------------------------------------
  // Dashboard.
  // ---------------------------------------------------------------------------
  "dashboard.description":
    "Übersicht über deinen aktuellen Spotify Toolkit-Arbeitsbereich.",

  "dashboard.workspaceModules":
    "Aktive Workspace-Module",

  "dashboard.extensionModules":
    "Aktive Erweiterungen",

  // ---------------------------------------------------------------------------
  // Tastenkürzel.
  // ---------------------------------------------------------------------------
  "shortcuts.heading":
    "Tastenbelegungen",

  "shortcuts.description":
    "Tastenkürzel anzeigen und bearbeiten.",

  "shortcuts.playPause":
    "Wiedergabe/Pause",

  "shortcuts.nextTrack":
    "Nächster Titel",

  "shortcuts.previousTrack":
    "Vorheriger Titel",

  "shortcuts.volumeUp":
    "Lautstärke erhöhen",

  "shortcuts.volumeDown":
    "Lautstärke verringern",

  "shortcuts.toggleMute":
    "Stumm ein/aus",

  "shortcuts.currentBinding":
    "Aktuelle Belegung",

  "shortcuts.edit":
    "Bearbeiten",

  "shortcuts.clear":
    "Belegung entfernen",

  "shortcuts.pressKeys":
    "Drücke jetzt die gewünschte Tastenkombination.",

  "shortcuts.reset":
    "Zurücksetzen",

  "shortcuts.open":
    "Tastenbelegungen öffnen",

  "shortcuts.backToSettings":
    "Zurück zu den Einstellungen",

  "shortcuts.conflictWith":
    "Diese Tastenkombination wird bereits für „{action}“ verwendet.",

  // ---------------------------------------------------------------------------
  // Einstellungen.
  // ---------------------------------------------------------------------------
  "settings.heading":
    "Einstellungen",

  "settings.workspaceTitle":
    "Workspace-Titel",

  "settings.displayName":
    "Anzeigename",

  "settings.displayNamePlaceholder":
    "Optional",

  "settings.language":
    "Sprache",

  "settings.languageAuto":
    "Automatisch",

  "settings.languageGerman":
    "Deutsch",

  "settings.languageEnglish":
    "Englisch",

  "settings.showGreeting":
    "Persönliche Begrüßung anzeigen",

  // ---------------------------------------------------------------------------
  // Modulverwaltung.
  // ---------------------------------------------------------------------------
  "modules.heading":
    "Module",

  "modules.description":
    "Funktionen aktivieren, umbenennen und sortieren.",

  "modules.customApp":
    "Workspace-Module",

  "modules.extension":
    "Spotify-Erweiterungen",

  "modules.enabled":
    "Aktiviert",

  "modules.displayTitle":
    "Anzeigename",

  "modules.order":
    "Reihenfolge",

  "modules.required":
    "Pflichtmodul",

  "modules.defaultTitlePlaceholder":
    "Standard: {title}",

  // ---------------------------------------------------------------------------
  // Workspace-Module.
  // ---------------------------------------------------------------------------
  "feature.dashboard":
    "Dashboard",

  "feature.listening-history":
    "Hörverlauf",

  "feature.statistics":
    "Statistiken",

  "feature.favorites":
    "Favoriten",

  "feature.playlist-tools":
    "Playlist-Werkzeuge",

  "feature.visualizer":
    "Visualisierer",

  "feature.song-notes":
    "Song-Notizen",

  "feature.theme-studio":
    "Theme-Studio",

  "feature.settings":
    "Einstellungen",

  // ---------------------------------------------------------------------------
  // Extension-Module.
  // ---------------------------------------------------------------------------
  "feature.keyboard-shortcuts":
    "Tastenkürzel",

  "feature.sleep-timer":
    "Sleep-Timer",

  "feature.volume-scroll":
    "Lautstärke per Mausrad",

  "feature.copy-track-info":
    "Songinformationen kopieren",

  "feature.quick-playlist":
    "Schneller Playlist-Button",

  "feature.mini-player":
    "Mini-Player",

  "feature.player-statistics":
    "Player-Statistiken",

  "feature.context-actions":
    "Kontextaktionen",
} as const;

// -----------------------------------------------------------------------------
// Alle erlaubten Translation-Keys werden aus dem deutschen Wörterbuch
// automatisch abgeleitet.
// -----------------------------------------------------------------------------
export type TranslationKey =
  keyof typeof germanTranslations;

// -----------------------------------------------------------------------------
// Jedes Übersetzungswörterbuch muss exakt dieselben Keys enthalten.
// -----------------------------------------------------------------------------
type TranslationDictionary =
  Record<
    TranslationKey,
    string
  >;

// -----------------------------------------------------------------------------
// Englisches Übersetzungswörterbuch.
//
// Durch TranslationDictionary meldet TypeScript sofort, wenn hier eine
// Übersetzung fehlt.
// -----------------------------------------------------------------------------
const englishTranslations:
  TranslationDictionary = {
  // ---------------------------------------------------------------------------
  // General app texts.
  // ---------------------------------------------------------------------------
  "app.productLabel":
    "Spotify Toolkit",

  "app.description":
    "Your personal and modular Spotify workspace.",

  "app.greeting":
    "Hello, {name}!",

  // ---------------------------------------------------------------------------
  // General module texts.
  // ---------------------------------------------------------------------------
  "module.underDevelopment":
    "This module is still under development.",

  // ---------------------------------------------------------------------------
  // Dashboard.
  // ---------------------------------------------------------------------------
  "dashboard.description":
    "Overview of your current Spotify Toolkit workspace.",

  "dashboard.workspaceModules":
    "Active workspace modules",

  "dashboard.extensionModules":
    "Active extensions",

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts.
  // ---------------------------------------------------------------------------
  "shortcuts.heading":
    "Keyboard shortcuts",

  "shortcuts.description":
    "View and edit keyboard shortcuts.",

  "shortcuts.playPause":
    "Play/Pause",

  "shortcuts.nextTrack":
    "Next track",

  "shortcuts.previousTrack":
    "Previous track",

  "shortcuts.volumeUp":
    "Volume up",

  "shortcuts.volumeDown":
    "Volume down",

  "shortcuts.toggleMute":
    "Mute/unmute",

  "shortcuts.currentBinding":
    "Current binding",

  "shortcuts.edit":
    "Edit",

  "shortcuts.clear":
    "Clear binding",

  "shortcuts.pressKeys":
    "Press the desired key combination now.",

  "shortcuts.reset":
    "Reset",

  "shortcuts.open":
    "Open keyboard shortcuts",

  "shortcuts.backToSettings":
    "Back to settings",

  "shortcuts.conflictWith":
    "This key combination is already assigned to “{action}”.",

  // ---------------------------------------------------------------------------
  // Settings.
  // ---------------------------------------------------------------------------
  "settings.heading":
    "Settings",

  "settings.workspaceTitle":
    "Workspace title",

  "settings.displayName":
    "Display name",

  "settings.displayNamePlaceholder":
    "Optional",

  "settings.language":
    "Language",

  "settings.languageAuto":
    "Automatic",

  "settings.languageGerman":
    "German",

  "settings.languageEnglish":
    "English",

  "settings.showGreeting":
    "Show personal greeting",

  // ---------------------------------------------------------------------------
  // Module management.
  // ---------------------------------------------------------------------------
  "modules.heading":
    "Modules",

  "modules.description":
    "Enable, rename and reorder features.",

  "modules.customApp":
    "Workspace modules",

  "modules.extension":
    "Spotify extensions",

  "modules.enabled":
    "Enabled",

  "modules.displayTitle":
    "Display name",

  "modules.order":
    "Order",

  "modules.required":
    "Required module",

  "modules.defaultTitlePlaceholder":
    "Default: {title}",

  // ---------------------------------------------------------------------------
  // Workspace modules.
  // ---------------------------------------------------------------------------
  "feature.dashboard":
    "Dashboard",

  "feature.listening-history":
    "Listening history",

  "feature.statistics":
    "Statistics",

  "feature.favorites":
    "Favorites",

  "feature.playlist-tools":
    "Playlist tools",

  "feature.visualizer":
    "Visualizer",

  "feature.song-notes":
    "Song notes",

  "feature.theme-studio":
    "Theme Studio",

  "feature.settings":
    "Settings",

  // ---------------------------------------------------------------------------
  // Extension modules.
  // ---------------------------------------------------------------------------
  "feature.keyboard-shortcuts":
    "Keyboard shortcuts",

  "feature.sleep-timer":
    "Sleep timer",

  "feature.volume-scroll":
    "Mouse-wheel volume",

  "feature.copy-track-info":
    "Copy track information",

  "feature.quick-playlist":
    "Quick playlist button",

  "feature.mini-player":
    "Mini player",

  "feature.player-statistics":
    "Player statistics",

  "feature.context-actions":
    "Context actions",
};

// -----------------------------------------------------------------------------
// Registry aller verfügbaren Sprachwörterbücher.
// -----------------------------------------------------------------------------
const translations:
  Record<
    SupportedLocale,
    TranslationDictionary
  > = {
    de: germanTranslations,
    en: englishTranslations,
  };

// -----------------------------------------------------------------------------
// Parameter für dynamische Übersetzungs-Platzhalter.
//
// Beispiel:
//
// { action: "Wiedergabe/Pause" }
// -----------------------------------------------------------------------------
export type TranslationParameters =
  Record<
    string,
    string | number
  >;

// -----------------------------------------------------------------------------
// Signatur der zentralen Übersetzungsfunktion.
// -----------------------------------------------------------------------------
export type Translator = (
  key: TranslationKey,
  parameters?: TranslationParameters,
) => string;

// -----------------------------------------------------------------------------
// Bestimmt die tatsächlich verwendete Sprache.
//
// Bei "auto" wird die Sprache anhand der Browser-/Spotify-Sprache gewählt.
// -----------------------------------------------------------------------------
export function resolveLocale(
  configuredLocale: AppLocale,
): SupportedLocale {
  // ---------------------------------------------------------------------------
  // Explizit konfigurierte Sprache direkt übernehmen.
  // ---------------------------------------------------------------------------
  if (
    configuredLocale === "de" ||
    configuredLocale === "en"
  ) {
    return configuredLocale;
  }

  // ---------------------------------------------------------------------------
  // Alle vom Browser gemeldeten Sprachen sammeln.
  // ---------------------------------------------------------------------------
  const browserLocales = [
    ...navigator.languages,
    navigator.language,
  ];

  // ---------------------------------------------------------------------------
  // Sobald eine Sprache mit "de" beginnt, wird Deutsch verwendet.
  // ---------------------------------------------------------------------------
  const prefersGerman =
    browserLocales.some(
      (locale) =>
        locale
          .toLocaleLowerCase()
          .startsWith("de"),
    );

  return prefersGerman
    ? "de"
    : "en";
}

// -----------------------------------------------------------------------------
// Ersetzt dynamische Platzhalter in Übersetzungstexten.
//
// Beispiel:
//
// "Bereits für {action} verwendet."
//
// wird mit:
//
// { action: "Wiedergabe/Pause" }
//
// entsprechend ersetzt.
// -----------------------------------------------------------------------------
function interpolate(
  text: string,
  parameters:
    TranslationParameters,
): string {
  return text.replace(
    /\{([a-zA-Z0-9_]+)\}/g,
    (
      placeholder,
      parameterName: string,
    ) => {
      // -----------------------------------------------------------------------
      // Passenden Parameter suchen.
      // -----------------------------------------------------------------------
      const value =
        parameters[
          parameterName
        ];

      // -----------------------------------------------------------------------
      // Wenn kein Wert vorhanden ist, bleibt der Platzhalter sichtbar.
      //
      // Dadurch fallen fehlerhafte Übersetzungsaufrufe schneller auf.
      // -----------------------------------------------------------------------
      return value === undefined
        ? placeholder
        : String(value);
    },
  );
}

// -----------------------------------------------------------------------------
// Erstellt eine Übersetzungsfunktion für eine konkrete Sprache.
// -----------------------------------------------------------------------------
export function createTranslator(
  locale: SupportedLocale,
): Translator {
  return (
    key,
    parameters = {},
  ): string => {
    // -------------------------------------------------------------------------
    // Text aus dem gewählten Wörterbuch lesen.
    // -------------------------------------------------------------------------
    const translatedText =
      translations[
        locale
      ][
        key
      ];

    // -------------------------------------------------------------------------
    // Platzhalter ersetzen und fertigen Text zurückgeben.
    // -------------------------------------------------------------------------
    return interpolate(
      translatedText,
      parameters,
    );
  };
}