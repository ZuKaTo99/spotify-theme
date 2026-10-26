/**
 * ZuKaTo Spicetify – benannte Sammlungen.
 *
 * Dieses Modul ist bewusst unabhängig von Spotify, React und der bestehenden
 * UI gehalten. Spotify-Schreibaktionen müssen außerhalb dieses Moduls nach
 * ausdrücklicher Benutzerbestätigung erfolgen.
 *
 * Integration: Der Aufrufer übergibt beim ersten Laden die Song-URIs der
 * optional übergebenen bisherigen Arbeitsliste. Ihr Storage-Feld bleibt unangetastet.
 */

/** Lesender und schreibender Zugriff auf einen synchronen Persistenzspeicher. */
export interface CollectionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Eine geordnete, lokal gespeicherte Sammlung von Spotify-Titeln. */
export interface NamedCollection {
  id: string;
  name: string;
  trackUris: string[];
  createdAt: number;
  updatedAt: number;
}

/** Versioniertes Schema für zukünftige verlustfreie Migrationen. */
export interface CollectionsDocument {
  schemaVersion: 1;
  activeCollectionId: string;
  collections: NamedCollection[];
  /** Anzeigenamen bleiben erhalten, auch wenn ein Song aus Verlauf/Favoriten fällt. */
  trackDetails?: Record<string, CollectionTrackDetails>;
}

export interface CollectionTrackDetails {
  title: string;
  artist: string;
  album: string;
}

export interface CollectionTrack extends CollectionTrackDetails {
  uri: string;
}

/** Nur-Lese-Vorschau; hier wird noch keine Spotify-Playlist angelegt. */
export interface PlaylistExportPlan {
  collectionId: string;
  name: string;
  trackUris: string[];
}

/** Austauschbare Zeit- und ID-Erzeuger vereinfachen reproduzierbare Tests. */
export interface CollectionsOptions {
  storageKey?: string;
  now?: () => number;
  newId?: () => string;
}

/** Domänenspezifischer Fehler für fehlerhafte Aktionen oder gespeicherte Daten. */
export class CollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionError';
  }
}

/** Speicherfehler dürfen bestehende Sammlungen niemals stillschweigend löschen. */
export class CollectionStorageError extends CollectionError {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionStorageError';
  }
}

/** Sicherheitsgrenzen gegen versehentlich unbegrenzt wachsende Listen. */
export const COLLECTION_LIMITS = Object.freeze({
  maxCollections: 40,
  maxTracksPerCollection: 500,
  maxNameLength: 60,
});

/** Ein einziger Schlüssel für Werkbank, Backup und spätere Migrationen. */
export const NAMED_COLLECTIONS_STORAGE_KEY = 'zukato:playlist-workspace:named-collections:v1';
const TRACK_URI_PATTERN = /^spotify:track:[A-Za-z0-9]{22}$/;

/**
 * Wandelt Titel-IDs, Spotify-Track-URIs und Spotify-Track-URLs in eine
 * einheitliche URI um. Album-, Episoden- und Playlist-URIs sind ungültig.
 */
// Abschnitt 1: Nur gültige Spotify-Songs werden in das gemeinsame Format gebracht.
export function normalizeTrackUri(input: string): string {
  const value = input.trim();
  if (TRACK_URI_PATTERN.test(value)) return value;
  if (/^[A-Za-z0-9]{22}$/.test(value)) return `spotify:track:${value}`;

  // Query-Parameter von URLs sind erlaubt, andere Domains ausdrücklich nicht.
  const match = /^https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{22})(?:[/?#].*)?$/i.exec(value);
  if (match) return `spotify:track:${match[1]}`;
  throw new CollectionError('Ungültige Spotify-Track-URI.');
}

/** Filtert doppelte URIs und erhält die Reihenfolge ihres ersten Auftretens. */
function uniqueTrackUris(uris: readonly string[]): string[] {
  if (!Array.isArray(uris)) throw new CollectionError('Die Titelliste ist ungültig.');
  return [...new Set(uris.map((uri) => {
    if (typeof uri !== 'string') throw new CollectionError('Die Titelliste enthält ungültige Werte.');
    return normalizeTrackUri(uri);
  }))];
}

/** Bereitet Sammlungsnamen konsistent für Anzeige und Duplikatprüfung auf. */
function normalizeName(name: string): string {
  if (typeof name !== 'string') throw new CollectionError('Der Sammlungsname ist ungültig.');
  const result = name.trim().replace(/\s+/g, ' ');
  if (!result || result.length > COLLECTION_LIMITS.maxNameLength) {
    throw new CollectionError('Der Sammlungsname muss 1 bis 60 Zeichen enthalten.');
  }
  return result;
}

/** Kopiert verschachtelte Arrays, damit Aufrufer keine internen Daten verändern. */
function cloneDocument(document: CollectionsDocument): CollectionsDocument {
  return {
    schemaVersion: 1,
    activeCollectionId: document.activeCollectionId,
    collections: document.collections.map((collection) => ({
      ...collection,
      trackUris: [...collection.trackUris],
    })),
    ...(document.trackDetails ? {trackDetails: Object.fromEntries(
      Object.entries(document.trackDetails).map(([uri, details]) => [uri, {...details}]),
    )} : {}),
  };
}

/** Prüft Daten aus localStorage ohne Vertrauen in fremdes oder altes JSON. */
// Abschnitt 2: Gespeicherte Daten werden erst geprüft, bevor wir sie verwenden.
// Bei beschädigten Daten stoppen wir, statt sie zu überschreiben.
export function parseCollectionsDocument(raw: string): CollectionsDocument {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new CollectionStorageError('Die gespeicherten Sammlungen enthalten ungültiges JSON.');
  }

  if (!value || typeof value !== 'object') {
    throw new CollectionStorageError('Das gespeicherte Sammlungsformat ist ungültig.');
  }
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== 1 || !Array.isArray(source.collections) ||
      source.collections.length === 0 ||
      source.collections.length > COLLECTION_LIMITS.maxCollections ||
      typeof source.activeCollectionId !== 'string') {
    throw new CollectionStorageError('Unbekannte oder beschädigte Sammlungsdaten.');
  }

  // Jede Sammlung einzeln prüfen: Pflichtfelder, Reihenfolge und doppelte Namen.
  const collections: NamedCollection[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const entry of source.collections) {
    if (!entry || typeof entry !== 'object') {
      throw new CollectionStorageError('Eine gespeicherte Sammlung ist ungültig.');
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id ||
        typeof item.name !== 'string' || !Array.isArray(item.trackUris) ||
        !Number.isSafeInteger(item.createdAt) || !Number.isSafeInteger(item.updatedAt)) {
      throw new CollectionStorageError('Eine gespeicherte Sammlung ist unvollständig.');
    }

    const storedUris = item.trackUris as unknown[];
    let name: string;
    let uris: string[];
    try {
      name = normalizeName(item.name);
      // Bestehende Daten dürfen nicht stillschweigend verändert werden.
      uris = uniqueTrackUris(item.trackUris);
    } catch {
      throw new CollectionStorageError('Eine gespeicherte Sammlung enthält ungültige Werte.');
    }
    if (name !== item.name || uris.length !== storedUris.length ||
        uris.some((uri, i) => uri !== storedUris[i]) ||
        uris.length > COLLECTION_LIMITS.maxTracksPerCollection ||
        ids.has(item.id) || names.has(name.toLocaleLowerCase())) {
      throw new CollectionStorageError('Gespeicherte Sammlungen enthalten doppelte oder fehlerhafte Daten.');
    }
    ids.add(item.id);
    names.add(name.toLocaleLowerCase());
    collections.push({
      id: item.id,
      name,
      trackUris: uris,
      createdAt: item.createdAt as number,
      updatedAt: item.updatedAt as number,
    });
  }
  if (!ids.has(source.activeCollectionId)) {
    throw new CollectionStorageError('Die ausgewählte Sammlung ist nicht mehr vorhanden.');
  }
  // Metadaten sind bei älteren Sammlungen optional. Vorhandene Werte werden
  // streng geprüft, damit beschädigte Daten nicht beim nächsten Schreiben verschwinden.
  let trackDetails: Record<string, CollectionTrackDetails> | undefined;
  if (source.trackDetails !== undefined) {
    if (!source.trackDetails || typeof source.trackDetails !== 'object' ||
        Array.isArray(source.trackDetails)) {
      throw new CollectionStorageError('Die gespeicherten Songinformationen sind ungültig.');
    }
    const entries = Object.entries(source.trackDetails);
    if (entries.length > COLLECTION_LIMITS.maxCollections * COLLECTION_LIMITS.maxTracksPerCollection) {
      throw new CollectionStorageError('Die gespeicherten Songinformationen sind zu umfangreich.');
    }
    trackDetails = Object.create(null) as Record<string, CollectionTrackDetails>;
    for (const [uri, value] of entries) {
      const item = value as Partial<CollectionTrackDetails> | null;
      if (!TRACK_URI_PATTERN.test(uri) || !item || typeof item !== 'object' ||
          typeof item.title !== 'string' || !item.title || item.title.length > 180 ||
          typeof item.artist !== 'string' || item.artist.length > 180 ||
          typeof item.album !== 'string' || item.album.length > 180) {
        throw new CollectionStorageError('Die gespeicherten Songinformationen enthalten ungültige Werte.');
      }
      trackDetails[uri] = {title: item.title, artist: item.artist, album: item.album};
    }
  }
  return { schemaVersion: 1, activeCollectionId: source.activeCollectionId, collections,
    ...(trackDetails ? {trackDetails} : {}) };
}

/**
 * Transaktionaler lokaler Speicher für mehrere benannte Sammlungen.
 * Jede Änderung wird zuerst persistiert und erst danach im Speicher übernommen.
 */
// Abschnitt 3: Hier laufen alle Änderungen an den Sammlungen zusammen.
// Erst nach erfolgreichem Speichern gelten Änderungen als übernommen.
export class NamedCollectionsStore {
  private readonly storage: CollectionStorage;
  private readonly storageKey: string;
  private readonly now: () => number;
  private readonly newId: () => string;
  private document: CollectionsDocument | null = null;

  constructor(storage: CollectionStorage, options: CollectionsOptions = {}) {
    this.storage = storage;
    this.storageKey = options.storageKey ?? NAMED_COLLECTIONS_STORAGE_KEY;
    this.now = options.now ?? (() => Date.now());
    this.newId = options.newId ?? (() => crypto.randomUUID());
  }

  /**
   * Lädt den neuen Workspace oder übernimmt einmalig die bisherige Arbeitsliste.
   * Wichtig: legacyTrackUris muss aus der tatsächlichen alten Logik stammen.
   * Deren Storage-Key wird absichtlich nicht geraten oder überschrieben.
   */
  load(legacyTrackUris: readonly string[] = []): CollectionsDocument {
    if (this.document) return cloneDocument(this.document);
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.storageKey);
    } catch {
      throw new CollectionStorageError('Die Sammlungen konnten nicht gelesen werden.');
    }
    if (raw !== null) {
      this.document = parseCollectionsDocument(raw);
      return cloneDocument(this.document);
    }
    // Beim ersten Start übernehmen wir die alte Arbeitsliste genau einmal.
    const tracks = uniqueTrackUris(legacyTrackUris);
    this.ensureTrackLimit(tracks);
    const timestamp = this.now();
    const id = this.newId();
    if (!id || typeof id !== 'string') throw new CollectionError('Ungültige Sammlungs-ID.');
    const initial: CollectionsDocument = {
      schemaVersion: 1,
      activeCollectionId: id,
      collections: [{id, name: 'Meine Sammlung', trackUris: tracks, createdAt: timestamp, updatedAt: timestamp}],
    };
    this.save(initial);
    return cloneDocument(this.requiredDocument());
  }

  /** Liefert eine sichere Kopie des geladenen Workspaces. */
  getSnapshot(): CollectionsDocument {
    return cloneDocument(this.requiredDocument());
  }

  /** Erzeugt eine leere Sammlung oder eine Kopie der gerade aktiven Sammlung. */
  create(name: string, duplicateActive = false): CollectionsDocument {
    const normalized = normalizeName(name);
    const next = this.getSnapshot();
    this.ensureNameFree(next, normalized);
    if (next.collections.length >= COLLECTION_LIMITS.maxCollections) {
      throw new CollectionError('Es sind höchstens 40 Sammlungen möglich.');
    }
    const active = this.findCollection(next, next.activeCollectionId);
    const id = this.allocateId(next);
    const timestamp = this.now();
    next.collections.push({
      id, name: normalized,
      trackUris: duplicateActive ? [...active.trackUris] : [],
      createdAt: timestamp, updatedAt: timestamp,
    });
    next.activeCollectionId = id;
    return this.save(next);
  }

  /** Wechselt die Sammlung, ohne Reihenfolge oder Inhalte zu verändern. */
  setActive(id: string): CollectionsDocument {
    const next = this.getSnapshot();
    this.findCollection(next, id);
    next.activeCollectionId = id;
    return this.save(next);
  }

  /** Benennt eine Sammlung um und verhindert Namenskollisionen. */
  rename(id: string, name: string): CollectionsDocument {
    const next = this.getSnapshot();
    const collection = this.findCollection(next, id);
    const normalized = normalizeName(name);
    this.ensureNameFree(next, normalized, id);
    collection.name = normalized;
    collection.updatedAt = this.now();
    return this.save(next);
  }

  /** Löscht nur die lokale Sammlung; Spotify-Playlists werden nicht angetastet. */
  remove(id: string): CollectionsDocument {
    const next = this.getSnapshot();
    this.findCollection(next, id);
    if (next.collections.length === 1) {
      throw new CollectionError('Die letzte Sammlung kann nicht gelöscht werden.');
    }
    next.collections = next.collections.filter((collection) => collection.id !== id);
    if (next.activeCollectionId === id) next.activeCollectionId = next.collections[0].id;
    return this.save(next);
  }

  /** Fügt Titel ohne Duplikate am Ende der angegebenen Sammlung hinzu. */
  addTracks(id: string, uris: readonly string[]): CollectionsDocument {
    const next = this.getSnapshot();
    const collection = this.findCollection(next, id);
    collection.trackUris = uniqueTrackUris([...collection.trackUris, ...uris]);
    this.ensureTrackLimit(collection.trackUris);
    collection.updatedAt = this.now();
    return this.save(next);
  }

  /** Speichert URIs und ihre sichtbaren Songdaten gemeinsam in einem Schreibvorgang. */
  addTrackInfos(id: string, tracks: readonly CollectionTrack[]): CollectionsDocument {
    const next = this.getSnapshot();
    const collection = this.findCollection(next, id);
    if (!Array.isArray(tracks)) throw new CollectionError('Die Titelliste ist ungültig.');
    const details = next.trackDetails ?? Object.create(null) as Record<string, CollectionTrackDetails>;
    const uris: string[] = [];
    for (const track of tracks) {
      if (!track || typeof track.uri !== 'string' || typeof track.title !== 'string' ||
          !track.title || track.title.length > 180 || typeof track.artist !== 'string' ||
          track.artist.length > 180 || typeof track.album !== 'string' || track.album.length > 180) {
        throw new CollectionError('Ein Song enthält ungültige Informationen.');
      }
      const uri = normalizeTrackUri(track.uri);
      uris.push(uri);
      details[uri] = {title: track.title, artist: track.artist, album: track.album};
    }
    collection.trackUris = uniqueTrackUris([...collection.trackUris, ...uris]);
    this.ensureTrackLimit(collection.trackUris);
    next.trackDetails = details;
    collection.updatedAt = this.now();
    return this.save(next);
  }

  /** Entfernt Titel nur lokal aus dieser Sammlung. */
  removeTracks(id: string, uris: readonly string[]): CollectionsDocument {
    const next = this.getSnapshot();
    const collection = this.findCollection(next, id);
    const excluded = new Set(uniqueTrackUris(uris));
    collection.trackUris = collection.trackUris.filter((uri) => !excluded.has(uri));
    collection.updatedAt = this.now();
    return this.save(next);
  }

  /** Verschiebt einen Titel um genau eine Position nach oben oder unten. */
  moveTrack(id: string, uri: string, direction: 'up' | 'down'): CollectionsDocument {
    const next = this.getSnapshot();
    const collection = this.findCollection(next, id);
    const index = collection.trackUris.indexOf(normalizeTrackUri(uri));
    if (index === -1) throw new CollectionError('Der Titel befindet sich nicht in der Sammlung.');
    if (direction !== 'up' && direction !== 'down') throw new CollectionError('Ungültige Richtung.');
    const other = index + (direction === 'up' ? -1 : 1);
    if (other < 0 || other >= collection.trackUris.length) return next;
    [collection.trackUris[index], collection.trackUris[other]] =
      [collection.trackUris[other], collection.trackUris[index]];
    collection.updatedAt = this.now();
    return this.save(next);
  }

  /** Kopiert ausgewählte Titel aus einer vorhandenen in eine andere Sammlung. */
  copyTracks(sourceId: string, targetId: string, uris: readonly string[]): CollectionsDocument {
    const next = this.getSnapshot();
    const source = this.findCollection(next, sourceId);
    const target = this.findCollection(next, targetId);
    const wanted = new Set(uniqueTrackUris(uris));
    const matching = source.trackUris.filter((uri) => wanted.has(uri));
    target.trackUris = uniqueTrackUris([...target.trackUris, ...matching]);
    this.ensureTrackLimit(target.trackUris);
    target.updatedAt = this.now();
    return this.save(next);
  }

  /**
   * Liefert ausschließlich den Exportplan. Eine tatsächlich schreibende
   * Spotify-Aktion darf erst nach einem separaten Bestätigungsdialog starten.
   */
  preparePlaylistExport(id: string): PlaylistExportPlan {
    const collection = this.findCollection(this.requiredDocument(), id);
    if (collection.trackUris.length === 0) {
      throw new CollectionError('Die Sammlung enthält keine Songs.');
    }
    return {
      collectionId: collection.id,
      name: collection.name,
      trackUris: [...collection.trackUris],
    };
  }

  /** Prüft die maximale Titellänge je Sammlung. */
  private ensureTrackLimit(uris: readonly string[]): void {
    if (uris.length > COLLECTION_LIMITS.maxTracksPerCollection) {
      throw new CollectionError('Eine Sammlung darf höchstens 500 Songs enthalten.');
    }
  }

  /** Stellt sicher, dass Sammlungsnamen unabhängig von Großschreibung eindeutig sind. */
  private ensureNameFree(document: CollectionsDocument, name: string, exceptId?: string): void {
    if (document.collections.some((entry) =>
      entry.id !== exceptId && entry.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new CollectionError('Eine Sammlung mit diesem Namen existiert bereits.');
    }
  }

  /** Findet eine Sammlung oder meldet eine ungültige ID. */
  private findCollection(document: CollectionsDocument, id: string): NamedCollection {
    const collection = document.collections.find((item) => item.id === id);
    if (!collection) throw new CollectionError('Die ausgewählte Sammlung existiert nicht.');
    return collection;
  }

  /** Erzeugt eine eindeutige ID, auch bei fehlerhaften externen ID-Generatoren. */
  private allocateId(document: CollectionsDocument): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const id = this.newId();
      if (typeof id === 'string' && id && !document.collections.some((entry) => entry.id === id)) return id;
    }
    throw new CollectionError('Es konnte keine eindeutige Sammlungs-ID erzeugt werden.');
  }

  /** Erzwingt die Initialisierung, bevor Änderungsmethoden verwendet werden. */
  private requiredDocument(): CollectionsDocument {
    if (!this.document) throw new CollectionError('Die Sammlungen müssen zuerst geladen werden.');
    return this.document;
  }

  /** Persistiert atomar aus Anwendungssicht: bei Fehler bleibt der RAM-Stand alt. */
  private save(next: CollectionsDocument): CollectionsDocument {
    // Entfernte Songs brauchen keine verwaisten Anzeigenamen. Dadurch wächst
    // der gemeinsame Katalog beim Ersetzen von Sammlungen nicht endlos weiter.
    if (next.trackDetails) {
      const used = new Set(next.collections.flatMap((item) => item.trackUris));
      next.trackDetails = Object.fromEntries(Object.entries(next.trackDetails)
        .filter(([uri]) => used.has(uri)));
    }
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(next));
    } catch {
      throw new CollectionStorageError('Die Sammlungen konnten nicht gespeichert werden.');
    }
    this.document = next;
    return cloneDocument(next);
  }
}
