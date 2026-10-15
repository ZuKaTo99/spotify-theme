// =============================================================================
// Datei: src/custom-app/modules/visualizer/video-thumbnail.ts
// Zweck: Einzelnes, kleines Standbild aus einem lokalen Videowallpaper erzeugen.
// Wo ändern? Extraktionszeit, Auflösung und Kompressionsgrenze nur hier.
// Datenschutz: Keine Server-Uploads; Video, Canvas und Blob-URL werden freigegeben.
// =============================================================================

/** Begrenzte Bildgröße, damit 12 Wallpaper keine große Vorschaudatenbank erzeugen. */
export const THUMBNAIL_MAX_BYTES = 120 * 1024;
const WIDTH = 320;
const HEIGHT = 180;
const TIMEOUT_MS = 4500;

/**
 * Browser-Decoder können bei einem unbekannten Codec scheitern. Das ist kein
 * Grund, den eigentlichen Videoimport abzubrechen: null zeigt einen Fallback.
 * Der Timeout verhindert ein festhängendes Importformular in Electron.
 */
export function createVideoThumbnail(blob: Blob): Promise<Blob | null> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let url = "";
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;

    /** Ein einziger Cleanup-Pfad für Seek, Decoderfehler und Zeitüberschreitung. */
    const finish = (image: Blob | null): void => {
      if (done) return;
      done = true;
      if (timeout !== null) clearTimeout(timeout);
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (url) URL.revokeObjectURL(url);
      resolve(image && image.size > 0 && image.size <= THUMBNAIL_MAX_BYTES ? image : null);
    };

    /** Canvas wird nur für genau einen decodierten Frame verwendet. */
    const capture = (): void => {
      try {
        if (!video.videoWidth || !video.videoHeight) return finish(null);
        const canvas = document.createElement("canvas");
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const context = canvas.getContext("2d");
        if (!context) return finish(null);
        const scale = Math.max(WIDTH / video.videoWidth, HEIGHT / video.videoHeight);
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;
        context.drawImage(video, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
        canvas.toBlob((image) => finish(image), "image/jpeg", 0.70);
      } catch { finish(null); }
    };

    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      const target = Number.isFinite(video.duration) && video.duration > 1 ? Math.min(1.5, video.duration / 2) : 0;
      if (target < 0.05) return capture();
      video.onseeked = capture;
      try { video.currentTime = target; } catch { capture(); }
    };
    timeout = setTimeout(() => finish(null), TIMEOUT_MS);
    try {
      url = URL.createObjectURL(blob);
      video.src = url;
      video.load();
    } catch { finish(null); }
  });
}
