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
