/**
 * ZuKaTo Spicetify – responsives Bedienfeld für benannte Sammlungen.
 *
 * Das Panel wird an ein bestehendes Element angehängt. Es enthält KEINE
 * direkte Spotify-API-Anbindung und verändert keine Mini-Player-/Nebula-Datei.
 *
 * CSS: NamedCollectionsPanel.css einmalig im vorhandenen Stylesheet einbinden.
 */

import {
  CollectionConflictError, NamedCollectionsStore,
  type CollectionsDocument,
  type PlaylistExportPlan,
} from './NamedCollections';
import { PlaylistExportReviewError } from '../../../../shared/spotify-playlist-transfer';
export { PlaylistExportReviewError } from '../../../../shared/spotify-playlist-transfer';

/** Benötigte Schnittstellen zu den schon vorhandenen Playlist-Werkzeugen. */
export interface NamedCollectionsPanelOptions {
  store: NamedCollectionsStore;
  legacyTrackUris: () => readonly string[];
  onCollectionChanged: (document: CollectionsDocument) => void;
  /** Bestehende Spotify-Playlist-Funktion, nur nach explizitem Klick aufgerufen. */
  onExportConfirmed?: (plan: PlaylistExportPlan) => Promise<void>;
  /** Gibt einen unklaren Auftrag erst nach Prüfung und zweiter Bestätigung frei. */
  onExportGuardReset?: (plan: PlaylistExportPlan) => void;
}

/** Öffentliche Steuerung für Aktualisierung und sicheres Entfernen des Panels. */
export interface NamedCollectionsPanelController {
  refresh(): void;
  destroy(): void;
}

type EditorMode = 'create' | 'rename' | null;

/** Erstellt HTML-Elemente ohne ungesichertes innerHTML. */
function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Erstellt einen beschrifteten Button mit einem echten Click-Handler. */
function createButton(label: string, action: () => void, className = ''): HTMLButtonElement {
  const button = createElement('button', `zukato-collections__button ${className}`, label);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

/** Formatiert die Titelanzahl für jeden Eintrag in der Auswahlliste. */
function trackCount(count: number): string {
  return `${count} ${count === 1 ? 'Song' : 'Songs'}`;
}

/** Ermittelt einen freien Namen für Duplikate auch bei bereits vorhandenen Kopien. */
function duplicateName(document: CollectionsDocument, original: string): string {
  const normalizedNames = new Set(document.collections.map((item) => item.name.toLocaleLowerCase()));
  const baseName = original.replace(/ \(Kopie(?: \d+)?\)$/, '');
  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const ending = suffix === 1 ? ' (Kopie)' : ` (Kopie ${suffix})`;
    const candidate = `${baseName.slice(0, 60 - ending.length)}${ending}`;
    if (!normalizedNames.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('Für diese Sammlung konnte kein eindeutiger Name ermittelt werden.');
}

/**
 * Bindet das Sammlungsmenü ein. Neue oder bestehende Workspace-Titel werden
 * über onCollectionChanged an die vorhandene Arbeitsliste zurückgemeldet.
 */
export function mountNamedCollectionsPanel(
  host: HTMLElement,
  options: NamedCollectionsPanelOptions,
): NamedCollectionsPanelController {
  // Abschnitt 1: Wir bauen nur unser eigenes Panel ein, nicht die Spotify-Hauptseite.
  const root = createElement('section', 'zukato-collections');
  root.setAttribute('aria-label', 'Benannte Musiksammlungen');
  host.append(root);

  // Abschnitt 2: Merken, welches Formular oder welcher Bestätigungsdialog offen ist.
  let mode: EditorMode = null;
  let renameId: string | null = null;
  let deletionId: string | null = null;
  let exportId: string | null = null;
  let reviewPlan: PlaylistExportPlan | null = null;
  let resetId: string | null = null;
  let exporting = false;
  let errorMessage = '';
  let successMessage = '';
  let disposed = false;

  /** Lädt die lokale Sammlung und meldet sie der bisherigen Arbeitsliste. */
  try {
    const initial = options.store.load(options.legacyTrackUris());
    options.onCollectionChanged(initial);
  } catch (error) {
    // Defekte Daten werden absichtlich nicht durch einen Default überschrieben.
    errorMessage = error instanceof Error ? error.message : 'Die Sammlungen konnten nicht geladen werden.';
  }

  /** Führt eine lokale Aktion aus und aktualisiert danach die bestehende Ansicht. */
  function apply(action: () => CollectionsDocument): void {
    try {
      const result = action();
      mode = null;
      renameId = null;
      deletionId = null;
      exportId = null;
      reviewPlan = null;
      resetId = null;
      errorMessage = '';
      successMessage = '';
      options.onCollectionChanged(result);
    } catch (error) {
      // Bei parallelen Änderungen die neue Version anzeigen, ohne den alten
      // Entwurf darüberzuschreiben. Die ausgelöste Aktion wird nicht wiederholt.
      if (error instanceof CollectionConflictError) {
        try {
          options.onCollectionChanged(options.store.reload());
          mode = null; renameId = null; deletionId = null; exportId = null;
        } catch (reloadError) {
          errorMessage = reloadError instanceof Error ? reloadError.message : 'Die Sammlungen konnten nicht neu geladen werden.';
          render();
          return;
        }
      }
      errorMessage = error instanceof Error ? error.message : 'Die Aktion ist fehlgeschlagen.';
    }
    render();
  }

  /** Zeigt die Bearbeitung des Sammlungsnamens als beschriftetes Inline-Formular. */
  function renderNameEditor(target: HTMLElement, original = ''): void {
    // Eine einzige Eingabe für neue Namen und das Umbenennen verwenden.
    const form = createElement('form', 'zukato-collections__editor');
    const label = createElement('label', 'zukato-collections__label', mode === 'rename' ? 'Neuer Name' : 'Name der Sammlung');
    const input = createElement('input', 'zukato-collections__input');
    input.type = 'text';
    input.maxLength = 60;
    input.required = true;
    input.value = original;
    input.autocomplete = 'off';
    label.append(input);
    const save = createElement('button', 'zukato-collections__button zukato-collections__button--primary', 'Speichern');
    save.type = 'submit';
    const cancel = createButton('Abbrechen', () => { mode = null; renameId = null; render(); });
    form.append(label, save, cancel);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value;
      if (mode === 'rename' && renameId) {
        apply(() => options.store.rename(renameId!, value));
      } else {
        apply(() => options.store.create(value));
      }
    });
    target.append(form);
  }

  /** Exportiert erst nach einer zweiten, ausdrücklich bestätigenden Benutzeraktion. */
  async function confirmExport(id: string): Promise<void> {
    if (exporting || disposed || !options.onExportConfirmed) return;
    // Während des Exports einen zweiten gleichzeitigen Auftrag verhindern.
    exporting = true;
    errorMessage = '';
    successMessage = '';
    render();
    let plan: PlaylistExportPlan | null = null;
    try {
      plan = options.store.preparePlaylistExport(id);
      await options.onExportConfirmed(plan);
      successMessage = 'Der Playlist-Auftrag wurde erfolgreich abgeschlossen.';
      exportId = null;
      reviewPlan = null;
      resetId = null;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Die Playlist konnte nicht erstellt werden.';
      reviewPlan = error instanceof PlaylistExportReviewError ? plan : null;
    } finally {
      exporting = false;
      render();
    }
  }

  /** Eine Freigabe löscht nur den lokalen Schutz dieses einen Auftrags.
   * Der Nutzer bestätigt zuvor ausdrücklich, dass er Spotify geprüft hat. */
  function confirmGuardReset(): void {
    if (exporting || !reviewPlan || !options.onExportGuardReset) return;
    try {
      options.onExportGuardReset(reviewPlan);
      reviewPlan = null;
      resetId = null;
      errorMessage = '';
      successMessage = 'Export nach Prüfung wieder freigegeben.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Der Exportstatus konnte nicht freigegeben werden.';
    }
    render();
  }

  /** Zeichnet nur das Panel neu; die übrige Spotify-Oberfläche bleibt unberührt. */
  function render(): void {
    if (disposed) return;
    // Abschnitt 3: Alte Ansicht entfernen und den aktuellen Stand neu anzeigen.
    root.replaceChildren();
    const header = createElement('div', 'zukato-collections__header');
    const heading = createElement('h3', 'zukato-collections__heading', 'Meine Sammlungen');
    const subtitle = createElement('p', 'zukato-collections__subtitle', 'Bis zu 40 Sammlungen mit je 500 Songs.');
    header.append(heading, subtitle);
    root.append(header);

    // Fehler und Erfolgsmeldungen direkt im Panel anzeigen.
    if (errorMessage) {
      const error = createElement('p', 'zukato-collections__error', errorMessage);
      error.setAttribute('role', 'alert');
      root.append(error);
    }
    if (successMessage) {
      const success = createElement('p', 'zukato-collections__success', successMessage);
      success.setAttribute('role', 'status');
      root.append(success);
    }

    let snapshot: CollectionsDocument;
    try {
      snapshot = options.store.getSnapshot();
    } catch {
      // Bei defektem Storage gibt es absichtlich keine gefährlichen Aktionen.
      return;
    }

    // Neue Sammlung anlegen oder die aktuelle Sammlung als Kopie übernehmen.
    const toolbar = createElement('div', 'zukato-collections__toolbar');
    toolbar.append(
      createButton('Neue Sammlung', () => { mode = 'create'; renameId = null; render(); }, 'zukato-collections__button--primary'),
      createButton('Aktuelle duplizieren', () => {
        const active = snapshot.collections.find((entry) => entry.id === snapshot.activeCollectionId)!;
        apply(() => options.store.create(duplicateName(snapshot, active.name), true));
      }),
    );
    root.append(toolbar);

    if (mode === 'create') renderNameEditor(root);

    // Für jede Sammlung die Auswahl und die zugehörigen Aktionen anzeigen.
    const list = createElement('ul', 'zukato-collections__list');
    for (const collection of snapshot.collections) {
      const current = collection.id === snapshot.activeCollectionId;
      const item = createElement('li', `zukato-collections__item${current ? ' zukato-collections__item--active' : ''}`);
      const select = createButton(collection.name, () => apply(() => options.store.setActive(collection.id)), 'zukato-collections__selector');
      select.setAttribute('aria-current', current ? 'true' : 'false');
      const count = createElement('span', 'zukato-collections__count', trackCount(collection.trackUris.length));
      const actions = createElement('div', 'zukato-collections__actions');
      const rename = createButton('Umbenennen', () => {
        mode = 'rename'; renameId = collection.id; deletionId = null; render();
      });
      rename.setAttribute('aria-label', `${collection.name} umbenennen`);
      const del = createButton('Löschen', () => { deletionId = collection.id; mode = null; render(); });
      del.setAttribute('aria-label', `${collection.name} löschen`);
      del.disabled = snapshot.collections.length === 1;
      actions.append(rename, del);
      item.append(select, count, actions);

      if (mode === 'rename' && renameId === collection.id) renderNameEditor(item, collection.name);
      // Löschen erfordert eine eigene Bestätigung und betrifft nur lokale Daten.
      if (deletionId === collection.id) {
        const warning = createElement('div', 'zukato-collections__confirmation');
        warning.append(
          createElement('p', '', `„${collection.name}“ nur lokal löschen? Spotify-Playlists bleiben unverändert.`),
          createButton('Löschen bestätigen', () => apply(() => options.store.remove(collection.id)), 'zukato-collections__button--danger'),
          createButton('Abbrechen', () => { deletionId = null; render(); }),
        );
        item.append(warning);
      }
      list.append(item);
    }
    root.append(list);

    const active = snapshot.collections.find((entry) => entry.id === snapshot.activeCollectionId)!;
    // Abschnitt 4: Playlist-Export bleibt deaktiviert, bis Spotify angebunden ist.
    const exportSection = createElement('div', 'zukato-collections__export');
    exportSection.append(createElement('p', '', `Aktiv: ${active.name} · ${trackCount(active.trackUris.length)}`));
    const canExport = Boolean(options.onExportConfirmed) && active.trackUris.length > 0 && !exporting;
    const exportButton = createButton('Als Spotify-Playlist exportieren', () => { exportId = active.id; render(); }, 'zukato-collections__button--primary');
    exportButton.disabled = !canExport;
    exportSection.append(exportButton);
    if (!options.onExportConfirmed) {
      exportSection.append(createElement('p', 'zukato-collections__hint', 'Der Export wird freigeschaltet, sobald die bestehende Spotify-Playlist-Funktion verbunden ist.'));
    }
    // Der tatsächliche Spotify-Aufruf darf erst nach dem Bestätigungsklick erfolgen.
    if (exportId === active.id) {
      const confirmation = createElement('div', 'zukato-collections__confirmation');
      const confirmButton = createButton('Playlist jetzt erstellen', () => { void confirmExport(active.id); }, 'zukato-collections__button--primary');
      confirmButton.disabled = exporting;
      confirmation.append(
        createElement('p', '', `Spotify-Playlist „${active.name}“ mit ${trackCount(active.trackUris.length)} erstellen?`),
        confirmButton,
        createButton('Abbrechen', () => { if (!exporting) { exportId = null; render(); } }),
      );
      exportSection.append(confirmation);
    }
    // Den Entsperrknopf nur für genau den Auftrag anbieten, dessen Ergebnis
    // unklar war. Zwei eigene Klicks verhindern eine versehentliche Freigabe.
    if (reviewPlan?.collectionId === active.id && options.onExportGuardReset) {
      const review = createElement('div', 'zukato-collections__confirmation');
      review.append(createElement('p', '', `Bitte „${reviewPlan.name}“ zuerst in Spotify prüfen. Eine erneute Freigabe kann eine doppelte Playlist erzeugen.`));
      if (resetId === active.id) {
        review.append(
          createElement('p', '', 'Spotify geprüft und einen erneuten Export bewusst erlauben?'),
          createButton('Exportstatus freigeben', confirmGuardReset, 'zukato-collections__button--danger'),
          createButton('Abbrechen', () => { resetId = null; render(); }),
        );
      } else {
        review.append(createButton('Nach Prüfung erneut erlauben', () => { resetId = active.id; render(); }));
      }
      exportSection.append(review);
    }
    root.append(exportSection);
  }

  render();
  return {
    /** Aktualisiert den angezeigten Stand nach Änderungen aus der vorhandenen Arbeitsliste. */
    refresh() { errorMessage = ''; render(); },
    /** Entfernt das Panel und verhindert spätere Aktualisierungen. */
    destroy() { disposed = true; root.remove(); },
  };
}
