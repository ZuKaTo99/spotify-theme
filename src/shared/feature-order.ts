// =============================================================================
// Datei: src/shared/feature-order.ts
// Zweck: Gültige Modul-Sortierpositionen prüfen, ohne während der Texteingabe
//        NaN oder unvollständige Werte in die gespeicherten Settings zu schreiben.
// =============================================================================

/** Nur ganze, endliche Sortierpositionen zwischen 0 und 10000 sind zulässig. */
export function parseFeatureOrderDraft(value: string): number | null {
  const text = value.trim();
  // Leere Eingaben, Vorzeichen, Exponentialschreibweise und Dezimalwerte
  // nicht normalisieren; der vorherige gespeicherte Wert bleibt erhalten.
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 0 && number <= 10000
    ? number : null;
}
