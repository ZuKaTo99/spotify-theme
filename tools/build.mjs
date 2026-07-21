import { build } from "esbuild";
import * as sass from "sass";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolsDirectory, "..");

const sourceDirectory = path.join(projectDirectory, "src");
const outputDirectory = path.join(projectDirectory, "dist");

const paths = {
  extension: {
    source: path.join(sourceDirectory, "extension", "index.ts"),
    output: path.join(outputDirectory, "extension", "zukato-extension.js"),
  },

  customApp: {
    source: path.join(sourceDirectory, "custom-app", "index.tsx"),
    output: path.join(outputDirectory, "custom-app", "index.js"),
    stylesSource: path.join(sourceDirectory, "custom-app", "app.scss"),
    stylesOutput: path.join(outputDirectory, "custom-app", "style.css"),
    manifestSource: path.join(
      sourceDirectory,
      "custom-app",
      "manifest.json",
    ),
    manifestOutput: path.join(
      outputDirectory,
      "custom-app",
      "manifest.json",
    ),
  },

  theme: {
    stylesSource: path.join(sourceDirectory, "theme", "user.scss"),
    stylesOutput: path.join(outputDirectory, "theme", "user.css"),
    colorsSource: path.join(sourceDirectory, "theme", "color.ini"),
    colorsOutput: path.join(outputDirectory, "theme", "color.ini"),
    assetsSource: path.join(sourceDirectory, "theme", "assets"),
    assetsOutput: path.join(outputDirectory, "theme", "assets"),
  },
};

async function compileScss(inputFile, outputFile) {
  const result = sass.compile(inputFile, {
    style: "expanded",
    sourceMap: false,
  });

  await writeFile(outputFile, result.css, "utf8");
}

async function buildExtension() {
  await build({
    entryPoints: [paths.extension.source],
    outfile: paths.extension.output,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    sourcemap: true,
    charset: "utf8",
    legalComments: "none",
  });
}

async function buildCustomApp() {
  await build({
    entryPoints: [paths.customApp.source],
    outfile: paths.customApp.output,

    bundle: true,
    format: "iife",
    globalName: "ZuKaToCustomApp",

    platform: "browser",
    target: "es2022",

    sourcemap: true,
    charset: "utf8",
    legalComments: "none",

/*
 * Die normale tsconfig nutzt react-jsx für die Typprüfung.
 * Beim Build verwenden wir jedoch bewusst den klassischen
 * JSX-Transform mit Spicetifys globaler React-Instanz.
 */
  jsx: "transform",
  jsxFactory: "Spicetify.React.createElement",
  jsxFragment: "Spicetify.React.Fragment",

  tsconfigRaw: {
    compilerOptions: {
      jsx: "react",
      jsxFactory: "Spicetify.React.createElement",
      jsxFragmentFactory: "Spicetify.React.Fragment",
    },
  },

    /*
     * Spicetify sucht im fertigen index.js nach einer global
     * erreichbaren Funktion namens render().
     *
     * Unsere TypeScript-Datei exportiert render().
     * esbuild legt diesen Export unter ZuKaToCustomApp.render ab.
     * Diese Brücke verbindet beide Seiten miteinander.
     */
    footer: {
      js: [
        "",
        "function render() {",
        "  return ZuKaToCustomApp.render();",
        "}",
      ].join("\n"),
    },
  });

  await compileScss(
    paths.customApp.stylesSource,
    paths.customApp.stylesOutput,
  );

  await cp(
    paths.customApp.manifestSource,
    paths.customApp.manifestOutput,
  );
}

async function buildTheme() {
  await compileScss(
    paths.theme.stylesSource,
    paths.theme.stylesOutput,
  );

  await cp(
    paths.theme.colorsSource,
    paths.theme.colorsOutput,
  );

  await cp(
    paths.theme.assetsSource,
    paths.theme.assetsOutput,
    {
      recursive: true,
      force: true,
    },
  );
}

async function main() {
  console.log("Bereinige dist-Verzeichnis …");

  await rm(outputDirectory, {
    recursive: true,
    force: true,
  });

  await mkdir(path.join(outputDirectory, "extension"), {
    recursive: true,
  });

  await mkdir(path.join(outputDirectory, "custom-app"), {
    recursive: true,
  });

  await mkdir(path.join(outputDirectory, "theme"), {
    recursive: true,
  });

  console.log("Baue Extension …");
  await buildExtension();

  console.log("Baue Custom App …");
  await buildCustomApp();

  console.log("Baue Theme …");
  await buildTheme();

  console.log("Build erfolgreich abgeschlossen.");
}

main().catch((error) => {
  console.error("Build fehlgeschlagen:");
  console.error(error);
  process.exitCode = 1;
});