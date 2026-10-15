// =============================================================================
// Datei: ScenePreview.tsx
// Zweck: Importierte HTML-Wallpapers/Videoclips vor der Zuordnung direkt prüfen.
// Wo ändern? Nur die Vorschau und ihren Blob-/Iframe-Lebenszyklus hier.
// Sicherheit: HTML wird in derselben isolierten CSP-Sandbox wie im Player
// geöffnet, niemals als React-HTML im privilegierten Spotify-Dokument.
// =============================================================================
import type { ReactElement } from "react";
import { loadScene } from "./scene-store";
import { ensureWallpaperCsp } from "./web-wallpaper";

const ReactRuntime = Spicetify.React as typeof import("react");

type Preview = { kind: "html" | "video"; html: string; url: string };

export function ScenePreview({ id, onError }: { id: string; onError: (message: string) => void }): ReactElement {
  const [preview, setPreview] = ReactRuntime.useState<Preview | null>(null);
  const onErrorRef = ReactRuntime.useRef(onError);
  onErrorRef.current = onError;

  ReactRuntime.useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setPreview(null);
    void loadScene(id).then(async (scene) => {
      if (cancelled) return;
      if (!scene) throw new Error("Wallpaper nicht mehr vorhanden.");
      if (scene.kind === "html") {
        const html = ensureWallpaperCsp(await scene.blob.text());
        if (!cancelled) setPreview({ kind: "html", html, url: "" });
      } else {
        objectUrl = URL.createObjectURL(scene.blob);
        if (!cancelled) setPreview({ kind: "video", html: "", url: objectUrl });
      }
    }).catch((error: unknown) => {
      if (!cancelled) onErrorRef.current(String(error));
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return <div className="zukato-viz__scene-preview" aria-label="Wallpaper-Vorschau">
    {!preview && <span>…</span>}
    {preview?.kind === "html" && <iframe key={id} title="Isolierte Wallpaper-Vorschau"
      sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={preview.html}
      onLoad={(event) => event.currentTarget.contentWindow?.postMessage({
        zukatoWallpaper: true, playing: true, run: 0, positionMs: 0, durationMs: 0,
      }, "*")} />}
    {preview?.kind === "video" && <video key={id} src={preview.url} muted autoPlay playsInline loop controls
      onError={() => onErrorRef.current("Video-Vorschau ist in diesem Client nicht abspielbar.")} />}
  </div>;
}
