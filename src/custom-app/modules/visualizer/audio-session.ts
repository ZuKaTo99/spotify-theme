import { displayCaptureOptions, explainCaptureError, releaseCapturedStream, requireLiveAudioTrack, type CaptureSource } from "./audio-capture";

/** Eine Audiofreigabe gehört zur Spotify-Sitzung, nicht zur gerade offenen Seite. */
export interface AudioResources {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  frequencyBytes: Uint8Array<ArrayBuffer>;
  waveformBytes: Uint8Array<ArrayBuffer>;
  tracks: MediaStreamTrack[];
  onEnded: () => void;
}

export interface AudioSessionSnapshot {
  resources: AudioResources | null;
  source: CaptureSource | null;
  starting: boolean;
  error: string;
  startedAt: number;
}

export class AudioCaptureSession {
  private resources: AudioResources | null = null;
  private source: CaptureSource | null = null;
  private starting = false;
  private error = "";
  private startedAt = 0;
  private generation = 0;
  private listeners = new Set<() => void>();

  snapshot(): AudioSessionSnapshot {
    return { resources: this.resources, source: this.source, starting: this.starting,
      error: this.error, startedAt: this.startedAt };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    listener();
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  setSmoothing(value: number): void {
    if (this.resources) this.resources.analyser.smoothingTimeConstant = value;
  }

  /** Direkt aus dem Button aufrufen: getDisplayMedia verlangt eine Nutzeraktion. */
  async start(source: CaptureSource, smoothing: number): Promise<void> {
    if (this.resources || this.starting) return;
    this.starting = true;
    this.error = "";
    const token = ++this.generation;
    this.notify();
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      if (source === "system") {
        if (!navigator.mediaDevices?.getDisplayMedia)
          throw new Error("Dieser Spotify-Client unterstützt keine Bildschirm-/Tab-Audiofreigabe. Bitte Mikrofon verwenden.");
        stream = await navigator.mediaDevices.getDisplayMedia(displayCaptureOptions());
      } else {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Mikrofonzugriff wird in diesem Spotify-Client nicht unterstützt.");
        stream = await navigator.mediaDevices.getUserMedia({ audio: {
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        } });
      }
      if (token !== this.generation) { releaseCapturedStream(stream); return; }
      const track = requireLiveAudioTrack(stream);
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = smoothing;
      context.createMediaStreamSource(stream).connect(analyser);
      await context.resume();
      if (token !== this.generation) { releaseCapturedStream(stream); await context.close(); return; }
      const onEnded = (): void => {
        this.stop();
        this.error = "Die Audiofreigabe wurde beendet.";
        this.notify();
      };
      const tracks = [track, ...stream.getVideoTracks()];
      for (const mediaTrack of tracks) mediaTrack.addEventListener("ended", onEnded);
      this.resources = {
        stream, context, analyser, tracks, onEnded,
        frequencyBytes: new Uint8Array(analyser.frequencyBinCount),
        waveformBytes: new Uint8Array(analyser.fftSize),
      };
      this.source = source;
      this.startedAt = performance.now();
      this.notify();
    } catch (cause) {
      const attached = this.resources?.stream === stream;
      if (attached) this.stop();
      else {
        releaseCapturedStream(stream);
        if (context) void context.close().catch(() => {});
      }
      if (attached || token === this.generation) {
        this.error = explainCaptureError(cause, source);
        this.notify();
      }
    } finally {
      if (token === this.generation) {
        this.starting = false;
        this.notify();
      }
    }
  }

  /** Nur ausdrückliches Stoppen oder das Ende einer Spur gibt die Quelle frei. */
  stop(): void {
    this.generation += 1;
    this.starting = false;
    this.error = "";
    const old = this.resources;
    this.resources = null;
    this.source = null;
    this.startedAt = 0;
    if (old) {
      for (const track of old.tracks) track.removeEventListener("ended", old.onEnded);
      releaseCapturedStream(old.stream);
      void old.context.close().catch(() => {});
    }
    this.notify();
  }
}

/** Spicetify kann die Custom App nach einem Routenwechsel neu auswerten. */
export function getAudioCaptureSession(): AudioCaptureSession {
  const host = window as Window & { __zukatoAudioCaptureSession?: AudioCaptureSession };
  return host.__zukatoAudioCaptureSession ??= new AudioCaptureSession();
}
