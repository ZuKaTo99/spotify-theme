// =============================================================================
// Datei: src/shared/runtime-i18n.ts
// Zweck: Deutsch/Englisch für Extension-Notifications bei jeder Nutzeraktion.
// =============================================================================
import { createTranslator, resolveLocale, type TranslationKey, type TranslationParameters } from "./i18n";
import { loadSettings } from "./settings";

/** Settings live lesen, damit ein Sprachwechsel keinen Extension-Neustart erfordert. */
export function runtimeText(key: TranslationKey, parameters?: TranslationParameters): string {
  const translator = createTranslator(resolveLocale(loadSettings().locale));
  return translator(key, parameters);
}
