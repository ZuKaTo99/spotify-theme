// =============================================================================
// Datei: tools/install.mjs
// Zweck: Windows-Installationsskript für Spicetify Extension und Custom App.
// =============================================================================
import { access, cp, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `toolsDirectory`.
// -----------------------------------------------------------------------------
const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `projectDirectory`.
// -----------------------------------------------------------------------------
const projectDirectory = path.resolve(toolsDirectory, "..");
// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `outputDirectory`.
// -----------------------------------------------------------------------------
const outputDirectory = path.join(projectDirectory, "dist");

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `appDataDirectory`.
// -----------------------------------------------------------------------------
const appDataDirectory = process.env.APPDATA;

if (!appDataDirectory) {
  throw new Error(
    "Die Windows-Umgebungsvariable APPDATA ist nicht verfügbar.",
  );
}

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `spicetifyDirectory`.
// -----------------------------------------------------------------------------
const spicetifyDirectory = path.join(
  appDataDirectory,
  "spicetify",
);

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `extension`.
// -----------------------------------------------------------------------------
const extension = {
  name: "zukato-extension.js",

  source: path.join(
    outputDirectory,
    "extension",
    "zukato-extension.js",
  ),

  target: path.join(
    spicetifyDirectory,
    "Extensions",
    "zukato-extension.js",
  ),
};

// -----------------------------------------------------------------------------
// Zentraler Modulzustand bzw. Registry-Wert `customApp`.
// -----------------------------------------------------------------------------
const customApp = {
  name: "zukato-workspace",

  source: path.join(
    outputDirectory,
    "custom-app",
  ),

  target: path.join(
    spicetifyDirectory,
    "CustomApps",
    "zukato-workspace",
  ),
};

// -----------------------------------------------------------------------------
// Stellt vor der Installation sicher, dass ein erwartetes Build-Artefakt existiert.
// -----------------------------------------------------------------------------
async function assertExists(
  targetPath,
  description,
) {
  try {
    await access(targetPath);
  } catch {
    throw new Error(
      `${description} wurde nicht gefunden: ${targetPath}`,
    );
  }
}

// -----------------------------------------------------------------------------
// Führt einen Spicetify-CLI-Befehl synchron mit sichtbarer Konsolenausgabe aus.
// -----------------------------------------------------------------------------
function runSpicetify(...arguments_) {
  console.log(`spicetify ${arguments_.join(" ")}`);

  execFileSync(
    "spicetify",
    arguments_,
    {
      stdio: "inherit",
    },
  );
}

// -----------------------------------------------------------------------------
// Kopiert die gebaute Extension in das Spicetify-Extensions-Verzeichnis.
// -----------------------------------------------------------------------------
async function installExtension() {
  console.log("Installiere Extension …");

  await mkdir(
    path.dirname(extension.target),
    {
      recursive: true,
    },
  );

  await cp(
    extension.source,
    extension.target,
    {
      force: true,
    },
  );
}

// -----------------------------------------------------------------------------
// Ersetzt die installierte Custom App durch den aktuellen Build.
// -----------------------------------------------------------------------------
async function installCustomApp() {
  console.log("Installiere Custom App …");

  await mkdir(
    path.dirname(customApp.target),
    {
      recursive: true,
    },
  );

  await rm(
    customApp.target,
    {
      recursive: true,
      force: true,
    },
  );

  await cp(
    customApp.source,
    customApp.target,
    {
      recursive: true,
      force: true,
    },
  );
}

// -----------------------------------------------------------------------------
// Orchestriert die Schritte dieses Skripts in der vorgesehenen Reihenfolge.
// -----------------------------------------------------------------------------
async function main() {
  await assertExists(
    extension.source,
    "Der gebaute Extension-Code",
  );

  await assertExists(
    customApp.source,
    "Die gebaute Custom App",
  );

  await installExtension();
  await installCustomApp();

  console.log("Aktiviere Extension und Custom App …");

  runSpicetify(
    "config",
    "extensions",
    extension.name,
  );

  runSpicetify(
    "config",
    "custom_apps",
    customApp.name,
  );

  runSpicetify("apply");

  console.log(
    "ZuKaTo Extension und Custom App wurden installiert.",
  );
}

main().catch((error) => {
  console.error("Installation fehlgeschlagen:");
  console.error(error);

  process.exitCode = 1;
});