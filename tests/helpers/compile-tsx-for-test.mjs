// =============================================================================
// Datei: tests/helpers/compile-tsx-for-test.mjs
// Zweck: TSX-Komponenten für echte UI-Tests plattformunabhängig kompilieren.
//
// TypeScript 7 verwendet einen nativen Compiler. Der bisherige Aufruf mit
// einzelnen CLI-Optionen und Quelldatei scheiterte unter Windows. Deshalb
// verwenden wir wie der produktive Offline-Build ein isoliertes tsconfig.json.
// Fehlerausgaben des Compilers dürfen dabei nicht verschluckt werden.
// =============================================================================
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";

const cache = new Map();

/**
 * Übersetzt eine echte Custom-App-Komponente nach CommonJS. Die normalen
 * Projekt- und Spotify-Daten werden dabei weder gelesen noch verändert.
 *
 * Das temporäre tsconfig.json setzt noEmit explizit auf false: Die reguläre
 * Projektkonfiguration nutzt absichtlich noEmit für die Typprüfung.
 */
export function compileTsxForTest(root, relativePath) {
  if (!/^src\/custom-app\/[A-Za-z0-9/_-]+\.tsx$/.test(relativePath)) {
    throw new Error("TSX-Testquelle muss zur Custom App gehören.");
  }

  const key = `${root}::${relativePath}`;
  if (cache.has(key)) return cache.get(key);

  const sourceRoot = path.resolve(root, "src");
  const source = path.resolve(root, relativePath);
  const temp = mkdtempSync(path.join(tmpdir(), "zukato-tsx-test-"));
  try {
    const outputDirectory = path.join(temp, "compiled");
    const configFile = path.join(temp, "tsconfig.json");
    const compiler = path.join(root, "node_modules", "typescript", "bin", "tsc");

    // Dieselben expliziten Compileroptionen wie im getesteten Offline-Build.
    // Mit --project statt einzelner CLI-Quelldatei funktioniert dies auch mit
    // dem nativen TypeScript-7-Compiler unter Windows.
    const config = {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        rootDir: sourceRoot,
        outDir: outputDirectory,
        noEmit: false,
        noCheck: true,
        skipLibCheck: true,
        esModuleInterop: true,
        jsx: "react",
        jsxFactory: "Spicetify.React.createElement",
        jsxFragmentFactory: "Spicetify.React.Fragment",
        sourceMap: false,
        declaration: false,
        types: [],
      },
      files: [source],
    };
    writeFileSync(configFile, JSON.stringify(config), "utf8");

    // Kein shell=true, keine globalen npm-Tools und keine .cmd-Dateien nötig.
    const result = spawnSync(process.execPath, [compiler, "--project", configFile], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 30000,
    });
    if (result.error || result.status !== 0) {
      const diagnostics = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join("\n");
      throw new Error(
        `TSX-Testkompilierung fehlgeschlagen (Exit ${result.status ?? "unbekannt"}): ` +
        (result.error?.message ?? (diagnostics || "Compiler lieferte keine Diagnose.")),
      );
    }

    const output = path.join(outputDirectory, relativePath.replace(/^src\//, "").replace(/\.tsx$/, ".js"));
    const compiled = readFileSync(output, "utf8");
    cache.set(key, compiled);
    return compiled;
  } finally {
    // Auch bei Compilerfehlern niemals temporäre Artefakte stehen lassen.
    rmSync(temp, { recursive: true, force: true });
  }
}
