// =============================================================================
// Datei: ScenePreview.tsx
// Zweck: Importierte HTML-Wallpapers/Videoclips vor der Zuordnung direkt prüfen.
// Wo ändern? Nur die Vorschau und ihren Blob-/Iframe-Lebenszyklus hier.
// Sicherheit: HTML wird in derselben isolierten CSP-Sandbox wie im Player
// geöffnet, niemals als React-HTML im privilegierten Spotify-Dokument.
// =============================================================================
import type { ReactElement } from "react";
import { loadScene, loadSceneProject } from "./scene-store";
import { renderWallpaperProject, type WallpaperRuntimeAsset } from "./wallpaper-project";
import { ensureWallpaperCsp } from "./web-wallpaper";

const ReactRuntime = Spicetify.React as typeof import("react");

type Preview = { kind: "html" | "video"; html: string; url: string;
  runtime?: { html: string; assets: WallpaperRuntimeAsset[] } };

export function ScenePreview({ id, onError }: { id: string; onError: (message: string) => void }): ReactElement {
  const [preview, setPreview] = ReactRuntime.useState<Preview | null>(null);
  const onErrorRef = ReactRuntime.useRef(onError);
  const initializedFrame = ReactRuntime.useRef("");
  const frameRef = ReactRuntime.useRef<HTMLIFrameElement>(null);
  onErrorRef.current = onError;
  // Bootstrap-Fehler aus der isolierten Vorschau anzeigen. Die Nachricht
  // enthält nie private Spotify-Daten oder Details aus dem HTML-Projekt.
  ReactRuntime.useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (event.source === frameRef.current?.contentWindow &&
          event.data?.zukatoProjectError === true) {
        onErrorRef.current("Wallpaper-Vorschau konnte Dateien nicht öffnen.");
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  ReactRuntime.useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    let disposeProject: (() => void) | undefined;
    setPreview(null);
    void loadScene(id).then(async (scene) => {
      if (cancelled) return;
      if (!scene) throw new Error("Wallpaper nicht mehr vorhanden.");
      if (scene.kind === "html") {
        let html = "";
        let runtime: Preview["runtime"];
        if (scene.format === "project-v2") {
          const project = await loadSceneProject(scene.id);
          if (!project) throw new Error("Projektdateien wurden nicht gefunden.");
          const rendered = await renderWallpaperProject(project);
          disposeProject = rendered.dispose;
          html = rendered.bootstrap;
          runtime = { html: rendered.html, assets: rendered.assets };
        } else {
          html = ensureWallpaperCsp(await scene.blob.text());
        }
        if (!cancelled) setPreview({ kind: "html", html, url: "", runtime });
        else disposeProject?.();
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
      disposeProject?.();
    };
  }, [id]);

  return <div className="zukato-viz__scene-preview" aria-label="Wallpaper-Vorschau">
    {!preview && <span>…</span>}
    {preview?.kind === "html" && <iframe key={id} ref={frameRef} title="Isolierte Wallpaper-Vorschau"
      sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={preview.html}
      onLoad={(event) => {
        const frame = event.currentTarget.contentWindow;
        if (!frame) return;
        if (preview.runtime && initializedFrame.current !== id) {
          initializedFrame.current = id;
          try { frame.postMessage({ zukatoProjectInit: true,
            html: preview.runtime.html, assets: preview.runtime.assets }, "*"); }
          catch { onErrorRef.current("Wallpaper-Vorschau konnte Projektdateien nicht laden."); }
        } else {
          frame.postMessage({
            zukatoWallpaper: true, playing: true, run: 0, positionMs: 0, durationMs: 0,
          }, "*");
        }
      }} />}
    {preview?.kind === "video" && <video key={id} src={preview.url} muted autoPlay playsInline loop controls
      onError={() => onErrorRef.current("Video-Vorschau ist in diesem Client nicht abspielbar.")} />}
  </div>;
}
