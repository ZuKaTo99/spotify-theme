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
import { displayCaptureOptions, releaseCapturedStream, requireLiveAudioTrack, type CaptureSource, hasMeasuredAudioSignal } from "./audio-capture";

const ReactRuntime = Spicetify.React as typeof import("react");

export type AudioSignalState = "idle" | "waiting" | "detected" | "silent" | "paused";

export interface SpectrumControls {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
  activeSource: CaptureSource | null;
  /** Diagnose: verbunden ist nicht dasselbe wie hörbares Audiosignal. */
  signal: AudioSignalState;
  error: string;
  start: () => Promise<void>;
  startSystem: () => Promise<void>;
  stop: () => void;
}

interface AudioResources {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  track: MediaStreamTrack;
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
  const lastSignalCheckRef = ReactRuntime.useRef(0);
  const [signal, setSignal] = ReactRuntime.useState<AudioSignalState>("idle");
  const settingsRef = ReactRuntime.useRef({ style, bars, gain, smoothing, playing, color, opacity, glow });
  settingsRef.current = { style, bars, gain, smoothing, playing, color, opacity, glow };
  const [activeSource, setActiveSource] = ReactRuntime.useState<CaptureSource | null>(null);
  const [error, setError] = ReactRuntime.useState("");

  /** Beendet jede Spur (auch Bildschirm-Video), WebAudio und die Animation. */
  const stop = ReactRuntime.useCallback((): void => {
    generation.current += 1;
    pendingRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const old = resourcesRef.current;
    resourcesRef.current = null;
    if (old) {
      old.track.removeEventListener("ended", old.onEnded);
      releaseCapturedStream(old.stream);
      void old.context.close().catch(() => {});
    }
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setActiveSource(null);
    setSignal("idle");
  }, []);

  /** Alle dargestellten Werte stammen unverändert aus einem echten Analyser. */
  const draw = ReactRuntime.useCallback((): void => {
    const resources = resourcesRef.current;
    const canvas = canvasRef.current;
    if (!resources || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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
    // Auch eine freigegebene Tonspur kann stumm sein. Ein günstiger Messwert
    // alle 700 ms meldet den tatsächlichen Zustand, ohne React pro Frame
    // zu aktualisieren oder Songdaten/Audio in irgendeiner Form zu speichern.
    const now = performance.now();
    if (now - lastSignalCheckRef.current >= 700) {
      lastSignalCheckRef.current = now;
      let next: AudioSignalState = "paused";
      if (config.playing) {
        const measurements = new Uint8Array(resources.analyser.frequencyBinCount);
        resources.analyser.getByteFrequencyData(measurements);
        next = hasMeasuredAudioSignal(measurements) ? "detected"
          : now - startedAtRef.current < 2200 ? "waiting" : "silent";
      }
      setSignal((previous) => previous === next ? previous : next);
    }
    if (config.playing && config.style !== "off") {
      const buffer = new Uint8Array(resources.analyser.frequencyBinCount);
      const barCount = config.bars;
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
              const orbit = (index / barCount) * Math.PI * 2 + performance.now() * 0.00012;
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
      track.addEventListener("ended", onEnded);
      // Beim expliziten Stoppen der Bildschirmfreigabe können auch die
      // Videospuren enden, ohne dass die Audio-Spur ein `ended` auslöst.
      for (const videoTrack of stream.getVideoTracks()) videoTrack.addEventListener("ended", onEnded, { once: true });
      resourcesRef.current = { stream, context, analyser, track, onEnded };
      startedAtRef.current = performance.now();
      lastSignalCheckRef.current = 0;
      setSignal("waiting");
      setActiveSource(source);
      frameRef.current = requestAnimationFrame(draw);
    } catch (cause) {
      releaseCapturedStream(stream);
      if (context) void context.close().catch(() => {});
      if (generation.current === token) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setActiveSource(null);
      }
    } finally {
      if (generation.current === token) pendingRef.current = false;
    }
  }, [draw, stop]);

  const start = ReactRuntime.useCallback(() => startCapture("microphone"), [startCapture]);
  const startSystem = ReactRuntime.useCallback(() => startCapture("system"), [startCapture]);

  ReactRuntime.useEffect(() => {
    if (resourcesRef.current) resourcesRef.current.analyser.smoothingTimeConstant = smoothing;
    if (style === "off" && resourcesRef.current) stop();
  }, [smoothing, style, stop]);
  ReactRuntime.useEffect(() => () => stop(), [stop]);
  return { canvasRef, active: activeSource !== null, activeSource, signal, error, start, startSystem, stop };
}
