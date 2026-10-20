// =============================================================================
// Datei: tests/helpers/load-ts-module.mjs
// Zweck: Reine TypeScript-Module in isolierten Node-Tests ausführen.
//
// TypeScript 7 exportiert über `require("typescript")` NICHT mehr die alte
// transpileModule/ScriptTarget-API. Die alten Tests schlugen deshalb unter
// Windows fehl, obwohl die Produktdateien korrekt waren.
//
// Node 22 besitzt stripTypeScriptTypes(). Es entfernt reine Typannotation,
// nicht aber Laufzeitcode. Ein kleiner, absichtlich begrenzter Exportadapter
// stellt für die vorhandenen reinen src/shared-Module CommonJS-Exports bereit.
// Kein npm-Compiler, keine Spotify-Verbindung und keine dynamische Auswertung
// untrusted Benutzereingaben erforderlich.
// =============================================================================
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import path from "node:path";

/** Für diese Tests dürfen nur in src/shared gelegene Quellmodule geladen werden. */
export function loadPureSharedModule(root, file, globals = {}) {
  if (!/^src\/shared\/[a-zA-Z0-9-]+\.ts$/.test(file))
    throw new Error("Nur reine Shared-Module laden.");
  const source = readFileSync(path.join(root, file), "utf8");
  const body = stripTypeScriptTypes(source, { mode: "strip" });
  // Typ-Imports verschwinden beim Strippen. Laufzeit-Imports werden NICHT
  // still entfernt: Andere Module müssten explizit im Test verdrahtet werden.
  if (/^\s*import\s+(?!type\b)/m.test(body))
    throw new Error(`Unerwarteter Laufzeit-Import in ${file}`);
  const names = new Set();
  const converted = body.replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\s+)(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g,
    (declaration, name) => {
      names.add(name);
      return declaration.replace(/^export\s+/, "");
    });
  if (/\bexport\s*(?:\{|default\b|\*)/.test(converted))
    throw new Error(`Nicht unterstütztes Exportformat in ${file}`);
  const exports = {};
  const code = converted + "\n" + [...names].map((name) => `exports.${name} = ${name};`).join("\n");
  runInNewContext(code, { exports, URL, Map, Set, ...globals }, { filename: file, timeout: 1000 });
  return exports;
}
