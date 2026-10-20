// =============================================================================
// Datei: ScenePreview.tsx
// Zweck: Importierte HTML-Wallpapers/Videoclips vor der Zuordnung direkt prüfen.
// Wo ändern? Nur die Vorschau und ihren Blob-/Iframe-Lebenszyklus hier.
// Sicherheit: HTML wird in derselben isolierten CSP-Sandbox wie im Player
// geöffnet, niemals als React-HTML im privilegierten Spotify-Dokument.
// =============================================================================
import type { ReactElement } from "react";
import { loadScene, loadSceneProject } from "./scene-store";
import { renderWallpaperProject, sceneFramePayload, type WallpaperRuntimeAsset, type WallpaperRuntimeModule } from "./wallpaper-project";
import { ensureWallpaperCsp } from "./web-wallpaper";
import { WallpaperFrameGate } from "./wallpaper-frame-gate";
import { currentWallpaper } from "./current-wallpaper";
import { loadWallpaperPrefs, applyWallpaperPrefsOperation, parseWallpaperPrefsOperation, WALLPAPER_PREFS_CHANGED } from "./wallpaper-preferences";

const ReactRuntime = Spicetify.React as typeof import("react");

type Preview = { id: string; kind: "html" | "video"; html: string; url: string;
  runtime?: { html: string; entry: string; assets: WallpaperRuntimeAsset[]; modules: WallpaperRuntimeModule[]; storageToken: string } };

export function ScenePreview({ id, onError }: { id: string; onError: (message: string) => void }): ReactElement {
  const [preview, setPreview] = ReactRuntime.useState<Preview | null>(null);
  const onErrorRef = ReactRuntime.useRef(onError);
  // Gemeinsam mit dem Hauptplayer gegen doppelte und verlorene Transfers.
  const frameGate = ReactRuntime.useRef(new WallpaperFrameGate());
  const previewRef = ReactRuntime.useRef<Preview | null>(preview);
  // Wenn der Nutzer schnell umschaltet, gehört ein asynchron geladenes
  // Preview-Objekt eventuell noch zur VORHERIGEN Szene. Niemals deren
  // Blobs an den iframe der neu ausgewählten Szene übertragen.
  previewRef.current = preview;
  const frameRef = ReactRuntime.useRef<HTMLIFrameElement>(null);
  const idRef = ReactRuntime.useRef(id);
  idRef.current = id;
  onErrorRef.current = onError;
  // Bootstrap-Fehler aus der isolierten Vorschau anzeigen. Die Nachricht
  // enthält nie private Spotify-Daten oder Details aus dem HTML-Projekt.
  ReactRuntime.useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.zukatoProjectReady === true) {
        const current = previewRef.current;
        const frame = frameRef.current?.contentWindow;
        if (!current || current.id !== idRef.current || !current.runtime || !frame ||
            !frameGate.current.onReady(current.id, event.data.documentId)) return;
        const runtime = current.runtime;
        try { frame.postMessage({ zukatoProjectInit: true, ...runtime,
          storage: loadWallpaperPrefs(current.id),
          sessionStorage: loadWallpaperPrefs(current.id, "session") }, "*"); }
        catch {
          frameGate.current.failed(idRef.current);
          onErrorRef.current("Wallpaper-Vorschau konnte Projektdateien nicht übertragen.");
        }
      } else if (event.data?.zukatoProjectStorage === true) {
        const current = previewRef.current;
        const action = parseWallpaperPrefsOperation(event.data);
        if (!current?.runtime || current.id !== idRef.current || !action ||
            event.data?.storageToken !== current.runtime.storageToken) return;
        if (!applyWallpaperPrefsOperation(current.id, action))
          onErrorRef.current("Wallpaper-Einstellungen konnten nicht dauerhaft gespeichert werden.");
      } else if (event.data?.zukatoProjectError === true && previewRef.current?.id === idRef.current) {
        onErrorRef.current("Wallpaper-Vorschau konnte Dateien nicht öffnen.");
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  // Gleichzeitig geöffnete Preview und Bühne synchron halten. Der
  // Änderungsimpuls enthält ausschließlich die ID, niemals Spotify-Daten.
  ReactRuntime.useEffect(() => {
    const sync = (event: Event): void => {
      const sceneId = (event as CustomEvent<{ sceneId: string }>).detail?.sceneId;
      const current = previewRef.current;
      if (!current?.runtime || current.id !== idRef.current || sceneId !== current.id) return;
      frameRef.current?.contentWindow?.postMessage({ zukatoProjectStorageSync: true,
        storageToken: current.runtime.storageToken, storage: loadWallpaperPrefs(sceneId),
        sessionStorage: loadWallpaperPrefs(sceneId, "session") }, "*");
    };
    window.addEventListener(WALLPAPER_PREFS_CHANGED, sync);
    return () => window.removeEventListener(WALLPAPER_PREFS_CHANGED, sync);
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
          const frame = sceneFramePayload(rendered);
          html = frame.srcDoc;
          runtime = { ...frame.runtime,
            storageToken: typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID() : `${Date.now()}:${Math.random()}` };
        } else {
          html = ensureWallpaperCsp(await scene.blob.text());
        }
        if (!cancelled) setPreview({ id, kind: "html", html, url: "", runtime });
        else disposeProject?.();
      } else {
        objectUrl = URL.createObjectURL(scene.blob);
        if (!cancelled) setPreview({ id, kind: "video", html: "", url: objectUrl });
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

  // React-Effekte laufen NACH dem Rendern. Das alte Preview bis dahin
  // ausdrücklich ausblenden, auch wenn dessen Promise längst beendet ist.
  const visible = currentWallpaper(preview, id, "id");
  return <div className="zukato-viz__scene-preview" aria-label="Wallpaper-Vorschau">
    {!visible && <span>…</span>}
    {visible?.kind === "html" && <iframe key={visible.id} ref={frameRef} title="Isolierte Wallpaper-Vorschau"
      sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={visible.html}
      onLoad={(event) => {
        const frame = event.currentTarget.contentWindow;
        if (!frame) return;
        if (visible.id !== idRef.current) return;
        if (visible.runtime) {
          if (frameGate.current.onLoad(visible.id)) {
            try { frame.postMessage({ zukatoProjectInit: true, ...visible.runtime,
              storage: loadWallpaperPrefs(visible.id),
              sessionStorage: loadWallpaperPrefs(visible.id, "session") }, "*"); }
            catch {
              frameGate.current.failed(visible.id);
              onErrorRef.current("Wallpaper-Vorschau konnte Projektdateien nicht laden.");
            }
          }
        } else {
          frame.postMessage({
            zukatoWallpaper: true, playing: true, run: 0, positionMs: 0, durationMs: 0,
          }, "*");
        }
      }} />}
    {visible?.kind === "video" && <video key={visible.id} src={visible.url} muted autoPlay playsInline loop controls
      onError={() => onErrorRef.current("Video-Vorschau ist in diesem Client nicht abspielbar.")} />}
  </div>;
}
