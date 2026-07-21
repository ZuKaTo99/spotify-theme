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

    "settings.heading": "Settings",
    "settings.workspaceTitle": "Workspace title",
    "settings.displayName": "Display name",
    "settings.displayNamePlaceholder": "Optional",
    "settings.language": "Language",
    "settings.languageAuto": "Automatic",
    "settings.languageGerman": "German",
    "settings.languageEnglish": "English",
    "settings.showGreeting":
      "Show personal greeting",
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

/**
 * Ermittelt die tatsächlich verwendete Sprache.
 *
 * Bei "auto" wird die Sprache des Spotify-Clients
 * beziehungsweise des eingebetteten Browsers verwendet.
 */
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

/**
 * Ersetzt Platzhalter wie {name} kontrolliert.
 */
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

/**
 * Erstellt eine typisierte Übersetzungsfunktion.
 *
 * Nicht vorhandene Übersetzungsschlüssel werden bereits
 * während der TypeScript-Prüfung erkannt.
 */
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