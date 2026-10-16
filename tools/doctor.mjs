// =============================================================================
// Datei: tools/doctor.mjs
// Zweck: Schnelle Plattformdiagnose, ohne Benutzerdateien zu verändern.
//
// Der Befehl `npm run doctor` überprüft die Voraussetzungen für Build und
// Spicetify-Installation und nennt konkrete Lösungsschritte für Windows.
// Es werden ausdrücklich keine Pakete installiert oder Einstellungen geändert.
// =============================================================================

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { access } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const windows = process.platform === "win32";
let warnings = 0;

/** Gibt Diagnosemeldungen mit einer einheitlichen, gut lesbaren Kennzeichnung aus. */
function report(ok, description, advice = "") {
  console.log(`${ok ? "[OK]" : "[HINWEIS]"} ${description}`);
  if (!ok) {
    warnings += 1;
    if (advice) console.log(`          ${advice}`);
  }
}

/** Sucht ein installiertes Node-Paket lokal statt über globale npm-Befehle. */
function resolveLocalPackage(name) {
  try {
    return require.resolve(`${name}/package.json`);
  } catch {
    return null;
  }
}

/** Testet esbuild OHNE einen Build oder eine Dateiänderung auszulösen. */
async function checkEsbuild() {
  if (!resolveLocalPackage("esbuild")) {
    report(false, "esbuild fehlt", "npm install ausführen; der Offline-Bundler ist alternativ nutzbar.");
    return;
  }
  try {
    const { transform } = await import("esbuild");
    await transform("const number: number = 1;", { loader: "ts" });
    report(true, "esbuild-Binärdatei ist ausführbar");
  } catch (error) {
    // Nur eine kurze Ursache ausgeben – manche Binärpakete erzeugen sehr lange
    // plattformspezifische Fehlermeldungen, die die Diagnose unlesbar machen.
    const summary = String(error.message).trim().split(/\r?\n/).find(Boolean) ?? "unbekannter Fehler";
    report(false, `esbuild ist nicht ausführbar: ${summary}`,
      "Der TypeScript-Offline-Bundler kann die Anwendung trotzdem bauen.");
  }
}

/** Startet die lokale TypeScript-Datei direkt mit der laufenden Node-Instanz. */
function checkTypeScript() {
  const packagePath = resolveLocalPackage("typescript");
  if (!packagePath) {
    report(false, "TypeScript fehlt", "npm install ausführen.");
    return;
  }
  const tsc = path.join(path.dirname(packagePath), "bin", "tsc");
  const result = spawnSync(process.execPath, [tsc, "--version"], {
    encoding: "utf8", windowsHide: true,
  });
  report(result.status === 0,
    result.status === 0 ? `Lokales TypeScript: ${result.stdout.trim()}` : "Lokales TypeScript kann nicht starten",
    "Bitte npm install auf demselben Betriebssystem ausführen; node_modules nicht kopieren.");
  // Eine durch Kopieren ältere node_modules-Version darf nicht als Beleg
  // für einen Test gegen die in package.json verlangte Compiler-Version gelten.
  if (result.status === 0) {
    const expected = String(require("../package.json").devDependencies.typescript ?? "");
    const expectedMajor = Number(/\d+/.exec(expected)?.[0]);
    const actualMajor = Number(/Version\s+(\d+)/.exec(result.stdout)?.[1]);
    if (expectedMajor && actualMajor && expectedMajor !== actualMajor) {
      report(false, `TypeScript-Version abweichend: package.json erwartet ${expected}, lokal ist ${result.stdout.trim()}`,
        "npm install ausführen und danach npm run check wiederholen.");
    }
  }
}

/** Liefert den vorhandenen Pfad zur Spicetify-CLI ohne sie zu starten. */
function checkSpicetify() {
  const result = windows
    ? spawnSync("where.exe", ["spicetify"], { encoding: "utf8", windowsHide: true })
    : spawnSync("which", ["spicetify"], { encoding: "utf8" });
  report(result.status === 0, "Spicetify-CLI " +
    (result.status === 0 ? `gefunden (${result.stdout.trim().split(/\r?\n/)[0]})` : "nicht im PATH"),
    "Spicetify installieren oder dessen ausführbares Verzeichnis in PATH eintragen.");
}

/** Prüft nur die wichtigsten Quellverzeichnisse des Projekts. */
async function checkSources() {
  for (const relative of ["src/extension/index.ts", "src/custom-app/index.tsx", "tools/bundle-fallback.mjs"]) {
    const absolute = path.resolve(relative);
    try {
      await access(absolute);
      report(true, `Projektdatei vorhanden: ${relative}`);
    } catch {
      report(false, `Projektdatei fehlt: ${relative}`, "Bist du im Projektverzeichnis?");
    }
  }
}

console.log(`ZuKaTo v${require("../package.json").version} – Umgebung prüfen (schreibgeschützt)`);
console.log(`Plattform: ${process.platform} | Node.js: ${process.version}`);
await checkSources();
checkTypeScript();
await checkEsbuild();
checkSpicetify();
console.log(warnings === 0 ? "Diagnose ohne Hinweise abgeschlossen." :
  `Diagnose abgeschlossen: ${warnings} Hinweis(e). Ein fehlender CLI-Pfad verhindert nicht den Build.`);
