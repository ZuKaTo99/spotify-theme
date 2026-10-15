// =============================================================================
// Datei: web-wallpaper.ts
// Zweck: Eigene Wallpaper-Engine-WEB-Projekte als abgeschlossene HTML-Szene laden.
// Wo ändern? Unterstützte lokale Dateitypen, Paketlimits und Sandbox-CSP hier.
// Sicherheit: Kein HTML im Spotify-DOM ausführen! Rendern NUR in einer Sandbox-
// iframe ohne allow-same-origin, ohne Netzwerk-/Navigationsfreigaben.
// Hinweis: Native Wallpaper-Engine-PKGs sind KEINE HTML-Webprojekte.
// =============================================================================

/** Kleine Webpakete bleiben direkt portabel, ohne externe ZIP-Bibliothek. */
export const MAX_HTML_PROJECT_BYTES = 12 * 1024 * 1024;
export const MAX_HTML_PROJECT_FILES = 64;

/** Nur selbst gewählte Begleitdateien werden in Data-URLs übersetzt. */
const SUPPORTED_FILES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4",
  webm: "video/webm", ogg: "video/ogg", ogv: "video/ogg",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
  css: "text/css", js: "text/javascript", html: "text/html", htm: "text/html", json: "application/json",
};

/** Ein explizites CSP verbietet dem importierten Skript u.a. Netzwerkzugriffe. */
export const WEB_WALLPAPER_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

function ext(name: string): string { return name.split(".").pop()?.toLowerCase() ?? ""; }

/** Pfade aus Dateiauswahlordnern zu relativen, harmlosen Projektpfaden machen. */
function localPath(name: string): string {
  const clean = name.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!clean || clean.startsWith("/") || clean.split("/").some((part) => part === ".." || part === ""))
    throw new Error("Unsicherer Pfad im HTML-Wallpaper-Paket.");
  return clean;
}

/** Browser- und Node-kompatible Base64-Kodierung; keine Daten hochladen. */
function toDataUrl(bytes: ArrayBuffer, mime: string): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 8192) {
    binary += String.fromCharCode(...view.subarray(i, i + 8192));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Lokale Asset-Referenzen relativ zu der HTML-/CSS-/JS-Quelldatei auflösen.
 * Das ist wichtig für echte Wallpaper-Engine-Webprojekte mit Unterordnern:
 * css/theme.css -> url(../images/bg.png), nicht css/images/bg.png.
 * ".." ist innerhalb des importierten Projektbaums erlaubt, jedoch nie
 * oberhalb seiner Wurzel. Externe URLs bleiben durch CSP weiterhin blockiert.
 */
function resolveLocalReference(reference: string, sourcePath: string): string | null {
  if (!reference || reference.startsWith("/") || reference.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith("//")) return null;
  const rawPath = reference.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  const parts = sourcePath.split("/").slice(0, -1);
  for (const segment of rawPath.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(segment);
  }
  return parts.join("/");
}

/** Referenzen in HTML-Attributen/JavaScript-Strings und CSS URLs ersetzen. */
function rewriteLocalReferences(content: string, assets: Map<string, string>, sourcePath: string): string {
  let result = content.replace(/(["'`])([^"'`\r\n]+)\1/g, (original, quote: string, reference: string) => {
    const canonical = resolveLocalReference(reference, sourcePath);
    return canonical && assets.has(canonical) ? `${quote}${assets.get(canonical)}${quote}` : original;
  });
  // CSS erlaubt zusätzlich unquotierte url()-Angaben. Nur MIME-Data-URLs
  // für tatsächlich importierte Dateien einsetzen, keinen Netzverkehr starten.
  result = result.replace(/url\(\s*([^)'"\s][^)]*?)\s*\)/gi, (original, reference: string) => {
    const canonical = resolveLocalReference(reference.trim(), sourcePath);
    return canonical && assets.has(canonical) ? `url("${assets.get(canonical)}")` : original;
  });
  return result;
}

/** Verhindert vorzeitiges Schließen eines dynamisch eingebetteten Skripts. */
function safeInlineScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script");
}

/**
 * Aus einer HTML-Datei oder einem ausgewählten Projektordner ein selbstständig
 * darstellbares Dokument machen. Lokale CSS-/JS-Dateien werden eingebettet,
 * Bild-/Video-/Font-Referenzen in Data-URLs umgewandelt. Dynamische fetch()-
 * Importe und proprietäre Wallpaper-Engine-Schnittstellen bleiben absichtlich
 * nicht verfügbar. Solche Projekte müssen zuvor exportiert/angepasst werden.
 */
export async function packWebWallpaper(files: readonly File[]): Promise<Blob> {
  if (!files.length || files.length > MAX_HTML_PROJECT_FILES ||
    files.reduce((sum, file) => sum + file.size, 0) > MAX_HTML_PROJECT_BYTES) {
    throw new Error("HTML-Wallpaper: maximal 64 Dateien und zusammen 12 MiB.");
  }
  const raw = files.map((file) => ({ file, path: localPath(file.webkitRelativePath || file.name) }));
  // Nicht nur den ersten Ordnernamen entfernen! Bei Sammelordnern liegen
  // Projekte z. B. unter Sammlung/02/index.html und Sammlung/02/style.css.
  // Erst der GEMEINSAME Projektdirectory-Prefix macht src="style.css"
  // wieder auflösbar. Ohne diese Normalisierung blieben JS/CSS blockiert.
  const dirs = raw.map((item) => item.path.split("/").slice(0, -1));
  const first = dirs[0];
  let depth = 0;
  while (depth < first.length && dirs.every((parts) => parts[depth] === first[depth])) depth++;
  const prefix = first.slice(0, depth).join("/");
  const trimPrefix = prefix ? `${prefix}/` : "";
  const entries = raw.map(({ file, path }) => ({ file, path: path.startsWith(trimPrefix) ? path.slice(trimPrefix.length) : path }));
  const candidates = entries.filter(({ path }) => ext(path) === "html" || ext(path) === "htm");
  const main = candidates.find(({ path }) => /(^|\/)index\.html?$/i.test(path)) ??
    (candidates.length === 1 ? candidates[0] : undefined);
  if (!main) throw new Error("HTML-Wallpaper benötigt eine eindeutige index.html im ausgewählten Projekt.");
  const assets = new Map<string, string>();
  const texts = new Map<string, string>();
  for (const { file, path } of entries) {
    const suffix = ext(path);
    if (!SUPPORTED_FILES[suffix]) throw new Error(`Nicht unterstützte Begleitdatei: ${path}`);
    if (assets.has(path) || texts.has(path)) throw new Error(`Dateiname doppelt: ${path}`);
    // Wallpaper Engine legt typischerweise eine project.json als Metadatei ab.
    // Sie wird bewusst ignoriert; ihre proprietären APIs werden nicht emuliert.
    if (suffix === "json") continue;
    if (suffix === "css" || suffix === "js") texts.set(path, await file.text());
    else if (suffix !== "html" && suffix !== "htm") assets.set(path, toDataUrl(await file.arrayBuffer(), SUPPORTED_FILES[suffix]));
  }
  // Verweise in Stylesheets werden vor deren Einbettung ebenfalls aufgelöst.
  let html = await main.file.text();
  html = html.replace(/<link\b([^>]*?)href\s*=\s*(["'])([^"']+)\2([^>]*)>/gi, (original, before: string, _q: string, filename: string, after: string) => {
    const path = resolveLocalReference(filename, main.path);
    return path && texts.has(path) && /rel\s*=\s*["']?stylesheet/i.test(`${before} ${after}`)
      ? `<style>${rewriteLocalReferences(texts.get(path)!, assets, path).replace(/<\/style/gi, "<\\/style")}</style>` : original;
  });
  html = html.replace(/<script\b([^>]*?)src\s*=\s*(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi, (original, before: string, _q: string, filename: string) => {
    const path = resolveLocalReference(filename, main.path);
    return path && texts.has(path) ? `<script${before}>${safeInlineScript(rewriteLocalReferences(texts.get(path)!, assets, path))}</script>` : original;
  });
  html = rewriteLocalReferences(html, assets, main.path);
  // CSP direkt zu Beginn des Dokuments aktivieren; in einem isolierten iframe
  // verhindert es ungewollte Internetverbindungen/ausbrechende Navigationen.
  const policy = `<meta http-equiv="Content-Security-Policy" content="${WEB_WALLPAPER_CSP}">`;
  html = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (tag) => tag + policy)
    : policy + html;
  // Kleine, isolierte Schnittstelle für Play/Pause aus Spotify. CSS-Animationen
  // und HTML-Videos können folgen; frei programmierte requestAnimationFrame-
  // Schleifen müssen vom Wallpaper-Autor selbst auf das Message-Event reagieren.
  const pauseBridge = `<style>html.zukato-wallpaper-paused *,html.zukato-wallpaper-paused *::before,html.zukato-wallpaper-paused *::after{animation-play-state:paused!important}</style><script>window.addEventListener('message',function(e){if(e.source!==window.parent||!e.data||e.data.zukatoWallpaper!==true)return;var d=e.data;var paused=!d.playing;document.documentElement.classList.toggle('zukato-wallpaper-paused',paused);if(window.__zukatoLastPaused!==paused){window.__zukatoLastPaused=paused;document.querySelectorAll('video').forEach(function(v){v.muted=true;if(paused)v.pause();else v.play().catch(function(){});});}window.dispatchEvent(new CustomEvent('zukato:player',{detail:{playing:!!d.playing,run:Number(d.run)||0,positionMs:Math.max(0,Number(d.positionMs)||0),durationMs:Math.max(0,Number(d.durationMs)||0)}}));});document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('video').forEach(function(v){v.muted=true;});});</script>`;
  html = html.replace(policy, policy + pauseBridge);
  const output = new Blob([html], { type: "text/html" });
  if (output.size > MAX_HTML_PROJECT_BYTES * 2) throw new Error("HTML-Wallpaper nach dem Packen zu groß.");
  return output;
}

/** Auch ein zuvor gespeichertes Dokument immer erneut mit CSP absichern. */
export function ensureWallpaperCsp(html: string): string {
  // Eigener Import muss eingebettet bleiben. Selbst wenn der Datensatz später
  // verändert wird, setzt die Viewer-Seite nochmals ihre eigene Schutzpolicy.
  const meta = `<meta http-equiv="Content-Security-Policy" content="${WEB_WALLPAPER_CSP}">`;
  return /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (tag) => tag + meta) : meta + html;
}
