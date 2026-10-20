// =============================================================================
// Datei: tests/installer.test.mjs
// Zweck: Prüft den Installer ohne ein echtes Spotify/Spicetify zu verändern.
//
// In jedem Test wird APPDATA auf ein neues temporäres Verzeichnis gesetzt.
// Ein nachgebildetes Spicetify-Kommando erfasst die CLI-Aufrufe und kann den
// Backup-Mismatch aus der Windows-Fehlermeldung gezielt simulieren.
// Damit werden auch versehentliche Endlosschleifen oder ungeprüfte Backups
// verhindert, ohne Dateien des Benutzers anzufassen.
// =============================================================================

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, rm, chmod, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Der Projektordner wird von der Testdatei aus bestimmt und ist daher weder
// vom Benutzernamen noch vom Betriebssystem abhängig.
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installerPath = path.join(projectDirectory, "tools", "install.mjs");

/**
 * Startet den wirklichen Installer mit einer ausschließlich temporären
 * Spicetify-CLI. Das Ergebnis enthält auch die Reihenfolge aller Kommandos.
 * Keine echte Spotify-Datei oder Benutzerkonfiguration wird hier angefasst.
 */
async function runScenario(scenario, { disableAutoBackup = false, existingFiles = false } = {}) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "zukato-installer-test-"));
  const binDirectory = path.join(tempDirectory, "bin");
  const appDataDirectory = path.join(tempDirectory, "appdata");
  const callsFile = path.join(tempDirectory, "calls.jsonl");
  await mkdir(binDirectory, { recursive: true });

  // Alle CLI-Aufrufe landen in einem JSONL-Log des Test-Fixtures.
  // Die einzelnen Szenarien simulieren exakt einen Spicetify-Exitcode.
  const fakeCliCode = String.raw`
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.ZUKATO_TEST_CALLS, JSON.stringify(args) + "\n");
const command = args.join(" ");
if (command === "config custom_apps zukato-workspace" && process.env.ZUKATO_TEST_SCENARIO === "config-fails") {
  console.error("Unable to write Spicetify config");
  process.exit(1);
}
if (command === "apply" && process.env.ZUKATO_TEST_SCENARIO !== "normal") {
  if (process.env.ZUKATO_TEST_SCENARIO === "unexpected") {
    console.error("Spotify access denied: permission error");
    process.exit(1);
  }
  console.error("warning  Spotify version and backup version are mismatched.");
  console.error('info  Please run "spicetify backup apply"');
  process.exit(1);
}
if (command === "backup apply" && process.env.ZUKATO_TEST_SCENARIO === "repair-fails") {
  console.error("Unable to back up Spotify files");
  process.exit(1);
}
console.log("Mock-Spicetify-OK:", command);
`;

  await writeFile(path.join(binDirectory, "mock-spicetify.cjs"), fakeCliCode, "utf8");

  // Linux/macOS verwenden ein ausführbares kleines Shell-Skript.
  // Windows verwendet eine .cmd-Datei; cmd.exe sucht sie über PATHEXT.
  const unixShim = path.join(binDirectory, "spicetify");
  await writeFile(unixShim, '#!/bin/sh\nexec node "$(dirname "$0")/mock-spicetify.cjs" "$@"\n', "utf8");
  await chmod(unixShim, 0o755);
  await writeFile(
    path.join(binDirectory, "spicetify.cmd"),
    '@echo off\r\nnode "%~dp0mock-spicetify.cjs" %*\r\n',
    "utf8",
  );

  const extensionsDirectory = path.join(appDataDirectory, "spicetify", "Extensions");
  const installedAppDirectory = path.join(appDataDirectory, "spicetify", "CustomApps", "zukato-workspace");
  const installedExtension = path.join(extensionsDirectory, "zukato-extension.js");
  const installedApp = path.join(installedAppDirectory, "index.js");
  if (existingFiles) {
    await mkdir(extensionsDirectory, { recursive: true });
    await mkdir(installedAppDirectory, { recursive: true });
    await writeFile(installedExtension, "OLD-EXTENSION", "utf8");
    await writeFile(installedApp, "OLD-CUSTOM-APP", "utf8");
  }

  const environment = {
    ...process.env,
    APPDATA: appDataDirectory,
    PATH: `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
    ZUKATO_TEST_CALLS: callsFile,
    ZUKATO_TEST_SCENARIO: scenario,
  };
  // Die explizite Option wird nur für den Test deaktiviert; niemals globale
  // Prozessumgebungsvariablen verändern, damit parallele Tests stabil bleiben.
  delete environment.ZUKATO_DISABLE_AUTO_BACKUP;
  if (disableAutoBackup) environment.ZUKATO_DISABLE_AUTO_BACKUP = "1";

  try {
    const result = spawnSync(process.execPath, [installerPath], {
      cwd: projectDirectory,
      env: environment,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    const calls = (await readFile(callsFile, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    // Wichtig: Zustand VOR dem Löschen des Testordners zurückgeben.
    const readOptional = async (file) => {
      try { return await readFile(file, "utf8"); }
      catch (error) { if (error.code === "ENOENT") return null; throw error; }
    };
    return {
      result,
      calls,
      installedExtension: await readOptional(installedExtension),
      installedApp: await readOptional(installedApp),
      output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

/** Normales Spicetify-Apply darf kein unnötiges Backup erzeugen. */
test("Installer: erfolgreicher Apply ohne Backup-Neuerstellung", async () => {
  const { result, calls } = await runScenario("normal");
  assert.equal(result.status, 0);
  assert.deepEqual(calls, [
    ["config", "extensions", "zukato-extension.js"],
    ["config", "custom_apps", "zukato-workspace"],
    ["apply"],
  ]);
});

/** Nur ein eindeutiger Mismatch darf einen automatischen Reparaturversuch auslösen. */
test("Installer: Spotify-Backup-Mismatch löst genau einmal backup apply aus", async () => {
  const { result, calls, output } = await runScenario("mismatch");
  assert.equal(result.status, 0, output);
  assert.deepEqual(calls.at(-2), ["apply"]);
  assert.deepEqual(calls.at(-1), ["backup", "apply"]);
  assert.equal(calls.length, 4);
  assert.match(output, /Backup aktualisiert/i);
});

/** Fehler ohne Backup-Hinweis dürfen kein überschreibendes Backup auslösen. */
test("Installer: Berechtigungsfehler löst KEIN Backup aus", async () => {
  const { result, calls, output } = await runScenario("unexpected");
  assert.equal(result.status, 1, output);
  assert.equal(calls.length, 3);
  assert.match(output, /spicetify apply fehlgeschlagen/i);
});

/** Ein zweiter fehlgeschlagener Befehl wird gemeldet, nicht in einer Schleife wiederholt. */
test("Installer: gescheiterte Backup-Reparatur endet nach einem Versuch", async () => {
  const { result, calls, output } = await runScenario("repair-fails");
  assert.equal(result.status, 1, output);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.at(-1), ["backup", "apply"]);
  assert.match(output, /spicetify backup apply fehlgeschlagen/i);
});

/** Fortgeschrittene Benutzer können automatisches Backup bewusst ausschalten. */
test("Installer: ZUKATO_DISABLE_AUTO_BACKUP verhindert die Reparatur", async () => {
  const { result, calls, output } = await runScenario("mismatch", { disableAutoBackup: true });
  assert.equal(result.status, 1, output);
  assert.equal(calls.length, 3);
  assert.match(output, /Automatik deaktiviert/i);
});

/** Ein abgelehnter Spicetify-Apply darf die bisher funktionierende Version nicht entfernen. */
test("Installer: gescheiterter Apply stellt alte App und Extension wieder her", async () => {
  const data = await runScenario("unexpected", { existingFiles: true });
  assert.equal(data.result.status, 1, data.output);
  assert.equal(data.installedExtension, "OLD-EXTENSION");
  assert.equal(data.installedApp, "OLD-CUSTOM-APP");
});

/** Schon ein Fehler beim Aktivieren der zweiten Komponente muss rückgängig sein. */
test("Installer: Konfigurationsfehler stellt beide alten Komponenten wieder her", async () => {
  const data = await runScenario("config-fails", { existingFiles: true });
  assert.equal(data.result.status, 1, data.output);
  assert.equal(data.installedExtension, "OLD-EXTENSION");
  assert.equal(data.installedApp, "OLD-CUSTOM-APP");
  assert.equal(data.calls.length, 2, "Nach config-Fehler kein apply ausführen");
});

/** Auch beim Erstinstallieren dürfen keine halbfertigen Zieldateien bleiben. */
test("Installer: fehlgeschlagene Neuinstallation hinterlässt keine beschädigten Dateien", async () => {
  const data = await runScenario("unexpected");
  assert.equal(data.result.status, 1, data.output);
  assert.equal(data.installedExtension, null);
  assert.equal(data.installedApp, null);
});

/** Erfolgreiches Update ersetzt tatsächlich den alten Code statt ihn zu behalten. */
test("Installer: erfolgreiche Installation tauscht alte Komponenten aus", async () => {
  const data = await runScenario("normal", { existingFiles: true });
  assert.equal(data.result.status, 0, data.output);
  assert.notEqual(data.installedExtension, "OLD-EXTENSION");
  assert.notEqual(data.installedApp, "OLD-CUSTOM-APP");
  assert.match(data.installedApp, /function render|ZuKaToCustomApp|Spicetify/);
});
