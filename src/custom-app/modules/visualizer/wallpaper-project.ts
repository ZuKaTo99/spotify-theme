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
  const htmlFiles = normalized.filter(({ path }) => /\.html?$/i.test(path));
  const entry = normalized.find(({ path }) => /^index\.html?$/i.test(path))?.path ??
    normalized.find(({ path }) => /(^|\/)index\.html?$/i.test(path))?.path ??
    (htmlFiles.length === 1 ? htmlFiles[0].path : undefined) ??
    // Bei mehreren HTML-Seiten gibt project.json möglicherweise den Einstieg
    // an. Das wird VOR dem Schreiben durch resolveWallpaperProjectEntry geprüft.
    (normalized.some(({ path }) => path.toLowerCase() === "project.json")
      ? htmlFiles[0]?.path : undefined);
  if (!entry) throw new Error("HTML-Projekt benötigt index.html oder einen eindeutigen Einstieg in project.json.");
  return { entry, files: normalized, bytes };
}

/**
 * Wallpaper Engine Webprojekte können in project.json das Feld `file` setzen.
 * Anders als ein bloßes Dateinamen-Raten respektieren wir diesen Einstieg und
 * prüfen vor der IndexedDB-Speicherung, dass er eine vorhandene lokale HTML-
 * Datei im vollständig ausgewählten Projektordner referenziert.
 */
export async function resolveWallpaperProjectEntry(project: PreparedProject): Promise<PreparedProject> {
  const manifest = project.files.find(({ path }) => path.toLowerCase() === "project.json");
  if (!manifest) return project;
  if (manifest.blob.size > 1024 * 1024)
    throw new Error("Wallpaper Engine project.json ist ungewöhnlich groß (maximal 1 MiB).");
  let metadata: unknown;
  try { metadata = JSON.parse(await manifest.blob.text()); }
  catch { throw new Error("Wallpaper Engine project.json enthält kein gültiges JSON."); }
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata))
    throw new Error("Wallpaper Engine project.json benötigt ein JSON-Objekt.");
  const file = (metadata as Record<string, unknown>).file;
  if (file === undefined || file === null || file === "") {
    // Wenn mehrere HTML-Seiten existieren, darf die Importlogik NICHT
    // willkürlich die alphabetisch erste Unterseite auswählen.
    const htmlFiles = project.files.filter(({ path }) => /\.html?$/i.test(path));
    const hasIndex = htmlFiles.some(({ path }) => /(^|\/)index\.html?$/i.test(path));
    if (htmlFiles.length > 1 && !hasIndex)
      throw new Error("project.json muss die HTML-Startseite im Feld 'file' angeben.");
    return project;
  }
  if (typeof file !== "string") throw new Error("Ungültiger Einstieg in project.json.");
  let entry: string;
  try { entry = validateProjectPath(file); }
  catch { throw new Error("project.json verweist auf eine Datei außerhalb des Wallpaper-Projekts."); }
  if (!/\.html?$/i.test(entry) || !project.files.some(({ path }) => path === entry))
    throw new Error(`Wallpaper-Startseite aus project.json fehlt: ${entry}`);
  return { ...project, entry };
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
  .replace("connect-src 'none'", "connect-src blob: data:")
  // ES-Module verwenden eigene Blob-URLs INNERHALB der Sandbox.
  .replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' blob:");

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
  /** Projekt-relativer Originalpfad, benötigt für dynamische JS-Dateizugriffe. */
  path: string;
  blob: Blob;
  mime: string;
}
/** Lokale ES-Module werden erst nach dem Isolieren des iframe instanziiert. */
export interface WallpaperRuntimeModule {
  /** Ein stabiler Import-Map-Schlüssel, niemals eine externe Adresse. */
  specifier: string;
  /** Quelltext mit lokal aufgelösten Importpfaden und Asset-Markern. */
  code: string;
}
export interface RenderedProject {
  /** Fertiges HTML mit Platzhaltern statt ungültiger parent-Blob-URLs. */
  html: string;
  /** Einstiegspfad bestimmt die relativen URLs von fetch() und XHR. */
  entry: string;
  /** Kleine, origin-isolierte Bootstrap-Seite für iframe.srcDoc. */
  bootstrap: string;
  /** Original-Blobs, die der Sandbox einmalig geschickt werden. */
  assets: WallpaperRuntimeAsset[];
  modules: WallpaperRuntimeModule[];
  /** Keine parent-Blob-URLs mehr: bleibt für alte Aufrufer verfügbar. */
  dispose: () => void;
}

/**
 * Einheitlicher Übergabevertrag für Bühne UND Bibliotheksvorschau.
 * Niemals rendered.html als srcDoc setzen: Dann werden Assets nicht per
 * postMessage übergeben, und Browser zeigen defekte Bilder/Fonts an.
 */
export function sceneFramePayload(project: RenderedProject): {
  srcDoc: string;
  runtime: { html: string; entry: string; assets: WallpaperRuntimeAsset[]; modules: WallpaperRuntimeModule[] };
} {
  return {
    srcDoc: project.bootstrap,
    runtime: { html: project.html, entry: project.entry, assets: project.assets, modules: project.modules },
  };
}

/**
 * Sandbox-Laufzeit fuer umfangreiche Webprojekte.
 *
 * - Blob-URLs werden ausschliesslich IN der iframe-Sandbox erzeugt.
 * - fetch()/XMLHttpRequest fuer projektlokale JSON-/Bild-/Audiodateien werden
 *   auf diese Blob-URLs abgebildet, auch wenn der Pfad erst in JS entsteht.
 * - Fehlende Dateien und kaputte Ressourcen werden ohne private Pfade gemeldet.
 * - Externe HTTP-Adressen bleiben wegen der restriktiven CSP gesperrt.
 *
 * ES-Modul-Imports mit lokalen, literalen Pfaden erhalten eine Import-Map.
 * Wallpaper-Engine-Spezial-APIs und Worker bleiben gesonderte Fälle.
 */
export const PROJECT_BOOTSTRAP = `<meta http-equiv="Content-Security-Policy" content="${PROJECT_CSP}">
<script>(function(){
  'use strict';
  var initialized=false;
  var activeUrls=[];
  var notices=Object.create(null);
  function report(code){
    if(notices[code])return;
    notices[code]=true;
    window.parent.postMessage({zukatoProjectError:true,code:code},'*');
  }
  window.addEventListener('message',function(event){
    if(initialized||event.source!==window.parent||!event.data||event.data.zukatoProjectInit!==true)return;
    initialized=true;
    var data=event.data, documentHtml=String(data.html||'');
    var resources=Array.isArray(data.assets)?data.assets:[];
    var modules=Array.isArray(data.modules)?data.modules:[];
    var entry=String(data.entry||'index.html');
    var paths=Object.create(null);
    var knownUrls=Object.create(null);
    var markerUrls=Object.create(null);
    // Ein globaler Ersetzungslauf statt N kompletter HTML-Kopien bei N
    // Assets. Bei großen Animationen mit 1000 Dateien war die alte Schleife
    // unnötig teuer und konnte den Spotify-Webview kurz einfrieren.
    function replaceAssetMarkers(text){
      return text.replace(/zukato-asset:\\d+:/g,function(marker){
        if(Object.prototype.hasOwnProperty.call(markerUrls,marker))return markerUrls[marker];
        report('PROJECT_ASSET_MISSING');
        return marker;
      });
    }
    try{
      for(var i=0;i<resources.length;i++){
        var item=resources[i];
        if(!item||typeof item.marker!=='string'||typeof item.path!=='string'||!(item.blob instanceof Blob))continue;
        // Bereits passend typisierte Blobs nicht nochmals einpacken.
        // Browser können so das Original-Blob statt einer zusätzlichen
        // 200-MiB-Blob-Hülle direkt als temporäre Quelle nutzen.
        var mime=String(item.mime||'application/octet-stream');
        var typed=item.blob.type===mime?item.blob:new Blob([item.blob],{type:mime});
        var url=URL.createObjectURL(typed);
        activeUrls.push(url);
        paths[item.path]=url;
        knownUrls[url]=true;
        markerUrls[item.marker]=url;
      }
      documentHtml=replaceAssetMarkers(documentHtml);
      // Import-Map VOR dem ersten <script type="module"> einfügen. Die
      // Module werden als Blob-URLs im OPAQUEN iframe-Origin erzeugt; URLs aus
      // dem Spotify-Elterndokument wären hier wegen Origin-Isolierung ungültig.
      // Ein solches Mapping unterstützt auch zyklische ES-Modul-Importe.
      if(modules.length){
        var imports=Object.create(null);
        for(var m=0;m<modules.length;m++){
          var mod=modules[m];
          if(!mod||typeof mod.specifier!=='string'||!/^zukato-module:/.test(mod.specifier)||
            typeof mod.code!=='string')continue;
          var moduleCode=mod.code;
          // Auch Modultexte nur EINMAL durchlaufen. Die Markerliste wurde
          // bereits beim Erstellen der lokalen Blob-URLs aufgebaut.
          moduleCode=replaceAssetMarkers(moduleCode);
          var moduleUrl=URL.createObjectURL(new Blob([moduleCode],{type:'text/javascript'}));
          activeUrls.push(moduleUrl);
          imports[mod.specifier]=moduleUrl;
        }
        // Import-Map-Inhalte niemals als ausführbaren HTML-Text interpretieren.
        var mapText=JSON.stringify({imports:imports}).replace(/</g,'\\\\u003c');
        var mapTag='<script type="importmap">'+mapText+'<\\/script>';
        if(/<head\b[^>]*>/i.test(documentHtml)){
          documentHtml=documentHtml.replace(/<head\b[^>]*>/i,function(tag){return tag+mapTag;});
        }else documentHtml=mapTag+documentHtml;
      }
      // Sandbox-srcdoc erbt eine fremde baseURI (Spotify); lokale URLs ohne
      // diesen Resolver wuerden deshalb ins Leere oder gegen Spotify gehen.
      function resolveAsset(ref){
        if(typeof ref!=='string'||!ref||ref[0]==='/'||ref.slice(0,2)==='//'||ref[0]==='#'||/^[a-z][a-z0-9+.-]*:/i.test(ref))return null;
        var raw=ref.split(/[?#]/,1)[0].replace(/\\\\/g,'/');
        try{raw=decodeURIComponent(raw);}catch(error){return '';}
        var segments=entry.split('/').slice(0,-1);
        var parts=raw.split('/');
        for(var j=0;j<parts.length;j++){
          var part=parts[j];
          if(!part||part==='.')continue;
          if(part==='..'){
            if(!segments.length)return '';
            segments.pop();
          }else segments.push(part);
        }
        return segments.join('/');
      }
      // Manche Animationen bauen Dateinamen erst zur Laufzeit zusammen, etwa
      // eine Bildfolge ("frames/" + frame + ".png"). Diese URLs kommen nicht
      // als statische HTML-Attribute vor und muessen im iframe aufgeloest werden.
      function assetUrl(value){
        if(typeof value!=='string')return null;
        // Bereits durch die HTML-/JS-Vorbereitung ersetzte Blob-Adressen
        // niemals ein zweites Mal als relative Dateinamen interpretieren.
        if(Object.prototype.hasOwnProperty.call(knownUrls,value))return value;
        var local=resolveAsset(value);
        if(local===null)return null;
        if(Object.prototype.hasOwnProperty.call(paths,local))return paths[local];
        report('PROJECT_ASSET_MISSING');
        return null;
      }
      function patchSrc(prototype,property){
        var old=Object.getOwnPropertyDescriptor(prototype,property);
        if(!old||!old.set||!old.get||!old.configurable)return;
        Object.defineProperty(prototype,property,{
          configurable:true,enumerable:old.enumerable,
          get:function(){return old.get.call(this);},
          set:function(value){return old.set.call(this,assetUrl(value)||value);}
        });
      }
      patchSrc(HTMLImageElement.prototype,'src');
      patchSrc(HTMLMediaElement.prototype,'src');
      patchSrc(HTMLSourceElement.prototype,'src');
      // setAttribute() wird von vielen Canvas-/3D-Bibliotheken statt .src
      // verwendet. Nur bekannte Medienelemente auf lokale URLs umbiegen.
      var nativeAttribute=Element.prototype.setAttribute;
      Element.prototype.setAttribute=function(name,value){
        if(typeof name==='string'&&name.toLowerCase()==='src'&&
          /^(?:IMG|VIDEO|AUDIO|SOURCE)$/.test(this.tagName)){
          value=assetUrl(value)||value;
        }
        return nativeAttribute.call(this,name,value);
      };
      // Bewusst kein Netzwerkfallback fuer unbekannte relative Pfade: Das
      // Wallpaper darf damit nicht versehentlich auf Spotify-URLs zugreifen.
      var nativeFetch=window.fetch.bind(window);
      window.fetch=function(input,init){
        var original=typeof input==='string'?input:null;
        var canonical=resolveAsset(original);
        if(canonical===null)return nativeFetch(input,init);
        if(!Object.prototype.hasOwnProperty.call(paths,canonical)){
          report('PROJECT_ASSET_MISSING');
          return Promise.reject(new TypeError('Projektdatei nicht gefunden'));
        }
        return nativeFetch(paths[canonical],init);
      };
      var nativeOpen=XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open=function(method,url){
        var canonical=resolveAsset(url);
        if(canonical!==null){
          if(!Object.prototype.hasOwnProperty.call(paths,canonical)){
            report('PROJECT_ASSET_MISSING');
            throw new TypeError('Projektdatei nicht gefunden');
          }
          arguments[1]=paths[canonical];
        }
        return nativeOpen.apply(this,arguments);
      };
      // Bewusst kleine Hilfs-API fuer dynamisch zusammengesetzte Bildpfade.
      // Bei unbekannten Dateien wird KEINE Netzadresse zurueckgegeben.
      window.zukatoWallpaperAssetUrl=assetUrl;
      // Error capture funktioniert auch fuer Bildfehler ohne Promise.
      window.addEventListener('error',function(e){
        if(e.target!==window){report('PROJECT_RESOURCE_ERROR');}
        else report('PROJECT_SCRIPT_ERROR');
      },true);
      window.addEventListener('unhandledrejection',function(){report('PROJECT_SCRIPT_ERROR');});
      document.open();
      document.write(documentHtml);
      document.close();
      window.addEventListener('pagehide',function(){
        activeUrls.forEach(function(url){URL.revokeObjectURL(url);});
        activeUrls=[];
      },{once:true});
    }catch(error){
      activeUrls.forEach(function(url){URL.revokeObjectURL(url);});
      activeUrls=[];
      report('PROJECT_INITIALIZATION_FAILED');
    }
  });
  // Frischer Dokumentstart: Auch ein iframe, das ohne neue React-Szene
  // intern neu geladen wurde, muss seine lokalen Blobs erneut erhalten.
  // Keine Dateinamen, Spotify-Informationen oder sonstige Daten mitsenden.
  window.parent.postMessage({zukatoProjectReady:true,
    documentId:String(Date.now())+':'+Math.random().toString(36).slice(2)},'*');
})();<\/script>`;

/**
 * Stabile Modulbezeichner vermeiden relative URLs gegen die Spotify-Adresse
 * oder die blob:-Basis. Import-Maps lösen sie lokal im Sandbox-Origin auf.
 */
function localModuleSpecifier(path: string): string {
  return `zukato-module:${encodeURIComponent(path)}`;
}

/**
 * Einfache native ES-Importformen: import ... from, export ... from,
 * import "datei.js" und import("datei.js") mit LITERAL-Pfaden.
 * Dynamisch berechnete Modulnamen und fremde npm-Pakete werden nicht geraten.
 * Nur vorhandene Dateien im Projektbaum bekommen einen Sandbox-Schlüssel.
 */
function rewriteModuleImports(
  code: string, source: string, files: ReadonlyMap<string, Blob>, dependencies: Set<string>,
): string {
  const replace = (full: string, prefix: string, quote: string, reference: string): string => {
    if (!reference.startsWith("./") && !reference.startsWith("../")) return full;
    const candidate = resolveProjectReference(reference, source);
    if (!candidate) throw new Error(`ES-Modul-Pfad verlässt das Wallpaper-Projekt: ${source}`);
    const target = [candidate, `${candidate}.js`, `${candidate}.mjs`, `${candidate}/index.js`]
      .find((item) => files.has(item) && /\.(?:js|mjs)$/i.test(item));
    if (!target) throw new Error(`Lokales ES-Modul fehlt: ${candidate}`);
    dependencies.add(target);
    return `${prefix}${quote}${localModuleSpecifier(target)}${quote}`;
  };
  // Import-/Export-Deklarationen mit optionalem `from`, inklusive Zeilenwechsel.
  // Keine externe JavaScript-Parser-Abhängigkeit im Spicetify-Client.
  const declarations = /\b(?:import|export)\s+(?:(?:[\w*{},\s]+?)\s+from\s*)?(["'])([^"'\r\n]+)\1/g;
  let updated = code.replace(declarations, (full: string, quote: string, reference: string) => {
    const suffix = `${quote}${reference}${quote}`;
    return replace(full, full.slice(0, -suffix.length), quote, reference);
  });
  // Dynamische Importe mit einem festen String werden ebenfalls unterstützt.
  updated = updated.replace(/\bimport\s*\(\s*(["'])([^"'\r\n]+)\1\s*\)/g,
    (full: string, quote: string, reference: string) => {
      const suffix = `${quote}${reference}${quote}`;
      return replace(full, full.slice(0, full.indexOf(suffix)), quote, reference) + full.slice(full.indexOf(suffix) + suffix.length);
    });
  return updated;
}

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
    assets.push({ marker, path, blob, mime: mimeFor(path) });
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
  // Nur ES-Module von <script type="module"> aus verfolgen. Andere
  // .js-Dateien bleiben klassische Skripte, damit alte Szenen funktionieren.
  const moduleSources = new Map<string, string>();
  const prepareModule = async (path: string): Promise<void> => {
    if (moduleSources.has(path)) return;
    const blob = files.get(path);
    if (!blob) throw new Error(`ES-Modul fehlt: ${path}`);
    const dependencies = new Set<string>();
    const rewritten = rewriteModuleImports(await blob.text(), path, files, dependencies);
    moduleSources.set(path, replaceReferences(rewritten, path));
    for (const child of dependencies) await prepareModule(child);
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
        const open = script.match(/^<script\b[^>]*>/i)?.[0] ?? "<script>";
        // Ein ES-Modul muss als echtes Modul laufen, NICHT als klassisches
        // Inline-Skript. Relative Importketten werden separat aufgelöst.
        if (/\btype\s*=\s*["']module["']/i.test(open)) {
          await prepareModule(path);
          html = html.replace(script, `<script type="module">import "${localModuleSpecifier(path)}";</script>`);
        } else {
          const code = replaceReferences(await files.get(path)!.text(), path);
          // src-Attribut entfernen, sonst lädt Chromium gegen Spotify.
          const attrs = open.replace(/\s+src\s*=\s*["'][^"']+["']/i, "");
          html = html.replace(script, `${attrs}${safeScript(code)}</script>`);
        }
      }
    }
    // Inline-Module mit import "./..." relativ zur Einstiegseite auflösen.
    // Klassische Inline-Skripte und Import-Maps aus dem Wallpaper bleiben
    // davon unberührt (deren Semantik darf nicht geändert werden).
    const inlineModules = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const match of inlineModules) {
      if (!/\btype\s*=\s*["']module["']/i.test(match[1])) continue;
      const dependencies = new Set<string>();
      const code = rewriteModuleImports(match[2], project.entry, files, dependencies);
      for (const child of dependencies) await prepareModule(child);
      html = html.replace(match[0], `<script${match[1]}>${safeScript(replaceReferences(code, project.entry))}</script>`);
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
    return {
      html, entry: project.entry, bootstrap: PROJECT_BOOTSTRAP, assets,
      modules: [...moduleSources].map(([path, code]) => ({ specifier: localModuleSpecifier(path), code })),
      dispose: () => undefined,
    };
}
