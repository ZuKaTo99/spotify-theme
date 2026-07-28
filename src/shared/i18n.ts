import type {
  AppLocale,
} from "./settings";

export type SupportedLocale =
  | "de"
  | "en";

const germanTranslations = {
  "app.productLabel": "Spotify Toolkit",
  "app.description":
  "Persönlicher und modularer Spotify-Arbeitsbereich.",
  "app.greeting": "Hallo, {name}!",

  "module.underDevelopment":
  "Dieses Modul wird noch entwickelt.",

  "settings.heading": "Einstellungen",
  "settings.workspaceTitle": "Workspace-Titel",
  "settings.displayName": "Anzeigename",
  "settings.displayNamePlaceholder": "Optional",
  "settings.language": "Sprache",
  "settings.languageAuto": "Automatisch",
  "settings.languageGerman": "Deutsch",
  "settings.languageEnglish": "Englisch",
  "settings.showGreeting":
    "Persönliche Begrüßung anzeigen",

  "modules.heading": "Module",
  "modules.description":
    "Funktionen aktivieren, umbenennen und sortieren.",
  "modules.customApp": "Workspace-Module",
  "modules.extension": "Spotify-Erweiterungen",
  "modules.enabled": "Aktiviert",
  "modules.displayTitle": "Anzeigename",
  "modules.order": "Reihenfolge",
  "modules.required": "Pflichtmodul",
  "modules.defaultTitlePlaceholder":
    "Standard: {title}",

  "feature.dashboard": "Dashboard",
  "feature.listening-history": "Hörverlauf",
  "feature.statistics": "Statistiken",
  "feature.favorites": "Favoriten",
  "feature.playlist-tools":
    "Playlist-Werkzeuge",
  "feature.visualizer": "Visualisierer",
  "feature.song-notes": "Song-Notizen",
  "feature.theme-studio": "Theme-Studio",
  "feature.settings": "Einstellungen",

  "feature.keyboard-shortcuts":
    "Tastenkürzel",
  "feature.sleep-timer": "Sleep-Timer",
  "feature.volume-scroll":
    "Lautstärke per Mausrad",
  "feature.copy-track-info":
    "Songinformationen kopieren",
  "feature.quick-playlist":
    "Schneller Playlist-Button",
  "feature.mini-player": "Mini-Player",
  "feature.player-statistics":
    "Player-Statistiken",
  "feature.context-actions":
    "Kontextaktionen",
} as const;

export type TranslationKey =
  keyof typeof germanTranslations;

type TranslationDictionary = Record<
  TranslationKey,
  string
>;

const englishTranslations:
  TranslationDictionary = {
    "app.productLabel": "Spotify Toolkit",
    "app.description":
      "Your personal and modular Spotify workspace.",
    "app.greeting": "Hello, {name}!",

    "module.underDevelopment":
    "This module is still under development.",

    "settings.heading": "Settings",
    "settings.workspaceTitle":
      "Workspace title",
    "settings.displayName": "Display name",
    "settings.displayNamePlaceholder":
      "Optional",
    "settings.language": "Language",
    "settings.languageAuto": "Automatic",
    "settings.languageGerman": "German",
    "settings.languageEnglish": "English",
    "settings.showGreeting":
      "Show personal greeting",

    "modules.heading": "Modules",
    "modules.description":
      "Enable, rename and reorder features.",
    "modules.customApp":
      "Workspace modules",
    "modules.extension":
      "Spotify extensions",
    "modules.enabled": "Enabled",
    "modules.displayTitle": "Display name",
    "modules.order": "Order",
    "modules.required": "Required module",
    "modules.defaultTitlePlaceholder":
      "Default: {title}",

    "feature.dashboard": "Dashboard",
    "feature.listening-history":
      "Listening history",
    "feature.statistics": "Statistics",
    "feature.favorites": "Favorites",
    "feature.playlist-tools":
      "Playlist tools",
    "feature.visualizer": "Visualizer",
    "feature.song-notes": "Song notes",
    "feature.theme-studio": "Theme Studio",
    "feature.settings": "Settings",

    "feature.keyboard-shortcuts":
      "Keyboard shortcuts",
    "feature.sleep-timer": "Sleep timer",
    "feature.volume-scroll":
      "Mouse-wheel volume",
    "feature.copy-track-info":
      "Copy track information",
    "feature.quick-playlist":
      "Quick playlist button",
    "feature.mini-player": "Mini player",
    "feature.player-statistics":
      "Player statistics",
    "feature.context-actions":
      "Context actions",
  };

const translations: Record<
  SupportedLocale,
  TranslationDictionary
> = {
  de: germanTranslations,
  en: englishTranslations,
};

export type TranslationParameters = Record<
  string,
  string | number
>;

export type Translator = (
  key: TranslationKey,
  parameters?: TranslationParameters,
) => string;

export function resolveLocale(
  configuredLocale: AppLocale,
): SupportedLocale {
  if (
    configuredLocale === "de" ||
    configuredLocale === "en"
  ) {
    return configuredLocale;
  }

  const browserLocales = [
    ...navigator.languages,
    navigator.language,
  ];

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

function interpolate(
  text: string,
  parameters: TranslationParameters,
): string {
  return text.replace(
    /\{([a-zA-Z0-9_]+)\}/g,
    (
      placeholder,
      parameterName: string,
    ) => {
      const value =
        parameters[parameterName];

      return value === undefined
        ? placeholder
        : String(value);
    },
  );
}

export function createTranslator(
  locale: SupportedLocale,
): Translator {
  return (
    key,
    parameters = {},
  ): string => {
    const translatedText =
      translations[locale][key];

    return interpolate(
      translatedText,
      parameters,
    );
  };
}