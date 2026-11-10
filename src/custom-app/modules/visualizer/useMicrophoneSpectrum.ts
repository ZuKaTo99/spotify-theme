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
//   * Freigaben / Cleanup: audio-session.ts
//   * Audiovalidierung: audio-capture.ts
//   * Form-/Farbzeichnung: draw() unten
// =============================================================================
import type { RefObject } from "react";
import type { SpectrumStyle } from "../../../shared/visualizer-config";
import { shouldDrawSpectrum, spectrumCanvasScale, spectrumFrameIntervalMs } from "./audio-performance";
import { type CaptureSource, hasMeasuredAudioSignal, spectrum64FromByteBins } from "./audio-capture";
import { getAudioCaptureSession, type AudioResources } from "./audio-session";
import { VISUALIZER_HOST_CHANGED_EVENT, visualizerHostHidden, visualizerHostWindow } from "./visualizer-host";

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

/**
 * Ein Canvas wird mit requestAnimationFrame gezeichnet statt React 60 mal pro
 * Sekunde neu zu rendern. Die Eingabespuren werden niemals nach extern gesendet.
 */
export function useMicrophoneSpectrum(
  style: SpectrumStyle, bars: number, gain: number, smoothing: number, playing: boolean,
  color = "#1ed760", opacity = 90, glow = 6,
): SpectrumControls {
  const session = getAudioCaptureSession();
  const initial = session.snapshot();
  const canvasRef = ReactRuntime.useRef<HTMLCanvasElement>(null);
  const resourcesRef = ReactRuntime.useRef<AudioResources | null>(initial.resources);
  const frameRef = ReactRuntime.useRef<number | null>(null);
  const frameHostRef = ReactRuntime.useRef<Window | null>(null);
  const lastDrawAtRef = ReactRuntime.useRef(0);
  const startedAtRef = ReactRuntime.useRef(initial.startedAt);
  // Signalzustand ist von den gezeichneten Balken unabhängig.
  // Bei ausgeblendetem Overlay läuft nur diese günstige 700-ms-Prüfung.
  const signalTimerRef = ReactRuntime.useRef<number | null>(null);
  const signalHostRef = ReactRuntime.useRef<Window | null>(null);
  const [signal, setSignal] = ReactRuntime.useState<AudioSignalState>(initial.resources ? "waiting" : "idle");
  const settingsRef = ReactRuntime.useRef({ style, bars, gain, smoothing, playing, color, opacity, glow });
  settingsRef.current = { style, bars, gain, smoothing, playing, color, opacity, glow };
  const [activeSource, setActiveSource] = ReactRuntime.useState<CaptureSource | null>(initial.source);
  const [starting, setStarting] = ReactRuntime.useState(initial.starting);
  const [error, setError] = ReactRuntime.useState(initial.error);

  const cancelFrame = (): void => {
    if (frameRef.current !== null) {
      const host = frameHostRef.current ?? window;
      if (typeof host.cancelAnimationFrame === "function") host.cancelAnimationFrame(frameRef.current);
      else cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
    frameHostRef.current = null;
    lastDrawAtRef.current = 0;
  };
  const scheduleFrame = (callback: FrameRequestCallback): void => {
    const host = visualizerHostWindow(canvasRef.current);
    frameHostRef.current = host;
    frameRef.current = typeof host.requestAnimationFrame === "function"
      ? host.requestAnimationFrame(callback) : requestAnimationFrame(callback);
  };

  /** Nur UI-Arbeit beim Seitenwechsel beenden; die Audiofreigabe bleibt aktiv. */
  const detachVisuals = (): void => {
    cancelFrame();
    if (signalTimerRef.current !== null)
      (signalHostRef.current ?? window).clearInterval(signalTimerRef.current);
    signalTimerRef.current = null;
    signalHostRef.current = null;
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const stop = ReactRuntime.useCallback((): void => { session.stop(); }, [session]);

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
    if (!resources || !canvas) { frameRef.current = null; frameHostRef.current = null; return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { frameRef.current = null; frameHostRef.current = null; return; }
    if (!shouldDrawSpectrum(settingsRef.current.style, settingsRef.current.playing, visualizerHostHidden(canvas))) {
      // Pause, Overlay=off oder Hintergrund: den letzten Peak entfernen und
      // KEINEN weiteren RAF einplanen. Spotify-Songwechsel/Visibility-Event
      // aktivieren die Zeichenschleife spaeter gezielt wieder.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameRef.current = null;
      frameHostRef.current = null;
      return;
    }
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) {
      scheduleFrame(draw);
      return;
    }
    const now = performance.now();
    if (lastDrawAtRef.current && now - lastDrawAtRef.current < spectrumFrameIntervalMs(width, height)) {
      scheduleFrame(draw);
      return;
    }
    lastDrawAtRef.current = now;
    const ratio = spectrumCanvasScale(width, height, visualizerHostWindow(canvas).devicePixelRatio);
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
      const frameTime = config.style === "particles" ? now : 0;
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
    scheduleFrame(draw);
  }, []);

  ReactRuntime.useEffect(() => session.subscribe(() => {
    const snapshot = session.snapshot();
    const previous = resourcesRef.current;
    resourcesRef.current = snapshot.resources;
    setActiveSource(snapshot.source);
    setStarting(snapshot.starting);
    setError(snapshot.error);
    if (!snapshot.resources) {
      detachVisuals();
      setSignal("idle");
      return;
    }
    if (snapshot.resources.context.state === "suspended")
      void snapshot.resources.context.resume().catch(() => {});
    if (previous !== snapshot.resources) {
      startedAtRef.current = snapshot.startedAt;
      setSignal("waiting");
      measureSignal();
    }
    if (signalTimerRef.current === null) {
      signalHostRef.current = visualizerHostWindow(canvasRef.current);
      signalTimerRef.current = signalHostRef.current.setInterval(measureSignal, 700);
    }
    if (frameRef.current === null &&
        shouldDrawSpectrum(settingsRef.current.style, settingsRef.current.playing, visualizerHostHidden(canvasRef.current)))
      scheduleFrame(draw);
  }), [session, draw, measureSignal]);

  const startCapture = ReactRuntime.useCallback((source: CaptureSource): Promise<void> =>
    session.start(source, settingsRef.current.smoothing), [session]);

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
  // bis zu „Audio stoppen“ oder Spur-Ende aktiv, auch nach einem Seitenwechsel.
  ReactRuntime.useEffect(() => {
    session.setSmoothing(smoothing);
    // Der Übergang off -> bars/ring/wave/particles benötigt einen neuen RAF.
    // Ein bereits laufender RAF wird dabei nicht verdoppelt.
    const canDraw = shouldDrawSpectrum(style, playing, visualizerHostHidden(canvasRef.current));
    if (!canDraw && frameRef.current !== null) {
      // Ein ausstehender Frame darf bei Pause/off nicht weiterlaufen.
      cancelFrame();
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (resourcesRef.current && canDraw && frameRef.current === null)
      scheduleFrame(draw);
    measureSignal();
  }, [smoothing, style, playing, draw, measureSignal, session]);
  // Chromium kann den Custom-App-Tab ausblenden. Bei Rueckkehr braucht der
  // RAF einen Neustart – ohne neuen MediaStream oder verlorene Freigabe.
  ReactRuntime.useEffect(() => {
    let observedDoc: Document | null = null;
    const listenToHost = (): void => {
      const hostDoc = canvasRef.current?.ownerDocument ?? document;
      if (observedDoc === hostDoc) return;
      if (observedDoc && observedDoc !== document)
        observedDoc.removeEventListener("visibilitychange", resumeVisible);
      observedDoc = hostDoc;
      if (hostDoc !== document) hostDoc.addEventListener("visibilitychange", resumeVisible);
    };
    const resumeVisible = (): void => {
      listenToHost();
      const host = visualizerHostWindow(canvasRef.current);
      if (signalTimerRef.current !== null && signalHostRef.current !== host) {
        (signalHostRef.current ?? window).clearInterval(signalTimerRef.current);
        signalHostRef.current = host;
        signalTimerRef.current = host.setInterval(measureSignal, 700);
      }
      if (resourcesRef.current?.context.state === "suspended")
        void resourcesRef.current.context.resume().catch(() => {});
      if (visualizerHostHidden(canvasRef.current)) {
        // Chromium kann RAF bei Hintergrundwechsel einfrieren. Alte IDs
        // ausdrücklich verwerfen, sonst blockieren sie den spaeteren Restart.
        cancelFrame();
        return;
      }
      if (frameRef.current !== null && frameHostRef.current !== host) cancelFrame();
      if (resourcesRef.current &&
          shouldDrawSpectrum(settingsRef.current.style, settingsRef.current.playing, false) &&
          frameRef.current === null) scheduleFrame(draw);
    };
    document.addEventListener("visibilitychange", resumeVisible);
    window.addEventListener(VISUALIZER_HOST_CHANGED_EVENT, resumeVisible);
    listenToHost();
    return () => {
      document.removeEventListener("visibilitychange", resumeVisible);
      window.removeEventListener(VISUALIZER_HOST_CHANGED_EVENT, resumeVisible);
      if (observedDoc && observedDoc !== document)
        observedDoc.removeEventListener("visibilitychange", resumeVisible);
    };
  }, [draw, measureSignal]);
  ReactRuntime.useEffect(() => () => detachVisuals(), []);
  return { canvasRef, active: activeSource !== null, activeSource, signal, error,
    starting, start, startSystem, stop, getSpectrum };
}
