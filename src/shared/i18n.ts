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
  'stats.intro': 'Statistik über lokal aufgezeichnete Titelwechsel, nicht über den vollständigen Spotify-Verlauf.',
  'stats.changes': 'Titelwechsel',
  'stats.unique': 'Verschiedene Titel',
  'stats.favorites': 'Favoriten',
  'stats.notes': 'Notizen',
  'stats.artists': 'Häufigste Künstler',
  'stats.tracks': 'Häufigste Titel',
  'stats.empty': 'Noch keine Daten. Die Extension zeichnet ab ihrer Aktivierung neue Titelwechsel auf.',
  'favorites.intro': 'Eigene Lesezeichen in ZuKaTo. Sie ändern nicht die Spotify-Bibliothek.',
  'favorites.count': '{count} gespeicherte Favoriten',
  'favorites.toggle': 'Aktuellen Titel merken / entfernen',
  'favorites.empty': 'Noch keine Favoriten gespeichert.',
  'notes.intro': 'Eine Notiz pro Titel. Nur auf diesem Gerät in ZuKaTo gespeichert.',
  'notes.choose': 'Aktuellen Titel wählen',
  'notes.label': 'Deine Notiz',
  'notes.count': '{count}/4000 Zeichen',
  'notes.saved': 'Notiz gespeichert.',
  'notes.empty': 'Spiele zuerst einen Titel ab.',
  'notes.savedCount': 'Gespeicherte Notizen ({count})',
  'notes.edit': 'Bearbeiten',
  'playlist.intro': 'Sicherer Warteschlangen-Helfer. Bestehende Spotify-Playlists werden nicht verändert.',
  'playlist.current': 'Aktuellen Titel einreihen',
  'playlist.allFavorites': 'Alle {count} Favoriten einreihen',
  'playlist.label': 'Spotify-URI eines Titels / einer Episode',
  'playlist.queue': 'Einreihen',
  'playlist.noValid': 'Keine gültigen Spotify-Titel.',
  'playlist.done': '{count} Titel zur Warteschlange hinzugefügt.',
  'playlist.failed': 'Warteschlange konnte nicht bearbeitet werden.',
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
  'viz.originalMissing': 'Wallpaper ausgeschaltet. Für diesen Song ist noch keine erlaubte Originalvideo-URL hinterlegt.',
  'viz.sceneImported': '{count} Wallpaper(s) importiert und zur Liste hinzugefügt.',
  'viz.manifestUpload': 'Originalvideo-Liste (.json) mit Song-URLs importieren',
  'viz.manifestTooLarge': 'JSON-Liste ist zu groß (max. 100 kB).',
  'viz.manifestImported': '{count} Originalvideo-Zuordnungen importiert.',
  'viz.modeOwnFirst': 'Eigene Wallpapers → danach Originalclip',
  'viz.modeOriginalFirst': 'Originalclip zuerst (sonst Wallpapers)',
  'viz.sceneLength': 'Sekunden pro Wallpaper',
  'viz.sceneScope': 'Zuordnung bearbeiten',
  'viz.sceneImportFile': 'Einzelne HTML-/Videodatei importieren',
  'viz.sceneImportFolder': 'Wallpaper-Hauptordner auswählen und automatisch zuordnen',
  'viz.sceneSandboxHelp': 'Jeder Unterordner mit index.html wird ein eigenes Wallpaper (01, 02, 03 ...). Deine lokalen Dateien werden kopiert, nicht verändert. Die Animation läuft während des ganzen Songs; CSS/JS/Bilder funktionieren in einer sicheren Sandbox, nicht alle speziellen Wallpaper-Engine-APIs.',
  'viz.sceneLibrary': 'Eigene Szenenbibliothek',
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
  'viz.intro': 'Video-Wallpapers im Spotify-Workspace mit optionaler echter Mikrofonanalyse und eigenen synchronisierten .lrc-Lyrics.',
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
  'viz.lyricsHelp': 'Eigene zeitgesteuerte .lrc-Datei für den aktuell laufenden Song importieren. Noch keine automatische Lyrics-Quelle; Texte werden nur lokal gespeichert.',
  'viz.showLyrics': 'Songtext im Video anzeigen',
  'viz.showTitle': 'Titel und Künstler anzeigen',
  'viz.pickLyrics': 'LRC-Datei importieren',
  'viz.deleteLyrics': 'Songtext löschen',
  'viz.lyricScale': 'Textgröße',
  'viz.lyricOffset': 'Songtext-Synchronisierung (+ = später)',
  'viz.lyricsReady': '{count} synchronisierte Zeilen geladen',
  'viz.noLyrics': 'Für diesen Titel wurde noch keine .lrc-Datei importiert.',
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
  'viz.editorHelp': 'LRC-Zeilen hier einfügen oder ändern. Setze die Zeitmarke an der Cursorposition anhand des aktuellen Spotify-Fortschritts und speichere für diesen Titel. Nur lokale Daten, keine Lyrics-API.',
  'viz.editorStats': '{count} gültige Zeilen · {bytes} Byte',
  'viz.editorTimestamp': 'Zeitmarke jetzt einfügen',
  'viz.editorSave': 'LRC für Song speichern',
  'viz.editorExport': 'LRC exportieren',

  'appearance.intro': 'Ändere die Akzentfarbe nur für den ZuKaTo Workspace. Das Spotify-Theme selbst bleibt unverändert.',
  'appearance.current': 'Aktuelle Palette:',

  // Dashboard-spezifische Live-Informationen.
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
    "Playlist-Werkzeuge",

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
  'stats.intro': 'Statistics from locally recorded track changes, not your full Spotify history.',
  'stats.changes': 'Track changes',
  'stats.unique': 'Unique tracks',
  'stats.favorites': 'Favorites',
  'stats.notes': 'Notes',
  'stats.artists': 'Top artists',
  'stats.tracks': 'Top tracks',
  'stats.empty': 'No data yet. The extension records track changes after activation.',
  'favorites.intro': 'Private ZuKaTo bookmarks. They do not modify your Spotify library.',
  'favorites.count': '{count} saved favorites',
  'favorites.toggle': 'Save / remove current track',
  'favorites.empty': 'No favorites saved yet.',
  'notes.intro': 'One note per track, stored only on this device in ZuKaTo.',
  'notes.choose': 'Select current track',
  'notes.label': 'Your note',
  'notes.count': '{count}/4000 characters',
  'notes.saved': 'Note saved.',
  'notes.empty': 'Play a track first.',
  'notes.savedCount': 'Saved notes ({count})',
  'notes.edit': 'Edit',
  'playlist.intro': 'Queue tools. Existing Spotify playlists will not be modified.',
  'playlist.current': 'Queue current track',
  'playlist.allFavorites': 'Queue all {count} favorites',
  'playlist.label': 'Spotify URI for a track / episode',
  'playlist.queue': 'Add to queue',
  'playlist.noValid': 'No valid Spotify tracks.',
  'playlist.done': 'Added {count} tracks to the queue.',
  'playlist.failed': 'Could not update the queue.',
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
  'viz.originalMissing': 'Wallpapers are off. No licensed original video URL has been configured for this track.',
  'viz.sceneImported': 'Imported {count} wallpaper(s) and added them to the playlist.',
  'viz.manifestUpload': 'Import original-video list (.json) with track URLs',
  'viz.manifestTooLarge': 'JSON list is too large (100 kB max).',
  'viz.manifestImported': 'Imported {count} original video assignments.',
  'viz.modeOwnFirst': 'My wallpapers → then original clip',
  'viz.modeOriginalFirst': 'Original clip first (otherwise wallpapers)',
  'viz.sceneLength': 'Seconds per wallpaper',
  'viz.sceneScope': 'Edit assignment for',
  'viz.sceneImportFile': 'Import HTML/video file',
  'viz.sceneImportFolder': 'Choose wallpaper collection folder and auto-assign',
  'viz.sceneSandboxHelp': 'Every subfolder with index.html becomes a separate wallpaper (01, 02, 03 ...). Your originals are copied, never changed. Each wallpaper plays for the full song. Local CSS/JS/assets work in an isolated sandbox; proprietary Wallpaper Engine APIs may not.',
  'viz.sceneLibrary': 'My scene library',
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
  'viz.intro': 'Video wallpapers inside Spotify, with optional real microphone analysis and your own synchronized .lrc lyrics.',
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
  'viz.lyricsHelp': 'Import your own timed .lrc file for the currently playing track. No automatic lyrics provider yet; files stay local.',
  'viz.showLyrics': 'Show lyrics over video',
  'viz.showTitle': 'Show track and artist',
  'viz.pickLyrics': 'Import LRC file',
  'viz.deleteLyrics': 'Delete lyrics',
  'viz.lyricScale': 'Lyrics size',
  'viz.lyricOffset': 'Lyrics timing (+ = later)',
  'viz.lyricsReady': '{count} synchronized lines loaded',
  'viz.noLyrics': 'No .lrc file has been imported for this track.',
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
  'viz.editorHelp': 'Paste or edit timed LRC lines. Insert a timestamp at the cursor based on the current Spotify position and save for this track. Local only, no lyrics API.',
  'viz.editorStats': '{count} valid lines · {bytes} bytes',
  'viz.editorTimestamp': 'Insert timestamp here',
  'viz.editorSave': 'Save LRC for track',
  'viz.editorExport': 'Export LRC',

  'appearance.intro': 'Change the accent color in the ZuKaTo workspace only. Your Spotify theme stays unchanged.',
  'appearance.current': 'Current palette:',

  // Dashboard-specific live information.
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
    "Playlist tools",

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