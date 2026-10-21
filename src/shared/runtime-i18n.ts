// =============================================================================
// Datei: src/shared/runtime-i18n.ts
// Zweck: Deutsch/Englisch für Extension-Notifications bei jeder Nutzeraktion.
// =============================================================================
import { createTranslator, resolveLocale, type TranslationKey, type TranslationParameters } from "./i18n";
import { loadSettings } from "./settings";

/** Settings live lesen, damit ein Sprachwechsel keinen Extension-Neustart erfordert. */
export function runtimeText(key: TranslationKey, parameters?: TranslationParameters): string {
  // Eine Fehlermeldung wird gerade bei defektem Spotify-Storage gebraucht.
  // Die Übersetzung darf deshalb nicht selbst am Storage-Lesezugriff scheitern.
  let locale: "auto" | "de" | "en" = "auto";
  try {
    locale = loadSettings().locale;
  } catch (error) {
    console.warn("[ZuKaTo] Sprache konnte nicht gelesen werden; Browser-Sprache wird verwendet.", error);
  }
  return createTranslator(resolveLocale(locale))(key, parameters);
}
