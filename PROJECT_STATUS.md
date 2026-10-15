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

# ZuKaTo v1.11.0 – Lyrics automatisch statt manuell (unveröffentlicht)

**Status:** Arbeitsstand auf Basis der nicht übernommenen v1.10.0; der Nutzer möchte ausdrücklich weiterhin nichts installieren, überschreiben, committen oder pushen. Die v1.8-/v1.9-/v1.10-Änderungen sind enthalten.

## Implementierung

- **Automatische LRCLIB-Abfrage pro Song-URI:** Songtitel, erster Künstler, Album und Laufzeit werden als Metadaten an die öffentliche CORS-API gesendet; keine Nutzer-Accounts oder Spotify-Tokens.
- **Synced vor Plain:** Zeitmarkierte Texte werden auf der Video-/HTML-Bühne über dem Wallpaper passend zur Spotify-Position hervorgehoben. Ohne Timing scrollbarer Text statt erfundener Zeitwerte.
- **Lokale Überschreibungen:** Bereits importierte bzw. selbst korrigierte `.lrc`-Dateien bleiben wirksam und gehen dem Netzwerk vor. Import und Editor sind in den erweiterten Optionen verborgen, aber verfügbar.
- **Weniger Netzlast:** 400-ms-Anfrageabstand, Abbruch bei Songwechsel, HTTP-429-`Retry-After`, RAM-Cache mit Ablaufzeit und Limit; kein persistentes Kopieren von Community-Lyrics in Datenbanken/Backups.
- **Fehlerzustände:** Laden, instrumental, keine Treffer, Provider-/Netzwerkfehler, Rate-Limit, Wiederholen und Quellenangabe. Deutsch und Englisch vorhanden.
- **Gestaltung unverändert:** Schriftgröße, Ausrichtung, Position, Shadow, Farbe, Highlight, Zeilenanzahl und Timing-Offset weiterhin individuell einstellbar. Das visuelle Overlay bleibt getrennt von HTML-Wallpapers und Mikrofon-Canvas.

**Rechtehinweis:** LRCLIB ist ein externer Community-Anbieter, keine lizenzierte offizielle Spotify-Lyrics-API. Es ist noch zu prüfen, ob dieser Anbieter für den späteren konkreten Veröffentlichungs-/Verwendungszweck rechtlich geeignet ist. Die Software speichert automatisch geladene Texte nur kurz im RAM. **Originalvideos werden weiterhin nicht automatisch bezogen.**

**Abnahme:** 77/77 automatisierte Node-Tests (davon 7 neue Lyrics-Tests), TypeScript 5.8.3 und Fallback-Build erfolgreich. Echte LRCLIB-Verfügbarkeit **im Spotify-Webview**, Darstellung, Quellrecht und Windows-Installation **noch nicht live geprüft**. Keine Behauptung einer vollständigen Spotify-Live-Abnahme.

---

# ZuKaTo v1.10.0 – konsolidierter Workspace (noch nicht übernommen)

**Status:** Entwicklungs-/Abnahmestand auf Grundlage von v1.9.0. Alle Änderungen aus v1.8.0 und v1.9.0 sind enthalten. Der Benutzer möchte aktuell ausdrücklich **keine Installation und keinen Git-Commit**.

## Was neu und anders ist

- **Zentrale Song-Schnellaktion:** Von jeder Workspace-Seite aus eine Suchansicht per „Song hinzufügen“ oder `Ctrl+Shift+F` öffnen. Spotify-Titel-/Künstlersuche und eingefügte Spotify-Links ermöglichen direktes Merken oder Hinzufügen zur Queue. Keine Spotify-Likes werden verändert; Favoriten sind lokale ZuKaTo-Lesezeichen.
- **Navigation:** Nach Musik, Gestaltung und System gruppiert. Der zuletzt geöffnete Bereich wird nur für die aktuelle Browser-Sitzung gemerkt; nach Deaktivierung eines Moduls wird sicher auf Dashboard/Einstellungen zurückgefallen.
- **Dashboard:** echte Fortschrittsanzeige des Spotify-Players einschließlich Zeitstempel; zentrale Song-Schnellaktion und bisherige Favoriten, Shortcuts, Cover, lokaler Verlauf und Statistiken.
- **Einstellungen:** Neue Übersicht als Standard mit Originalclip-Ein/Aus direkt sichtbar, vier Schaltflächen zu den eigentlichen Bereichen sowie kompakte Zahlen zum lokalen Speicher. Alle erweiterten Formulare bleiben erreichbar, aber sind nicht auf der Startansicht verstreut.
- **Datenkonsistenz:** `addFavorite` ist idempotent, sodass versehentliche Wiederholungen nicht mehr zwischen Speichern und Entfernen wechseln. Vorhandene `toggleFavorite`-Aktionen für ausdrücklich gewünschtes Entfernen bleiben unverändert.
- **Barrierefreiheit:** Dialog hat Fokus, Escape-Schließen, Hintergrund-Klick-Schließen und Tab-Fokusring. Navigation nutzt weiterhin `aria-current`.
- **UI:** Konsistente responsive Styles und respektierte Einstellung für reduzierte Animationen. Deutsch/Englisch komplett ergänzt. Alle neuen/geänderten Bausteine haben Dateikopf- und Logik-Kommentare.

## Technische Grenzen

- Spicetify-Integration und Darstellung sind **noch nicht in einem echten Spotify-Client getestet**.
- Song-Suche greift ausschließlich über `Spicetify.CosmosAsync` auf die Spotify-Web-API zu; Verfügbarkeit hängt vom angemeldeten Client ab. Die eigene Queue nutzt `Spicetify.addToQueue`.
- Original-Musikvideos werden **nicht automatisch bezogen**; bei eingeschaltetem Modus sind nur vorher gespeicherte erlaubte Quellen nutzbar. Offizielle bzw. nachweislich lizenzierte Original-Lyrics sind weiterhin offen; ab v1.11 gibt es eine unabhängige LRCLIB-Abfrage als Komfortfunktion.
- Hörverlaufszahlen stehen für beobachtete Songwechsel, nicht für Spotifys vollständige Hörstatistik.

**Prüfung:** `npm test`: 70/70 Unit-/Smoke-Tests erfolgreich; Typprüfung/Styles/Bundles über den plattformunabhängigen Fallback gebaut. Es sind fünf neue Tests für Zeitberechnung, Navigation, Session-Fallback und Favoriten-Idempotenz hinzugekommen. Echte Windows-/Spotify-Abnahme ausstehend.

**Paket:** Vollständige Dateien im ZIP-Stammverzeichnis, ohne `.git` und `node_modules`; inklusive neu erstelltem `dist`. Eine spätere Übernahme würde die bestehende Projektstruktur überschreiben, ohne die Git-Historie zu ersetzen. Noch keine Übernahme empfohlen, bis der Nutzer die Vorschau beurteilen möchte.

---

# ZuKaTo v1.9.0 – UX-Überarbeitung (Teststand)

**Ausgangslage:** Der Nutzer hat v1.8.0 bewusst noch nicht übernommen. v1.9.0 enthält deshalb alle v1.8.0-Funktionen UND die neue Oberfläche. Das Archiv ist ein vollständiges direkt überschreibbares Projekt, kein Git-Patch.

**Neu und überarbeitet:**

- Dashboard als echte Startseite mit Live-Wiedergabestatus, aktuellem Titel, Spotify-Cover (nur validierte CDN-URLs), Play/Pause, Skip und ZuKaTo-Favoritenaktion.
- Dashboard-Schnellzugriffe öffnen direkt die entsprechenden Module; deaktivierte Module werden ausgeblendet. Lokale Kennzahlen, zuletzt gehörte Titel und häufigster Künstler sind klar von vollständigen Spotify-Streamingstatistiken abgegrenzt.
- Einstellungen in fünf Bereiche gegliedert: **Allgemein**, **Wallpapers**, **Module**, **Tastenkürzel**, **Daten & Backup**. Nur ein Bereich ist jeweils sichtbar.
- Originalclip-Quellenwahl im Einstellungsbereich als einzelner Ein-/Ausschalter. Wallpaper-Verwaltung ist bei Bedarf aufklappbar; importierte Medien, Szenen und Clips bleiben erhalten. Kein automatischer Originalclip-Download.
- Modulübersicht zeigt zuerst Ein/Aus; Namen und Sortierung liegen in aufklappbaren erweiterten Optionen. Pflichtmodule bleiben gesperrt.
- Theme-Studio zeigt neben den 24 Palettenfarben und eigener HEX-Farbe eine echte Mini-Vorschau des ZuKaTo-Layouts.
- Einheitliche Abstände, Oberflächen, Schaltflächen und responsive Ansichten auf engem Spotify-Fenster.
- Der neue Dashboard-Summary-Algorithmus und Cover-URL-Filter sind isoliert und per Unit-Tests überprüfbar. Neue/überarbeitete Dateien sind kommentiert.

**Prüfstand:** TypeScript 5.8.3 (global) erfolgreich; Projekt-Bundles mit dem vorhandenen Offline-Fallback erstellt; Sass-Styles kompiliert; automatisierte Tests einschließlich neuer Dashboard-/Settings-Tests erfolgreich. Wegen in dieser Umgebung nicht passender plattformspezifischer npm-Binaries wurde der Offline-Fallback genutzt. Ein echter Windows-/Spotify-Live-Test und die tatsächliche Oberflächenabnahme sind weiterhin offen.

**Wichtig:** Bestehende Daten, Wallpaper-Dateien und Zuordnungen werden nicht gelöscht, migriert oder stillschweigend überschrieben. Offline-Build und Tests ersetzen keinen echten Spotify-Test.

**Windows-Installation:** ZIP-Inhalt direkt in den bestehenden Projektordner entpacken, vorhandene Projektdateien überschreiben, `.git` und `node_modules` unangetastet lassen. Danach wie bisher `npm install`, `npm test`, `npm run install:spicetify` bzw. `INSTALLIEREN_WINDOWS.cmd`. Vor der Übernahme des neuen Standes zuerst in Spotify prüfen; keine Git-Aktionen durch die ZIP.

---

# ZuKaTo v1.8.0 – Projektstatus

**Neue Oberfläche:** Songsuche (Favoriten, Queue, Notizen), 24 Theme-Farben plus HEX-Eingabe, Originalclips nur noch per Schalter.

**Prüfstand dieser Bearbeitung:** Quellsyntax und gezielte Offline-Unit-Tests ausgeführt. TypeScript-Gesamtcheck, vollständiger npm-Build, die übrigen bestehenden Projekttests und Spotify-Live-Test konnten in der Entwicklungsumgebung ohne installierbare npm-Abhängigkeiten nicht wiederholt werden und müssen auf Windows mit `npm test` bestätigt werden.

**Installationsart:** ZIP-Inhalt direkt in den bestehenden Projektordner entpacken und Dateien überschreiben; `.git` und `node_modules` werden nicht mitgeliefert. Anschließend `INSTALLIEREN_WINDOWS.cmd` oder `npm install`, `npm test`, `npm run install:spicetify`. Änderungen an Git werden nicht automatisiert.

**Offene Originalvideo-Funktion:** Ein/Aus-Umschalter ist vorhanden, automatischer lizenzierter Originalclip-Abruf nicht. Alte Clip-URLs bleiben gespeichert.

---

# ZuKaTo – Projektstand / zielgerichtete Weiterentwicklung

**Stand:** 14.10.2026 – v1.7.0, persistenter Songzähler, HTML-Player-Bridge und Wallpaper-Vorschau.

## Implementiert

- Vollständiger und erreichbarer Workspace-Router, Start auf dem Dashboard
- Module: Dashboard, Hörverlauf, lokale Auswertung, Favoriten, Warteschlange, Player-Monitor, Notizen, Akzentfarben
- Einstellungen, bestehende Shortcut-Konfiguration, Feature-Management, JSON-Backup und -Import
- Extension: Tastenkürzel, Sleep-Timer, Volume-Scroll, Clipboard, Queue-Aktionen, Mini-Player, Tracking, Kontext-Lesezeichen
- Persistenz-Layer mit defensiver Datennormalisierung und 500/250/250 Datengrenzen
- Responsives Workspace-CSS, Deutsch/Englisch für neue Workspace-Module
- Wallpaper-Visualizer v1.2: Video-Bühne, Song-/Standard-Wallpaper aus IndexedDB, vollbildfähiger Hintergrund mit Blur/Dim/Fit/Speed, LRC-Overlay mit Offset und lokale Konfiguration
- Video-Szenensteuerung: 0–3000-ms-Crossfade, alter Video-Layer bleibt sichtbar bis zum ersten Frame, Error-Fallback, gleiche Standarddatei startet bei Songwechsel nicht erneut, Blob-URL-Cleanup
- Non-destruktiver Video-Ausschnitt-Editor: frei gewählter Start/Ende-Loop pro Song/Default ohne Rekodierung, Clip-Metadaten folgen beim Kopieren und alte Dateien bleiben lesbar; Originalexport unverändert. Nur selbst importierte Wallpaper-Videodateien, keine vorgefertigten Medien.
- Lokale Wallpaper-Bibliothek: Metadaten, Größen, Sortierung, Einzelexport und bestätigt gelöschte Zuordnungen; bei neuen Imports kleine JPG-Miniaturbilder (≤120 KiB) in separaten IndexedDB-Datensätzen, bei v1.2-Dateien nachträglich generierbar; Decoderfehler verhindern den Video-Import nicht
- Lyrics-Design: Position, Ausrichtung, Zeilenanzahl, Highlight-/Textfarbe und Schatten, alles mit Settings-Migration und validierten Hexfarben
- Visualizer-Presets: drei eingebaute Szenen (Kino, Karaoke, Konzert), acht speicherbare eigene Szenen, anwenden/löschen, Backup-Unterstützung
- Optionales echtes Mikrofon-FFT-Spektrum: Equalizer/Ring/Wave/reaktive Partikel inklusive anpassbarer Farbe, Deckkraft und Glow (KEIN Spotify-Rohaudio), explizite Freigabe mit Track- und AudioContext-Cleanup
- Importvalidierung und Quotas: 80 MiB/Video, 12 Videos, 256 MiB gesamt, LRC bis 250 KiB
- Visualizer-Regler, eigene Presets und Song-Szenen im ZuKaTo-JSON-Backup; Videos, Miniaturbilder und LRC-Dateien bewusst ausgeschlossen
- v1.5 Song-Video-Synchronisierung: Optionaler Positionsabgleich anhand von Spicetify.Player (auch bei Seek/Trackwechsel), frei einstellbarer Zeitversatz von ±10 Sekunden, Clipgrenzen weiterhin nicht-destruktiv. Mit Seek-Toleranz und Schutz gegen Loop-Grenz-Oszillation; keine echte Audio-Sample-Synchronität.
- v1.5 Song-spezifische Visualizer-Szenen: bis zu 100 eigene Styles pro Song mit automatischem Fallback auf globale Einstellungen und Preset-Anwendung im richtigen Scope. Settings-Backup um Song-Szenen ergänzt.
- v1.5 Design-Extras: Video-Farbton, Sättigung und Vignette als reine CSS-Effekte, unabhängig von Lyrics und Audio-Layer.
- v1.5 integrierter LRC-Editor: eigene Texte editieren, Zeitmarken aus Playerposition einfügen, LRC speichern/exportieren; keine fremden Songtexte abrufen.
- Build der Custom App, Extension und des Theme-Gerüsts; Offline-Fallback für fremde `node_modules`-Plattformen
- Node-Smoke-Tests für die gebündelten Entry Points, Titelwechsel, dedupliziertes Tracking und Lifecycle-Cleanup

## v1.6 – neuer Funktionsumfang

- HTML-Wallpaper-Ordner (auch mehrere `index.html`-Projekte je Hauptordner) in einem validierten Sammelimport; CSS/JS/Bilder werden projektbezogen gepackt und die gesamte Sammlung in einer IndexedDB-Transaktion gespeichert.
- Ein Wallpaper je Spotify-`songchange`; kein Timer für den Szenenwechsel. Die Liste springt mit dem **nächsten** Song nach ihrem Ende an den Anfang zurück (Modulo). Songzuordnungen überschreiben die globale Reihenfolge.
- Ein/Aus-Schalter direkt in **Einstellungen** und im Visualizer. Ausgeschaltet: direkt hinterlegte erlaubte Online-Originalclips statt eigener HTML-Wallpapers; ohne Quelle wird klar darauf hingewiesen.
- Pro Song manuelle HTTPS-MP4/WebM/OGV-Links und optionaler JSON-Massenimport. Kein automatischer Spotify-/Canvas-/YouTube-Download.
- HTML-Viewer benutzt iframe-Sandbox ohne `allow-same-origin` und restriktive CSP; eigene Animationen benötigen keine Spotify-Roh-Audioberechtigung. Lyrics bleiben ein separates LRC-Overlay.
- Szenenbibliothek: bis zu 128 Assets/512 MiB, ein HTML-Webprojekt höchstens 64 Dateien/12 MiB. Keine vorinstallierten Wallpapers, keine Änderungen an den Quelldateien.

## v1.7 – neuer Funktionsumfang

- Persistenter, unabhängiger Titel-/Durchlaufzähler im Extension-Kern mit Fallback-Beobachter in der Custom App. Lokale Speicherung, Deduplizierung von wiederholten Player-Events, Seek-/Pause-Unterscheidung, kontrollierte Listener-/Timer-Abmeldung. **Ohne echte Spotify-Integration ist die Repeat-Erkennung noch separat zu verifizieren.**
- Ordner-Playlist mit speicherbarem Startanker: Neue oder neu sortierte Listen richten sich auf den nächsten Songwechsel aus, anstatt an einem alten globalen Index zu beginnen; v1.6-Daten werden ohne Umstellung geladen.
- `zukato:player` im isolierten HTML-iframe: nichtprivate Wiedergabeparameter für selbst erstellte JavaScript-Wallpapers. Dokumentation und Beispiel in `HTML_WALLPAPER_API.md`.
- HTML-Verpacker: relative Pfade in CSS- und JavaScript-Unterverzeichnissen inkl. CSS `url(...)` ohne Anführungszeichen.
- HTML-/Video-Vorschau, Speicherbelegung und Hinweise auf fehlende Zuordnungen in der Szenenbibliothek. Blob-URLs werden beim Schließen wieder freigegeben.
- Neue Tests für mehrfach eintreffende Events, Repeat, Seek, Wiederherstellung, Pfadauflösung und Playlist-Anker zusätzlich zu bisherigen Smoke-Tests.

## Bewusst nicht als bereits erledigt dargestellt

- **Spotify-Live-Tests:** Ohne lokal laufenden, installierten Spotify-Client nicht ausführbar. Insbesondere CSS-Klassen, Kontextmenü- und Player-Events müssen im Zielclient validiert werden.
- **Vollständiger Spotify-Hörverlauf:** Dafür sind andere Spotify-Schnittstellen / Datenexporte nötig. Der Recorder misst neue lokale Track-Ereignisse.
- **Spotify-Digitalaudio:** Kein gesicherter Zugriff auf Roh-Audio durch die verwendete Spicetify-API. Die neue echte FFT verarbeitet ausschließlich einen explizit genehmigten Mikrofonstream, nicht den Spotify-Audiostream.
- **Dauerhafte Spotify-Playlist-Änderungen:** Die aktuellen Werkzeuge verändern bewusst nur die Warteschlange. Playlist-Management benötigt zusätzliche API- und Berechtigungsprüfung.
- **Original-Lyrics und Wallpaper Engine:** LRC-Import funktioniert; HTML-Wallpaper-Engine-Webprojekte sind importierbar. Automatische lizenzierte Lyrics, native Wallpaper-Engine-Szenenpakete (`.pkg`), proprietäre HTML-APIs, Videodownloads und zuverlässige digitale Audio-Loopback-Quellen sind NICHT implementiert. Crossfades, Miniaturbilder und Presets sind dagegen bereits umgesetzt.
- **Plattformübergreifender Installer:** `tools/install.mjs` ist weiterhin speziell für Windows; macOS/Linux benötigen einen separaten Installer.

## Sinnvolle gezielte Abschlussabnahme im echten Spotify

1. ZuKaTo per `npm run install:spicetify` installieren, Spotify öffnen.
2. Jede Workspace-Seite öffnen, Favorit und Song-Notiz speichern, Spotify neu starten, Persistenz verifizieren.
3. Aufnahme von Titelwechseln und korrekte Statistik prüfen; bei Deaktivierung von `player-statistics` darf nichts mehr aufgezeichnet werden.
4. Profileinträge (Sleep-Timer/Mini-Player/Clipboard) und Titel-Kontextmenüs testen; Menü- und Player-Events nach Spotify-Updates überprüfen.
5. Tastenkürzel einschließlich Eingabefokus testen; sicherstellen, dass Scrollrad nur am Lautstärkeregler eingreift.
6. Export/Import auf einer Testinstallation prüfen und einen Feature-Toggle im laufenden Client ausprobieren.
7. MP4/WebM-Wallpaper im echten Spotify einlesen, Play/Pause/Skip, Video-Codec, Fullscreen und das IndexedDB-Speicherquota prüfen; Crossfade, Miniaturbilder, Clip-Loop von z. B. 12–28 s, originale Exportdatei und Bibliotheksvorschau kontrollieren.
8. Eigenes .lrc dem Song zuordnen; Editor öffnen, eigene Zeitmarke setzen, speichern und exportieren; Lyrics-Offset kontrollieren.
9. Test mit selbst importiertem Clip (z. B. 12–28 s): Freilaufender Loop vs. Song-Sync, Song-Seek um 30 s, Pause, Fortsetzen und ±5 s Video-Versatz prüfen. Bei Video-Codecs und Seek-Verhalten gibt es je nach Client Unterschiede.
10. Zwei Titel mit verschiedenen songbezogenen Szenen speichern, wechseln und beim dritten Song den globalen Fallback prüfen. Preset in Song-Szene anwenden, globale Szene darf unverändert bleiben. Mikrofon-Permission/Stop testen.

Die implementierte v1.7-Grundlage ist **code- und buildseitig testbar**. Der Gesamtumfang des Wunsch-Visualizers ist bewusst noch nicht abgeschlossen; Spotify-spezifische Live-Abnahme und die in `VISUALIZER_ROADMAP.md` aufgeführten Ausbaustufen bleiben offen.

---

## Hotfix v1.7.1 (14.10.2026)

- Windows/Node.js-24-Fix: `tools/bundle-fallback.mjs` benötigt kein `npm root -g` mehr; TypeScript wird direkt aus `node_modules` verwendet.
- Spicetify-Installer startet Windows-`.cmd`-Programme über die System-Shell, statt sie direkt an `execFileSync` zu übergeben.
- Neuer, rein lesender Diagnosebefehl `npm run doctor`; optionaler Fallback-Test mit `ZUKATO_FORCE_FALLBACK=1`.
- Alle 51 Projekttests unter Linux (Node.js 22/TypeScript 5) erfolgreich, auch bei explizit aktiviertem Fallback.
- **Nicht geprüft**: echter Windows-/Node.js-24-/TypeScript-7-Build und Live-Betrieb in Spotify.
- **Separat offen**: npm-audit-Befund mit hoher Severity, bis das betroffene Paket exakt ermittelt wurde.

Siehe [START_HIER_WINDOWS.md](START_HIER_WINDOWS.md) für eine sichere Installation ohne Überschreiben der GitLab-Arbeitskopie.


## Installer-Fix v1.7.2 (15.10.2026)

- `spicetify apply` kann nach einem Spotify-Update mit "Spotify version and backup version are mismatched" scheitern.
- Der Installer wertet die konkrete Spicetify-Ausgabe aus und führt **nur bei erkanntem Backup-Mismatch** automatisch genau einmal `spicetify backup apply` aus.
- Berechtigungsprobleme, fehlende CLI und andere Fehler werden nicht fälschlich als Backup-Problem behandelt. Keine Restore-/Reset-Aktionen.
- Windows-CLI-Aufruf ohne `shell: true` verhindert den Node.js-24-Warnhinweis DEP0190 für Shell-Argumente.
- Neue `tests/installer.test.mjs` prüft fünf Fälle: normaler Apply, Backup-Mismatch, Fremdfehler, Fehler bei Backup-Erstellung und bewusst deaktivierte Reparatur.
- Gesamt: 56/56 automatische Tests mit simulierten Spicetify-Kommandos; Windows-Live-Test bleibt offen.
- Die ZIP ist für direktes Entpacken in den **bestehenden** ZuKaTo-Projektordner ausgelegt (ohne `.git`/`node_modules`).
