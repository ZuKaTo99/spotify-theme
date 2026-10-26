// =============================================================================
// Datei: src/shared/i18n.ts
// Zweck: Zentrales Übersetzungssystem für Deutsch und Englisch.
// =============================================================================

import type {
  AppLocale,
} from "./settings";

// -----------------------------------------------------------------------------
// Alle aktuell unterstützten Sprachen.
// -----------------------------------------------------------------------------
export type SupportedLocale =
  | "de"
  | "en";

// -----------------------------------------------------------------------------
// Deutsches Übersetzungswörterbuch.
//
// Dieses Objekt ist gleichzeitig die zentrale Quelle aller gültigen
// TranslationKey-Werte.
// -----------------------------------------------------------------------------
const germanTranslations = {
  // ---------------------------------------------------------------------------
  // Allgemeine App-Texte.
  // ---------------------------------------------------------------------------
  "app.productLabel":
    "Spotify Toolkit",

  "app.description":
    "Persönlicher und modularer Spotify-Arbeitsbereich.",

  "app.greeting":
    "Hallo, {name}!",

  // ---------------------------------------------------------------------------
  // Allgemeine Modul-Texte.
  // ---------------------------------------------------------------------------
  "module.underDevelopment":
    "Dieses Modul wird noch entwickelt.",

  // ---------------------------------------------------------------------------
  // Dashboard.
  // ---------------------------------------------------------------------------
  "dashboard.description":
    "Übersicht über deinen aktuellen Spotify Toolkit-Arbeitsbereich.",

  "dashboard.workspaceModules":
    "Aktive Workspace-Module",

  "dashboard.extensionModules":
    "Aktive Erweiterungen",

  // ---------------------------------------------------------------------------
  // Tastenkürzel.
  // ---------------------------------------------------------------------------
  "shortcuts.heading":
    "Tastenbelegungen",

  "shortcuts.description":
    "Tastenkürzel anzeigen und bearbeiten.",

  "shortcuts.playPause":
    "Wiedergabe/Pause",

  "shortcuts.nextTrack":
    "Nächster Titel",

  "shortcuts.previousTrack":
    "Vorheriger Titel",

  "shortcuts.volumeUp":
    "Lautstärke erhöhen",

  "shortcuts.volumeDown":
    "Lautstärke verringern",

  "shortcuts.toggleMute":
    "Stumm ein/aus",

  "shortcuts.currentBinding":
    "Aktuelle Belegung",

  "shortcuts.edit":
    "Bearbeiten",

  "shortcuts.clear":
    "Belegung entfernen",

  "shortcuts.pressKeys":
    "Drücke jetzt die gewünschte Tastenkombination.",

  "shortcuts.cancel":
    "Aufnahme abbrechen",

  "shortcuts.reset":
    "Zurücksetzen",

  "shortcuts.open":
    "Tastenbelegungen öffnen",

  "shortcuts.backToSettings":
    "Zurück zu den Einstellungen",

  "shortcuts.conflictWith":
    "Diese Tastenkombination wird bereits für „{action}“ verwendet.",

  // ---------------------------------------------------------------------------
  // Einstellungen.
  // ---------------------------------------------------------------------------
  "settings.heading":
    "Einstellungen",

  "settings.workspaceTitle":
    "Workspace-Titel",

  "settings.displayName":
    "Anzeigename",

  "settings.displayNamePlaceholder":
    "Optional",

  "settings.language":
    "Sprache",

  "settings.languageAuto":
    "Automatisch",

  "settings.languageGerman":
    "Deutsch",

  "settings.languageEnglish":
    "Englisch",

  "settings.showGreeting":
    "Persönliche Begrüßung anzeigen",

  // ---------------------------------------------------------------------------
  // Modulverwaltung.
  // ---------------------------------------------------------------------------
  "modules.heading":
    "Module",

  "modules.description":
    "Funktionen aktivieren, umbenennen und sortieren.",

  "modules.customApp":
    "Workspace-Module",

  "modules.extension":
    "Spotify-Erweiterungen",

  "modules.enabled":
    "Aktiviert",

  "modules.displayTitle":
    "Anzeigename",

  "modules.order":
    "Reihenfolge",

  "modules.required":
    "Pflichtmodul",

  "modules.defaultTitlePlaceholder":
    "Standard: {title}",

  // ---------------------------------------------------------------------------
  // Workspace-Module.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Neue Workspace-Module und deren sichtbare Bedienoberfläche.
  // ---------------------------------------------------------------------------
  'common.remove': 'Entfernen',
  'common.save': 'Speichern',
  'common.play': 'Abspielen',
  'common.emptyTrack': 'Kein Titel',
  'history.intro': 'Die letzten Titelwechsel, die diese Extension auf diesem Gerät aufgezeichnet hat.',
  'history.count': '{count} Einträge (maximal 500 gespeichert)',
  'history.clear': 'Verlauf löschen',
  'history.confirm': 'Lokalen Hörverlauf wirklich löschen?',
  'history.empty': 'Noch keine Titel aufgezeichnet. Aktiviere die Erweiterung Player-Statistiken.',
  'history.remember': '☆ Merken',
  'library.actionFailed': 'Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.',
  'stats.intro': 'Statistik über lokal aufgezeichnete Titelwechsel, nicht über den vollständigen Spotify-Verlauf.',
  'stats.changes': 'Titelwechsel',
  'stats.unique': 'Verschiedene Titel',
  'stats.favorites': 'Favoriten',
  'stats.notes': 'Notizen',
  'stats.artists': 'Häufigste Künstler',
  'stats.tracks': 'Häufigste Titel',
  'stats.empty': 'Noch keine Daten. Die Extension zeichnet ab ihrer Aktivierung neue Titelwechsel auf.',
  // v1.70: Ehrliche lokale Aktivitätstrends; Zeitraumfilter für Songwechsel.
  'stats.period': 'Zeitraum auswählen',
  'stats.period.7d': '7 Tage',
  'stats.period.30d': '30 Tage',
  'stats.period.all': 'Gesamter Verlauf',
  'stats.today': 'Heute',
  'stats.activeDays': 'Aktive Tage',
  'stats.activity7': 'Songwechsel der letzten 7 Tage',
  'stats.activityHint': 'Nur auf diesem Gerät gespeicherte Songwechsel. Keine Hörzeit oder vollständige Spotify-Statistik.',
  'stats.emptyPeriod': 'In diesem Zeitraum keine Songwechsel erfasst.',
  'stats.dateLocale': 'de-DE',
  // v1.73: Intelligente Bibliothekswerkzeuge aus lokalem Verlauf.
  'discovery.heading': 'Musik wiederentdecken',
  'discovery.open': 'Musik wiederentdecken',
  'discovery.intro': 'Häufig gespielte oder länger nicht gehörte Songs aus deinem lokalen Verlauf finden und gesammelt bearbeiten.',
  'discovery.count': '{count} passende Titel',
  'discovery.order': 'Sortierung',
  'discovery.frequent': 'Am häufigsten gehört',
  'discovery.missed': 'Am längsten nicht gehört',
  'discovery.minimum': 'Mindestens so viele Songwechsel',
  'discovery.search': 'Titel suchen',
  'discovery.searchPlaceholder': 'Song oder Künstler',
  'discovery.onlyMissing': 'Nur noch nicht gespeicherte Favoriten',
  'discovery.hint': 'Grundlage sind maximal 500 lokal erfasste Songwechsel, nicht deine vollständige Spotify-Historie. Markieren verändert noch nichts.',
  'discovery.details': '{count} Songwechsel · zuletzt {date}',
  'discovery.empty': 'Keine passenden Titel. Passe die Filter an oder höre weitere Songs.',

  // v1.71: Persönliches Dashboard, Schnellzugriffe und einblendbare Bereiche.
  'dashboard.customize': 'Anpassen',
  'dashboard.done': 'Fertig',
  'dashboard.editShortcuts': 'Anordnung deiner Schnellzugriffe',
  'dashboard.addShortcut': 'Modul hinzufügen',
  'dashboard.allShortcutsAdded': 'Alle verfügbaren Module sind bereits hinzugefügt.',
  'dashboard.noShortcuts': 'Noch keine aktiven Schnellzugriffe. Über „Anpassen“ kannst du welche hinzufügen.',
  'dashboard.moveUp': '{title} nach oben',
  'dashboard.moveDown': '{title} nach unten',
  'dashboard.removeShortcut': '{title} entfernen',
  'dashboard.sections': 'Dashboard-Bereiche anzeigen',
  'dashboard.section.stats': 'Lokale Kennzahlen',
  'dashboard.section.activity': '7-Tage-Aktivität',
  'dashboard.section.recent': 'Zuletzt gehört',
  'dashboard.section.favorites': 'Meine Favoriten',
  'dashboard.section.notes': 'Letzte Song-Notizen',
  'dashboard.cardOrder': 'Informationskarten anordnen',
  'dashboard.cardFavoritesEmpty': 'Noch keine Favoriten gespeichert.',
  'dashboard.cardNotesEmpty': 'Noch keine Song-Notizen gespeichert.',
  'dashboard.openFavorites': 'Favoriten öffnen →',
  'dashboard.openNotes': 'Notizen öffnen →',
  'dashboard.section.overview': 'Workspace-Überblick',
  'dashboard.reset': 'Dashboard zurücksetzen',
  'dashboard.actionStatistics': 'Lokale Hörstatistik',
  'dashboard.actionHistory': 'Gespielte Songs anzeigen',
  'dashboard.actionNotes': 'Song-Notizen bearbeiten',
  'dashboard.actionSettings': 'Workspace konfigurieren',
  'dashboard.activitySummary': '{count} Songwechsel in den letzten 7 Tagen',
  'dashboard.openStatistics': 'Statistik öffnen →',

  'favorites.intro': 'Eigene Lesezeichen in ZuKaTo. Sie ändern nicht die Spotify-Bibliothek.',
  'favorites.count': '{count} gespeicherte Favoriten',
  'favorites.toggle': 'Aktuellen Titel merken / entfernen',
  'favorites.empty': 'Noch keine Favoriten gespeichert.',

  // Lokale Suche und barrierefreie Seitenbedienung großer Sammlungen.
  // Mehrfachbearbeitung über Suchergebnisse und Seiten hinweg.
  // Spotify-Playlist-Export: ausdrücklich bestätigt, keine stillen Mutationen.
  // v1.61: Sammelimport und zuletzt verwendete Playlists.
  // v1.67: Klare, tastaturbedienbare Playlist-Arbeitsbereiche.
  'playlistWorkspace.navigation': 'Playlist-Werkzeuge',
  'playlistWorkspace.queue': 'Schnell einreihen',
  'playlistWorkspace.import': 'Links importieren',
  'playlistWorkspace.manage': 'Playlists verwalten',
  'playlistWorkspace.transfer': 'Favoriten übertragen',
  'playlistWorkspace.collections': 'Sammlung zusammenstellen',
  'playlistWorkspace.favoritesCount': '{count} gespeicherte Favoriten',
  'playlistPaste.heading': 'Mehrere Spotify-Links einfügen',
  'playlistPaste.description': 'Bis zu {count} Titel oder Episoden als Links oder URIs einfügen. Zeilen, Kommas und Leerzeichen trennen Einträge.',
  'playlistPaste.label': 'Spotify-Links / URIs (Mehrfachimport)',
  'playlistPaste.summary': '{count} gültige Titel · {invalid} ungültig · {duplicates} doppelt',
  'playlistPaste.characters': 'Die Eingabe ist zu lang (höchstens 60.000 Zeichen). Nichts wird gesendet.',
  'playlistPaste.tokens': 'Zu viele Einträge (höchstens 2.000 prüfen). Nichts wird gesendet.',
  'playlistPaste.items': 'Mehr als 500 verschiedene gültige Titel. Bitte die Liste aufteilen; nichts wird gekürzt oder gesendet.',
  'playlistPaste.more': '… und {count} weitere Einträge',
  'playlistPaste.queue': '{count} Titel einreihen',
  'playlistPaste.queueConfirm': '{count} Titel zur Warteschlange hinzufügen?',
  'playlistPaste.clear': 'Eingabe leeren',
  'playlistPaste.workbench': 'Importliste bearbeiten',
  'playlistPaste.selected': '{count} von {total} Titeln ausgewählt',
  'playlistPaste.selectAll': 'Alle auswählen',
  'playlistPaste.selectNone': 'Auswahl aufheben',
  'playlistPaste.keepOnly': 'Nur Auswahl in Eingabe behalten',
  'playlistPaste.keepConfirm': 'Nur die {count} ausgewählten Titel in die Eingabe übernehmen? Ungültige und abgewählte Einträge werden entfernt.',
  'playlistPaste.filter': 'Importliste durchsuchen',
  'playlistPaste.filterHint': 'Spotify-ID, Track oder Episode filtern …',
  'playlistPaste.filtered': '{count} Treffer in der Importliste',
  'playlistPaste.selectItem': 'Titel auswählen: {item}',
  'playlistPaste.moveUp': 'Nach oben',
  'playlistPaste.moveDown': 'Nach unten',
  'playlistPaste.moveItemUp': 'Titel nach oben: {item}',
  'playlistPaste.moveItemDown': 'Titel nach unten: {item}',
  'playlistPaste.previous': 'Zurück',
  'playlistPaste.next': 'Weiter',
  'playlistPaste.page': 'Seite {page} von {total}',
  // v1.64: Playlist-Inhalte nur auf Klick laden; Löschungen ausdrücklich bestätigen.
  'playlistManager.remotePage': 'Spotify-Seite direkt laden (1–{total}, 50 Titel pro Seite)',
  'playlistManager.jump': 'Seite laden',
  'playlistManager.jumpHint': 'Nur diese Seite wird nachgeladen. Die Suche und Auswahl gelten für bereits geladene Titel, nicht die gesamte Playlist.',
  'playlistManager.maxPages': 'Aus Sicherheitsgründen sind höchstens {limit} Positionen erreichbar.',
  'playlistManager.invalidRemotePage': 'Ungültige Spotify-Seitennummer.',
  'playlistManager.detailsLoad': 'Eigene Playlist: Name und Beschreibung bearbeiten',
  'playlistManager.detailsName': 'Playlist-Name',
  'playlistManager.detailsDescription': 'Playlist-Beschreibung',
  'playlistManager.detailsHint': 'Nur für eigene Playlists. Sichtbarkeit und Songs bleiben unverändert.',
  'playlistManager.detailsSave': 'Änderungen in Spotify speichern',
  'playlistManager.detailsConfirm': 'Playlist-Name/Beschreibung in Spotify als „{name}“ speichern?',
  'playlistManager.detailsSaved': 'Änderungen an Spotify gesendet. Zum Prüfen Metadaten neu laden.',
  'playlistManager.detailsError': 'Metadaten nicht verfügbar oder Playlist gehört nicht deinem Konto.',
  'playlistManager.detailsInvalid': 'Name oder Beschreibung ungültig.',
  'playlistManager.detailsSaveError': 'Änderung nicht sicher bestätigt. In Spotify prüfen und erst danach erneut versuchen.',
  'playlistManager.heading': 'Playlist-Inhalte verwalten',
  'playlistManager.description': 'Bestehende Playlist laden, Songs auswählen, einreihen, kopieren oder nach Bestätigung aus Spotify entfernen.',
  'playlistManager.myPlaylists': 'Meine Playlists als Quelle laden',
  'playlistManager.loading': 'Lädt …',
  'playlistManager.choices': '{count} Playlists geladen',
  'playlistManager.findPlaylist': 'Playlist nach Name oder Besitzer suchen',
  'playlistManager.chooseSource': 'Playlist als Quelle wählen …',
  'playlistManager.source': 'Quell-Playlist (Spotify-Link oder URI)',
  'playlistManager.load': 'Inhalte laden / neu laden',
  'playlistManager.sourceError': 'Quell-Playlists konnten nicht geladen werden.',
  'playlistManager.loadError': 'Playlist-Inhalte nicht verfügbar. Spotify erlaubt den Abruf möglicherweise nur für eigene oder gemeinsam bearbeitete Playlists.',
  'playlistManager.count': '{count} von {total} Einträgen geladen (bis zu 10.000 Positionen).',
  'playlistManager.filter': 'Geladene Songs durchsuchen',
  'playlistManager.selectResults': 'Alle Treffer auswählen',
  'playlistManager.clear': 'Auswahl aufheben',
  'playlistManager.selected': '{count} verschiedene Titel ausgewählt',
  'playlistManager.selectTrack': 'Titel auswählen: {title}',
  'playlistManager.more': 'Weitere Songs laden',
  'playlistManager.queue': '{count} Titel einreihen',
  'playlistManager.remove': '{count} Titel aus Spotify entfernen',
  'playlistManager.deleting': 'Entfernt …',
  'playlistManager.duplicates': 'Achtung: Spotify entfernt beim Löschen nach URI alle Vorkommen eines gewählten Songs, auch noch nicht angezeigte Duplikate. Nur mit Schreibrechten möglich.',
  'playlistManager.copy': 'Ausgewählte Songs in eine andere Playlist kopieren',
  'playlistManager.deleteConfirm': '{count} verschiedene Songs endgültig aus der Spotify-Playlist entfernen? Spotify kann ALLE Vorkommen dieser Songs löschen, auch auf nicht geladenen Seiten!',
  'playlistManager.deleted': '{count} verschiedene Songs wurden bestätigt entfernt. Zum Prüfen die Playlist neu laden.',
  'playlistManager.partial': '{count} von {total} Löschvorgängen bestätigt. Bitte Playlist neu laden; nicht blind wiederholen.',
  'playlistManager.deleteError': 'Entfernen nicht bestätigt. Bitte Playlist neu laden und Berechtigungen prüfen; ein Request kann trotzdem angekommen sein.',
  'playlistManager.moveChoose': 'Position ändern',
  'playlistManager.chooseMove': 'Position von {title} (Platz {position}) ändern',
  'playlistManager.moveSelected': 'Verschieben: {title} (aktuell Platz {position})',
  'playlistManager.moveTarget': 'Neuer Platz in der Spotify-Playlist (1–{total})',
  'playlistManager.moveApply': 'An Position verschieben',
  'playlistManager.moveCancel': 'Abbrechen',
  'playlistManager.moveHint': 'Nur dieses eine Vorkommen wird verschoben, auch bei doppelten Songs. Die Playlist danach neu laden.',
  'playlistManager.moveConfirm': '„{title}“ von Platz {from} auf Platz {to} in Spotify verschieben?',
  'playlistManager.moved': 'Verschiebung von Platz {from} auf {to} bestätigt. Playlist für den aktuellen Stand neu laden.',
  'playlistManager.moveError': 'Verschiebung nicht bestätigt. Bitte die Playlist neu laden; der Server kann den Auftrag trotzdem ausgeführt haben.',
  'playlistCreate.toggle': 'Neue Spotify-Playlist erstellen',
  'playlistCreate.name': 'Name der neuen Playlist',
  'playlistCreate.description': 'Beschreibung (optional)',
  'playlistCreate.visibility': 'Sichtbarkeit',
  'playlistCreate.private': 'Privat (Standard)',
  'playlistCreate.public': 'Öffentlich',
  'playlistCreate.submit': 'Leere Playlist erstellen',
  'playlistCreate.creating': 'Erstellt …',
  'playlistCreate.hint': 'Die Playlist wird erst angelegt und als Ziel gewählt. Songs werden nur nach einem weiteren Klick und Bestätigung hinzugefügt. Spotify-Schreibrechte erforderlich.',
  'playlistCreate.confirm': 'Leere Spotify-Playlist „{name}“ erstellen? Es werden noch keine Songs hinzugefügt.',
  'playlistCreate.success': 'Neue Playlist erstellt und als Ziel ausgewählt. Um Songs hinzuzufügen, bitte die Übertragung separat bestätigen.',
  'playlistCreate.failed': 'Playlist-Erstellung nicht bestätigt. Prüfe deine Spotify-Playlists, bevor du erneut klickst – der Auftrag könnte trotzdem angekommen sein.',
  'playlistBrowser.load': 'Meine Spotify-Playlists laden / aktualisieren',
  'playlistBrowser.loading': 'Lade Playlists …',
  'playlistBrowser.count': '{count} Playlists geladen',
  'playlistBrowser.error': 'Playlists konnten nicht geladen werden. Spotify-Verbindung und Leseberechtigung prüfen.',
  'playlistBrowser.search': 'Playlists durchsuchen',
  'playlistBrowser.searchHint': 'Playlistname oder Besitzer …',
  'playlistBrowser.choose': 'Gefundene Spotify-Playlist als Ziel wählen',
  'playlistBrowser.placeholder': 'Playlist auswählen …',
  'playlistBrowser.more': 'Weitere Playlists laden',
  'playlistBrowser.empty': 'Keine passenden Playlists gefunden.',
  'playlistBrowser.hint': 'Auch abonnierte Playlists können erscheinen. Hinzufügen funktioniert nur mit Schreibrechten; die Auswahl speichert noch nichts.',
  'playlistTransfer.recent': 'Zuletzt verwendete Playlists',
  'playlistTransfer.chooseRecent': 'Ziel-Playlist wählen …',
  'playlistTransfer.clearRecent': 'Liste löschen',
  'playlistTransfer.heading': "In Spotify-Playlist übertragen",
  'playlistTransfer.description': "Alle lokalen Favoriten in eine bestehende Spotify-Playlist übernehmen.",
  'playlistTransfer.destination': "Spotify-Playlist-Link oder URI",
  'playlistTransfer.hint': "Nur Playlists, die du bearbeiten darfst. Keine automatische Änderung ohne Bestätigung.",
  'playlistTransfer.add': "{count} ausgewählte Titel hinzufügen",
  'playlistTransfer.confirm': "{count} Titel wirklich zur Spotify-Playlist hinzufügen?",
  'playlistTransfer.invalid': "Bitte einen gültigen Spotify-Playlist-Link eingeben.",
  'playlistTransfer.working': "Übertrage …",
  'playlistTransfer.success': "{count} Titel zur Playlist hinzugefügt.",
  'playlistTransfer.skipped': "{count} ungültige oder doppelte Titel übersprungen.",
  'playlistTransfer.partial': "{count} von {total} Titeln bestätigt. Übertragung gestoppt; nicht blind erneut senden.",
  'playlistTransfer.failed': "Übertragung fehlgeschlagen. Playlist-Berechtigung und Spotify-Verbindung prüfen; ein unbestätigter Request kann angekommen sein.",
  'bulk.selectPage': 'Seite auswählen',
  'bulk.selectResults': 'Alle Treffer auswählen',
  'bulk.clearSelection': 'Auswahl aufheben',
  'bulk.selectTrack': 'Titel auswählen',
  'bulk.selected': '{count} Titel ausgewählt',
  'bulk.queue': 'Auswahl einreihen',
  'bulk.save': 'Als Favoriten merken',
  'bulk.remove': 'Auswahl entfernen',
  'bulk.confirmRemove': '{count} ausgewählte Favoriten wirklich entfernen?',
  'bulk.removed': '{count} Favoriten entfernt.',
  'bulk.saved': '{count} Favoriten hinzugefügt, {skipped} übersprungen.',
  'bulk.queued': '{count} Titel eingereiht.',
  'bulk.skipped': '{count} ungültige Titel übersprungen.',
  'bulk.failed': 'Sammelaktion fehlgeschlagen. Daten wurden nicht als Erfolg gemeldet.',
  'bulk.partial': '{count} von {total} Titeln eingereiht. Weitere Titel wurden nach einem API-Fehler nicht gesendet.',
  'collection.clearSearch': 'Suche leeren',
  'collection.sortLabel': 'Sortieren nach',
  'collection.sortOriginal': 'Bisherige Reihenfolge',
  'collection.sortTitle': 'Titel A–Z',
  'collection.sortArtist': 'Künstler A–Z',
  'collection.sortRecent': 'Neueste zuerst',
  'collection.sortOldest': 'Älteste zuerst',
  'collection.compact': 'Kompakte Liste',
  'collection.comfortable': 'Große Liste',
  'collection.filter': 'Liste durchsuchen',
  'collection.placeholder': 'Titel, Künstler oder Album',
  'collection.results': '{count} Treffer',
  'collection.noResults': 'Keine passenden Titel gefunden.',
  'collection.pagesLabel': 'Seitennavigation der Titelliste',
  'collection.previous': 'Zurück',
  'collection.next': 'Weiter',
  'collection.page': 'Seite {page} von {pages}',

  'notes.intro': 'Eine Notiz pro Titel. Nur auf diesem Gerät in ZuKaTo gespeichert.',
  'notes.choose': 'Aktuellen Titel wählen',
  'notes.label': 'Deine Notiz',
  'notes.count': '{count}/4000 Zeichen',
  'notes.saved': 'Notiz gespeichert.',
  'notes.discard': 'Entwurf verwerfen',
  'notes.draftHint': 'Ungespeicherter Entwurf – nur für diese Sitzung gesichert.',
  'notes.saveFailed': 'Notiz konnte nicht gespeichert werden. Der Entwurf bleibt erhalten.',
  'notes.empty': 'Spiele zuerst einen Titel ab.',
  'notes.savedCount': 'Gespeicherte Notizen ({count})',
  'notes.edit': 'Bearbeiten',
  'notes.searchPlaceholder': 'Titel, Künstler, Album oder Notiztext',
  'playlist.intro': 'Warteschlange und Übertragung in bestehende Spotify-Playlists. Änderungen an Playlists nur nach deiner Bestätigung.',
  'playlist.current': 'Aktuellen Titel einreihen',
  'playlist.allFavorites': 'Alle {count} Favoriten einreihen',
  'playlist.label': 'Spotify-URI eines Titels / einer Episode',
  'playlist.queue': 'Einreihen',
  'playlist.noValid': 'Keine gültigen Spotify-Titel.',
  'playlist.done': '{count} Titel zur Warteschlange hinzugefügt.',
  'playlist.failed': 'Warteschlange konnte nicht bearbeitet werden.',
  'playlist.partial': '{count} von {total} Titeln erfolgreich eingereiht. Der Rest wurde nach einem Spotify-Fehler nicht gesendet.',
  'playlist.skipped': '{count} ungültige Spotify-Einträge wurden übersprungen.',
  'playlist.noCurrent': 'Kein Titel ausgewählt.',
  'visualizer.intro': 'Live-Monitor der Spotify-Wiedergabe. Keine Spektralanalyse ohne Audiodaten-Zugriff.',
  'visualizer.playing': '▶ Wiedergabe',
  'visualizer.paused': '⏸ Pausiert',
  'visualizer.pause': 'Pause',
  'visualizer.play': 'Play',
  'visualizer.noTrack': 'Kein Titel',

  // Immersiver Video-Visualizer: Audio/Lyrics werden nur nach Nutzerinteraktion geladen.
  'viz.sceneHeading': 'HTML-Wallpaper-Ordner & Originalvideos',
  'viz.sceneHelp': 'Wähle deinen Hauptordner mit HTML-Wallpaper-Projekten (je Unterordner eine index.html). Pro neuem Spotify-Titel wird genau das nächste Wallpaper abgespielt. Nach dem letzten beginnt die Liste beim nächsten Song wieder von vorn. Du kannst für bestimmte Songs feste eigene Einträge wählen.',
  'viz.sceneMode': 'Hintergrundquelle',
  'viz.wallpapersEnabled': 'Eigene HTML-Wallpapers AN (AUS = Originalvideo-Ausschnitte)',
  'viz.originalMissing': 'Spotify Canvas wird im bereits geöffneten Now-Playing-Bereich gesucht. Falls die Quelle nicht zugänglich ist, wird das Cover gezeigt.',
  'viz.sceneImported': '{count} Wallpaper(s) importiert und zur Liste hinzugefügt.',
  'viz.manifestUpload': 'Originalvideo-Liste (.json) mit Song-URLs importieren',
  'viz.manifestTooLarge': 'JSON-Liste ist zu groß (max. 100 kB).',
  'viz.manifestImported': '{count} Originalvideo-Zuordnungen importiert.',
  'viz.modeOwnFirst': 'Eigene Wallpapers → danach Originalclip',
  'viz.modeOriginalFirst': 'Originalclip zuerst (sonst Wallpapers)',
  'viz.sceneLength': 'Sekunden pro Wallpaper',
  'viz.sceneScope': 'Zuordnung bearbeiten',
  'viz.sceneImportFolder': 'Vollständigen Wallpaper-Ordner auswählen',
  'viz.sceneFolderOnlyHelp': 'Nur vollständige Ordner: HTML, CSS, JavaScript, Bilder, Fonts und alle Unterordner werden gemeinsam gespeichert. Ein Sammelordner kann mehrere Projekte enthalten.',
  'viz.sceneImportPreparing': '{count} Projekte mit insgesamt {files} Dateien werden geprüft und importiert …',
  'viz.sceneSandboxHelp': 'Jeder Unterordner mit index.html wird ein eigenes Wallpaper (01, 02, 03 ...). Deine lokalen Dateien werden kopiert, nicht verändert. Die Animation läuft während des ganzen Songs; CSS/JS/Bilder funktionieren in einer sicheren Sandbox, nicht alle speziellen Wallpaper-Engine-APIs.',
  'viz.sceneLibrary': 'Eigene Szenenbibliothek',
  'viz.scenePrefsStatus': 'Gespeicherte Wallpaper-Einstellungen: {local} lokal, {session} Sitzung.',
  'viz.scenePrefsEmptyHelp': 'Wenn sich Regler zurücksetzen, bitte die Speicherlogik im Original-Wallpaper prüfen.',
  'viz.sceneDeleteConfirm': 'Diese importierte Szene endgültig aus der ZuKaTo-Bibliothek löschen? (Die Originaldatei bleibt erhalten.)',
  'viz.previewOpen': 'Vorschau öffnen',
  'viz.previewClose': 'Vorschau schließen',
  'viz.sceneUsage': '{count} gespeicherte Szenen · {size} MiB',
  'viz.libraryMissing': '{count} zugeordnete Wallpaper fehlen lokal – Hauptordner bitte erneut importieren.',
  'viz.sceneSelect': 'Szene auswählen',
  'viz.sceneAdd': 'Zur Song-Diashow hinzufügen',
  'viz.sceneExport': 'Szene exportieren',
  'viz.sceneDelete': 'Datei aus Bibliothek löschen',
  'viz.scenePlaylist': 'Wallpaper-Reihenfolge (ein Eintrag pro Song)',
  'viz.sceneMissing': 'Fehlende Datei',
  'viz.sceneUp': 'Nach oben',
  'viz.sceneDown': 'Nach unten',
  'viz.sceneRemove': 'Nur Zuordnung entfernen',
  'viz.sceneEmpty': 'Noch kein Hauptordner importiert – deine bisherigen Einzelvideos bleiben verfügbar.',
  'viz.sceneClipStart': 'Originalclip ab Sekunde',
  'viz.sceneClipEnd': 'Originalclip bis Sekunde (optional)',
  'viz.sceneClipFull': 'Bis zum Ende',
  'viz.sceneOriginalUrl': 'Direkte Originalvideo-URL (HTTPS)',
  'viz.sceneSaveUrl': 'Originalclip speichern / leer zum Löschen',
  'viz.sceneOnlineHelp': 'Bei deaktivierten Wallpapers werden Originalclips von deinen hinterlegten HTTPS-MP4/WebM/OGV-Links gezeigt. Noch kein automatischer Abruf von Spotify Canvas oder anderen geschützten Musikvideos. Die Wiedergabe hängt von Nutzungsrechten und Browser-Codec/CORS ab.',
  'viz.sceneListFull': 'Maximal 128 Wallpapers in einer Reihenfolge.',
  'viz.sceneScopesFull': 'Maximal 100 individuelle Song-Zuordnungen.',
  'viz.sceneCurrent': 'Diashow-Szene',
  'viz.sceneOriginalActive': 'Originalvideo-Ausschnitt (Onlinequelle)',
  // ---------------------------------------------------------------------------
  // Visualizer v1.12: schlanke Steuerelemente und fokussierter Kinomodus.
  // Die Medien-Bühne und bereits geöffnete Vorschauen bleiben beim Reiterwechsel intakt.
  // ---------------------------------------------------------------------------
  'viz.panelsLabel': 'Visualizer-Einstellungen',
  'viz.optionsOpen': 'Anpassen',
  'viz.optionsClose': 'Einstellungen schließen',
  'viz.miniWindow': 'Desktop-Player',
  'viz.miniWindowHint': 'Wallpaper mit Player-Tasten vor dem Minimieren als Desktop-Fenster öffnen',
  'viz.miniUnsupported': 'Diese Spotify-Webview unterstützt kein separates Mini-Fenster',
  'viz.miniWindowFailed': 'Mini-Fenster konnte in diesem Spotify-Client nicht geöffnet werden.',
  'viz.miniExpand': 'Groß',
  'viz.miniExpandHint': 'Visualizer groß öffnen',
  'viz.miniPopup': 'Desktop',
  'viz.panel.wallpapers': 'Wallpapers',
  'viz.panel.lyrics': 'Songtexte',
  'viz.panel.audio': 'Audioeffekte',
  'viz.panel.advanced': 'Presets & Extras',
  'viz.switchToOriginals': 'Originalclips einschalten',
  'viz.switchToWallpapers': 'Wallpapers einschalten',
  'viz.originalModeInfo': 'Quellen wechseln, ohne importierte Dateien zu löschen.',
  'viz.canvasRetry': 'Canvas erneut prüfen',
  'viz.cinemaEnter': 'Kinomodus',
  'viz.cinemaExit': 'Bearbeiten',
  'viz.status.wallpaper': 'HTML-/Video-Wallpaper aktiv',
  'viz.status.video': 'Video aktiv',
  'viz.status.missing': 'Spotify Canvas wird gesucht',
  'viz.status.empty': 'Noch kein Wallpaper hinterlegt',
  'viz.manageSceneList': 'HTML-Wallpaper-Ordner und Reihenfolge verwalten',
  'viz.manageLegacyLibrary': 'Einzelvideos und ältere Bibliothek verwalten',
  'viz.moreVideoOptions': 'Video-Feineinstellungen',
  'viz.moreAudioOptions': 'Audioeffekte anpassen',
  'viz.moreLyricsOptions': 'Weitere Textoptionen',
  'viz.intro': 'Deine animierten Wallpapers, Audioeffekte und automatisch gesuchte Songtexte – direkt übereinander auf einer Bühne.',
  'viz.wallpaperHeading': 'Animierter Hintergrund',
  'viz.wallpaperHelp': 'MP4/WebM/OGV bis 80 MiB, auf diesem Gerät gespeichert. Stumm, Endlosschleife, pausiert mit Spotify. Ein Titelvideo überschreibt den Standard.',
  'viz.assignment': 'Wallpaper zuordnen',
  'viz.default': 'Standard für alle Titel',
  'viz.forTrack': 'Nur aktueller Titel',
  'viz.pickVideo': 'Video auswählen',
  'viz.deleteVideo': 'Video-Zuordnung löschen',
  'viz.fit': 'Bildfüllung',
  'viz.cover': 'Füllen (zuschneiden)',
  'viz.contain': 'Ganzes Video anzeigen',
  'viz.preserveAppearance': 'HTML-Wallpapers unverändert anzeigen',
  'viz.preserveAppearanceHelp': 'Standard: keine zusätzliche Abdunklung, Unschärfe oder Farbfilter durch ZuKaTo. Deine eigenen Wetter- und Lichtanimationen bleiben sichtbar.',
  'viz.dim': 'Abdunkeln',
  'viz.blur': 'Weichzeichnen',
  'viz.videoSpeed': 'Videogeschwindigkeit',
  'viz.audioHeading': 'Soundvisualizer',
  'viz.audioHelp': 'Echte Frequenz-/Wellenwerte nur mit deiner ausdrücklichen Mikrofonfreigabe. Das Mikrofon hört Umgebungsgeräusche, nicht den digitalen Spotify-Stream. Ohne Freigabe bleibt das Spektrum aus.',
  'viz.spectrumMode': 'Darstellung',
  'viz.modeOff': 'Aus',
  'viz.modeBars': 'Equalizer-Balken',
  'viz.modeRing': 'Radialer Ring',
  'viz.modeWave': 'Wellenform',
  'viz.modeParticles': 'Reaktive Partikel',
  'viz.spectrumColor': 'Spektrumfarbe',
  'viz.spectrumOpacity': 'Spektrum-Deckkraft',
  'viz.spectrumGlow': 'Spektrum-Leuchteffekt',
  'viz.startMic': 'Mikrofonanalyse starten',
  'viz.stopMic': 'Mikrofon freigeben / stoppen',
  'viz.sensitivity': 'Empfindlichkeit',
  'viz.smoothing': 'Glättung',
  'viz.bars': 'Elementanzahl',
  'viz.lyricsHeading': 'Synchronisierte Songtexte',
  'viz.lyricsHelp': 'Songtexte werden automatisch zum aktuellen Titel gesucht. Farben, Größe, Position und Timing kannst du selbst gestalten.',
  'viz.showLyrics': 'Songtext im Video anzeigen',
  'viz.showTitle': 'Titel und Künstler anzeigen',
  'viz.pickLyrics': 'LRC-Datei importieren',
  'viz.deleteLyrics': 'Songtext löschen',
  'viz.lyricScale': 'Textgröße',
  'viz.lyricOffset': 'Songtext-Synchronisierung (+ = später)',
  'viz.lyricsReady': '{count} synchronisierte Zeilen geladen',
  'viz.lyricsLoading': 'Songtext wird automatisch gesucht …',
  'viz.waitingMetadata': 'Warte auf vollständige Songdaten von Spotify …',
  'viz.signalDetected': 'Audiosignal erkannt',
  'viz.signalSilent': 'Kein Audiosignal messbar – Audiofreigabe prüfen',
  'viz.signalPaused': 'Spotify pausiert',
  'viz.signalChecking': 'Prüfe Audiosignal …',
  'viz.diagnosticsOpen': 'Verbindung prüfen',
  'viz.diagnosticsClose': 'Diagnose schließen',
  'viz.diagnosticsIntro': 'Status der Quellen (keine privaten Kontodaten).',
  'viz.diagnosticsCopy': 'Diagnose kopieren',
  'viz.diagnosticsCopied': 'Diagnose in die Zwischenablage kopiert.',
  'viz.diagnosticsManual': 'Zwischenablage gesperrt – Bericht unten manuell markieren.',
  'viz.diagnosticsReport': 'Anonymer Diagnosebericht',
  'viz.lyricsOwn': 'Dein eigener Songtext hat Vorrang.',
  'viz.lyricsAutoSynced': 'Synchronisierter Songtext automatisch geladen.',
  'viz.lyricsAutoPlain': 'Songtext automatisch geladen (ohne Zeitmarken).',
  'viz.lyricsInstrumental': 'Instrumentaltitel – kein Songtext vorhanden.',
  'viz.lyricsRateLimited': 'Lyrics-Anbieter ist vorübergehend ausgelastet. Später erneut versuchen.',
  'viz.lyricsError': 'Songtext momentan nicht abrufbar (Netzwerk oder Anbieter).',
  'viz.lyricsRetry': 'Erneut suchen',
  'viz.lyricsSource': 'Quelle',
  'viz.lyricsAdvanced': 'Eigene Lyrics / LRC – zusätzliche Optionen',
  'viz.lyricsAdvancedHelp': 'Optional: Mit einer eigenen LRC-Datei kannst du automatische Treffer überschreiben oder Zeitmarken korrigieren.',
  'viz.lyricsNoSync': 'Dieser Songtext hat keine Zeitmarken und kann nicht automatisch hervorgehoben werden.',
  'viz.lyricsAutoHelp': 'Songtexte kommen, soweit verfügbar, automatisch von LRCLIB. Verfügbarkeit und Genauigkeit hängen vom Anbieter ab.',
  'viz.plainLyricsLabel': 'Songtext ohne Synchronisierung – zum Scrollen',

  'viz.noLyrics': 'Für diesen Titel wurde kein Songtext gefunden.',
  'viz.noTrack': 'Bitte zuerst einen Titel abspielen.',
  'viz.invalidLyrics': 'Die Datei muss gültige synchronisierte .lrc-Zeitmarken enthalten.',
  'viz.largeLyrics': 'Die Lyrics-Datei ist zu groß (max. 250 KiB).',
  'viz.background': 'Hintergrund',
  'viz.noWallpaper': 'Noch kein Wallpaper ausgewählt',
  'viz.fullscreen': 'Vollbild',
  'viz.saved': 'Lokal gespeichert.',
  'viz.autoplayBlocked': 'Video-Autoplay ist in diesem Spotify-Client eingeschränkt.',
  'viz.unsupportedVideo': 'Der Spotify-Client kann dieses Video bzw. den verwendeten Codec nicht abspielen.',
  'viz.spectrumLabel': 'Audiospektrum aus der optionalen Mikrofonanalyse',
  // Wallpaper-Galerie und Videoübergänge (v1.2): UI bleibt vollständig lokal.
  'viz.transition': 'Video-Übergang',
  'viz.libraryHeading': 'Meine Wallpaper-Bibliothek',
  'viz.libraryUsage': '{count}/{limit} Videos · {used} von {total} belegt',
  'viz.librarySort': 'Sortieren nach',
  'viz.sortRecent': 'Zuletzt hinzugefügt',
  'viz.sortName': 'Dateiname',
  'viz.sortSize': 'Dateigröße',
  'viz.libraryEmpty': 'Keine lokalen Videos vorhanden. Importiere zuerst ein Wallpaper.',
  'viz.libraryPreview': 'Videovorschau',
  'viz.libraryGone': 'Das Video wurde inzwischen entfernt.',
  'viz.makeDefault': 'Als Standard verwenden',
  'viz.useForTrack': 'Aktuellem Titel zuweisen',
  'viz.exportVideo': 'Video exportieren',
  'viz.confirmDelete': 'Dieses lokal gespeicherte Wallpaper endgültig löschen?',
  // Lyrics-Layout, Video-Miniaturbilder und gespeicherte Szenen (v1.3).
  'viz.lyricAlign': 'Songtext-Ausrichtung',
  'viz.alignLeft': 'Links',
  'viz.alignCenter': 'Mitte',
  'viz.alignRight': 'Rechts',
  'viz.lyricPosition': 'Songtext-Position',
  'viz.positionTop': 'Oben',
  'viz.positionMiddle': 'Mittig',
  'viz.positionBottom': 'Unten',
  'viz.lyricLines': 'Gleichzeitig sichtbare Zeilen',
  'viz.lyricColor': 'Textfarbe (umliegende Zeilen)',
  'viz.lyricHighlight': 'Hervorhebung (aktuelle Zeile)',
  'viz.lyricShadow': 'Textschatten',
  'viz.presetsHeading': 'Visualizer-Szenen und Presets',
  'viz.presetsHelp': 'Vorlagen und eigene Einstellungen für Video, Spektrum und Lyrics. Videos und Liedtexte selbst bleiben unverändert.',
  'viz.presetSelect': 'Szene auswählen',
  'viz.presetCinema': 'Kino · ruhige Videoszene',
  'viz.presetKaraoke': 'Karaoke · Songtext im Fokus',
  'viz.presetConcert': 'Konzert · Audio-Ring (Mikrofon separat einschalten)',
  'viz.presetApply': 'Szene anwenden',
  'viz.presetDelete': 'Eigenes Preset löschen',
  'viz.presetName': 'Aktuelle Einstellungen als Preset speichern',
  'viz.presetPlaceholder': 'z. B. Neon Night',
  'viz.presetSave': 'Neues Preset speichern',
  'viz.presetCount': '{count} von 8 eigenen Presets gespeichert',
  'viz.presetApplied': 'Szene angewendet.',
  'viz.generateThumbnail': 'Miniaturbild erzeugen (ältere Videos)',
  'viz.thumbnailFailed': 'Der Videocodec unterstützt keine Bildvorschau.',
  // Songbezogene Videoclips werden ohne Dateikonvertierung als Zeitbereich gespeichert.
  'viz.clipHeading': 'Video-Ausschnitt (Loop)',
  'viz.clipHelp': 'Start/Ende deines eigenen Videos in Sekunden. Der Bereich läuft wiederholt; die Originaldatei bleibt vollständig erhalten.',
  'viz.clipStart': 'Start (Sekunden)',
  'viz.clipEnd': 'Ende (Sekunden, optional)',
  'viz.clipToEnd': 'Bis Dateiende',
  'viz.clipDuration': 'Videolänge: {seconds} s',
  'viz.clipDurationUnknown': 'Videolänge nicht lesbar – bitte Codec prüfen.',
  'viz.clipPreview': 'Zum Start springen',
  'viz.clipSave': 'Ausschnitt speichern',
  'viz.clipReset': 'Ganzes Video verwenden',
  // v1.5: Eigene Videos bleiben unangetastet; Effekte + zeitliche Zuordnung.
  'viz.videoSync': 'Videosynchronisierung',
  'viz.videoSyncFree': 'Freilaufender Loop',
  'viz.videoSyncSong': 'An Songposition koppeln',
  'viz.videoSyncHelp': 'Bei Song-Sync startet der Clip passend zur Songposition. Auch beim Vor- oder Zurückspringen wird die Videoposition nachgeführt. Kein Audiozugriff erforderlich.',
  'viz.videoOffset': 'Video-Versatz (+ = früheres Videobild)',
  'viz.videoSaturation': 'Video-Sättigung',
  'viz.videoHue': 'Video-Farbton',
  'viz.vignette': 'Vignette (dunkle Ränder)',
  'viz.trackSceneHeading': 'Eigene Szene für diesen Song',
  'viz.trackSceneHelp': 'Speichere die aktuellen Visualizer-Regler nur für diesen Titel. Beim nächsten Song wird automatisch die passende Szene oder die globale Einstellung geladen. Videos und Lyrics bleiben unabhängig davon.',
  'viz.trackSceneActive': 'Aktiv: Song-spezifische Szene',
  'viz.trackSceneGlobal': 'Aktiv: globale Szene',
  'viz.trackSceneSave': 'Aktuelle Szene diesem Song zuordnen',
  'viz.trackSceneReset': 'Song-Szene entfernen / global verwenden',
  'viz.trackSceneSaved': 'Song-Szene lokal gespeichert.',
  'viz.trackSceneRemoved': 'Globale Szene wiederhergestellt.',
  'viz.editorHeading': 'Eigenen Songtext direkt bearbeiten',
  'viz.editorHelp': 'Optionale LRC-Korrekturen: Setze Zeitmarken anhand der Spotify-Wiedergabeposition. Eigene Texte werden lokal gespeichert und haben Vorrang vor der automatischen Quelle.',
  'viz.editorStats': '{count} gültige Zeilen · {bytes} Byte',
  'viz.editorTimestamp': 'Zeitmarke jetzt einfügen',
  'viz.editorSave': 'LRC für Song speichern',
  'viz.editorExport': 'LRC exportieren',

  // v1.8: Direkte Songsuche statt URI-Pflicht, erweiterte Farbpalette.
  'search.linkTrack': 'Spotify-Titel',
  'search.unknownArtist': 'Details nicht verfügbar',
  'search.heading': 'Songs suchen und hinzufügen',
  'search.help': 'Suche nach Song oder Künstler. Alternativ Spotify-Link einfügen und Suchen klicken.',
  'search.placeholder': 'Song, Künstler oder Spotify-Link',
  'search.button': 'Suchen',
  'search.loading': 'Suche läuft …',
  'search.results': 'Suchergebnisse',
  'search.empty': 'Keine passenden Titel gefunden.',
  'search.failed': 'Spotify-Suche derzeit nicht verfügbar. Prüfe deine Verbindung oder versuche einen Spotify-Link.',
  'search.actionFailed': 'Song konnte nicht übernommen werden.',
  'search.favorite': 'Merken',
  'search.queue': 'Einreihen',
  'search.notes': 'Notiz schreiben',
  'search.alreadyFavorite': 'Song bereits als Favorit gespeichert.',
  'search.saved': 'Song in ZuKaTo gespeichert.',
  'appearance.presets': '24 fertige Farben',
  'appearance.custom': 'Eigene Farbe',
  'appearance.picker': 'Farbe auswählen',
  'appearance.hex': 'HEX-Farbwert',
  'appearance.apply': 'Farbe übernehmen',
  'appearance.invalid': 'Bitte einen gültigen Farbwert wie #1ed760 eingeben.',
  'viz.sceneHeadingSimplified': 'HTML-Wallpapers und Wiedergabe',
  'viz.originalToggle': 'Originalvideo-Ausschnitte statt HTML-Wallpapers anzeigen',
  'viz.originalAutoNote': 'Ein/Aus: ZuKaTo versucht das bereits rechts in Spotify sichtbare Canvas im Visualizer anzuzeigen. Ist dessen Videoquelle nicht zugänglich, erscheint das Cover. Kein Download und keine Eingabe einer Video-URL nötig.',
  'appearance.intro': 'Ändere die Akzentfarbe nur für den ZuKaTo Workspace. Das Spotify-Theme selbst bleibt unverändert.',
  'appearance.current': 'Aktuelle Palette:',

  // Dashboard-spezifische Live-Informationen.
  // Dashboard v1.9: klare Live-Anzeige, Schnellzugriffe und ehrliche Kennzahlen.
  "dashboard.welcomeLabel": "Deine Musik. Dein Workspace.",
  "dashboard.welcome": "Willkommen bei ZuKaTo",
  "dashboard.playing": "Wiedergabe läuft",
  "dashboard.idle": "Bereit",
  "dashboard.noTrack": "Noch kein Song ausgewählt",
  "dashboard.noTrackHelp": "Spiele einen Titel in Spotify ab.",
  "dashboard.pause": "Pause",
  "dashboard.resume": "Abspielen / Fortsetzen",
  "dashboard.next": "Nächster Titel",
  "dashboard.saveFavorite": "☆ Merken",
  "dashboard.removeFavorite": "★ Gemerkt",
  "dashboard.savedFavorite": "In ZuKaTo-Favoriten gespeichert.",
  "dashboard.removedFavorite": "Aus ZuKaTo-Favoriten entfernt.",
  "dashboard.quickAccess": "Schnellzugriff",
  "dashboard.quickAccessHelp": "Deine wichtigsten Funktionen auf einen Blick.",
  "dashboard.actionFavorites": "Songs sammeln",
  "dashboard.actionQueue": "Warteschlange verwalten",
  "dashboard.actionVisualizer": "Wallpaper und Lyrics",
  "dashboard.actionTheme": "Farben anpassen",
  "dashboard.statsHeading": "Deine lokalen Zahlen",
  "dashboard.viewAll": "Alle anzeigen →",
  "dashboard.emptyHistory": "Noch kein Hörverlauf. Spiele einen Song ab, um zu starten.",
  "dashboard.yourWorkspace": "Dein Überblick",
  "dashboard.topArtist": "Meistgehörter Künstler in diesem Verlauf",
  "dashboard.notYet": "Noch keine Daten",
  "dashboard.openSettings": "Einstellungen öffnen",
  // Einstellungsstruktur v1.9: Tabs statt langer Scroll-Seite.
  "navigation.start": "Start",
  "navigation.library": "Musik & Sammlung",
  "navigation.creative": "Gestaltung",
  "navigation.system": "System",
  // v1.68: Direkte Modulsuche und dauerhaft angeheftete Navigationsziele.
  "navigation.heading": "Module & Navigation",
  "navigation.current": "Aktuell: {title}",
  "navigation.search": "Module suchen …",
  "navigation.expand": "Alle Module zeigen",
  "navigation.collapse": "Module einklappen",
  "navigation.pinned": "Schnellzugriff",
  "navigation.pin": "{title} anheften",
  "navigation.unpin": "{title} lösen",
  "navigation.pinLimit": "Maximal {count} Module anheften. Zum Wechseln zuerst einen Stern lösen.",
  "navigation.noResults": "Kein Modul gefunden. Suchbegriff ändern oder löschen.",
  "quick.open": "Song hinzufügen",
  "quick.title": "Songs finden & hinzufügen",
  "quick.help": "Titel oder Künstler suchen, Spotify-Link einfügen und direkt auswählen.",
  "quick.save": "Merken",
  "quick.queue": "Zur Warteschlange",
  "quick.current": "Aktueller Song",
  "quick.saved": "In ZuKaTo-Favoriten gespeichert.",
  "quick.alreadySaved": "Dieser Song ist bereits gemerkt.",
  "quick.queued": "Song zur Spotify-Warteschlange hinzugefügt.",
  "quick.failed": "Aktion fehlgeschlagen. Bitte Spotify-Verbindung prüfen.",
  "quick.close": "Song-Suche schließen",
  "quick.commandHint": "Musik verwalten, ohne durch Module zu wechseln",
  "dashboard.progress": "Wiedergabefortschritt",
  "dashboard.findSong": "Song suchen und hinzufügen",
  "settings.characters": "{count}/{max} Zeichen · Esc zum Verwerfen",
  "settings.tabOverview": "Übersicht",
  "settings.tabOverviewHelp": "Die wichtigsten Schalter und Bereiche auf einen Blick.",
  "settings.overviewIntro": "Hier findest du das Wesentliche. Weitere Optionen öffnest du nur bei Bedarf.",
  "settings.overviewStats": "{modules} Workspace-Module · {favorites} Favoriten · {notes} Notizen (lokal gespeichert)",
  "settings.simpleHeading": "Alles an einem Ort",
  "settings.simpleIntro": "Wähle links den Bereich. Erweiterte Optionen bleiben zugänglich, stehen aber nicht mehr im Weg.",
  "settings.tabGeneral": "Allgemein",
  "settings.tabGeneralHelp": "Name, Begrüßung und Sprache.",
  "settings.tabWallpapers": "Wallpapers",
  "settings.tabWallpapersHelp": "Videoquelle wechseln und eigene HTML-Wallpapers verwalten.",
  "settings.tabModules": "Module",
  "settings.tabModulesHelp": "Module ein- und ausschalten. Details bei Bedarf öffnen.",
  "settings.tabShortcuts": "Tastenkürzel",
  "settings.tabShortcutsHelp": "Tastenbelegungen anzeigen und ändern.",
  "settings.tabData": "Daten & Backup",
  "settings.tabDataHelp": "Deine Einstellungen und lokale Daten sichern oder wiederherstellen.",
  "settings.advancedModule": "Weitere Optionen",
  "settings.useOriginalClips": "Originalvideo-Ausschnitte anzeigen",
  "settings.useOriginalClipsHelp": "Ein Schalter: Ein = hinterlegte Originalclips, Aus = deine HTML-Wallpapers.",
  "settings.on": "Ein",
  "settings.off": "Aus",
  "settings.wallpapersActive": "Deine importierten HTML-Wallpapers werden pro neuem Song weitergeschaltet.",
  "settings.manageWallpapers": "HTML-Wallpaper-Ordner und Reihenfolge verwalten",
  "settings.manageWallpapersHelp": "Ordner importieren, Vorschau öffnen oder Wiedergabereihenfolge festlegen. Die Originaldateien werden nicht verändert.",
  "dashboard.nowPlaying": "Gerade läuft",
  "dashboard.recent": "Zuletzt gehört",
  // Laufzeitmeldungen der Spicetify-Extension.
  "runtime.sleepPaused": 'ZuKaTo Sleep-Timer: Wiedergabe pausiert.',
  "runtime.sleepStarted": 'ZuKaTo Sleep-Timer: {minutes} Minuten.',
  "runtime.sleepStopped": 'Sleep-Timer beendet.',
  "runtime.sleepRemaining": 'Noch {minutes} Minuten.',
  "runtime.sleepNone": 'Kein Sleep-Timer aktiv.',
  "runtime.copied": 'Titelinformationen kopiert.',
  "runtime.clipboardError": 'Zwischenablage nicht verfügbar.',
  "runtime.noCurrent": 'Kein Titel ausgewählt.',
  "runtime.queued": '{count} Titel zur Warteschlange hinzugefügt.',
  "runtime.queueFailed": 'Hinzufügen zur Warteschlange fehlgeschlagen.',
  "runtime.bookmarkAdded": 'ZuKaTo-Lesezeichen hinzugefügt.',
  "runtime.bookmarkRemoved": 'ZuKaTo-Lesezeichen entfernt.',

  "feature.dashboard":
    "Dashboard",

  "feature.listening-history":
    "Hörverlauf",

  "feature.statistics":
    "Statistiken",

  "feature.favorites":
    "Favoriten",

  "feature.playlist-tools":
    "Warteschlange",

  "feature.visualizer":
    "Wallpaper-Visualizer",

  "feature.song-notes":
    "Song-Notizen",

  "feature.theme-studio":
    "Theme-Studio",

  "feature.settings":
    "Einstellungen",

  // ---------------------------------------------------------------------------
  // Extension-Module.
  // ---------------------------------------------------------------------------
  "feature.keyboard-shortcuts":
    "Tastenkürzel",

  "feature.sleep-timer":
    "Sleep-Timer",

  "feature.volume-scroll":
    "Lautstärke per Mausrad",

  "feature.copy-track-info":
    "Songinformationen kopieren",

  "feature.quick-playlist":
    "Schnelle Warteschlange",

  "feature.mini-player":
    "Mini-Player",

  "feature.player-statistics":
    "Player-Statistiken",

  "feature.context-actions":
    "Kontextaktionen",
} as const;

// -----------------------------------------------------------------------------
// Alle erlaubten Translation-Keys werden aus dem deutschen Wörterbuch
// automatisch abgeleitet.
// -----------------------------------------------------------------------------
export type TranslationKey =
  keyof typeof germanTranslations;

// -----------------------------------------------------------------------------
// Jedes Übersetzungswörterbuch muss exakt dieselben Keys enthalten.
// -----------------------------------------------------------------------------
type TranslationDictionary =
  Record<
    TranslationKey,
    string
  >;

// -----------------------------------------------------------------------------
// Englisches Übersetzungswörterbuch.
//
// Durch TranslationDictionary meldet TypeScript sofort, wenn hier eine
// Übersetzung fehlt.
// -----------------------------------------------------------------------------
const englishTranslations:
  TranslationDictionary = {
  // ---------------------------------------------------------------------------
  // General app texts.
  // ---------------------------------------------------------------------------
  "app.productLabel":
    "Spotify Toolkit",

  "app.description":
    "Your personal and modular Spotify workspace.",

  "app.greeting":
    "Hello, {name}!",

  // ---------------------------------------------------------------------------
  // General module texts.
  // ---------------------------------------------------------------------------
  "module.underDevelopment":
    "This module is still under development.",

  // ---------------------------------------------------------------------------
  // Dashboard.
  // ---------------------------------------------------------------------------
  "dashboard.description":
    "Overview of your current Spotify Toolkit workspace.",

  "dashboard.workspaceModules":
    "Active workspace modules",

  "dashboard.extensionModules":
    "Active extensions",

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts.
  // ---------------------------------------------------------------------------
  "shortcuts.heading":
    "Keyboard shortcuts",

  "shortcuts.description":
    "View and edit keyboard shortcuts.",

  "shortcuts.playPause":
    "Play/Pause",

  "shortcuts.nextTrack":
    "Next track",

  "shortcuts.previousTrack":
    "Previous track",

  "shortcuts.volumeUp":
    "Volume up",

  "shortcuts.volumeDown":
    "Volume down",

  "shortcuts.toggleMute":
    "Mute/unmute",

  "shortcuts.currentBinding":
    "Current binding",

  "shortcuts.edit":
    "Edit",

  "shortcuts.clear":
    "Clear binding",

  "shortcuts.pressKeys":
    "Press the desired key combination now.",

  "shortcuts.cancel":
    "Cancel recording",

  "shortcuts.reset":
    "Reset",

  "shortcuts.open":
    "Open keyboard shortcuts",

  "shortcuts.backToSettings":
    "Back to settings",

  "shortcuts.conflictWith":
    "This key combination is already assigned to “{action}”.",

  // ---------------------------------------------------------------------------
  // Settings.
  // ---------------------------------------------------------------------------
  "settings.heading":
    "Settings",

  "settings.workspaceTitle":
    "Workspace title",

  "settings.displayName":
    "Display name",

  "settings.displayNamePlaceholder":
    "Optional",

  "settings.language":
    "Language",

  "settings.languageAuto":
    "Automatic",

  "settings.languageGerman":
    "German",

  "settings.languageEnglish":
    "English",

  "settings.showGreeting":
    "Show personal greeting",

  // ---------------------------------------------------------------------------
  // Module management.
  // ---------------------------------------------------------------------------
  "modules.heading":
    "Modules",

  "modules.description":
    "Enable, rename and reorder features.",

  "modules.customApp":
    "Workspace modules",

  "modules.extension":
    "Spotify extensions",

  "modules.enabled":
    "Enabled",

  "modules.displayTitle":
    "Display name",

  "modules.order":
    "Order",

  "modules.required":
    "Required module",

  "modules.defaultTitlePlaceholder":
    "Default: {title}",

  // ---------------------------------------------------------------------------
  // Workspace modules.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Neue Workspace-Module und deren sichtbare Bedienoberfläche.
  // ---------------------------------------------------------------------------
  'common.remove': 'Remove',
  'common.save': 'Save',
  'common.play': 'Play',
  'common.emptyTrack': 'No track',
  'history.intro': 'The most recent track changes recorded by this extension on this device.',
  'history.count': '{count} entries (up to 500 stored)',
  'history.clear': 'Clear history',
  'history.confirm': 'Permanently delete the local listening history?',
  'history.empty': 'No tracks recorded yet. Enable the Player Statistics extension.',
  'history.remember': '☆ Save',
  'library.actionFailed': 'Could not save changes. Please try again.',
  'stats.intro': 'Statistics from locally recorded track changes, not your full Spotify history.',
  'stats.changes': 'Track changes',
  'stats.unique': 'Unique tracks',
  'stats.favorites': 'Favorites',
  'stats.notes': 'Notes',
  'stats.artists': 'Top artists',
  'stats.tracks': 'Top tracks',
  'stats.empty': 'No data yet. The extension records track changes after activation.',
  // v1.70: Local activity charts based on recorded track changes only.
  'stats.period': 'Select period',
  'stats.period.7d': '7 days',
  'stats.period.30d': '30 days',
  'stats.period.all': 'All local history',
  'stats.today': 'Today',
  'stats.activeDays': 'Active days',
  'stats.activity7': 'Track changes over the last 7 days',
  'stats.activityHint': 'Only track changes recorded on this device. Not listening time or complete Spotify history.',
  'stats.emptyPeriod': 'No track changes recorded in this period.',
  'stats.dateLocale': 'en-US',
  // v1.73: Discover local history without external recommendations.
  'discovery.heading': 'Rediscover your music',
  'discovery.open': 'Rediscover music',
  'discovery.intro': 'Find frequently played or long-unheard tracks from local history and take bulk actions.',
  'discovery.count': '{count} matching tracks',
  'discovery.order': 'Sort by',
  'discovery.frequent': 'Most played',
  'discovery.missed': 'Longest since last played',
  'discovery.minimum': 'Minimum track changes',
  'discovery.search': 'Search tracks',
  'discovery.searchPlaceholder': 'Song or artist',
  'discovery.onlyMissing': 'Only tracks not already favorited',
  'discovery.hint': 'Based on up to 500 locally recorded track changes, not your full Spotify history. Selecting a track makes no changes.',
  'discovery.details': '{count} track changes · last {date}',
  'discovery.empty': 'No matching tracks. Adjust the filters or listen to more music.',

  // v1.71: Persönliches Dashboard, Schnellzugriffe und einblendbare Bereiche.
  'dashboard.customize': 'Customize',
  'dashboard.done': 'Done',
  'dashboard.editShortcuts': 'Reorder your shortcuts',
  'dashboard.addShortcut': 'Add module',
  'dashboard.allShortcutsAdded': 'All available modules are already added.',
  'dashboard.noShortcuts': 'No active shortcuts. Choose Customize to add some.',
  'dashboard.moveUp': 'Move {title} up',
  'dashboard.moveDown': 'Move {title} down',
  'dashboard.removeShortcut': 'Remove {title}',
  'dashboard.sections': 'Show dashboard sections',
  'dashboard.section.stats': 'Local statistics',
  'dashboard.section.activity': '7-day activity',
  'dashboard.section.recent': 'Recently played',
  'dashboard.section.favorites': 'My favorites',
  'dashboard.section.notes': 'Recent song notes',
  'dashboard.cardOrder': 'Arrange information cards',
  'dashboard.cardFavoritesEmpty': 'No saved favorites yet.',
  'dashboard.cardNotesEmpty': 'No song notes yet.',
  'dashboard.openFavorites': 'Open favorites →',
  'dashboard.openNotes': 'Open notes →',
  'dashboard.section.overview': 'Workspace overview',
  'dashboard.reset': 'Reset dashboard',
  'dashboard.actionStatistics': 'Local listening statistics',
  'dashboard.actionHistory': 'Browse played tracks',
  'dashboard.actionNotes': 'Edit song notes',
  'dashboard.actionSettings': 'Configure your workspace',
  'dashboard.activitySummary': '{count} track changes in the last 7 days',
  'dashboard.openStatistics': 'Open statistics →',

  'favorites.intro': 'Private ZuKaTo bookmarks. They do not modify your Spotify library.',
  'favorites.count': '{count} saved favorites',
  'favorites.toggle': 'Save / remove current track',
  'favorites.empty': 'No favorites saved yet.',

  // Local search and accessible pagination for large collections.
  // Bulk management across pages and filtered results.
  // Spotify-Playlist-Export: ausdrücklich bestätigt, keine stillen Mutationen.
  // v1.61: Multi-link import and recent destinations.
  // v1.67: Keyboard-accessible playlist workspace sections.
  'playlistWorkspace.navigation': 'Playlist tools',
  'playlistWorkspace.queue': 'Quick queue',
  'playlistWorkspace.import': 'Import links',
  'playlistWorkspace.manage': 'Manage playlists',
  'playlistWorkspace.transfer': 'Transfer favorites',
  'playlistWorkspace.collections': 'Build a collection',
  'playlistWorkspace.favoritesCount': '{count} saved favorites',
  'playlistPaste.heading': 'Paste multiple Spotify links',
  'playlistPaste.description': 'Paste up to {count} track or episode links/URIs. Separate items with newlines, commas or whitespace.',
  'playlistPaste.label': 'Spotify links / URIs (bulk import)',
  'playlistPaste.summary': '{count} valid · {invalid} invalid · {duplicates} duplicates',
  'playlistPaste.characters': 'Input too long (maximum 60,000 characters). Nothing will be sent.',
  'playlistPaste.tokens': 'Too many entries (maximum 2,000 to analyze). Nothing will be sent.',
  'playlistPaste.items': 'More than 500 distinct valid tracks. Split the list; nothing will be truncated or sent.',
  'playlistPaste.more': '… and {count} more items',
  'playlistPaste.queue': 'Queue {count} items',
  'playlistPaste.queueConfirm': 'Add {count} items to the queue?',
  'playlistPaste.clear': 'Clear input',
  'playlistPaste.workbench': 'Edit imported tracks',
  'playlistPaste.selected': '{count} of {total} tracks selected',
  'playlistPaste.selectAll': 'Select all',
  'playlistPaste.selectNone': 'Deselect all',
  'playlistPaste.keepOnly': 'Keep only selection in input',
  'playlistPaste.keepConfirm': 'Replace the input with the {count} selected tracks? Invalid and deselected entries will be removed.',
  'playlistPaste.filter': 'Search imported tracks',
  'playlistPaste.filterHint': 'Filter by Spotify ID, track or episode …',
  'playlistPaste.filtered': '{count} matching imported tracks',
  'playlistPaste.selectItem': 'Select track: {item}',
  'playlistPaste.moveUp': 'Move up',
  'playlistPaste.moveDown': 'Move down',
  'playlistPaste.moveItemUp': 'Move track up: {item}',
  'playlistPaste.moveItemDown': 'Move track down: {item}',
  'playlistPaste.previous': 'Previous',
  'playlistPaste.next': 'Next',
  'playlistPaste.page': 'Page {page} of {total}',
  // v1.64: Playlist-Inhalte nur auf Klick laden; Löschungen ausdrücklich bestätigen.
  'playlistManager.remotePage': 'Load Spotify page directly (1–{total}, 50 tracks per page)',
  'playlistManager.jump': 'Load page',
  'playlistManager.jumpHint': 'Only the requested page is loaded. Search and selection cover loaded tracks only, not the whole playlist.',
  'playlistManager.maxPages': 'For safety, at most {limit} positions can be accessed.',
  'playlistManager.invalidRemotePage': 'Invalid Spotify page number.',
  'playlistManager.detailsLoad': 'Edit owned playlist name and description',
  'playlistManager.detailsName': 'Playlist name',
  'playlistManager.detailsDescription': 'Playlist description',
  'playlistManager.detailsHint': 'Owned playlists only. Visibility and tracks are not changed.',
  'playlistManager.detailsSave': 'Save changes to Spotify',
  'playlistManager.detailsConfirm': 'Change the Spotify playlist name/description to “{name}”?',
  'playlistManager.detailsSaved': 'Changes sent to Spotify. Reload details to verify.',
  'playlistManager.detailsError': 'Playlist details unavailable or playlist not owned by your account.',
  'playlistManager.detailsInvalid': 'Invalid name or description.',
  'playlistManager.detailsSaveError': 'Update not confirmed. Check Spotify before trying again.',
  'playlistManager.heading': 'Manage playlist contents',
  'playlistManager.description': 'Load an existing playlist, select tracks, queue, copy, or remove them from Spotify after confirmation.',
  'playlistManager.myPlaylists': 'Load my playlists as sources',
  'playlistManager.loading': 'Loading …',
  'playlistManager.choices': '{count} playlists loaded',
  'playlistManager.findPlaylist': 'Find playlists by name or owner',
  'playlistManager.chooseSource': 'Choose a source playlist …',
  'playlistManager.source': 'Source playlist (Spotify link or URI)',
  'playlistManager.load': 'Load / refresh playlist items',
  'playlistManager.sourceError': 'Could not load source playlists.',
  'playlistManager.loadError': 'Playlist items unavailable. Spotify may only permit reading playlists you own or collaborate on.',
  'playlistManager.count': 'Loaded {count} of {total} items (up to 10,000 positions).',
  'playlistManager.filter': 'Search loaded tracks',
  'playlistManager.selectResults': 'Select all results',
  'playlistManager.clear': 'Clear selection',
  'playlistManager.selected': '{count} distinct tracks selected',
  'playlistManager.selectTrack': 'Select track: {title}',
  'playlistManager.more': 'Load more tracks',
  'playlistManager.queue': 'Queue {count} tracks',
  'playlistManager.remove': 'Remove {count} tracks from Spotify',
  'playlistManager.deleting': 'Removing …',
  'playlistManager.duplicates': 'Warning: Spotify removes every occurrence of a selected URI, including duplicates on pages not loaded yet. Write access required.',
  'playlistManager.copy': 'Copy selected tracks to another playlist',
  'playlistManager.deleteConfirm': 'Remove {count} distinct tracks from this Spotify playlist? Spotify may remove ALL occurrences, including on pages not loaded!',
  'playlistManager.deleted': 'Confirmed removal of {count} distinct tracks. Refresh the playlist to verify.',
  'playlistManager.partial': 'Confirmed {count} of {total} removals. Refresh playlist; do not retry blindly.',
  'playlistManager.deleteError': 'Removal not confirmed. Refresh playlist and check permissions; a request might still have succeeded.',
  'playlistManager.moveChoose': 'Change position',
  'playlistManager.chooseMove': 'Change position of {title} (item {position})',
  'playlistManager.moveSelected': 'Move: {title} (currently position {position})',
  'playlistManager.moveTarget': 'New position in Spotify playlist (1–{total})',
  'playlistManager.moveApply': 'Move to position',
  'playlistManager.moveCancel': 'Cancel',
  'playlistManager.moveHint': 'Only this occurrence is moved, even with duplicate songs. Reload the playlist afterwards.',
  'playlistManager.moveConfirm': 'Move “{title}” from position {from} to {to} on Spotify?',
  'playlistManager.moved': 'Move from position {from} to {to} confirmed. Reload playlist to see the latest state.',
  'playlistManager.moveError': 'Move not confirmed. Reload the playlist; Spotify may have applied the request despite the error.',
  'playlistCreate.toggle': 'Create a new Spotify playlist',
  'playlistCreate.name': 'New playlist name',
  'playlistCreate.description': 'Description (optional)',
  'playlistCreate.visibility': 'Visibility',
  'playlistCreate.private': 'Private (default)',
  'playlistCreate.public': 'Public',
  'playlistCreate.submit': 'Create empty playlist',
  'playlistCreate.creating': 'Creating …',
  'playlistCreate.hint': 'A new empty playlist is created and selected as destination. Tracks are added only after another click and confirmation. Spotify write access required.',
  'playlistCreate.confirm': 'Create empty Spotify playlist “{name}”? No tracks will be added yet.',
  'playlistCreate.success': 'New playlist created and selected. Please confirm a separate transfer to add tracks.',
  'playlistCreate.failed': 'Playlist creation not confirmed. Check Spotify playlists before trying again – the request might already have succeeded.',
  'playlistBrowser.load': 'Load / refresh my Spotify playlists',
  'playlistBrowser.loading': 'Loading playlists …',
  'playlistBrowser.count': '{count} playlists loaded',
  'playlistBrowser.error': 'Could not load playlists. Check Spotify connection and read permissions.',
  'playlistBrowser.search': 'Search playlists',
  'playlistBrowser.searchHint': 'Playlist name or owner …',
  'playlistBrowser.choose': 'Choose a Spotify playlist as destination',
  'playlistBrowser.placeholder': 'Select playlist …',
  'playlistBrowser.more': 'Load more playlists',
  'playlistBrowser.empty': 'No matching playlists found.',
  'playlistBrowser.hint': 'Followed playlists may appear too. Adding items requires write access; selecting one changes nothing.',
  'playlistTransfer.recent': 'Recently used playlists',
  'playlistTransfer.chooseRecent': 'Choose destination …',
  'playlistTransfer.clearRecent': 'Clear list',
  'playlistTransfer.heading': "Add to Spotify playlist",
  'playlistTransfer.description': "Transfer all local favorites to an existing Spotify playlist.",
  'playlistTransfer.destination': "Spotify playlist link or URI",
  'playlistTransfer.hint': "Only playlists you can edit. Nothing is changed without confirmation.",
  'playlistTransfer.add': "Add {count} selected tracks",
  'playlistTransfer.confirm': "Add {count} tracks to the Spotify playlist?",
  'playlistTransfer.invalid': "Enter a valid Spotify playlist link.",
  'playlistTransfer.working': "Transferring…",
  'playlistTransfer.success': "Added {count} tracks to the playlist.",
  'playlistTransfer.skipped': "Skipped {count} invalid or duplicate tracks.",
  'playlistTransfer.partial': "Confirmed {count} of {total} tracks. Transfer stopped; do not blindly retry.",
  'playlistTransfer.failed': "Transfer failed. Check playlist permissions and Spotify connection; an unconfirmed request may have succeeded.",
  'bulk.selectPage': 'Select page',
  'bulk.selectResults': 'Select all results',
  'bulk.clearSelection': 'Clear selection',
  'bulk.selectTrack': 'Select track',
  'bulk.selected': '{count} tracks selected',
  'bulk.queue': 'Queue selected',
  'bulk.save': 'Save as favorites',
  'bulk.remove': 'Remove selected',
  'bulk.confirmRemove': 'Remove {count} selected favorites?',
  'bulk.removed': '{count} favorites removed.',
  'bulk.saved': '{count} favorites added, {skipped} skipped.',
  'bulk.queued': '{count} tracks queued.',
  'bulk.skipped': '{count} invalid entries skipped.',
  'bulk.failed': 'Bulk action failed. No success was reported.',
  'bulk.partial': '{count} of {total} tracks queued. Remaining tracks were not sent after an API error.',
  'collection.clearSearch': 'Clear search',
  'collection.sortLabel': 'Sort by',
  'collection.sortOriginal': 'Saved order',
  'collection.sortTitle': 'Title A–Z',
  'collection.sortArtist': 'Artist A–Z',
  'collection.sortRecent': 'Newest first',
  'collection.sortOldest': 'Oldest first',
  'collection.compact': 'Compact list',
  'collection.comfortable': 'Comfortable list',
  'collection.filter': 'Filter tracks',
  'collection.placeholder': 'Track, artist or album',
  'collection.results': '{count} results',
  'collection.noResults': 'No matching tracks found.',
  'collection.pagesLabel': 'Track list pagination',
  'collection.previous': 'Previous',
  'collection.next': 'Next',
  'collection.page': 'Page {page} of {pages}',

  'notes.intro': 'One note per track, stored only on this device in ZuKaTo.',
  'notes.choose': 'Select current track',
  'notes.label': 'Your note',
  'notes.count': '{count}/4000 characters',
  'notes.saved': 'Note saved.',
  'notes.discard': 'Discard draft',
  'notes.draftHint': 'Unsaved draft – temporarily preserved for this session.',
  'notes.saveFailed': 'Could not save note. Your draft has been preserved.',
  'notes.empty': 'Play a track first.',
  'notes.savedCount': 'Saved notes ({count})',
  'notes.edit': 'Edit',
  'notes.searchPlaceholder': 'Track, artist, album or note text',
  'playlist.intro': 'Queue tools and transfer into existing Spotify playlists. Playlists are only changed after confirmation.',
  'playlist.current': 'Queue current track',
  'playlist.allFavorites': 'Queue all {count} favorites',
  'playlist.label': 'Spotify URI for a track / episode',
  'playlist.queue': 'Add to queue',
  'playlist.noValid': 'No valid Spotify tracks.',
  'playlist.done': 'Added {count} tracks to the queue.',
  'playlist.failed': 'Could not update the queue.',
  'playlist.partial': 'Queued {count} of {total} tracks. Remaining tracks were not sent after a Spotify error.',
  'playlist.skipped': 'Skipped {count} invalid Spotify entries.',
  'playlist.noCurrent': 'No current track.',
  'visualizer.intro': 'Live Spotify playback monitor. Spectrum analysis requires raw audio access.',
  'visualizer.playing': '▶ Playing',
  'visualizer.paused': '⏸ Paused',
  'visualizer.pause': 'Pause',
  'visualizer.play': 'Play',
  'visualizer.noTrack': 'No track',

  // Immersive video visualizer; permission-based audio input and personal LRC texts.
  'viz.sceneHeading': 'HTML wallpaper folder & original videos',
  'viz.sceneHelp': 'Select a folder containing your own HTML wallpaper projects (one index.html per subfolder). Exactly one wallpaper plays per Spotify track; the next song advances to the next wallpaper. After the last item, the next song starts at the beginning. You can also pin a specific wallpaper to individual songs.',
  'viz.sceneMode': 'Background source',
  'viz.wallpapersEnabled': 'Enable my HTML wallpapers (OFF = original video excerpts)',
  'viz.originalMissing': 'Searching for the Spotify Canvas already visible in Now Playing. Shows the cover when the source is inaccessible.',
  'viz.sceneImported': 'Imported {count} wallpaper(s) and added them to the playlist.',
  'viz.manifestUpload': 'Import original-video list (.json) with track URLs',
  'viz.manifestTooLarge': 'JSON list is too large (100 kB max).',
  'viz.manifestImported': 'Imported {count} original video assignments.',
  'viz.modeOwnFirst': 'My wallpapers → then original clip',
  'viz.modeOriginalFirst': 'Original clip first (otherwise wallpapers)',
  'viz.sceneLength': 'Seconds per wallpaper',
  'viz.sceneScope': 'Edit assignment for',
  'viz.sceneImportFolder': 'Choose complete wallpaper folder',
  'viz.sceneFolderOnlyHelp': 'Complete folders only: HTML, CSS, JavaScript, images, fonts and all subfolders stay together. A collection folder may contain multiple projects.',
  'viz.sceneImportPreparing': 'Checking and importing {count} projects with {files} files …',
  'viz.sceneSandboxHelp': 'Every subfolder with index.html becomes a separate wallpaper (01, 02, 03 ...). Your originals are copied, never changed. Each wallpaper plays for the full song. Local CSS/JS/assets work in an isolated sandbox; proprietary Wallpaper Engine APIs may not.',
  'viz.sceneLibrary': 'My scene library',
  'viz.scenePrefsStatus': 'Saved wallpaper settings: {local} local, {session} session.',
  'viz.scenePrefsEmptyHelp': 'If controls keep resetting, check how the original wallpaper stores its settings.',
  'viz.sceneDeleteConfirm': 'Permanently delete this imported scene from the ZuKaTo library? (The original file will remain unchanged.)',
  'viz.previewOpen': 'Preview scene',
  'viz.previewClose': 'Close preview',
  'viz.sceneUsage': '{count} saved scenes · {size} MiB',
  'viz.libraryMissing': '{count} assigned wallpapers are missing locally – please reimport your folder.',
  'viz.sceneSelect': 'Select a scene',
  'viz.sceneAdd': 'Add to track slideshow',
  'viz.sceneExport': 'Export scene',
  'viz.sceneDelete': 'Delete file from library',
  'viz.scenePlaylist': 'Wallpaper order (one item per track)',
  'viz.sceneMissing': 'Missing file',
  'viz.sceneUp': 'Move up',
  'viz.sceneDown': 'Move down',
  'viz.sceneRemove': 'Remove assignment only',
  'viz.sceneEmpty': 'No collection folder yet – existing individually imported videos still work.',
  'viz.sceneClipStart': 'Original clip start (seconds)',
  'viz.sceneClipEnd': 'Original clip end (optional)',
  'viz.sceneClipFull': 'Until the end',
  'viz.sceneOriginalUrl': 'Direct original video URL (HTTPS)',
  'viz.sceneSaveUrl': 'Save original clip / clear to remove',
  'viz.sceneOnlineHelp': 'When wallpapers are off, the player displays original clips from your configured direct HTTPS MP4/WebM/OGV URLs. Spotify Canvas and protected music videos are not downloaded automatically. Playback depends on usage rights and browser codecs/CORS.',
  'viz.sceneListFull': 'Up to 128 wallpapers per playlist.',
  'viz.sceneScopesFull': 'Up to 100 individual track assignments.',
  'viz.sceneCurrent': 'Slideshow scene',
  'viz.sceneOriginalActive': 'Original video excerpt (online source)',
  // ---------------------------------------------------------------------------
  // Visualizer v1.12: focused controls and a distraction-free cinema mode.
  // ---------------------------------------------------------------------------
  'viz.panelsLabel': 'Visualizer controls',
  'viz.optionsOpen': 'Customize',
  'viz.optionsClose': 'Close settings',
  'viz.miniWindow': 'Desktop player',
  'viz.miniWindowHint': 'Open the wallpaper and playback controls on the desktop before minimizing',
  'viz.miniUnsupported': 'This Spotify WebView does not support a separate mini window',
  'viz.miniWindowFailed': 'Could not open a mini window in this Spotify client.',
  'viz.miniExpand': 'Expand',
  'viz.miniExpandHint': 'Open visualizer',
  'viz.miniPopup': 'Desktop',
  'viz.panel.wallpapers': 'Wallpapers',
  'viz.panel.lyrics': 'Lyrics',
  'viz.panel.audio': 'Audio effects',
  'viz.panel.advanced': 'Presets & extras',
  'viz.switchToOriginals': 'Enable original clips',
  'viz.switchToWallpapers': 'Enable wallpapers',
  'viz.originalModeInfo': 'Switch sources without deleting imported files.',
  'viz.canvasRetry': 'Recheck Canvas',
  'viz.cinemaEnter': 'Cinema mode',
  'viz.cinemaExit': 'Edit view',
  'viz.status.wallpaper': 'HTML/video wallpaper active',
  'viz.status.video': 'Video active',
  'viz.status.missing': 'Searching for Spotify Canvas',
  'viz.status.empty': 'No wallpaper configured',
  'viz.manageSceneList': 'Manage HTML wallpaper folder and playback order',
  'viz.manageLegacyLibrary': 'Manage individual videos and legacy library',
  'viz.moreVideoOptions': 'Advanced video controls',
  'viz.moreAudioOptions': 'Adjust audio effects',
  'viz.moreLyricsOptions': 'More text options',
  'viz.intro': 'Your animated wallpapers, audio effects and automatically retrieved lyrics on one immersive stage.',
  'viz.wallpaperHeading': 'Animated wallpaper',
  'viz.wallpaperHelp': 'MP4/WebM/OGV up to 80 MiB, stored on this device. Muted, looping and paused with Spotify. Track-specific video overrides the default.',
  'viz.assignment': 'Assign wallpaper',
  'viz.default': 'Default for all tracks',
  'viz.forTrack': 'Current track only',
  'viz.pickVideo': 'Choose video',
  'viz.deleteVideo': 'Remove video assignment',
  'viz.fit': 'Video fit',
  'viz.cover': 'Fill (crop)',
  'viz.contain': 'Show whole video',
  'viz.preserveAppearance': 'Show HTML wallpapers in original colors',
  'viz.preserveAppearanceHelp': 'Default: no extra darkening, blur or color filters from ZuKaTo. Your custom lighting and weather effects remain visible.',
  'viz.dim': 'Dim',
  'viz.blur': 'Blur',
  'viz.videoSpeed': 'Video speed',
  'viz.audioHeading': 'Sound visualizer',
  'viz.audioHelp': 'Real frequency / waveform data only after explicit microphone permission. The microphone captures ambient sound, NOT Spotify’s internal digital audio. Without permission the spectrum is off.',
  'viz.spectrumMode': 'Display style',
  'viz.modeOff': 'Off',
  'viz.modeBars': 'Equalizer bars',
  'viz.modeRing': 'Radial ring',
  'viz.modeWave': 'Waveform',
  'viz.modeParticles': 'Reactive particles',
  'viz.spectrumColor': 'Spectrum color',
  'viz.spectrumOpacity': 'Spectrum opacity',
  'viz.spectrumGlow': 'Spectrum glow',
  'viz.startMic': 'Start microphone analysis',
  'viz.stopMic': 'Stop / release microphone',
  'viz.sensitivity': 'Sensitivity',
  'viz.smoothing': 'Smoothing',
  'viz.bars': 'Element count',
  'viz.lyricsHeading': 'Synchronized lyrics',
  'viz.lyricsHelp': 'Lyrics are automatically searched for the current song. Customize their colors, size, position and timing.',
  'viz.showLyrics': 'Show lyrics over video',
  'viz.showTitle': 'Show track and artist',
  'viz.pickLyrics': 'Import LRC file',
  'viz.deleteLyrics': 'Delete lyrics',
  'viz.lyricScale': 'Lyrics size',
  'viz.lyricOffset': 'Lyrics timing (+ = later)',
  'viz.lyricsReady': '{count} synchronized lines loaded',
  'viz.lyricsLoading': 'Looking up lyrics automatically …',
  'viz.waitingMetadata': 'Waiting for complete Spotify track metadata …',
  'viz.signalDetected': 'Audio signal detected',
  'viz.signalSilent': 'No measurable audio signal – check the shared source',
  'viz.signalPaused': 'Spotify is paused',
  'viz.signalChecking': 'Checking audio signal …',
  'viz.diagnosticsOpen': 'Check connections',
  'viz.diagnosticsClose': 'Close diagnostics',
  'viz.diagnosticsIntro': 'Source status (no private account data).',
  'viz.diagnosticsCopy': 'Copy diagnostics',
  'viz.diagnosticsCopied': 'Diagnostics copied to clipboard.',
  'viz.diagnosticsManual': 'Clipboard unavailable – manually select the report below.',
  'viz.diagnosticsReport': 'Anonymous diagnostic report',
  'viz.lyricsOwn': 'Your own lyrics take priority.',
  'viz.lyricsAutoSynced': 'Synchronized lyrics loaded automatically.',
  'viz.lyricsAutoPlain': 'Lyrics loaded automatically (no timestamps).',
  'viz.lyricsInstrumental': 'Instrumental track – no lyrics available.',
  'viz.lyricsRateLimited': 'Lyrics provider is temporarily busy. Please retry later.',
  'viz.lyricsError': 'Lyrics currently unavailable (network or provider).',
  'viz.lyricsRetry': 'Search again',
  'viz.lyricsSource': 'Source',
  'viz.lyricsAdvanced': 'Own lyrics / LRC – advanced options',
  'viz.lyricsAdvancedHelp': 'Optional: Override automatic lyrics or correct timing using your own LRC file.',
  'viz.lyricsNoSync': 'These lyrics have no timestamps and cannot be highlighted in sync.',
  'viz.lyricsAutoHelp': 'Lyrics are provided by LRCLIB when available. Availability and accuracy depend on the provider.',
  'viz.plainLyricsLabel': 'Unsynchronized lyrics – scroll to read',

  'viz.noLyrics': 'No lyrics found for this track.',
  'viz.noTrack': 'Play a track first.',
  'viz.invalidLyrics': 'File must contain valid timed .lrc tags.',
  'viz.largeLyrics': 'Lyrics file is too large (max 250 KiB).',
  'viz.background': 'Background',
  'viz.noWallpaper': 'No wallpaper selected yet',
  'viz.fullscreen': 'Fullscreen',
  'viz.saved': 'Saved locally.',
  'viz.autoplayBlocked': 'Video autoplay is restricted by this Spotify client.',
  'viz.unsupportedVideo': 'The Spotify client cannot play this video or its codec.',
  'viz.spectrumLabel': 'Audio spectrum from optional microphone analysis',
  // Local-only wallpaper library and crossfades (v1.2).
  'viz.transition': 'Video crossfade',
  'viz.libraryHeading': 'My wallpaper library',
  'viz.libraryUsage': '{count}/{limit} videos · {used} used of {total}',
  'viz.librarySort': 'Sort by',
  'viz.sortRecent': 'Most recent',
  'viz.sortName': 'File name',
  'viz.sortSize': 'File size',
  'viz.libraryEmpty': 'No local videos yet. Import a wallpaper first.',
  'viz.libraryPreview': 'Video preview',
  'viz.libraryGone': 'The video has already been removed.',
  'viz.makeDefault': 'Use as default',
  'viz.useForTrack': 'Assign to current track',
  'viz.exportVideo': 'Export video',
  'viz.confirmDelete': 'Permanently delete this locally stored wallpaper?',
  // Lyrics layout, video thumbnails and saved scenes (v1.3).
  'viz.lyricAlign': 'Lyrics alignment',
  'viz.alignLeft': 'Left',
  'viz.alignCenter': 'Center',
  'viz.alignRight': 'Right',
  'viz.lyricPosition': 'Lyrics position',
  'viz.positionTop': 'Top',
  'viz.positionMiddle': 'Middle',
  'viz.positionBottom': 'Bottom',
  'viz.lyricLines': 'Visible lines',
  'viz.lyricColor': 'Text color (surrounding lines)',
  'viz.lyricHighlight': 'Highlight (current line)',
  'viz.lyricShadow': 'Text shadow',
  'viz.presetsHeading': 'Visualizer scenes and presets',
  'viz.presetsHelp': 'Built-in and saved settings for video, spectrum and lyrics. Media files and song texts are not modified.',
  'viz.presetSelect': 'Choose a scene',
  'viz.presetCinema': 'Cinema · quiet video scene',
  'viz.presetKaraoke': 'Karaoke · focused lyrics',
  'viz.presetConcert': 'Concert · audio ring (enable microphone separately)',
  'viz.presetApply': 'Apply scene',
  'viz.presetDelete': 'Delete custom preset',
  'viz.presetName': 'Save current settings as a preset',
  'viz.presetPlaceholder': 'e.g. Neon Night',
  'viz.presetSave': 'Save new preset',
  'viz.presetCount': '{count} of 8 custom presets saved',
  'viz.presetApplied': 'Scene applied.',
  'viz.generateThumbnail': 'Generate thumbnail (older videos)',
  'viz.thumbnailFailed': 'This video codec cannot generate a thumbnail.',
  // Edits are metadata only: original user videos are never transcoded.
  'viz.clipHeading': 'Video segment (loop)',
  'viz.clipHelp': 'Set start/end points in seconds for your own video. Only this section loops; the original file stays intact.',
  'viz.clipStart': 'Start (seconds)',
  'viz.clipEnd': 'End (seconds, optional)',
  'viz.clipToEnd': 'To end of file',
  'viz.clipDuration': 'Video duration: {seconds} s',
  'viz.clipDurationUnknown': 'Video duration unavailable – check the codec.',
  'viz.clipPreview': 'Jump to start',
  'viz.clipSave': 'Save segment',
  'viz.clipReset': 'Use entire video',
  // v1.5: User-supplied videos and local-only styles.
  'viz.videoSync': 'Video synchronization',
  'viz.videoSyncFree': 'Free-running loop',
  'viz.videoSyncSong': 'Sync with song position',
  'viz.videoSyncHelp': 'Song sync aligns the clip with Spotify playback. Seeking backward or forward also updates the video position. No audio stream access is needed.',
  'viz.videoOffset': 'Video offset (+ = video is ahead)',
  'viz.videoSaturation': 'Video saturation',
  'viz.videoHue': 'Video hue',
  'viz.vignette': 'Vignette (dark edges)',
  'viz.trackSceneHeading': 'Individual scene for this song',
  'viz.trackSceneHelp': 'Save the current visualizer controls for this track only. The matching scene or global default is loaded automatically on track change. Video and lyrics remain independent.',
  'viz.trackSceneActive': 'Active: song-specific scene',
  'viz.trackSceneGlobal': 'Active: global scene',
  'viz.trackSceneSave': 'Use current scene for this song',
  'viz.trackSceneReset': 'Remove song scene / use global',
  'viz.trackSceneSaved': 'Song scene saved locally.',
  'viz.trackSceneRemoved': 'Restored global scene.',
  'viz.editorHeading': 'Edit your own lyrics directly',
  'viz.editorHelp': 'Optional LRC corrections: insert timestamps from Spotify playback. Your locally saved lyrics override the automatic provider.',
  'viz.editorStats': '{count} valid lines · {bytes} bytes',
  'viz.editorTimestamp': 'Insert timestamp here',
  'viz.editorSave': 'Save LRC for track',
  'viz.editorExport': 'Export LRC',

  // v1.8: Search by artist/title, expanded color studio and simple clip toggle.
  'search.linkTrack': 'Spotify track',
  'search.unknownArtist': 'Details unavailable',
  'search.heading': 'Search and add songs',
  'search.help': 'Search by song title or artist. Or paste a Spotify link and press Search.',
  'search.placeholder': 'Track, artist or Spotify link',
  'search.button': 'Search',
  'search.loading': 'Searching …',
  'search.results': 'Search results',
  'search.empty': 'No matching songs found.',
  'search.failed': 'Spotify search is unavailable. Check your connection or try a Spotify link.',
  'search.actionFailed': 'Could not add song.',
  'search.favorite': 'Save',
  'search.queue': 'Queue',
  'search.notes': 'Write note',
  'search.alreadyFavorite': 'This track is already saved.',
  'search.saved': 'Song saved in ZuKaTo.',
  'appearance.presets': '24 preset colors',
  'appearance.custom': 'Custom color',
  'appearance.picker': 'Pick color',
  'appearance.hex': 'HEX color',
  'appearance.apply': 'Apply color',
  'appearance.invalid': 'Enter a valid color such as #1ed760.',
  'viz.sceneHeadingSimplified': 'HTML wallpapers and playback',
  'viz.originalToggle': 'Show original video excerpts instead of HTML wallpapers',
  'viz.originalAutoNote': 'One switch: ZuKaTo tries to mirror the Canvas already visible in Spotify Now Playing sidebar. If the video source is inaccessible, the cover is shown. No video URL or download is required.',
  'appearance.intro': 'Change the accent color in the ZuKaTo workspace only. Your Spotify theme stays unchanged.',
  'appearance.current': 'Current palette:',

  // Dashboard-specific live information.
  // Dashboard v1.9: live playback and direct actions.
  "dashboard.welcomeLabel": "Your music. Your workspace.",
  "dashboard.welcome": "Welcome to ZuKaTo",
  "dashboard.playing": "Now playing",
  "dashboard.idle": "Ready",
  "dashboard.noTrack": "No track selected",
  "dashboard.noTrackHelp": "Start playing a track in Spotify.",
  "dashboard.pause": "Pause",
  "dashboard.resume": "Play / Resume",
  "dashboard.next": "Next track",
  "dashboard.saveFavorite": "☆ Save",
  "dashboard.removeFavorite": "★ Saved",
  "dashboard.savedFavorite": "Saved to ZuKaTo favorites.",
  "dashboard.removedFavorite": "Removed from ZuKaTo favorites.",
  "dashboard.quickAccess": "Quick access",
  "dashboard.quickAccessHelp": "Your most-used tools in one place.",
  "dashboard.actionFavorites": "Collect tracks",
  "dashboard.actionQueue": "Manage queue",
  "dashboard.actionVisualizer": "Wallpapers and lyrics",
  "dashboard.actionTheme": "Customize colors",
  "dashboard.statsHeading": "Your local numbers",
  "dashboard.viewAll": "View all →",
  "dashboard.emptyHistory": "No listening history yet. Play a track to get started.",
  "dashboard.yourWorkspace": "Your overview",
  "dashboard.topArtist": "Most-played artist in local history",
  "dashboard.notYet": "No data yet",
  "dashboard.openSettings": "Open settings",
  // Settings navigation v1.9: sections instead of a long list.
  "navigation.start": "Home",
  "navigation.library": "Music & library",
  "navigation.creative": "Creative",
  "navigation.system": "System",
  // v1.68: Search and pinned navigation shortcuts.
  "navigation.heading": "Modules & navigation",
  "navigation.current": "Current: {title}",
  "navigation.search": "Search modules …",
  "navigation.expand": "Show all modules",
  "navigation.collapse": "Collapse modules",
  "navigation.pinned": "Quick access",
  "navigation.pin": "Pin {title}",
  "navigation.unpin": "Unpin {title}",
  "navigation.pinLimit": "You can pin up to {count} modules. Unpin one first.",
  "navigation.noResults": "No modules found. Try another search.",
  "quick.open": "Add a song",
  "quick.title": "Find & add songs",
  "quick.help": "Search tracks or artists, paste a Spotify link and choose an action.",
  "quick.save": "Save",
  "quick.queue": "Add to queue",
  "quick.current": "Current track",
  "quick.saved": "Saved to ZuKaTo favorites.",
  "quick.alreadySaved": "Track already saved.",
  "quick.queued": "Added to Spotify queue.",
  "quick.failed": "Action failed. Please check your Spotify connection.",
  "quick.close": "Close song search",
  "quick.commandHint": "Manage music without switching modules",
  "dashboard.progress": "Playback progress",
  "dashboard.findSong": "Find and add a song",
  "settings.characters": "{count}/{max} characters · Esc to cancel",
  "settings.tabOverview": "Overview",
  "settings.tabOverviewHelp": "Key switches and sections at a glance.",
  "settings.overviewIntro": "Everything essential is here. Open advanced options only when needed.",
  "settings.overviewStats": "{modules} workspace modules · {favorites} favorites · {notes} notes (stored locally)",
  "settings.simpleHeading": "Everything in one place",
  "settings.simpleIntro": "Choose an area. Advanced controls are available when you need them.",
  "settings.tabGeneral": "General",
  "settings.tabGeneralHelp": "Name, greeting and language.",
  "settings.tabWallpapers": "Wallpapers",
  "settings.tabWallpapersHelp": "Switch video sources and manage your HTML wallpapers.",
  "settings.tabModules": "Modules",
  "settings.tabModulesHelp": "Enable or disable modules. Expand details only if needed.",
  "settings.tabShortcuts": "Shortcuts",
  "settings.tabShortcutsHelp": "View and edit your keyboard bindings.",
  "settings.tabData": "Data & Backup",
  "settings.tabDataHelp": "Back up or restore your settings and local data.",
  "settings.advancedModule": "More options",
  "settings.useOriginalClips": "Show original video excerpts",
  "settings.useOriginalClipsHelp": "One switch: On = configured original clips, Off = your HTML wallpapers.",
  "settings.on": "On",
  "settings.off": "Off",
  "settings.wallpapersActive": "Your imported HTML wallpapers rotate once per new track.",
  "settings.manageWallpapers": "Manage HTML wallpaper folder and order",
  "settings.manageWallpapersHelp": "Import folders, preview scenes or set the playback order. Source files remain untouched.",
  "dashboard.nowPlaying": "Now playing",
  "dashboard.recent": "Recently played",
  // Laufzeitmeldungen der Spicetify-Extension.
  "runtime.sleepPaused": 'ZuKaTo sleep timer: playback paused.',
  "runtime.sleepStarted": 'ZuKaTo sleep timer: {minutes} minutes.',
  "runtime.sleepStopped": 'Sleep timer canceled.',
  "runtime.sleepRemaining": '{minutes} minutes remaining.',
  "runtime.sleepNone": 'No sleep timer is active.',
  "runtime.copied": 'Track information copied.',
  "runtime.clipboardError": 'Clipboard not available.',
  "runtime.noCurrent": 'No track selected.',
  "runtime.queued": 'Added {count} tracks to the queue.',
  "runtime.queueFailed": 'Could not add tracks to the queue.',
  "runtime.bookmarkAdded": 'ZuKaTo bookmark added.',
  "runtime.bookmarkRemoved": 'ZuKaTo bookmark removed.',

  "feature.dashboard":
    "Dashboard",

  "feature.listening-history":
    "Listening history",

  "feature.statistics":
    "Statistics",

  "feature.favorites":
    "Favorites",

  "feature.playlist-tools":
    "Queue tools",

  "feature.visualizer":
    "Wallpaper Visualizer",

  "feature.song-notes":
    "Song notes",

  "feature.theme-studio":
    "Theme Studio",

  "feature.settings":
    "Settings",

  // ---------------------------------------------------------------------------
  // Extension modules.
  // ---------------------------------------------------------------------------
  "feature.keyboard-shortcuts":
    "Keyboard shortcuts",

  "feature.sleep-timer":
    "Sleep timer",

  "feature.volume-scroll":
    "Mouse-wheel volume",

  "feature.copy-track-info":
    "Copy track information",

  "feature.quick-playlist":
    "Quick queue",

  "feature.mini-player":
    "Mini player",

  "feature.player-statistics":
    "Player statistics",

  "feature.context-actions":
    "Context actions",
};

// -----------------------------------------------------------------------------
// Registry aller verfügbaren Sprachwörterbücher.
// -----------------------------------------------------------------------------
const translations:
  Record<
    SupportedLocale,
    TranslationDictionary
  > = {
    de: germanTranslations,
    en: englishTranslations,
  };

// -----------------------------------------------------------------------------
// Parameter für dynamische Übersetzungs-Platzhalter.
//
// Beispiel:
//
// { action: "Wiedergabe/Pause" }
// -----------------------------------------------------------------------------
export type TranslationParameters =
  Record<
    string,
    string | number
  >;

// -----------------------------------------------------------------------------
// Signatur der zentralen Übersetzungsfunktion.
// -----------------------------------------------------------------------------
export type Translator = (
  key: TranslationKey,
  parameters?: TranslationParameters,
) => string;

// -----------------------------------------------------------------------------
// Bestimmt die tatsächlich verwendete Sprache.
//
// Bei "auto" wird die Sprache anhand der Browser-/Spotify-Sprache gewählt.
// -----------------------------------------------------------------------------
export function resolveLocale(
  configuredLocale: AppLocale,
): SupportedLocale {
  // ---------------------------------------------------------------------------
  // Explizit konfigurierte Sprache direkt übernehmen.
  // ---------------------------------------------------------------------------
  if (
    configuredLocale === "de" ||
    configuredLocale === "en"
  ) {
    return configuredLocale;
  }

  // ---------------------------------------------------------------------------
  // Alle vom Browser gemeldeten Sprachen sammeln.
  // ---------------------------------------------------------------------------
  const browserLocales = [
    ...(navigator.languages ?? []),
    navigator.language ?? "en",
  ];

  // ---------------------------------------------------------------------------
  // Sobald eine Sprache mit "de" beginnt, wird Deutsch verwendet.
  // ---------------------------------------------------------------------------
  const prefersGerman =
    browserLocales.some(
      (locale) =>
        locale
          .toLocaleLowerCase()
          .startsWith("de"),
    );

  return prefersGerman
    ? "de"
    : "en";
}

// -----------------------------------------------------------------------------
// Ersetzt dynamische Platzhalter in Übersetzungstexten.
//
// Beispiel:
//
// "Bereits für {action} verwendet."
//
// wird mit:
//
// { action: "Wiedergabe/Pause" }
//
// entsprechend ersetzt.
// -----------------------------------------------------------------------------
function interpolate(
  text: string,
  parameters:
    TranslationParameters,
): string {
  return text.replace(
    /\{([a-zA-Z0-9_]+)\}/g,
    (
      placeholder,
      parameterName: string,
    ) => {
      // -----------------------------------------------------------------------
      // Passenden Parameter suchen.
      // -----------------------------------------------------------------------
      const value =
        parameters[
          parameterName
        ];

      // -----------------------------------------------------------------------
      // Wenn kein Wert vorhanden ist, bleibt der Platzhalter sichtbar.
      //
      // Dadurch fallen fehlerhafte Übersetzungsaufrufe schneller auf.
      // -----------------------------------------------------------------------
      return value === undefined
        ? placeholder
        : String(value);
    },
  );
}

// -----------------------------------------------------------------------------
// Erstellt eine Übersetzungsfunktion für eine konkrete Sprache.
// -----------------------------------------------------------------------------
export function createTranslator(
  locale: SupportedLocale,
): Translator {
  return (
    key,
    parameters = {},
  ): string => {
    // -------------------------------------------------------------------------
    // Text aus dem gewählten Wörterbuch lesen.
    // -------------------------------------------------------------------------
    const translatedText =
      translations[
        locale
      ][
        key
      ];

    // -------------------------------------------------------------------------
    // Platzhalter ersetzen und fertigen Text zurückgeben.
    // -------------------------------------------------------------------------
    return interpolate(
      translatedText,
      parameters,
    );
  };
}
