// =============================================================================
// Datei: tools/install.mjs
// Zweck: Installiert die ZuKaTo-Extension und -Custom-App in Spicetify.
//
// WICHTIG FÜR WINDOWS / SPOTIFY-UPDATES:
// - Die App wird zuerst gebaut (über npm run install:spicetify) und kopiert.
// - Bei einem VERALTETEN Spicetify-Backup scheitert "spicetify apply" mit Code 1.
// - Ausschließlich für diesen erkannten Spezialfall starten wir automatisch
//   den von Spicetify empfohlenen Befehl "spicetify backup apply".
// - Andere Fehler werden NICHT als fehlende Spicetify-Installation ausgegeben.
// - Es gibt maximal EINEN Reparaturversuch. Keine automatische Restore-/Reset-
//   Aktion und keine Änderungen an Git oder dem Quellcode des Projekts.
// =============================================================================

import { access, cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// -----------------------------------------------------------------------------
// Verzeichnisse: Alle Projektpfade sind relativ zu dieser Skriptdatei.
// APPDATA bestimmt ausschließlich den Spicetify-Datenordner des Benutzers.
// -----------------------------------------------------------------------------
const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolsDirectory, "..");
const outputDirectory = path.join(projectDirectory, "dist");
const appDataDirectory = process.env.APPDATA;

if (!appDataDirectory) {
  throw new Error("APPDATA fehlt. Bitte den Installer auf Windows ausführen.");
}

const spicetifyDirectory = path.join(appDataDirectory, "spicetify");
const extension = {
  name: "zukato-extension.js",
  source: path.join(outputDirectory, "extension", "zukato-extension.js"),
  target: path.join(spicetifyDirectory, "Extensions", "zukato-extension.js"),
};
const customApp = {
  name: "zukato-workspace",
  source: path.join(outputDirectory, "custom-app"),
  target: path.join(spicetifyDirectory, "CustomApps", "zukato-workspace"),
};

// -----------------------------------------------------------------------------
// Hilfsfunktion: Der Build muss existieren, bevor installierte Dateien geändert
// werden. Das verhindert einen leeren Custom-App-Ordner bei fehlendem Build.
// -----------------------------------------------------------------------------
async function assertExists(targetPath, description) {
  try {
    await access(targetPath);
  } catch {
    throw new Error(`${description} fehlt: ${targetPath}`);
  }
}

// -----------------------------------------------------------------------------
// CLI-Aufruf: Unter Windows führt cmd.exe den Spicetify-Befehl aus.
//
// Warum NICHT spawnSync(..., { shell: true })?
// Node.js 24 meldet dafür bei Argumenten DEP0190. Da die Argumente nur aus
// den hier fest codierten, harmlosen Spicetify-Befehlen bestehen, kann cmd.exe
// sie direkt ohne shell:true ausführen. Es werden KEINE Benutzerwerte in die
// Kommandozeile übernommen.
//
// stdout/stderr werden eingefangen UND wieder angezeigt. Wir benötigen den
// Text, um den Backup-Mismatch sicher von anderen Fehlern zu unterscheiden.
// -----------------------------------------------------------------------------
function executeSpicetify(...args) {
  // Schutz vor späteren Erweiterungen mit ungeprüften Shell-Argumenten.
  // Die aktuell erlaubten CLI-Werte enthalten keine Sonderzeichen/Leerzeichen.
  for (const argument of args) {
    if (!/^[A-Za-z0-9._-]+$/.test(argument)) {
      throw new Error(`Ungültiges Spicetify-Argument: ${argument}`);
    }
  }

  console.log(`spicetify ${args.join(" ")}`);

  const isWindows = process.platform === "win32";
  const command = isWindows ? (process.env.ComSpec || "cmd.exe") : "spicetify";
  const commandArgs = isWindows
    ? ["/d", "/s", "/c", `spicetify ${args.join(" ")}`]
    : args;
  const result = spawnSync(command, commandArgs, {
    cwd: projectDirectory,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });

  // Die echten Spicetify-Meldungen bleiben für die Fehlerdiagnose sichtbar.
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    text: `${result.stdout || ""}\n${result.stderr || ""}`,
    error: result.error,
  };
}

// -----------------------------------------------------------------------------
// Erkennt NUR den spezifischen Backup-Mismatch nach einem Spotify-Update.
// Spicetify gibt diesen Hinweis je nach Version leicht unterschiedlich aus.
// Ein generischer Fehlercode 1 rechtfertigt KEIN automatisches neues Backup.
// -----------------------------------------------------------------------------
function isOutdatedBackup(message) {
  return /Spotify version and backup version are mismatched/i.test(message)
    || /Please run\s+["'`]?spicetify backup apply/i.test(message)
    || /backup version.*(?:mismatch|different)/i.test(message);
}

// -----------------------------------------------------------------------------
// Einheitlicher Fehler: Ein fehlendes CLI-Programm ist etwas ANDERES als ein
// Fehler von Spicetify selbst. Die Meldungen nennen deshalb den korrekten Fall.
// -----------------------------------------------------------------------------
function requireSuccessfulCommand(result, label) {
  if (result.ok) return;
  if (result.error) {
    throw new Error(`${label} konnte nicht gestartet werden: ${result.error.message}`);
  }
  throw new Error(`${label} fehlgeschlagen (Exitcode ${result.status ?? "unbekannt"}). Siehe Spicetify-Ausgabe oben.`);
}

// -----------------------------------------------------------------------------
// Anwenden + einmalige Backup-Reparatur:
//
// Erst normal apply versuchen. Nur bei erkannter Versionsabweichung folgt der
// offizielle Befehl "backup apply". Dieser erstellt ein NEUES Spicetify-Backup
// des aktuellen Spotify-Clients und wendet die Erweiterungen anschließend an.
// "backup apply" enthält bereits den Apply-Schritt: KEIN zweites Apply nötig.
//
// Wer das bewusst verhindern möchte, kann ZUKATO_DISABLE_AUTO_BACKUP=1 setzen.
// -----------------------------------------------------------------------------
function applySpicetify() {
  const first = executeSpicetify("apply");
  if (first.ok) return;
  if (first.error) requireSuccessfulCommand(first, "spicetify apply");

  if (!isOutdatedBackup(first.text)) {
    requireSuccessfulCommand(first, "spicetify apply");
  }

  if (process.env.ZUKATO_DISABLE_AUTO_BACKUP === "1") {
    throw new Error(
      'Das Spotify-Backup ist veraltet. Automatik deaktiviert; bitte "spicetify backup apply" manuell ausführen.',
    );
  }

  console.log("Spotify wurde seit dem letzten Spicetify-Backup aktualisiert.");
  console.log('Repariere den Backup-Stand automatisch mit "spicetify backup apply" …');
  const recovery = executeSpicetify("backup", "apply");

  if (!recovery.ok) {
    requireSuccessfulCommand(recovery, "spicetify backup apply");
  }
  console.log("Spicetify-Backup aktualisiert; ZuKaTo wurde angewendet.");
}

// -----------------------------------------------------------------------------
// Extension installieren. Es wird nur die ZuKaTo-Datei ersetzt; fremde
// Erweiterungen und Spicetify-Einstellungen bleiben erhalten.
// -----------------------------------------------------------------------------
async function installExtension() {
  console.log("Installiere Extension …");
  await mkdir(path.dirname(extension.target), { recursive: true });
  await cp(extension.source, extension.target, { force: true });
}

// -----------------------------------------------------------------------------
// Custom App installieren. Der alte ZuKaTo-App-Ordner wird ersetzt, NICHT der
// vollständige CustomApps-Ordner anderer Spicetify-Erweiterungen.
// -----------------------------------------------------------------------------
async function installCustomApp() {
  console.log("Installiere Custom App …");
  await mkdir(path.dirname(customApp.target), { recursive: true });
  await rm(customApp.target, { recursive: true, force: true });
  await cp(customApp.source, customApp.target, { recursive: true, force: true });
}

// -----------------------------------------------------------------------------
// Installationsablauf: Zuerst Dateien, dann Spicetify-Konfiguration, danach
// Apply/Reparatur. Jeder Fehler bricht mit Exitcode 1 ab.
// -----------------------------------------------------------------------------
async function main() {
  await assertExists(extension.source, "Extension-Build");
  await assertExists(path.join(customApp.source, "index.js"), "Custom-App-Build");
  await assertExists(path.join(customApp.source, "manifest.json"), "Custom-App-Manifest");

  await installExtension();
  await installCustomApp();

  console.log("Aktiviere Extension und Custom App …");
  requireSuccessfulCommand(
    executeSpicetify("config", "extensions", extension.name),
    "Spicetify-Extension-Konfiguration",
  );
  requireSuccessfulCommand(
    executeSpicetify("config", "custom_apps", customApp.name),
    "Spicetify-Custom-App-Konfiguration",
  );
  applySpicetify();
  console.log("ZuKaTo Extension und Custom App wurden installiert.");
}

main().catch((error) => {
  console.error("Installation fehlgeschlagen:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
