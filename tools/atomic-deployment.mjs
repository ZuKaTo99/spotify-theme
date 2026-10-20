// =============================================================================
// Datei: tools/atomic-deployment.mjs
// Zweck: ZuKaTo-Updates sicher in Spicetify bzw. in dist/ übernehmen.
//
// Warum? Ein direktes rm(target) + cp(source,target) zerstört bei Kopierfehlern
// den zuvor funktionierenden Stand. Wir kopieren zuerst in einen Nachbarordner,
// tauschen dann per rename() aus und bewahren das Original bis zum erfolgreichen
// Abschluss aller Schritte auf. Auch ein fehlgeschlagenes spicetify apply wird
// zurückgerollt. Andere Spicetify-Apps werden niemals verändert.
//
// Wo ändern? Rollback und Dateitausch NUR in dieser Datei; Installations-
// CLI-Aufrufe gehören weiterhin nach tools/install.mjs.
// =============================================================================
import { cp, lstat, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";

/** Eintrag für eine zu aktualisierende Datei oder einen vollständigen Ordner. */
/** @typedef {{source: string, target: string, recursive?: boolean}} Artifact */

/** Erkennt nur ENOENT als „nicht installiert“; Rechtefehler bleiben sichtbar. */
async function exists(file) {
  try { await lstat(file); return true; }
  catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Bereitet ALLE Artefakte vor, bevor das erste bestehende Ziel verschoben wird.
 * `afterInstall` enthält optional die Spicetify-Konfiguration und den Apply.
 * Erst wenn auch dieser Schritt gelingt, werden die Backups verworfen.
 *
 * Ein fehlgeschlagenes Rollback belässt das Backup ABSICHTLICH auf der Platte;
 * es darf niemals in einem finally-Block versehentlich gelöscht werden.
 *
 * @param {Artifact[]} artifacts
 * @param {() => (void | Promise<void>)} [afterInstall]
 */
export async function installArtifactsAtomically(artifacts, afterInstall = async () => {}) {
  const prepared = [];
  let failure;
  try {
    for (const artifact of artifacts) {
      await mkdir(path.dirname(artifact.target), { recursive: true });
      const temporary = await mkdtemp(path.join(path.dirname(artifact.target), ".zukato-update-"));
      const entry = {
        ...artifact,
        temporary,
        staged: path.join(temporary, "next"),
        backup: path.join(temporary, "previous"),
        movedOriginal: false,
        installed: false,
      };
      prepared.push(entry); // Auch ein fehlgeschlagenes cp muss aufgeräumt werden.
      await cp(entry.source, entry.staged, { recursive: !!entry.recursive, force: true });
    }

    for (const entry of prepared) {
      if (await exists(entry.target)) {
        await rename(entry.target, entry.backup);
        entry.movedOriginal = true;
      }
      await rename(entry.staged, entry.target);
      entry.installed = true;
    }
    await afterInstall();
  } catch (error) {
    failure = error;
    const rollbackErrors = [];
    for (const entry of [...prepared].reverse()) {
      try {
        if (entry.installed) await rm(entry.target, { force: true, recursive: true });
        if (entry.movedOriginal) await rename(entry.backup, entry.target);
      } catch (rollbackError) {
        rollbackErrors.push(new Error(
          `Wiederherstellung von ${entry.target} fehlgeschlagen; Sicherheitskopie liegt unter ${entry.backup}`,
          { cause: rollbackError },
        ));
      }
    }
    if (rollbackErrors.length) {
      // BACKUPS ERHALTEN. Aufräumen wäre Datenverlust, wenn rename() scheiterte.
      throw new AggregateError([error, ...rollbackErrors],
        "Update fehlgeschlagen und mindestens ein Backup konnte nicht zurückgespielt werden.");
    }
  }

  // Bei normalem Erfolg UND erfolgreich rückgesetztem Fehler können die
  // temporären Kopien gefahrlos gelöscht werden.
  for (const entry of prepared) {
    try { await rm(entry.temporary, { force: true, recursive: true }); }
    catch (error) { console.warn(`Temporärer Update-Ordner konnte nicht entfernt werden: ${entry.temporary}: ${error}`); }
  }
  if (failure) throw failure;
}
