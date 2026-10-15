// =============================================================================
// Datei: src/custom-app/modules/visualizer/useMicrophoneSpectrum.ts
// Zweck: ECHTE Frequenzanalyse aus einem bewusst freigegebenen Mikrofonstream.
// Wo ändern? Formen der grafischen Darstellung und Audio-Analyse nur hier.
// Hinweis: Der Mikrofonstream ist NICHT Spotifys digitaler Audiostream!
// =============================================================================
import type { RefObject } from "react";
import type { SpectrumStyle } from "../../../shared/visualizer-config";

const ReactRuntime = Spicetify.React as typeof import("react");

export interface SpectrumControls {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
  error: string;
  start: () => Promise<void>;
  stop: () => void;
}

interface AudioResources { stream: MediaStream; context: AudioContext; analyser: AnalyserNode }

/**
 * Ein Canvas wird mit requestAnimationFrame gezeichnet, ohne 60 React-Render pro Sekunde.
 * Alle MediaStream-Tracks und der AudioContext werden beim Verlassen geschlossen.
 */
export function useMicrophoneSpectrum(
  style: SpectrumStyle, bars: number, gain: number, smoothing: number, playing: boolean,
  color = "#1ed760", opacity = 90, glow = 6,
): SpectrumControls {
  const canvasRef = ReactRuntime.useRef<HTMLCanvasElement>(null);
  const resourcesRef = ReactRuntime.useRef<AudioResources | null>(null);
  const frameRef = ReactRuntime.useRef<number | null>(null);
  const generation = ReactRuntime.useRef(0);
  const settingsRef = ReactRuntime.useRef({ style, bars, gain, smoothing, playing, color, opacity, glow });
  settingsRef.current = { style, bars, gain, smoothing, playing, color, opacity, glow };
  const [active, setActive] = ReactRuntime.useState(false);
  const [error, setError] = ReactRuntime.useState("");

  /** Gemeinsamer Stop-Handler: verhindert offene Mikrofone nach Modulwechsel. */
  const stop = ReactRuntime.useCallback((): void => {
    generation.current += 1;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const old = resourcesRef.current;
    resourcesRef.current = null;
    if (old) {
      old.stream.getTracks().forEach((track) => track.stop());
      void old.context.close().catch(() => {});
    }
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setActive(false);
  }, []);

  /** Zeichnet Balken, Ring, Wellenform oder Partikel aus echten Audio-Bufferwerten. */
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
      canvas.width = targetW; canvas.height = targetH;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const config = settingsRef.current;
    if (config.playing && config.style !== "off") {
      const buffer = new Uint8Array(resources.analyser.frequencyBinCount);
      const barCount = config.bars;
      // Der Anwender kontrolliert die Optik, die Audiowerte bleiben unverfälscht.
      // save/restore verhindert, dass Transparenz/Schatten andere Frames beeinflussen.
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
          // Logarithmische Frequenzbins machen Bass/Mitten besser sichtbar.
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
            const cx = width / 2; const cy = height / 2;
            if (config.style === "particles") {
              // Jede Partikelposition basiert auf einem echten Frequenzbin.
              // Ohne Mikrofonfreigabe wird dieser Zeichenpfad nicht aufgerufen.
              const orbit = (index / barCount) * Math.PI * 2 + performance.now() * 0.00012;
              const distance = radius + intensity * Math.min(width, height) * 0.3;
              const px = cx + Math.cos(orbit) * distance;
              const py = cy + Math.sin(orbit) * distance;
              ctx.beginPath();
              ctx.arc(px, py, 1.2 + intensity * 7, 0, Math.PI * 2);
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

  /** getUserMedia nur nach Klick; Ablehnung wird angezeigt, nie still umgangen. */
  const start = ReactRuntime.useCallback(async (): Promise<void> => {
    if (resourcesRef.current) return;
    setError("");
    const token = ++generation.current;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Mikrofonfreigabe wird in diesem Client nicht unterstützt.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (generation.current !== token) { stream.getTracks().forEach((track) => track.stop()); return; }
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = settingsRef.current.smoothing;
      context.createMediaStreamSource(stream).connect(analyser);
      await context.resume();
      if (generation.current !== token) {
        stream.getTracks().forEach((track) => track.stop());
        await context.close();
        return;
      }
      resourcesRef.current = { stream, context, analyser };
      setActive(true);
      frameRef.current = requestAnimationFrame(draw);
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context) void context.close().catch(() => {});
      if (generation.current === token) setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [draw]);

  /** Live-Smoothing aktualisieren und auf Stil „Aus“ mit Freigabe reagieren. */
  ReactRuntime.useEffect(() => {
    if (resourcesRef.current) resourcesRef.current.analyser.smoothingTimeConstant = smoothing;
    if (style === "off" && resourcesRef.current) stop();
  }, [smoothing, style, stop]);
  ReactRuntime.useEffect(() => () => stop(), [stop]);
  return { canvasRef, active, error, start, stop };
}
