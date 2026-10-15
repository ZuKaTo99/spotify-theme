# ZuKaTo v1.12.0 – Visualizer-Steuerzentrale (unveröffentlichter Arbeitsstand)

**Noch nichts installieren oder committen.** Die Version enthält alle bisherigen
unveröffentlichten Änderungen (v1.8–v1.11) und verbessert die Visualizer-Bedienung.

- **Bühne im Vordergrund:** Track, gewählte Quelle, Video/HTML-Wallpaper und
  automatische Lyrics bleiben beim Einstellen sichtbar.
- **Vier statt aller Regler auf einmal:** Wallpapers, Songtexte, Audioeffekte und
  Presets/Extras haben eigene Registerkarten. Die zuletzt ausgewählte wird
  ausschließlich für die laufende Sitzung gemerkt.
- **Eigene Wallpaper zuerst:** Der Ordnerimport und die pro-Song-Reihenfolge
  stehen direkt im Wallpaper-Bereich. Ältere Einzelvideo-Funktionen sind in
  einem ausklappbaren Abschnitt erreichbar.
- **Schneller Quellenwechsel:** Wallpapers/Originalclips oben an der Bühne
  umschalten, ohne die gespeicherte Bibliothek zu löschen.
- **Kinomodus:** Verwaltungsansichten ausblenden; jederzeit zum Bearbeiten
  zurückkehren. Browser-Vollbild bleibt als separate Option erhalten.
- **Bugfix:** Die angezeigte Nummer des aktuellen Wallpapers berücksichtigt
  nun den Startpunkt frisch importierter Ordner und Song-Overrides.
- **Qualität:** 84/84 automatisierte Tests inkl. Windows-unabhängigem Fallback-
  Build bestanden. Spotify-/Windows-Liveprüfung bleibt ausstehend.

**Unverändert offen:** Automatische rechtmäßig verfügbare Original-Musikclips
(der Schalter allein lädt keine), zuverlässige Lyrics-Rechteabklärung und
Spotify-/Spicetify-Liveabnahme. Näheres in `REVIEW_V1.12.md`.

---

## ZuKaTo v1.11.0 – automatische Lyrics (Entwicklungsstand, NICHT übernehmen)

**Wichtig:** Dieses Paket enthält die Änderungen seit der noch nicht übernommenen v1.8.0/v1.9.0/v1.10.0. Es ist ein Arbeitsstand, kein Auftrag zur Installation oder zum Git-Commit.

**Lyrics im Visualizer werden jetzt automatisch gesucht**: Beim Songwechsel liest ZuKaTo Titel, Künstler, Album und Songdauer aus dem Player und fragt die dokumentierte LRCLIB-API (`https://lrclib.net/docs`) an. Bei vorhandenen LRC-Zeitmarken wird die aktuelle Zeile synchron zum Spotify-Fortschritt hervorgehoben. Wenn der Anbieter nur unzeitgesteuerten Text hat, erscheint er als scrollbarer Volltext ohne falsche Synchronisierung. Instrumentalsongs, fehlende Treffer, Offline-/Netzwerkfehler und HTTP-429-Limits erhalten eigene Statusanzeigen. Es gibt einen manuellen Wiederholungsversuch. **Es handelt sich um eine unabhängige Community-Lyrics-Quelle, NICHT um einen offiziellen Spotify-/Publisher-Lyrics-Endpunkt; Vollständigkeit, Rechte und Korrektheit können nicht garantiert werden.** Die Nutzung ist abhängig von Quelle und geltendem Recht.

**Weiterhin selbst einstellbar:** Schriftgröße, Farbe, Highlight, Schatten, Position, sichtbare Zeilen und Timing-Offset. Eigene lokale LRCs überschreiben automatische Treffer, liegen aber nur noch unter „Eigene Lyrics / LRC – zusätzliche Optionen“. Automatisch abgerufene Texte werden nur kurzfristig im Arbeitsspeicher gehalten (max. 35 Titel) und nicht in ZIP, JSON-Backup oder IndexedDB gesammelt. Es werden keine Zugangstokens, Spotify-Kontodaten oder Wallpapers an LRCLIB geschickt.

**Technisch:** `src/custom-app/modules/visualizer/automatic-lyrics.ts` trennt API, Matching, RAM-Cache, Begrenzungen und Rate-Limits vom React-Visualizer. Offline-Regressionsprüfungen stehen in `tests/automatic-lyrics.test.mjs`. Die echten Anfragen und die Spotify-Live-Darstellung müssen unter Windows im Spotify-Client geprüft werden.

---

## ZuKaTo v1.10.0 – Navigation, Dashboard und Song-Aktionen

**Noch nicht übernommen:** Diese Version führt die v1.8-/v1.9-Weiterentwicklung fort. Der Entwicklungsstand wird lediglich vorbereitet und geprüft. Die Version ersetzt keine Rechteprüfung für Originalclips/Lyrics und wurde noch nicht unter Windows/Spotify abgenommen.

Die neue **Song-Schnellaktion** öffnet sich über den Button im Workspace oder per `Ctrl+Shift+F`. Hier lassen sich Spotify-Songs suchen bzw. Links einfügen, direkt für lokale ZuKaTo-Favoriten merken oder in die Spotify-Warteschlange einreihen. Die bekannten Song-Notizen und Detailmodule bleiben unverändert nutzbar.

Die Navigation ist in **Start**, **Musik & Sammlung**, **Gestaltung** und **System** gruppiert. Der zuletzt geöffnete Bereich bleibt für diese Sitzung gespeichert. Das Dashboard zeigt Spotify-Fortschritt/Restlänge in Minuten:Sekunden und einen zentralen Suchzugriff.

In **Einstellungen → Übersicht** stehen der Originalvideo-Schalter, Navigation zu den wichtigsten Konfigurationsbereichen und eine Zusammenfassung der lokal gespeicherten Daten. Erweiterte Optionen sind nicht entfernt, sondern gezielt zu öffnen.

Technische Dateien: `src/shared/workspace-navigation.ts`, `src/shared/player-progress.ts`, `src/custom-app/components/QuickTrackPanel.tsx`, `src/custom-app/components/TrackSearch.tsx`; Regressionstests in `tests/workspace-ux.test.mjs`.

---

## ZuKaTo v1.9.0 – neu gestalteter Workspace

Die v1.9.0 ist eine **vollständige Weiterentwicklung von v1.8.0**. Falls v1.8.0 noch nicht installiert wurde, kann das v1.9.0-Paket direkt über den vorhandenen Projektordner entpackt werden.

- **Dashboard:** Schnellzugriffe, Live-Wiedergabe, Favoritenaktion, Spotify-Cover, aktueller Verlauf und lokale Statistiken.
- **Einstellungen:** Fünf getrennte Bereiche statt einer langen Formularseite. Die Originalclip-Umschaltung besteht aus nur einem Ein/Aus-Schalter; die fortgeschrittene HTML-Wallpaper-Verwaltung liegt auf Wunsch aufgeklappt darunter.
- **Module:** Aktivierung als kompakter Schalter; seltene Titel- und Reihenfolgeoptionen hinter „Weitere Optionen“.
- **Theme-Studio:** 24 Farben, eigene HEX-Werte und die Vorschau eines echten ZuKaTo-Minilayouts.
- **Technik:** Keine geänderten Storage-Schlüssel, keine neuen Laufzeit-Abhängigkeiten. Ausführliche Kommentare in allen neuen und überarbeiteten Dateien.

Historischer Stand von v1.9.0: Damals gab es noch keine automatische Lyrics-Quelle. **Ab v1.11.0** ist LRCLIB als unabhängiger automatischer Anbieter angebunden; offizielle/lizenzierte Publisher-Lyrics und automatische Originalvideos bleiben getrennte offene Ziele.

---

> **Windows / Node.js 24:** Bei Build-Problemen zuerst [START_HIER_WINDOWS.md](START_HIER_WINDOWS.md) lesen (`npm run doctor`).

# ZuKaTo Spicetify / Spotify Toolkit

Ein modulares Spotify-Toolkit für **Spicetify** mit eigener Custom App, Erweiterungen und einer zentralen, lokal gespeicherten Konfiguration.

## Start (Windows / PowerShell)

Voraussetzungen: Spotify Desktop, eine funktionierende Spicetify-Installation sowie Node.js 22.16+ und npm. Unter Windows kannst du auch direkt `INSTALLIEREN_WINDOWS.cmd` starten (enthält dieselben Prüf- und Installationsschritte). Die Spicetify-CLI (`spicetify`) muss auf dem System verfügbar sein.

```powershell
# Im Projektordner ausführen:
npm install
npm test
npm run install:spicetify
```

Danach Spotify gegebenenfalls neu starten und **ZuKaTo Workspace** in der Sidebar öffnen. Die Installation kopiert die gebauten Dateien nach `%APPDATA%\spicetify\Extensions\zukato-extension.js` und `%APPDATA%\spicetify\CustomApps\zukato-workspace`, aktiviert beide via `spicetify config` und führt `spicetify apply` aus. Falls Spicetify ausdrücklich einen Backup-Versionskonflikt meldet, wird automatisch einmal `spicetify backup apply` ausgeführt. Ein vorhandener installierter ZuKaTo-Workspace-Ordner wird dabei ersetzt; zuvor eigene Anpassungen dort sichern.

Bei bereits installiertem Projekt nach Änderungen:

```powershell
npm run check                  # TypeScript-Typprüfung
npm run build                  # Extension + Custom App + Theme
npm test                       # Build + automatisierte Smoke-Tests
npm run install:spicetify      # Build + lokale Spicetify-Installation
```

### Projektstruktur

| Ort | Funktion |
| --- | --- |
| `src/custom-app/App.tsx` | App-Rahmen, Navigation, Akzentfarbe |
| `src/custom-app/components/ModuleContent.tsx` | Zentraler Modul-Router |
| `src/custom-app/modules/` | Dashboard, Verlauf, Statistiken, Favoriten, Queue, Monitor, Notizen, Theme, Settings |
| `src/extension/modules/` | Spicetify-Menüs, Tastenkürzel, Sleep-Timer, Mini-Player, Kontextaktionen, Statistik-Recorder |
| `src/shared/library.ts` | Validierter Datenspeicher für die Modul-Daten |
| `src/shared/settings.ts` | Versionierte, validierte Settings inklusive Shortcut-Belegungen |
| `src/shared/features.ts` | Feature-IDs, Aktivierung und Reihenfolge |
| `src/shared/i18n.ts` | Deutsche und englische Texte |
| `src/custom-app/app.scss` | Design (bewusst auf `.zukato-app` begrenzt) |
| `tools/build.mjs` | Compiler und plattformunabhängiger Fallback |
| `tools/install.mjs` | Lokale Windows-Installation |
| `tests/smoke.test.mjs` | Tests der tatsächlich erzeugten JavaScript-Dateien |
| `tests/installer.test.mjs` | Simulierte Spicetify-Installation, inklusive Backup-Reparatur und Fehlerfällen |
| `src/custom-app/modules/visualizer/` | Video-Layer, Wallpaper-Galerie, Miniaturbilder, LRC, Presets und Mikrofonanalyse |
| `dist/` | Direkt installierbare Build-Artefakte |

## Module und Bedienung

**Workspace:** Dashboard (Zähler + aktueller Titel), Hörverlauf (bis zu 500 lokal beobachtete Titelwechsel), Statistiken (Häufigkeiten, keine behaupteten Streaming-Minuten), Favoriten (lokale Lesezeichen), Playlist-Werkzeuge (Warteschlange ohne Modifikation von Playlists), Wiedergabe-Monitor (Fortschritt, Player-Steuerung), Song-Notizen (bis zu 4000 Zeichen je Titel), Theme-Studio (Workspace-Akzentfarben), Einstellungen (Module/Tastenkürzel/Backup).

**Extension:** Tastenkürzel (änderbare Kombinationen), Sleep-Timer (Profilmenü, 15/30/60 Minuten, Abbrechen), Lautstärke per Mausrad (nur direkt am Spotify-Lautstärkeregler), Titelinfos/URI kopieren (Kontext- bzw. Profilmenü), Titel zur Warteschlange hinzufügen, Mini-Player (im Profilmenü einschaltbar), lokaler Player-Recorder und Lesezeichen im Kontextmenü.

*Das Feature `player-statistics` muss für die Aufzeichnung neuer Hörverlaufseinträge aktiv sein (standardmäßig an). Die Historie ist **nicht** Spotifys gesamter bisheriger Wiedergabeverlauf und enthält keine validen Hörminuten.* Favoriten und Notizen gehören zu ZuKaTo; sie synchronisieren **nicht** mit den Spotify-Likes oder deinem Spotify-Konto. Die Daten bleiben gerätespezifisch gespeichert und können unter **Einstellungen → Datensicherung & Wiederherstellung** exportiert/importiert werden.

**Wallpaper-Visualizer (v1.6):** Der bisherige Wiedergabe-Monitor wurde zum immersiven Video-Visualizer ausgebaut. Er kombiniert ein lokal gespeichertes, stummes Hintergrundvideo mit einem optionalen Canvas-Spektrum und zeitsynchronen LRC-Lyrics. Videos laufen in Endlosschleife und folgen Play/Pause. Neu: Die Loop-Zeit eines importierten Videos lässt sich im Clip-Editor festlegen, ohne die Originaldatei anzutasten. Bei einem Titelwechsel wird ein anderes Video erst nach seinem ersten dekodierten Bild überblendet; dasselbe Standardvideo läuft ohne Neustart weiter. Der Crossfade lässt sich zwischen 0 und 3000 ms einstellen. Wahlweise laufen die Videos frei im Loop oder werden auf die Spotify-Songposition ausgerichtet; beim Song-Seek wird der Clip nachgeführt. Das ist ein zeitbasierter Abgleich mit Toleranz, keine sample- oder framegenaue Audioanalyse.

### NEU v1.8.0 – Songsuche, 24 Farben und vereinfachte Originalclips

- **Songs ohne URI-Umwege:** In **Favoriten**, **Playlist-Werkzeuge** und **Song-Notizen** steht jetzt eine Suche nach Songtitel/Künstler zur Verfügung. Auch normale Spotify-Songlinks (`https://open.spotify.com/track/...`) oder `spotify:track:...` können eingefügt und ausgewählt werden. Aus den Treffern lassen sich lokale Favoriten speichern, Songs zur Queue hinzufügen oder Notizen für einen Song schreiben. ZuKaTo verändert dadurch nicht ungefragt deine echten Spotify-Playlists oder Spotify-Likes. Die Suche nutzt ausschließlich die vom angemeldeten Spotify-Client unterstützte Spotify-API; die Kompatibilität hängt von der eingesetzten Spotify-Version ab. Bei einem Songlink kann der Titel auch ohne verfügbare Detaildaten übernommen werden.
- **Theme-Farbpalette:** Das Theme-Studio bietet **24 Akzentfarben**, einen Farbwähler und ein eigenes HEX-Feld (`#RRGGBB`) mit Eingabeprüfung und kontrastreicher Button-Beschriftung. Die Farbe bleibt auf ZuKaTo beschränkt und wird weiterhin im JSON-Backup gespeichert. Alte Farbauswahlen/Backups bleiben gültig.
- **Originalausschnitte – nur Ein/Aus:** In der Wallpaper-Verwaltung gibt es nur noch einen Schalter, ob hinterlegte Originalclips statt der eigenen HTML-Wallpapers gezeigt werden sollen. Komplexe Eingabefelder für Einzel-URLs, Zeitbereiche und JSON-Manifeste wurden aus der normalen Oberfläche entfernt. Alte Zuordnungen bleiben als Daten erhalten. **Wichtig:** Ein Schalter erzeugt keine Videoquelle: Automatisches Abrufen urheberrechtlich geschützter Originalclips ist weiterhin nicht vorhanden; ohne hinterlegte Quelle erscheint ein Hinweis.
- **Projekt weiter verständlich halten:** Die Song-Suche ist in `src/custom-app/components/TrackSearch.tsx` wiederverwendbar; Parsing und API-Aufruf sind in `src/shared/track-search.ts` isoliert. Farbvalidierung und Kontrast liegen in `src/shared/appearance.ts`. Alle neuen Module sind kommentiert.

### NEU v1.7 – dauerhafte Playlist, HTML-Songsignale und Vorschau

- **Songwechsel-Zähler im Extension-Kern:** Er läuft auch weiter, wenn der Visualizer-Tab geschlossen ist. Sein Index wird lokal gespeichert und nach einem Neustart wiederverwendet. Doppelte Player-Events, Pause und Seek sollen keine zusätzlichen Wallpapers auslösen; echte Skips und Repeats sind eigene Durchläufe. Ist die Extension nicht installiert, kann die Custom App den Zähler nur beobachten, solange sie geöffnet ist.
- **Frischer Ordner beginnt bei Eintrag 1:** Beim Import, Hinzufügen oder Umsortieren einer Playlist wird eine neue Startposition gespeichert. Das erste Wallpaper beginnt spätestens beim nächsten Titelwechsel; die bisherigen Songdurchläufe bestimmen nicht zufällig die Startposition des neuen Ordners.
- **HTML-Bridge:** Importierte Web-Wallpapers erhalten das lokale JavaScript-Event `zukato:player` mit `playing`, `run`, `positionMs`, `durationMs`. Eigene Animationen können darauf reagieren, ohne dass dem iframe Spotify-API- oder Netzwerkzugriff gegeben wird.
- **Mehr Ordnerkompatibilität:** Eingebettete Styles/Skripte dürfen Unterordner referenzieren; relative CSS-Assets wie `../images/bg.png` und unquotierte `url(...)` werden korrekt lokal aufgelöst.
- **Bibliotheks-Vorschau und Diagnose:** Importierte HTML-Projekte und Videos vorab ansehen, lokale Belegung und fehlende Playlist-Dateien erkennen.

Eine direkt weiterverwendbare Schnittstellenbeschreibung mit Beispielcode steht in [`HTML_WALLPAPER_API.md`](HTML_WALLPAPER_API.md). **Keine vorinstallierten Wallpapers.** Auch in v1.7 findet kein automatischer Import geschützter Musikvideos oder lizenzierter Original-Lyrics statt.

### NEU v1.6 – eigene HTML-Wallpapers als Song-für-Song-Ordnerliste

**Deine gewünschte Abspiellogik:** In **ZuKaTo Workspace → Einstellungen → HTML-Wallpaper-Ordner** den Hauptordner auswählen, der mehrere selbst erstellte Wallpaper-Engine-**Web**-Projekte enthält. Ein Projekt ist ein Unterordner mit `index.html` und seinen CSS-/JS-/Bilddateien. Das Projekt kopiert diese Dateien in den lokalen ZuKaTo-Speicher; es gibt keine dauerhafte Hintergrundverbindung zum Originalordner.

```text
Meine_Wallpapers/
├── 01_Nebel/
│   ├── index.html
│   ├── style.css
│   └── assets/...
├── 02_Regen/
│   ├── index.html
│   └── animation.js
└── 03_Sterne/
    ├── index.html
    └── assets/...
```

Die Reihenfolge wird **natürlich nach Ordnernamen sortiert**: Titel 1 → Nebel, Titel 2 → Regen, Titel 3 → Sterne, Titel 4 → wieder Nebel. Während Titel 1 läuft, bleibt Nebel dauerhaft aktiv und kann **innerhalb seines eigenen HTML-Projekts** endlos animieren. **Kein** automatischer Wechsel nach Sekunden. Skip und Repeat gelten als nächster Songwechsel. Du kannst über **Nur aktueller Titel** einzelnen Songs ausdrücklich andere Szenen zuordnen. Über den **Checkbox-Schalter** ist die Wallpaper-Funktion an/aus: AUS zeigt die für den Song hinterlegte URL auf einen direkt abspielbaren **erlaubten** Originalvideoclip. Ist noch keine solche URL hinterlegt, erscheint ein Hinweis statt einer erfundenen Quelle.

Die manuelle Originalclip-Konfiguration aus früheren Versionen ist ab v1.8 aus der Einstellungsoberfläche entfernt. Bereits früher gespeicherte Zuordnungen bleiben aus Kompatibilitätsgründen erhalten. Das folgende JSON ist nur ein historisches Formatbeispiel, **keine** Importanleitung für v1.8 (URLs sind Platzhalter):

```json
{
  "format": "zukato-original-clips-v1",
  "videos": [
    {"trackUri": "spotify:track:DEINE_TRACK_ID", "url": "https://dein-server.example/video.mp4", "start": 12, "end": 28}
  ]
}
```

**Grenzen:** Nur eigenständig im Browser laufende HTML-Webwallpapers werden unterstützt; keine nativen Wallpaper-Engine-`.pkg`-Szenen und keine proprietäre Wallpaper-Engine-JavaScript-API. Dateien werden beim Import in eine isolierte iframe-Sandbox eingebettet, ohne externe Netzwerkzugriffe. Einzelprojekte sind auf 64 Dateien/12 MiB, die Szenenbibliothek auf 128 Einträge/512 MiB begrenzt. Dynamische Fetch-Abhängigkeiten oder andere nicht eingebettete externe Assets können nicht laufen. Originalvideos werden **nicht** automatisch von Spotify Canvas, YouTube oder geschützten Anbietern abgerufen; auch das automatische Beziehen von Original-Lyrics ist noch nicht integriert. Songtexte können weiterhin als eigene LRC-Datei über dem Hintergrund eingeblendet werden. Die lokalen Binärdateien werden **nicht** vom normalen JSON-Backup erfasst; die Ordner/Originaldateien separat aufbewahren.

### Wallpaper-Visualizer verwenden

1. In Spotify **ZuKaTo Workspace → Wallpaper-Visualizer** aufrufen.
2. Unter **Animierter Hintergrund** ein `.mp4`, `.webm` oder `.ogv` importieren. **Standard** wird für alle Songs verwendet; **Nur aktueller Titel** überschreibt den Standard ausschließlich bei dem laufenden Song. Ohne Video erscheint ein dunkler Verlaufs-Hintergrund.
3. Anpassen: Hintergrundfüllung/Zuschneiden, Abdunklung, Blur, **Sättigung, Farbton, Vignette**, Videogeschwindigkeit, Crossfade-Dauer und Bühnen-Vollbild. Unter **Videosynchronisierung** „Freilaufender Loop“ (wie v1.4) oder **„An Songposition koppeln“** wählen. Mit **Video-Versatz** lässt sich die Clipphase für den gewünschten Songmoment um ±10 Sekunden korrigieren.
   In der **Wallpaper-Bibliothek** stehen gespeicherte Videos mit einer sortierbaren Dateiliste, Dateigrößen, automatischen Miniaturbildern bei neuen Imports (bei alten Videos per Klick nachrüstbar), einer einzeln aktivierbaren Videovorschau, Zuweisung als Standard oder zum aktuellen Titel, Einzelexport und bestätigtem Löschen bereit. Die Zuweisung kopiert den Blob samt gewähltem Loop-Bereich und zählt darum als zusätzlicher belegter Slot. **Clip-Editor:** Video anklicken, Start und optional Ende in Sekunden eingeben, „Ausschnitt speichern“ wählen. „Ganzes Video verwenden“ entfernt die Clip-Grenzen. Die Originaldatei wird nicht verändert; der Einzelexport liefert immer das vollständige Video.
4. Unter **Synchronisierte Songtexte** bei laufendem Song eine eigene **`.lrc`-Datei** importieren oder den **integrierten LRC-Editor** aufklappen. Der Editor unterstützt Eingabe/Korrektur, Einfügen einer Zeitmarke an der aktuellen Spotify-Position, Speichern und Export der eigenen Datei. Die aktuelle Zeile wird anhand von Spotifys Positionsangabe im Video hervorgehoben. Schriftgröße, Zeilenanzahl (1/3/5), Position (oben/mitte/unten), Ausrichtung (links/mitte/rechts), Text-/Highlight-Farben, Schatten und Timing-Versatz erlauben ein individuelles Lyrics-Design.
5. Unter **Soundvisualizer** zwischen Balken, Ring, Wellenform und reaktiven Partikeln wechseln; eigene Farbe, Deckkraft und Glow einstellen. Die Effekte bleiben bei ausgeschaltetem Mikrofon unsichtbar.
6. Unter **Eigene Szene für diesen Song** können die aktuellen Video-/Audio-/Lyrics-Regler automatisch an den derzeit laufenden Song gekoppelt werden. Änderungen an der Song-Szene verändern nicht den globalen Stil; beim nächsten Titel werden dessen Szene oder die globalen Einstellungen geladen. Ein Klick auf „Song-Szene entfernen“ stellt die globale Szene wieder her. Maximal 100 Song-Szenen. Unter **Visualizer-Szenen und Presets** eine von drei Vorlagen (Kino, Karaoke, Konzert) verwenden oder bis zu acht eigene Einstellungen speichern. Die Presets ändern weder gespeicherte Videodateien noch LRC-Liedtexte.
7. Für die optische Reaktion bei **Soundvisualizer** ausdrücklich **Mikrofonanalyse starten** klicken. Ohne bewusste Berechtigung wird **kein** Audio erfasst und **kein** Spektrum erfunden. Stoppen oder Verlassen der Seite gibt die Mikrofonspur frei.

**LRC-Beispiel (eigener Text, nicht der Text eines echten Songs):**

```text
[ar:ZuKaTo Demo]
[offset:+100]
[00:05.50]Erste selbst geschriebene Zeile
[00:12.20]Zweite selbst geschriebene Zeile
```

**Aktuelle Grenzen und Datenschutz:** 80 MiB pro Video, maximal 12 Videos und 256 MiB insgesamt; native Wallpaper-Engine-Pakete (`.pkg`) und proprietäre Wallpaper-Engine-Szenenformate werden **nicht** unterstützt; selbstständige HTML-Webprojekte sind ab v1.6 importierbar. Verwende deine eigenen kompatiblen HTML-Webprojekte oder MP4-/WebM-/OGV-Videos; keine Medien sind vorinstalliert. Die Loop-Funktion schneidet nicht physisch und exportiert auch keine Videoclips. Der jeweilige Videocodec muss vom Spotify-Client unterstützt werden. Videos und LRC-Texte liegen lokal in IndexedDB und werden nicht hochgeladen. Die Bibliothek lädt eine Video-Vorschau erst, wenn du einen Eintrag auswählst. Die kleinen JPG-Miniaturbilder liegen getrennt in IndexedDB (bis 120 KiB), werden bei Kopien mitgenommen und bei Löschungen entfernt. Falls der verwendete Videocodec kein Standbild ermöglicht, bleibt die Kachel als Platzhalter sichtbar und der Videoimport funktioniert trotzdem. Temporäre Objekt-URLs werden beim Wechsel wieder freigegeben. Das normale ZuKaTo-JSON-Backup sichert **Visualizer-Einstellungen, eigene Presets und Song-Szenen**, nicht Binärvideos, Vorschaubilder oder LRC-Dateien. Diese Medien vor einem Profilwechsel separat aufbewahren.

Die optionale echte WebAudio-FFT misst **Mikrofon-Audio** (z. B. hörbaren Lautsprecherton), **nicht** Spotifys geschützten digitalen Audiostream; das Mikrofon ist keineswegs eine garantierte Loopback-Lösung. Automatisches Laden des **Original-Songtexts** aus einer zulässigen Lyrics-Quelle ist noch offen. Eine Spicetify-Einbindung mit Lyrics Plus benötigt eine gesondert geprüfte Schnittstelle und Berechtigung; es werden keine internen Spotify-APIs stillschweigend abgefragt. Details in `VISUALIZER_ROADMAP.md`.

**Theme:** Seit v1.8 stehen 24 Presets plus freie HEX-Farbe zur Verfügung. Das Theme-Build-Artefakt `dist/theme/` enthält ein neutrales Grundgerüst. Das Theme-Studio verändert bewusst nur die Custom App, nicht fremde Spotify-Styles oder installierte Drittanbieter-Themes. `tools/install.mjs` installiert darum nur Extension und Custom App, kein globales Spotify-Theme.

## Datensicherung und Privatsphäre

Die Shared-Library verwendet `Spicetify.Platform.LocalStorageAPI` mit `zukato-toolkit.library.v1`. Die Visualizer-Regler werden unter `zukato-toolkit.visualizer.v1`, die Presets unter `zukato-toolkit.visualizer-presets.v1`, individuelle Song-Styles unter `zukato-toolkit.visualizer-track-scenes.v1`, die großen Dateien in der lokalen IndexedDB `zukato-toolkit.visualizer-assets` gespeichert. Einstellungen liegen unter `spotify-toolkit.settings`, die Workspace-Farbe unter `zukato-toolkit.appearance.v1`. Kein eigener Backend-Service, kein Cloud-Upload und keine unsichtbaren Spotify-Bibliothek-Änderungen. Beim **Import** werden vorhandene lokale ZuKaTo-Daten nach Bestätigung ersetzt.

Die JSON-Backupdatei enthält ggf. persönliche Song-Notizen und Hörverlauf. Bewahre sie entsprechend vertraulich auf. Zur Deinstallation zunächst Extension und App via `spicetify config extensions zukato-extension.js-` / `spicetify config custom_apps zukato-workspace-` deaktivieren und anschließend `spicetify apply` ausführen; gespeicherte Daten werden dadurch nicht automatisch gelöscht.

## Build und technische Grenzen

Normalerweise verwendet der Build `esbuild` und `sass`. Falls ein entpacktes `node_modules` von einem **anderen Betriebssystem** stammt (z. B. Windows-`node_modules` unter Linux), kann `esbuild` seine native Binärdatei nicht starten. Hier greift `tools/bundle-fallback.mjs` mit dem lokal installierten TypeScript-Compiler, ohne globale `npm`-Aufrufe. Das ist hauptsächlich für Projektübertragung und Offline-Analyse gedacht: auf dem Zielsystem bevorzugt `npm install` ausführen, um korrekte native Abhängigkeiten zu installieren. Der Fallback erstellt keine Sourcemaps; der normale Build schon. Bei einem Source-Only-Update enthält das ZIP absichtlich keine alten `dist`-Dateien: `npm install` gefolgt von `npm test` baut sie aus den tatsächlichen Quellen neu.

`npm test` umfasst Bundle-Smoke-Tests mit simulierten Spicetify-APIs, Songsession-Reducer-/Lifecycle-Tests und Visualizer-Unit-Tests (LRC-Timing/Editor-Zeitmarken, Bibliothek, Kopien, Medien-Storage, Clip-/Song-Synchronisierung, Song-Szenen, Backup-Normalisierung und Mikrofonfreigabe). Die Source-Unit-Tests verwenden die Node-22-Funktion `stripTypeScriptTypes`. **Ein Lauf unter echtem Spotify/Spicetify ist hiermit nicht ersetzt.** Vor Veröffentlichung sämtliche Features im Zielclient prüfen; besonders Player-Events, Kontextmenüs und die Spotify-Version können sich ändern.

## Kommentar-Konvention

Alle selbst gepflegten TypeScript-, TSX-, MJS-, SCSS-, INI- und Testdateien sind mit **Datei-, Zweck-, Abschnitts- und funktionsbezogenen Kommentaren** versehen. Neue Funktionen sollen ebenso kommentiert werden: Welche Datei? Was tut der Abschnitt? Warum existiert er? Wo wird die Funktion aufgerufen? So sind Änderungen später schnell in VS Code wiederzufinden.

JSON-Dateien, generierte Dateien in `dist/`, installierte Abhängigkeiten in `node_modules/` und Git-Metadaten werden nicht manuell kommentiert. Kommentare in JSON würden das Dateiformat ungültig machen.
