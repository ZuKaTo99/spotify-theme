import { access, cp, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolsDirectory, "..");
const outputDirectory = path.join(projectDirectory, "dist");

const appDataDirectory = process.env.APPDATA;

if (!appDataDirectory) {
  throw new Error(
    "Die Windows-Umgebungsvariable APPDATA ist nicht verfügbar.",
  );
}

const spicetifyDirectory = path.join(
  appDataDirectory,
  "spicetify",
);

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