// =============================================================================
// Datei: tests/atomic-deployment-v137.test.mjs
// Zweck: Atomaren Dateitausch MIT echten Dateien testen, ohne Windows,
// Spotify oder Benutzerinstallationen anzufassen. Fokus: Rollback beim Kopieren
// und bei fehlerhaftem Anwenden einer bereits gebauten Version.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installArtifactsAtomically } from "../tools/atomic-deployment.mjs";

async function withDirectory(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "zukato-atomic-v137-"));
  try { await callback(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}

/** Mehrere Artefakte werden nur bei Erfolg gemeinsam aktiviert. */
test("Atomare Installation: App und Extension werden vollständig ersetzt", async () => {
  await withDirectory(async (root) => {
    const sourceDir = path.join(root, "source-app");
    const targetDir = path.join(root, "installed-app");
    await mkdir(sourceDir);
    await mkdir(targetDir);
    await writeFile(path.join(sourceDir, "index.js"), "NEW APP");
    await writeFile(path.join(targetDir, "index.js"), "OLD APP");
    await writeFile(path.join(root, "new.js"), "NEW EXT");
    await writeFile(path.join(root, "extension.js"), "OLD EXT");
    await installArtifactsAtomically([
      { source: path.join(root, "new.js"), target: path.join(root, "extension.js") },
      { source: sourceDir, target: targetDir, recursive: true },
    ]);
    assert.equal(await readFile(path.join(targetDir, "index.js"), "utf8"), "NEW APP");
    assert.equal(await readFile(path.join(root, "extension.js"), "utf8"), "NEW EXT");
    assert.equal((await readdir(root)).filter((name) => name.startsWith(".zukato-update-")).length, 0);
  });
});

/** Fehlende zweite Quelle darf nicht einmal die erste installierte Datei ändern. */
test("Atomare Installation: Vorbereitungsfehler lässt beide alten Dateien unverändert", async () => {
  await withDirectory(async (root) => {
    await writeFile(path.join(root, "old.js"), "OLD");
    await writeFile(path.join(root, "new.js"), "NEW");
    await assert.rejects(installArtifactsAtomically([
      { source: path.join(root, "new.js"), target: path.join(root, "old.js") },
      { source: path.join(root, "missing"), target: path.join(root, "missing-target") },
    ]));
    assert.equal(await readFile(path.join(root, "old.js"), "utf8"), "OLD");
    assert.deepEqual((await readdir(root)).filter((name) => name.startsWith(".zukato-update-")), []);
  });
});

/** Auch ein NACH dem Kopieren fehlgeschlagenes Anwenden muss rückgängig werden. */
test("Atomare Installation: Apply-Fehler rollt vorhandene Dateien und Ordner zurück", async () => {
  await withDirectory(async (root) => {
    const folder = path.join(root, "app");
    const source = path.join(root, "next");
    await mkdir(folder);
    await mkdir(source);
    await writeFile(path.join(folder, "index.js"), "OLD");
    await writeFile(path.join(source, "index.js"), "NEW");
    await assert.rejects(installArtifactsAtomically([
      { source, target: folder, recursive: true },
    ], () => { throw new Error("Mock apply verweigert"); }), /Mock apply verweigert/);
    assert.equal(await readFile(path.join(folder, "index.js"), "utf8"), "OLD");
  });
});

/** Bei initialer Einrichtung darf ein Fehlschlag keine leere App hinterlassen. */
test("Atomare Installation: fehlgeschlagene Erstinstallation entfernt neues Ziel", async () => {
  await withDirectory(async (root) => {
    await writeFile(path.join(root, "next.js"), "NEW");
    await assert.rejects(installArtifactsAtomically([
      { source: path.join(root, "next.js"), target: path.join(root, "target.js") },
    ], () => { throw new Error("Mock Fehler"); }));
    assert.ok(!(await readdir(root)).includes("target.js"));
  });
});
