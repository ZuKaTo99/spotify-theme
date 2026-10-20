// =============================================================================
// Datei: useMicrophoneSpectrum.ts
// Zweck: Reaktive Echtzeitgrafik aus ausdrücklich freigegebenem Audio.
//
// WICHTIGE GRENZE:
//   Spicetify bietet keinen direkten digitalen Spotify-Audiostream an.
//   Audio kommt entweder vom eigenen Mikrofon ODER optional von einer
//   Bildschirm-/Tab-Freigabe mit Audiotrack. Die Desktop-Version von Spotify
//   kann letzteres verweigern. Stille erzeugt KEINE erfundenen Peaks.
//
// Wo ändern?
//   * Freigaben / Cleanup: startCapture() und stop() unten
//   * Audiovalidierung: audio-capture.ts
//   * Form-/Farbzeichnung: draw() unten
// =============================================================================
import type { RefObject } from "react";
import type { SpectrumStyle } from "../../../shared/visualizer-config";
import { shouldDrawSpectrum } from "./audio-performance";
import { displayCaptureOptions, releaseCapturedStream, requireLiveAudioTrack, type CaptureSource, hasMeasuredAudioSignal, spectrum64FromByteBins, explainCaptureError } from "./audio-capture";

const ReactRuntime = Spicetify.React as typeof import("react");

export type AudioSignalState = "idle" | "waiting" | "detected" | "silent" | "paused";

export interface SpectrumControls {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
  activeSource: CaptureSource | null;
  /** Diagnose: verbunden ist nicht dasselbe wie hörbares Audiosignal. */
  signal: AudioSignalState;
  error: string;
  /** Eine noch offene Browser-Freigabe darf kein zweites Dialogfenster öffnen. */
  starting: boolean;
  start: () => Promise<void>;
  startSystem: () => Promise<void>;
  stop: () => void;
  /** Snapshot, nie Audio-Rohdaten: 64 Frequenzwerte aus freigegebener Quelle. */
  getSpectrum: () => number[] | null;
}

interface AudioResources {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  /** Einmal pro Freigabe anlegen statt 20-60 Arrays pro Sekunde. */
  frequencyBytes: Uint8Array<ArrayBuffer>;
  /** Waveform nutzt die volle FFT-Laenge; die Frequenz nur deren Haelfte. */
  waveformBytes: Uint8Array<ArrayBuffer>;
  /** Alle Audio-/Videospuren tragen denselben End-Listener. */
  tracks: MediaStreamTrack[];
  onEnded: () => void;
}

/**
 * Ein Canvas wird mit requestAnimationFrame gezeichnet statt React 60 mal pro
 * Sekunde neu zu rendern. Die Eingabespuren werden niemals nach extern gesendet.
 */
export function useMicrophoneSpectrum(
  style: SpectrumStyle, bars: number, gain: number, smoothing: number, playing: boolean,
  color = "#1ed760", opacity = 90, glow = 6,
): SpectrumControls {
  const canvasRef = ReactRuntime.useRef<HTMLCanvasElement>(null);
  const resourcesRef = ReactRuntime.useRef<AudioResources | null>(null);
  const frameRef = ReactRuntime.useRef<number | null>(null);
  const generation = ReactRuntime.useRef(0);
  const pendingRef = ReactRuntime.useRef(false);
  const startedAtRef = ReactRuntime.useRef(0);
  // Signalzustand ist von den gezeichneten Balken unabhängig.
  // Bei ausgeblendetem Overlay läuft nur diese günstige 700-ms-Prüfung.
  const signalTimerRef = ReactRuntime.useRef<number | null>(null);
  const [signal, setSignal] = ReactRuntime.useState<AudioSignalState>("idle");
  const settingsRef = ReactRuntime.useRef({ style, bars, gain, smoothing, playing, color, opacity, glow });
  settingsRef.current = { style, bars, gain, smoothing, playing, color, opacity, glow };
  const [activeSource, setActiveSource] = ReactRuntime.useState<CaptureSource | null>(null);
  const [starting, setStarting] = ReactRuntime.useState(false);
  const [error, setError] = ReactRuntime.useState("");

  /** Beendet jede Spur (auch Bildschirm-Video), WebAudio und die Animation. */
  const stop = ReactRuntime.useCallback((): void => {
    generation.current += 1;
    pendingRef.current = false;
    setStarting(false);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (signalTimerRef.current !== null) window.clearInterval(signalTimerRef.current);
    signalTimerRef.current = null;
    const old = resourcesRef.current;
    resourcesRef.current = null;
    if (old) {
      for (const track of old.tracks) track.removeEventListener("ended", old.onEnded);
      releaseCapturedStream(old.stream);
      void old.context.close().catch(() => {});
    }
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setActiveSource(null);
    setSignal("idle");
  }, []);

  /**
   * Audioerkennung unabhängig vom Canvas: auch im Modus „off“ bleibt die
   * Statusanzeige korrekt, ohne einen versteckten 60-fps-Zeichenloop zu fahren.
   * Diese Messwerte verlassen den Prozess nicht und werden nicht gespeichert.
   */
  const measureSignal = ReactRuntime.useCallback((): void => {
    const resource = resourcesRef.current;
    if (!resource) return;
    const now = performance.now();
    let next: AudioSignalState = "paused";
    if (settingsRef.current.playing) {
      resource.analyser.getByteFrequencyData(resource.frequencyBytes);
      next = hasMeasuredAudioSignal(resource.frequencyBytes) ? "detected"
        : now - startedAtRef.current < 2200 ? "waiting" : "silent";
    }
    setSignal((previous) => previous === next ? previous : next);
  }, []);

  const draw = ReactRuntime.useCallback((): void => {
    const resources = resourcesRef.current;
    const canvas = canvasRef.current;
    if (!resources || !canvas) { frameRef.current = null; return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { frameRef.current = null; return; }
    if (!shouldDrawSpectrum(settingsRef.current.style, settingsRef.current.playing, (typeof document !== "undefined" && document.hidden))) {
      // Pause, Overlay=off oder Hintergrund: den letzten Peak entfernen und
      // KEINEN weiteren RAF einplanen. Spotify-Songwechsel/Visibility-Event
      // aktivieren die Zeichenschleife spaeter gezielt wieder.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameRef.current = null;
      return;
    }
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) {
      frameRef.current = requestAnimationFrame(draw);
      return;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.floor(width * ratio);
    const targetH = Math.floor(height * ratio);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const config = settingsRef.current;
    if (config.playing && config.style !== "off") {
      // Beide Buffer werden innerhalb der Audiofreigabe wiederverwendet.
      const buffer = config.style === "wave" ? resources.waveformBytes : resources.frequencyBytes;
      const barCount = config.bars;
      const frameTime = config.style === "particles" ? performance.now() : 0;
      const tint = /^#[0-9a-f]{6}$/i.test(config.color) ? config.color : "#1ed760";
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0.1, config.opacity / 100));
      ctx.shadowColor = tint;
      ctx.shadowBlur = Math.min(30, Math.max(0, config.glow));
      ctx.strokeStyle = tint;
      ctx.fillStyle = tint;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      if (config.style === "wave") {
        resources.analyser.getByteTimeDomainData(buffer);
        ctx.beginPath();
        for (let i = 0; i < buffer.length; i += 2) {
          const x = (i / (buffer.length - 1)) * width;
          const y = height / 2 + ((buffer[i] - 128) / 128) * height * 0.3 * config.gain;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        resources.analyser.getByteFrequencyData(buffer);
        for (let index = 0; index < barCount; index += 1) {
          const position = (index / Math.max(1, barCount - 1)) ** 1.7;
          const bin = Math.min(buffer.length - 1, Math.floor(position * buffer.length * 0.62));
          const intensity = Math.min(1, (buffer[bin] / 255) * config.gain);
          if (config.style === "bars") {
            const slot = width / barCount;
            const barHeight = Math.max(2, intensity * height * 0.7);
            ctx.fillRect(index * slot + slot * 0.18, height - barHeight - 12, slot * 0.64, barHeight);
          } else {
            const angle = (index / barCount) * Math.PI * 2 - Math.PI / 2;
            const radius = Math.min(width, height) * 0.18;
            const length = Math.max(3, intensity * Math.min(width, height) * 0.22);
            const cx = width / 2;
            const cy = height / 2;
            if (config.style === "particles") {
              const orbit = (index / barCount) * Math.PI * 2 + frameTime * 0.00012;
              const distance = radius + intensity * Math.min(width, height) * 0.3;
              ctx.beginPath();
              ctx.arc(cx + Math.cos(orbit) * distance, cy + Math.sin(orbit) * distance, 1.2 + intensity * 7, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
              ctx.lineTo(cx + Math.cos(angle) * (radius + length), cy + Math.sin(angle) * (radius + length));
              ctx.stroke();
            }
          }
        }
      }
      ctx.restore();
    }
    frameRef.current = requestAnimationFrame(draw);
  }, []);

  /**
   * Sowohl Mikrofon als auch Systemton starten hier. Das Aufrufen von
   * getDisplayMedia erfolgt DIREKT innerhalb der Button-Aktion; sonst kann
   * der Browser die nötige Nutzeraktivierung verlieren.
   */
  const startCapture = ReactRuntime.useCallback(async (source: CaptureSource): Promise<void> => {
    if (resourcesRef.current || pendingRef.current) return;
    pendingRef.current = true;
    setStarting(true);
    setError("");
    const token = ++generation.current;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      if (source === "system") {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error("Dieser Spotify-Client unterstützt keine Bildschirm-/Tab-Audiofreigabe. Bitte Mikrofon verwenden.");
        }
        stream = await navigator.mediaDevices.getDisplayMedia(displayCaptureOptions());
      } else {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Mikrofonzugriff wird in diesem Spotify-Client nicht unterstützt.");
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      }
      if (generation.current !== token) {
        releaseCapturedStream(stream);
        return;
      }
      // Wichtig: audio:true bei Bildschirmfreigabe garantiert KEINEN Ton!
      const track = requireLiveAudioTrack(stream);
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = settingsRef.current.smoothing;
      context.createMediaStreamSource(stream).connect(analyser);
      await context.resume();
      if (generation.current !== token) {
        releaseCapturedStream(stream);
        await context.close();
        return;
      }
      const onEnded = (): void => { setError("Die Audiofreigabe wurde beendet."); stop(); };
      // Auch die Videospuren der Bildschirmfreigabe können alleine enden.
      // Beim Stoppen ALLE Listener entfernen; sonst feuern alte Freigaben
      // nach dem Start einer neuen Session in den aktuellen Visualizer.
      const tracks = [track, ...stream.getVideoTracks()];
      for (const mediaTrack of tracks) mediaTrack.addEventListener("ended", onEnded);
      resourcesRef.current = {
        stream, context, analyser, tracks, onEnded,
        frequencyBytes: new Uint8Array(analyser.frequencyBinCount),
        waveformBytes: new Uint8Array(analyser.fftSize),
      };
      startedAtRef.current = performance.now();
      setSignal("waiting");
      setActiveSource(source);
      // Signalerkennung auch ohne sichtbare Balken. Die Timer werden beim
      // Stoppen und nach Spur-Ende gemeinsam aufgeräumt.
      measureSignal();
      signalTimerRef.current = window.setInterval(measureSignal, 700);
      if (shouldDrawSpectrum(settingsRef.current.style, settingsRef.current.playing, (typeof document !== "undefined" && document.hidden)))
        frameRef.current = requestAnimationFrame(draw);
    } catch (cause) {
      // Wenn ein Fehler ERST nach dem Einhängen der Stream-Ressourcen
      // auftritt, dürfen weder alte Listener noch ein halbaktiver Stream
      // zurückbleiben. Andernfalls stoppt ein späterer Klick dieselbe Spur
      // zweimal und verhindert anschließend neue Audiofreigaben.
      if (resourcesRef.current?.stream === stream) {
        const attached = resourcesRef.current;
        resourcesRef.current = null;
        for (const mediaTrack of attached.tracks)
          mediaTrack.removeEventListener("ended", attached.onEnded);
        if (signalTimerRef.current !== null) window.clearInterval(signalTimerRef.current);
        signalTimerRef.current = null;
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      releaseCapturedStream(stream);
      if (context) void context.close().catch(() => {});
      if (generation.current === token) {
        setError(explainCaptureError(cause, source));
        setActiveSource(null);
      }
    } finally {
      if (generation.current === token) {
        pendingRef.current = false;
        setStarting(false);
      }
    }
  }, [draw, measureSignal, stop]);

  // Eine eigene Abfrage statt 60 React-Renders/s: SceneBackdrop übernimmt die
  // Übertragung maximal zwanzigmal pro Sekunde, solange eine echte Freigabe läuft.
  const getSpectrum = ReactRuntime.useCallback((): number[] | null => {
    const resource = resourcesRef.current;
    if (!resource || !settingsRef.current.playing ||
        resource.stream.getAudioTracks().every((track) => track.readyState !== "live")) return null;
    resource.analyser.getByteFrequencyData(resource.frequencyBytes);
    return spectrum64FromByteBins(resource.frequencyBytes);
  }, []);

  const start = ReactRuntime.useCallback(() => startCapture("microphone"), [startCapture]);
  const startSystem = ReactRuntime.useCallback(() => startCapture("system"), [startCapture]);

  // Eine Nebula-/HTML-Szene kann Audio benötigen, selbst wenn ZuKaTos eigene
  // Balken ausgeblendet sind. „off“ betrifft deshalb ausschließlich das
  // gezeichnete Overlay – eine ausdrücklich freigegebene Audioquelle bleibt
  // bis zu „Audio stoppen“, Spur-Ende oder Unmount aktiv.
  ReactRuntime.useEffect(() => {
    if (resourcesRef.current) resourcesRef.current.analyser.smoothingTimeConstant = smoothing;
    // Der Übergang off -> bars/ring/wave/particles benötigt einen neuen RAF.
    // Ein bereits laufender RAF wird dabei nicht verdoppelt.
    const canDraw = shouldDrawSpectrum(style, playing,
      (typeof document !== "undefined" && document.hidden));
    if (!canDraw && frameRef.current !== null) {
      // Ein ausstehender Frame darf bei Pause/off nicht weiterlaufen.
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (resourcesRef.current && canDraw && frameRef.current === null)
      frameRef.current = requestAnimationFrame(draw);
    measureSignal();
  }, [smoothing, style, playing, draw, measureSignal]);
  // Chromium kann den Custom-App-Tab ausblenden. Bei Rueckkehr braucht der
  // RAF einen Neustart – ohne neuen MediaStream oder verlorene Freigabe.
  ReactRuntime.useEffect(() => {
    const resumeVisible = (): void => {
      if (document.hidden) {
        // Chromium kann RAF bei Hintergrundwechsel einfrieren. Alte IDs
        // ausdrücklich verwerfen, sonst blockieren sie den spaeteren Restart.
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        return;
      }
      if (resourcesRef.current &&
          shouldDrawSpectrum(settingsRef.current.style, settingsRef.current.playing, false) &&
          frameRef.current === null) frameRef.current = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", resumeVisible);
    return () => document.removeEventListener("visibilitychange", resumeVisible);
  }, [draw]);
  ReactRuntime.useEffect(() => () => stop(), [stop]);
  return { canvasRef, active: activeSource !== null, activeSource, signal, error,
    starting, start, startSystem, stop, getSpectrum };
}
