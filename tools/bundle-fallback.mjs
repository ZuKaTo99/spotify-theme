// =============================================================================
// Datei: tools/bundle-fallback.mjs
// Zweck: ZuKaTo-Bundler ohne esbuild-Binärdatei (Windows, Linux, Offline-Builds).
//
// Warum existiert dieser Fallback?
//   esbuild benutzt eine plattformspezifische Binärdatei. Wenn sie nach einem
//   ZIP-Transfer oder bei blockierten Installationsskripten nicht funktioniert,
//   benötigen wir trotzdem fertige Extension- und Custom-App-Bundles.
//
// Wichtige Reparatur ab v1.7.1:
//   Wir starten NICHT mehr `npm root -g` und erwarten KEIN globales TypeScript 5.
//   Stattdessen verwenden wir den lokalen TypeScript-Compiler (auch TypeScript 7)
//   über `process.execPath`, erzeugen temporäre CommonJS-Dateien und bündeln
//   deren lokale require()-Abhängigkeiten selbst.
// =============================================================================

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const requireFromBuild = createRequire(import.meta.url);

/**
 * Findet das TSC-Einstiegsskript des im Projekt installierten TypeScript-Pakets.
 * Die lokale Installation verhindert Abhängigkeiten von PATH, npm.cmd und
 * globalen TypeScript-Versionen.
 */
function localTypeScriptExecutable() {
  const packageFile = requireFromBuild.resolve("typescript/package.json");
  return path.join(path.dirname(packageFile), "bin", "tsc");
}

/**
 * Nutzt immer die aktuell ausgeführte Node.js-Binärdatei, damit auch Node 24 auf
 * Windows keine .cmd/.bat-Datei über spawnSync starten muss.
 */
function compileProject(sourceDirectory, temporaryDirectory) {
  const outputDirectory = path.join(temporaryDirectory, "compiled");
  const configFile = path.join(temporaryDirectory, "tsconfig.json");

  const config = {
    compilerOptions: {
      target: "ES2022",
      module: "CommonJS",
      // Kein moduleResolution: TypeScript 7 unterstützt "Node10" nicht mehr.
      // Bei CommonJS wählt jede TypeScript-Version selbst ihre passende Auflösung.
      rootDir: sourceDirectory,
      outDir: outputDirectory,
      noEmit: false,
      noCheck: true, // `npm run check` hat den Code bereits streng geprüft.
      skipLibCheck: true,
      esModuleInterop: true,
      jsx: "react",
      jsxFactory: "Spicetify.React.createElement",
      jsxFragmentFactory: "Spicetify.React.Fragment",
      sourceMap: false,
      declaration: false,
      types: [],
    },
    include: [
      path.join(sourceDirectory, "**", "*.ts"),
      path.join(sourceDirectory, "**", "*.tsx"),
    ],
    exclude: ["**/*.d.ts"],
  };

  return { outputDirectory, configFile, config };
}

/**
 * Startet den lokalen TypeScript-Compiler und liefert eine klare Fehlermeldung,
 * statt den ursprünglichen Fehler als `spawnSync npm ENOENT` zu verschleiern.
 */
function runCompiler(configFile) {
  const result = spawnSync(
    process.execPath,
    [localTypeScriptExecutable(), "--project", configFile],
    { encoding: "utf8", windowsHide: true, shell: false },
  );

  if (result.error) {
    throw new Error(`Lokaler TypeScript-Compiler konnte nicht starten: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `Lokaler TypeScript-Compiler fehlgeschlagen (Exit ${result.status}).\n` +
      [result.stdout, result.stderr].filter(Boolean).join("\n"),
    );
  }
}

/**
 * Liest die zur Laufzeit tatsächlich benötigten lokalen require()-Importe aus
 * den von TypeScript erzeugten JavaScript-Dateien. Type-Only-Imports wurden vom
 * Compiler bereits entfernt und brauchen daher nicht gesondert geprüft werden.
 */
function findDependencies(code) {
  const imports = new Set();
  const matcher = /\brequire\s*\(\s*(["'])([^"']+)\1\s*\)/g;
  let match;
  while ((match = matcher.exec(code)) !== null) imports.add(match[2]);
  return [...imports];
}

/** Löst relative JS-Importe auf; externe Runtime-Pakete sind nicht erlaubt. */
async function resolveCompiledModule(importer, specifier) {
  if (!specifier.startsWith(".")) {
    throw new Error(`Nicht unterstützte Runtime-Abhängigkeit: ${specifier} (${importer})`);
  }

  for (const candidate of [
    path.resolve(path.dirname(importer), `${specifier}.js`),
    path.resolve(path.dirname(importer), specifier, "index.js"),
  ]) {
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch {
      // Die nächste zulässige Dateivariante prüfen.
    }
  }

  throw new Error(`Kompilierte Abhängigkeit fehlt: ${specifier} in ${importer}`);
}

/**
 * Bündelt eine Extension (app=false) oder Custom App (app=true).
 * Jeder Aufruf entfernt seine temporären Kompilate wieder, auch bei Fehlern.
 */
export async function bundleFallback(entry, output, { app = false } = {}) {
  const entryAbsolute = path.resolve(entry);
  const sourceDirectory = path.resolve(path.dirname(entryAbsolute), "..");
  // Die Dateien liegen stets unter src/extension/ oder src/custom-app/.
  const projectSource = path.resolve(sourceDirectory);
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "zukato-build-"));

  try {
    const { configFile, config, outputDirectory } = compileProject(projectSource, temporaryDirectory);
    await writeFile(configFile, JSON.stringify(config), "utf8");
    runCompiler(configFile);

    const entryCompiled = path.join(
      outputDirectory,
      path.relative(projectSource, entryAbsolute).replace(/\.tsx?$/i, ".js"),
    );
    const moduleMap = new Map();
    const dependencyMap = new Map();
    const identify = (absolute) => path.relative(outputDirectory, absolute).replaceAll(path.sep, "/");

    // Sammle alle erreichbaren Dateien rekursiv, ohne Dateien mehrfach einzufügen.
    async function collect(filename) {
      if (moduleMap.has(filename)) return;
      const code = await readFile(filename, "utf8");
      moduleMap.set(filename, code);
      const dependencies = {};
      dependencyMap.set(filename, dependencies);
      for (const specifier of findDependencies(code)) {
        const target = await resolveCompiledModule(filename, specifier);
        dependencies[specifier] = identify(target);
        await collect(target);
      }
    }
    await collect(entryCompiled);

    const factories = [...moduleMap.entries()].map(([file, code]) =>
      `${JSON.stringify(identify(file))}: function(module, exports, require) {\n${code}\n}`,
    ).join(",\n");
    const dependencies = Object.fromEntries(
      [...dependencyMap.entries()].map(([file, refs]) => [identify(file), refs]),
    );

    // Browser-Bundles benötigen keinen Node.js-Require-Mechanismus.
    // Die Mini-Runtime kann ausschließlich vorher aufgelöste lokale Module laden.
    const runtime = `// ZuKaTo: portables Offline-Bundle ohne native esbuild-Abhängigkeit.\n` +
      `const modules = {${factories}};\n` +
      `const deps = ${JSON.stringify(dependencies)};\n` +
      `const cache = Object.create(null);\n` +
      `function load(id) {\n` +
      `  if (cache[id]) return cache[id].exports;\n` +
      `  const module = {exports: {}}; cache[id] = module;\n` +
      `  modules[id](module, module.exports, (specifier) => {\n` +
      `    const target = deps[id]?.[specifier];\n` +
      `    if (!target) throw new Error('Unbekannter Import: ' + id + ' -> ' + specifier);\n` +
      `    return load(target);\n` +
      `  });\n` +
      `  return module.exports;\n` +
      `}\nreturn load(${JSON.stringify(identify(entryCompiled))});\n`;

    const bundled = app
      ? `// ZuKaTo Custom App: Spicetify ruft die globale Funktion render() auf.\n` +
        `var ZuKaToCustomApp = (() => {\n${runtime}})();\n` +
        `function render() { return ZuKaToCustomApp.render(); }\n`
      : `// ZuKaTo Extension: Start bei Skriptausführung.\n(() => {\n${runtime}})();\n`;

    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, bundled, "utf8");
    console.info(`Offline-Bundler: ${moduleMap.size} Module -> ${output}`);
  } finally {
    // Keine temporären Videodateien oder TypeScript-Kompilate zurücklassen.
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
