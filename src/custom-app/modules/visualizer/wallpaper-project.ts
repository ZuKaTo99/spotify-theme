// =============================================================================
// Datei: wallpaper-project.ts
// Zweck: Große, selbst erstellte Wallpaper-Engine-Webprojekte vollständig und
// ohne Base64-Vervielfachung einlesen, rendern und unverändert exportieren.
// Wo ändern? Hier Projektlimits, virtuelle Dateipfade und Sandbox-Aufbereitung.
// Kein Zugriff auf Spotify-Tokens, keine automatische Dateisystemüberwachung.
// =============================================================================

import { WEB_WALLPAPER_CSP } from "./web-wallpaper";

/** Obergrenzen schützen IndexedDB vor versehentlichem Masseneinlesen. */
export const MAX_PROJECT_FILES = 1024;
export const MAX_PROJECT_BYTES = 256 * 1024 * 1024;
export const MAX_TOTAL_SCENE_BYTES = 2 * 1024 * 1024 * 1024;

export interface ProjectAsset {
  path: string;
  blob: Blob;
}
export interface PreparedProject {
  entry: string;
  files: ProjectAsset[];
  bytes: number;
}

/** Browser-Dateiauswahl liefert bei webkitdirectory den Original-Relativpfad. */
export function validateProjectPath(value: string): string {
  const path = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.includes("\0") || /^[a-z]:/i.test(path) ||
      path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Unsicherer Dateipfad im Wallpaper-Projekt: ${value}`);
  }
  return path;
}

/** Nur relative Dateireferenzen; niemals ../ oberhalb des Projektordners. */
export function resolveProjectReference(reference: string, source: string): string | null {
  if (!reference || reference.startsWith("/") || reference.startsWith("#") ||
    reference.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(reference)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(reference.split(/[?#]/, 1)[0].replace(/\\/g, "/")); }
  catch { return null; }
  const segments = source.split("/").slice(0, -1);
  for (const segment of decoded.split("/")) {
    if (segment === "." || !segment) continue;
    if (segment === "..") {
      if (!segments.length) return null;
      segments.pop();
    } else segments.push(segment);
  }
  return segments.join("/");
}

/** Unerwünschte ausführbare Windows-Dateien nicht in die Bibliothek aufnehmen. */
function isRejectedFile(path: string): boolean {
  return /\.(?:exe|msi|bat|cmd|ps1|vbs|scr|com|lnk|dll)$/i.test(path);
}

/**
 * Ein Projektpaket vorbereiten, ohne die Datei-Inhalte zu lesen oder zu kopieren.
 * So bleiben auch >60 Dateien mit vielen MB als Original-Blobs erhalten.
 * Ein leerer oder uneindeutiger Einstieg wird vor jedem IDB-Schreibzugriff
 * zurückgewiesen. Projekt.json und 3D-/Binär-Assets werden mitgespeichert.
 */
export function prepareWallpaperProject(files: readonly File[]): PreparedProject {
  if (!files.length || files.length > MAX_PROJECT_FILES)
    throw new Error(`HTML-Projekt benötigt 1 bis ${MAX_PROJECT_FILES} Dateien.`);
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  if (bytes > MAX_PROJECT_BYTES)
    throw new Error(`HTML-Projekt überschreitet ${Math.floor(MAX_PROJECT_BYTES / 1048576)} MiB.`);
  const sources = files.map((blob) => ({
    path: validateProjectPath(blob.webkitRelativePath || blob.name), blob,
  }));
  // Entferne nur den gemeinsamen Verzeichnisprefix, NICHT willkürlich einen
  // Teilpfad. Andernfalls brechen Referenzen in verschachtelten CSS-Dateien.
  const folders = sources.map(({ path }) => path.split("/").slice(0, -1));
  let depth = 0;
  while (depth < folders[0].length && folders.every((parts) => parts[depth] === folders[0][depth])) depth++;
  const base = folders[0].slice(0, depth).join("/");
  const normalized = sources.map(({ path, blob }) => ({
    path: base && path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path, blob,
  }));
  const seen = new Set<string>();
  for (const { path, blob } of normalized) {
    if (seen.has(path.toLowerCase())) throw new Error(`Doppelte Wallpaper-Datei: ${path}`);
    if (isRejectedFile(path)) throw new Error(`Nicht unterstützte Begleitdatei: ${path}`);
    if (!blob.size && /\.html?$/i.test(path)) throw new Error("Leere HTML-Datei im Wallpaper-Projekt.");
    seen.add(path.toLowerCase());
  }
  const entry = normalized.find(({ path }) => /^index\.html?$/i.test(path))?.path ??
    normalized.find(({ path }) => /(^|\/)index\.html?$/i.test(path))?.path ??
    (normalized.filter(({ path }) => /\.html?$/i.test(path)).length === 1
      ? normalized.find(({ path }) => /\.html?$/i.test(path))?.path : undefined);
  if (!entry) throw new Error("HTML-Projekt benötigt eine eindeutige index.html.");
  return { entry, files: normalized, bytes };
}

/** Blob-Typen erweitern: Windows liefert bei vielen Modellen/Fonts kein MIME. */
function mimeFor(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", avif: "image/avif", svg: "image/svg+xml",
    mp4: "video/mp4", webm: "video/webm", ogv: "video/ogg", mp3: "audio/mpeg",
    ogg: "audio/ogg", wav: "audio/wav", flac: "audio/flac",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
    json: "application/json", gltf: "model/gltf+json", glb: "model/gltf-binary",
    wasm: "application/wasm", bin: "application/octet-stream",
  };
  return types[extension ?? ""] ?? "application/octet-stream";
}

/** CSP beschränkt auch große Projekte auf lokale, nur temporäre Blob-URLs. */
export const PROJECT_CSP = WEB_WALLPAPER_CSP
  .replace("img-src data: blob:", "img-src data: blob:")
  .replace("font-src data:", "font-src data: blob:")
  .replace("connect-src 'none'", "connect-src blob: data:");

function safeStyle(text: string): string { return text.replace(/<\/style/gi, "<\\/style"); }
function safeScript(text: string): string { return text.replace(/<\/script/gi, "<\\/script"); }

/**
 * Die Blob-URLs gehören in den Sandbox-Origin! Eine parent-seitig angelegte
 * blob:https://spotify...-URL ist in einem iframe ohne allow-same-origin oft
 * nicht lesbar (Chromium blockiert sie). Die origin-isolierte Startseite
 * erzeugt deshalb die URLs selbst, nachdem sie die Blobs per postMessage
 * erhalten hat. Blobs werden als strukturierte Daten transportiert, nicht als
 * Base64-Strings. Das spart bei großen Projekten sehr viel Speicher.
 */
export interface WallpaperRuntimeAsset {
  marker: string;
  blob: Blob;
  mime: string;
}
export interface RenderedProject {
  /** Fertiges HTML mit Platzhaltern statt ungültiger parent-Blob-URLs. */
  html: string;
  /** Kleine, origin-isolierte Bootstrap-Seite für iframe.srcDoc. */
  bootstrap: string;
  /** Original-Blobs, die der Sandbox einmalig geschickt werden. */
  assets: WallpaperRuntimeAsset[];
  /** Keine parent-Blob-URLs mehr: bleibt für alte Aufrufer verfügbar. */
  dispose: () => void;
}

/**
 * Beim Laden der Sandbox wartet eine minimale, geschützte Seite auf die
 * Projektdaten. Nach Übergabe schreibt sie das Projekt innerhalb desselben
 * isolierten Origins in ihr eigenes Dokument. Bei Entladen des iframe werden
 * die temporären Blob-URLs automatisch ungültig.
 *
 * Sicherheit: nur Nachrichten aus dem direkten Elternfenster, genau ein
 * Import, keine Tokens und kein allow-same-origin; der Hauptinhalt bekommt
 * zusätzlich wieder PROJECT_CSP.
 */
export const PROJECT_BOOTSTRAP = `<meta http-equiv="Content-Security-Policy" content="${PROJECT_CSP}">
<script>(function(){
  var initialized=false;
  window.addEventListener('message',function(event){
    if(initialized||event.source!==window.parent||!event.data||event.data.zukatoProjectInit!==true)return;
    initialized=true;
    var data=event.data, documentHtml=String(data.html||'');
    var resources=Array.isArray(data.assets)?data.assets:[];
    var urls=[];
    try{
      for(var i=0;i<resources.length;i++){
        var item=resources[i];
        if(!item||typeof item.marker!=='string'||!(item.blob instanceof Blob))continue;
        var url=URL.createObjectURL(new Blob([item.blob],{type:String(item.mime||'application/octet-stream')}));
        urls.push(url);
        documentHtml=documentHtml.split(item.marker).join(url);
      }
      document.open();
      document.write(documentHtml);
      document.close();
      window.addEventListener('pagehide',function(){urls.forEach(function(url){URL.revokeObjectURL(url);});},{once:true});
    }catch(error){
      urls.forEach(function(url){URL.revokeObjectURL(url);});
      window.parent.postMessage({zukatoProjectError:true,message:'HTML-Wallpaper konnte nicht gestartet werden.'},'*');
    }
  });
})();<\/script>`;

/**
 * Rendering bereitet ausschließlich HTML/Text und Blob-Marker vor. Niemals
 * temporäre Blob-URLs im Spotify-Hauptfenster anlegen: sie können von der
 * sicheren iframe-Sandbox nicht zuverlässig gelesen werden.
 */
export async function renderWallpaperProject(project: PreparedProject): Promise<RenderedProject> {
  const files = new Map(project.files.map(({ path, blob }) => [path, blob]));
  const urls = new Map<string, string>();
  const assets: WallpaperRuntimeAsset[] = [];
  for (const [path, blob] of files) {
    if (/\.(?:css|js|mjs|cjs|html?|map)$/i.test(path)) continue;
    const marker = `zukato-asset:${assets.length}:`;
    urls.set(path, marker);
    assets.push({ marker, blob, mime: mimeFor(path) });
  }
  const replaceReferences = (content: string, source: string): string => {
    let updated = content.replace(/(["'`])([^"'`\r\n]+)\1/g, (full, quote: string, relative: string) => {
      const resolved = resolveProjectReference(relative, source);
      return resolved && urls.has(resolved) ? `${quote}${urls.get(resolved)}${quote}` : full;
    });
    updated = updated.replace(/url\(\s*([^)'"\s][^)]*?)\s*\)/gi, (full, relative: string) => {
      const resolved = resolveProjectReference(relative.trim(), source);
      return resolved && urls.has(resolved) ? `url("${urls.get(resolved)}")` : full;
    });
    return updated;
  };
  const cssMemo = new Map<string, string>();
  /**
   * CSS @import einschließlich media queries aus Unterordnern laden.
   * Ohne das Einbetten würden relative Imports aus einer srcDoc-Sandbox
   * sonst gegen Spotifys Seiten-URL statt gegen das Webprojekt auflösen.
   */
  const transformCss = async (content: string, source: string, stack: Set<string>): Promise<string> => {
    const imports = [...content.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+\.css(?:\?[^"']*)?)["']\s*\)?\s*([^;]*);/gi)];
    for (const match of imports) {
      const child = resolveProjectReference(match[1], source);
      if (!child || !files.has(child)) continue;
      const childCss = await cssContent(child, stack);
      const media = match[2].trim();
      // CSS-Level-4 import layer()/supports() sind nicht generisch in @media
      // umwandelbar und bleiben vorerst zur Kompatibilitätsprüfung erhalten.
      if (/^(?:layer|supports)\b/i.test(media)) continue;
      content = content.replace(match[0], media ? `@media ${media}{${childCss}}` : childCss);
    }
    return replaceReferences(content, source);
  };
  const cssContent = async (path: string, stack = new Set<string>()): Promise<string> => {
    if (cssMemo.has(path)) return cssMemo.get(path)!;
    if (stack.has(path)) throw new Error(`Zyklischer CSS-Import: ${path}`);
    const blob = files.get(path);
    if (!blob) throw new Error(`Stylesheet fehlt: ${path}`);
    const chain = new Set(stack); chain.add(path);
    const output = await transformCss(await blob.text(), path, chain);
    cssMemo.set(path, output);
    return output;
  };
    let html = await files.get(project.entry)!.text();
    // Reihenfolge beibehalten: Stylesheets/Script-Tags bleiben an ihren Stellen.
    const links = [...html.matchAll(/<link\b[^>]*>/gi)];
    for (const match of links) {
      const link = match[0];
      if (!/\brel\s*=\s*["']?stylesheet/i.test(link)) continue;
      const attr = link.match(/\bhref\s*=\s*["']([^"']+)["']/i);
      const path = attr && resolveProjectReference(attr[1], project.entry);
      if (path && files.has(path)) html = html.replace(link, `<style>${safeStyle(await cssContent(path))}</style>`);
    }
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>\s*<\/script>/gi)];
    for (const match of scripts) {
      const script = match[0];
      const attr = script.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      const path = attr && resolveProjectReference(attr[1], project.entry);
      if (path && files.has(path)) {
        const code = replaceReferences(await files.get(path)!.text(), path);
        const open = script.match(/^<script\b[^>]*>/i)?.[0] ?? "<script>";
        // src-Attribut entfernen, sonst lädt der Browser extern statt inline.
        const attrs = open.replace(/\s+src\s*=\s*["'][^"']+["']/i, "");
        html = html.replace(script, `${attrs}${safeScript(code)}</script>`);
      }
    }
    // srcset besteht aus mehreren URLs und Breiten-/Dichte-Angaben.
    // Ein einfaches Ersetzen von Anführungszeichen übersieht diese Assets.
    html = html.replace(/\bsrcset\s*=\s*(["'])([^"']+)\1/gi, (full, quote: string, value: string) => {
      const parts = value.split(",").map((part) => {
        const trimmed = part.trim();
        const match = /^(\S+)(\s+.*)?$/.exec(trimmed);
        const resolved = match && resolveProjectReference(match[1], project.entry);
        return resolved && urls.has(resolved)
          ? `${urls.get(resolved)}${match?.[2] ?? ""}` : trimmed;
      });
      return `srcset=${quote}${parts.join(", ")}${quote}`;
    });
    // Auch inline <style>-Blöcke können relative CSS-Imports enthalten.
    const inlineStyles = [...html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)];
    for (const match of inlineStyles) {
      const replacement = await transformCss(match[2], project.entry, new Set());
      html = html.replace(match[0], `<style${match[1]}>${safeStyle(replacement)}</style>`);
    }
    html = replaceReferences(html, project.entry);
    const policy = `<meta http-equiv="Content-Security-Policy" content="${PROJECT_CSP}">`;
    const bridge = `<style>html.zukato-wallpaper-paused *,html.zukato-wallpaper-paused *::before,html.zukato-wallpaper-paused *::after{animation-play-state:paused!important}</style><script>window.addEventListener('message',function(e){if(e.source!==window.parent||!e.data||e.data.zukatoWallpaper!==true)return;var d=e.data;var paused=!d.playing;document.documentElement.classList.toggle('zukato-wallpaper-paused',paused);if(window.__zukatoLastPaused!==paused){window.__zukatoLastPaused=paused;document.querySelectorAll('video').forEach(function(v){v.muted=true;if(paused)v.pause();else v.play().catch(function(){});});}window.dispatchEvent(new CustomEvent('zukato:player',{detail:{playing:!!d.playing,run:Number(d.run)||0,positionMs:Math.max(0,Number(d.positionMs)||0),durationMs:Math.max(0,Number(d.durationMs)||0)}}));});document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('video').forEach(function(v){v.muted=true;});});</script>`;
    html = /<head\b[^>]*>/i.test(html)
      ? html.replace(/<head\b[^>]*>/i, (tag) => `${tag}${policy}${bridge}`)
      : `${policy}${bridge}${html}`;
    return { html, bootstrap: PROJECT_BOOTSTRAP, assets, dispose: () => undefined };
}
