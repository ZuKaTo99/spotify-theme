// =============================================================================
// Datei: audio-capture.ts
// Zweck: Eine EXPLIZIT vom Anwender freigegebene Audioquelle prüfen und
//        deren Ressourcen zuverlässig freigeben.
//
// WARUM GETDISPLAYMEDIA?
//   Spotify stellt Erweiterungen keine dekodierten Audiosamples bereit.
//   Wenn der jeweilige Chromium-/Electron-Client die Bildschirmfreigabe MIT
//   Audio erlaubt, können die vom Anwender freigegebenen Tonspuren jedoch
//   legal über WebAudio analysiert werden. Eine Bildschirmfreigabe OHNE Ton
//   wird NICHT als funktionierender Musik-Visualizer ausgegeben.
//   Es findet KEINE Aufzeichnung, Übertragung oder Dateispeicherung statt.
//
// Wo ändern? Neue Quellen hier prüfen; React-Lifecycle im Spectrum-Hook.
// =============================================================================

export type CaptureSource = "microphone" | "system";

/** Rückgabe erklärt verständlich, warum kein Audio analysiert werden kann. */
export function requireLiveAudioTrack(stream: MediaStream): MediaStreamTrack {
  const track = stream.getAudioTracks().find((item) => item.readyState === "live");
  if (!track) {
    throw new Error("Die Freigabe enthält keine aktive Tonspur. Wähle eine Quelle mit aktivierter Audiofreigabe oder nutze das Mikrofon.");
  }
  return track;
}

/** Immer ALLE Tracks stoppen – Bildschirmfreigabe liefert auch ein Videotrack. */
export function releaseCapturedStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch { /* Bereits vom Benutzer beendet. */ }
  }
}

/** Optionen müssen aus einer echten Nutzeraktion heraus verwendet werden. */
export function displayCaptureOptions(): DisplayMediaStreamOptions {
  // `systemAudio` ist ein optionaler Hinweis, keine Funktionsgarantie.
  return { video: true, audio: true, systemAudio: "include" } as DisplayMediaStreamOptions;
}

/**
 * Erkenne TATSÄCHLICHE gemessene Audioenergie. Die Werte kommen ausschließlich
 * aus AnalyserNode.getByteFrequencyData(), nicht aus einem Demo-Spektrum.
 * Ein paar leise Quantisierungsartefakte gelten noch nicht als Audiosignal.
 */
export function hasMeasuredAudioSignal(bins: Uint8Array): boolean {
  if (!bins.length) return false;
  let significant = 0;
  for (let index = 0; index < bins.length; index += 1) {
    if (bins[index] >= 12) significant += 1;
    if (significant >= 4) return true;
  }
  return false;
}


/**
 * 64 normierte Frequenzbänder für selbst programmierte HTML-Wallpapers.
 * Die Daten stammen AUSSCHLIESSLICH aus einer freigegebenen Audioquelle,
 * nicht aus dem Spotify-DRM-Stream. Nur Momentanwerte verlassen das Hook;
 * sie werden weder aufgezeichnet noch lokal oder im Netzwerk gespeichert.
 *
 * Mit logarithmischer Bin-Verteilung bleiben besonders die tiefen/mittleren
 * Frequenzen sichtbar. Bei Stille liefern wir 64 Nullen, niemals Demo-Peaks.
 */
export function spectrum64FromByteBins(bins: Uint8Array): number[] {
  const result = new Array<number>(64).fill(0);
  if (!bins.length) return result;
  for (let i = 0; i < 64; i++) {
    const from = Math.min(bins.length - 1, Math.floor((i / 64) ** 1.7 * bins.length * 0.82));
    const to = Math.min(bins.length, Math.max(from + 1,
      Math.floor(((i + 1) / 64) ** 1.7 * bins.length * 0.82)));
    let sum = 0;
    for (let j = from; j < to; j++) sum += bins[j];
    result[i] = Math.min(1, Math.max(0, sum / ((to - from) * 255)));
  }
  return result;
}

/**
 * Browser-/Electron-Meldungen sind häufig englisch und unspezifisch.
 * Diese Abbildung erklärt nur BEKANNTE Berechtigungs- und Hardwarefehler;
 * fachliche Fehler (z. B. eine Freigabe ohne Tonspur) bleiben unverändert.
 * Wo ändern? Neue standardisierte DOMException.name-Werte hier ergänzen.
 */
export function explainCaptureError(cause: unknown, source: CaptureSource): string {
  const name = cause instanceof Error ? cause.name : "";
  const media = source === "system" ? "System-/Tab-Audio" : "Mikrofon";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return `${media}: Berechtigung wurde abgelehnt. Öffne die Freigabe erneut und erlaube den Audiozugriff.`;
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return `${media}: Es wurde keine verfügbare Audioquelle gefunden.`;
  if (name === "NotReadableError" || name === "TrackStartError")
    return `${media}: Die Audioquelle ist blockiert oder wird bereits von einer anderen Anwendung verwendet.`;
  if (name === "AbortError")
    return `${media}: Die Audiofreigabe wurde abgebrochen. Bitte erneut versuchen.`;
  if (name === "TypeError" && source === "system")
    return "Dieser Spotify-Client unterstützt die angeforderte System-/Tab-Audiofreigabe nicht. Bitte Mikrofon verwenden.";
  return cause instanceof Error ? cause.message : String(cause);
}
