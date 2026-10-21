// =============================================================================
// Datei: src/shared/backup-validation.ts
// Zweck: Backups vor dem ersten Storage-Schreibzugriff strukturell prüfen.
// Warum: Die Normalisierer sind absichtlich tolerant gegenüber kaputten
//        Storage-Werten. Beim expliziten RESTORE wäre stilles Zurücksetzen
//        von Favoriten, Notizen oder Presets dagegen gefährlich.
// Wo ändern? Schema des JSON-Backups und Validierungsregeln hier erweitern.
// =============================================================================

/** Auch ältere Exportdateien nutzen weiterhin dieses Format (Version 1). */
export interface ToolkitBackupData {
  format: "zukato-toolkit-backup";
  version: 1;
  createdAt?: string;
  settings: Record<string, unknown>;
  library: Record<string, unknown>;
  palette?: string;
  visualizer?: Record<string, unknown>;
  visualizerPresets?: unknown[];
  trackVisualizerScenes?: unknown[];
  scenePreferences?: Record<string, unknown>;
}

/** Dateigröße schützt vor sehr großen oder absichtlich manipulierten JSON-Dateien. */
export const MAX_BACKUP_BYTES = 10_000_000;

/**
 * Dieselben Obergrenzen werden von der jeweiligen Storage-Normalisierung
 * verwendet (library.ts und visualizer-config.ts). Ein Restore darf NICHT
 * still auf diese Grenzen kürzen, weil dadurch exportierte Daten verlorengehen.
 * Bei einer Änderung die entsprechenden Tests und Normalisierer mitziehen.
 */
export const BACKUP_COLLECTION_LIMITS = Object.freeze({
  history: 500,
  favorites: 250,
  notes: 250,
  visualizerPresets: 8,
  trackVisualizerScenes: 100,
  scenePlaylistScopes: 100,
  scenePlaylistItems: 128,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function invalid(block: string): never {
  throw new Error(`Backup beschädigt: ${block}. Es wurden keine Daten überschrieben.`);
}

/**
 * Prüft nur die äußere Struktur, nicht einzelne alte Konfigurationsfelder.
 * Detailwerte werden anschließend von den vorhandenen Normalisierern migriert.
 * Damit bleiben gültige ältere Backups verwendbar, kaputte Arrays führen aber
 * nicht mehr zu einem stillen Verlust kompletter Datensammlungen.
 */
export function validateToolkitBackup(value: unknown): ToolkitBackupData {
  if (!isRecord(value) || value.format !== "zukato-toolkit-backup" || value.version !== 1) {
    throw new Error("Keine unterstützte ZuKaTo-Backupdatei (Version 1).");
  }

  const settings = value.settings;
  if (!isRecord(settings) || !["schemaVersion", "workspaceTitle", "locale", "features", "showGreeting"]
    .some((key) => Object.prototype.hasOwnProperty.call(settings, key))) invalid("Einstellungen fehlen");

  const library = value.library;
  if (!isRecord(library) || !Array.isArray(library.history) ||
      !Array.isArray(library.favorites) || !Array.isArray(library.notes)) {
    invalid("Hörverlauf, Favoriten oder Notizen fehlen");
  }

  // Ein gültiges Backup kann größer als das heutige Speicherlimit sein.
  // Das normale Laden kürzt Listen bewusst; beim Restore würde das aber
  // ohne Warnung exportierte Einträge zerstören. Daher vorher abbrechen.
  for (const [name, label] of [
    ["history", "Hörverlauf"], ["favorites", "Favoriten"], ["notes", "Notizen"],
  ] as const) {
    if ((library[name] as unknown[]).length > BACKUP_COLLECTION_LIMITS[name]) {
      invalid(`${label} überschreitet die maximale Anzahl (${BACKUP_COLLECTION_LIMITS[name]})`);
    }
  }

  // Die URI wird von library.ts auf 250 Zeichen begrenzt. Eine längere
  // syntaktisch korrekte URI würde dabei abgeschnitten und danach verworfen.
  // Gleiches gilt für zu lange Notizen oder Metadaten.
  const validMetadata = (entry: Record<string, unknown>): boolean =>
    (["title", "artist", "album"] as const).every((key) =>
      entry[key] === undefined || (typeof entry[key] === "string" && entry[key].length <= 180));
  const validLength = (entry: Record<string, unknown>): boolean =>
    entry.uri !== undefined && typeof entry.uri === "string" &&
    entry.uri.length <= 250 && validMetadata(entry);

  // Ein Array voller Null-/Fremdobjekte wäre formal gültig, würde aber beim
  // Normalisieren vollständig geleert. Deshalb auch jeden gespeicherten Eintrag
  // vor der Bestätigung prüfen; alte Backups dürfen Metadaten weglassen.
  const validUri = (entry: unknown): entry is Record<string, unknown> =>
    isRecord(entry) && typeof entry.uri === "string" &&
    /^spotify:(track|episode):[A-Za-z0-9]+$/.test(entry.uri) && validLength(entry);
  if ((library.history as unknown[]).some((entry) =>
    !validUri(entry) || typeof entry.playedAt !== "number" ||
    !Number.isFinite(entry.playedAt) || entry.playedAt < 0)) {
    invalid("Hörverlauf enthält ungültige Einträge");
  }
  if ((library.favorites as unknown[]).some((entry) => !validUri(entry))) {
    invalid("Favoriten enthalten ungültige Einträge");
  }
  if ((library.notes as unknown[]).some((entry) =>
    !validUri(entry) || typeof entry.text !== "string" || entry.text.length > 4000 ||
    (entry.updatedAt !== undefined && (typeof entry.updatedAt !== "number" ||
      !Number.isFinite(entry.updatedAt) || entry.updatedAt < 0)))) {
    invalid("Notizen enthalten ungültige Einträge");
  }

  // Fehlende optionale Abschnitte sind bei alten Backups zulässig.
  // Falsche Typen dagegen dürfen niemals die vorhandenen Daten löschen.
  if (value.palette !== undefined && typeof value.palette !== "string") invalid("Farbpalette ungültig");
  if (value.visualizer !== undefined) {
    if (!isRecord(value.visualizer)) invalid("Visualizer-Einstellungen ungültig");
    const visualizer = value.visualizer;
    if (!["spectrum", "wallpaperFit", "sensitivity", "version"].some((key) => key in visualizer)) {
      invalid("Visualizer-Einstellungen ungültig");
    }
  }
  if (value.visualizerPresets !== undefined) {
    if (!Array.isArray(value.visualizerPresets)) invalid("Visualizer-Presets ungültig");
    if (value.visualizerPresets.length > BACKUP_COLLECTION_LIMITS.visualizerPresets)
      invalid("Zu viele Visualizer-Presets");
    const presetIds = new Set<string>();
    for (const item of value.visualizerPresets) {
      if (!isRecord(item) || typeof item.id !== "string" ||
          !/^custom-[A-Za-z0-9-]{1,60}$/.test(item.id) ||
          typeof item.name !== "string" || !item.name.trim() ||
          !isRecord(item.config)) invalid("Visualizer-Preset beschädigt");
      if (presetIds.has(item.id)) invalid("Doppelte Visualizer-Preset-ID");
      presetIds.add(item.id);
    }
  }
  if (value.trackVisualizerScenes !== undefined) {
    if (!Array.isArray(value.trackVisualizerScenes)) invalid("Song-Szenen ungültig");
    if (value.trackVisualizerScenes.length > BACKUP_COLLECTION_LIMITS.trackVisualizerScenes)
      invalid("Zu viele Song-Szenen");
    const sceneUris = new Set<string>();
    for (const item of value.trackVisualizerScenes) {
      if (!isRecord(item) || typeof item.uri !== "string" ||
          !/^spotify:(track|episode):[A-Za-z0-9]+$/.test(item.uri) || !isRecord(item.config)) {
        invalid("Song-Szene beschädigt");
      }
      if (sceneUris.has(item.uri)) invalid("Doppelte Song-Szene");
      sceneUris.add(item.uri);
    }
  }
  if (value.scenePreferences !== undefined) {
    if (!isRecord(value.scenePreferences)) invalid("Wallpaper-Playlists ungültig");
    const scenes = value.scenePreferences;
    for (const key of ["playlists", "starts", "originals", "originalRanges"]) {
      if (scenes[key] !== undefined && !isRecord(scenes[key])) invalid(`Wallpaper-Feld ${key} ungültig`);
    }
    if (isRecord(scenes.playlists)) {
      if (Object.keys(scenes.playlists).length > BACKUP_COLLECTION_LIMITS.scenePlaylistScopes)
        invalid("Zu viele Wallpaper-Playlists");
      for (const [scope, items] of Object.entries(scenes.playlists)) {
        if (!/^(default|spotify:(?:track|episode):[A-Za-z0-9]+)$/.test(scope) ||
          !Array.isArray(items) || items.length > BACKUP_COLLECTION_LIMITS.scenePlaylistItems ||
          items.some((item) => typeof item !== "string" ||
            !/^scene-[a-zA-Z0-9-]{8,80}$/.test(item)) ||
          new Set(items).size !== items.length) {
          invalid("Wallpaper-Playlist beschädigt oder zu groß");
        }
      }
    }
    for (const key of ["starts", "originals", "originalRanges"] as const) {
      if (isRecord(scenes[key]) && Object.keys(scenes[key]).length > BACKUP_COLLECTION_LIMITS.scenePlaylistScopes)
        invalid(`Zu viele Wallpaper-Einträge in ${key}`);
    }
  }

  // Den Typ erst nach erfolgreicher Prüfung zusichern; keine Daten verändern.
  return value as unknown as ToolkitBackupData;
}

/** Übersicht für eine bewusste Bestätigung VOR jeder Datenänderung. */
export function backupSummary(backup: ToolkitBackupData): {
  history: number; favorites: number; notes: number; presets: number; songScenes: number;
} {
  return {
    history: (backup.library.history as unknown[]).length,
    favorites: (backup.library.favorites as unknown[]).length,
    notes: (backup.library.notes as unknown[]).length,
    presets: backup.visualizerPresets?.length ?? 0,
    songScenes: backup.trackVisualizerScenes?.length ?? 0,
  };
}
