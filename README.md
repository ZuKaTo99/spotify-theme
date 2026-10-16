# ZuKaTo Spicetify

ZuKaTo ist eine kommentierte Spicetify-Erweiterung mit Workspace, Songverwaltung,
Dashboard, Einstellungen und einem Visualizer für eigene HTML-Web-Wallpapers.

**Stabilisierungsstand:** v1.26.0. Der Build und die automatisierten Tests sind
prüfbar; die Canvas-, Lyrics- und Audiowiedergabe muss in deinem tatsächlichen
Spotify-Client getestet werden. Es gibt keine mitgelieferten Wallpaper-Videos.

## Installation / Aktualisierung unter Windows

ZIP-Inhalt in den vorhandenen Projektordner kopieren. Bei einer **Aktualisierung**
bleiben alte, in der ZIP nicht mehr vorhandene Dateien zunächst auf der Festplatte;
die bereinigte Dateiliste steht unten. Die `.git`-Daten bleiben erhalten.

Im Projektordner (Git Bash oder PowerShell) jeweils einzeln ausführen:

```bash
npm install
npm test
npm run install:spicetify
```

Benötigt werden Node.js, npm, ein installiertes Spicetify und der Spotify-Desktop-
Client. `npm run doctor` hilft bei Installationsproblemen. Der Build erzeugt
`dist/` automatisch. Ein zusätzlicher Windows-CMD-Installer ist nicht nötig.

## Stabilisierung v1.26.0 (keine neuen Features)

- **Große HTML-Wallpapers:** Hunderte Platzhalter für Bilder, Fonts und
  3D-Assets werden in einem Durchlauf im isolierten iframe ersetzt statt
  die gesamte HTML-Seite für jede einzelne Datei erneut zu kopieren. Dasselbe
  gilt für lokale ES-Modultexte. Das reduziert unnötige CPU-Arbeit beim Start.
- **Blob-Speicher:** Bereits korrekt typisierte Assets erhalten direkt eine
  temporäre Object-URL; es wird nicht nochmals eine zusätzliche Blob-Hülle
  erzeugt. Die ursprünglichen Projektdateien bleiben unverändert.
- **iframe-Lebenszyklus:** Bühne und Vorschau verarbeiten nun ein eindeutiges
  Ready-Signal jedes neuen Bootstrap-Dokuments. Eine erneute Navigation kann
  ihre Dateien erneut bekommen, ohne dass die üblichen doppelten `load`-
  Ereignisse bei `document.write()` alles noch einmal übertragen. Ein Limit
  schützt vor endlosen Neuübertragungen durch fehlerhafte Wallpaper-Skripte.
- **Diagnose:** `npm run doctor` ist wieder ausführbar; der dokumentierte
  Befehl hatte bisher keinen passenden npm-Script-Eintrag.
- **Regression:** Neue Tests führen das tatsächliche Bootstrap-JavaScript mit
  100 Asset-Dateien in einer isolierten JavaScript-Testumgebung aus und prüfen
  mehrere Navigations-/Ladefolgen. Ein echter Spotify-Webview-Test ist dadurch
  weiterhin nicht ersetzt.

## Stabilisierung v1.25.0 (keine neuen Features)

Diese Version führt die Fehlerbereinigung aus v1.24.0 fort. Änderungen:

- **Parallele Video-Uploads:** Das Limit von zwölf Videowallpapers und 256 MiB
  wird innerhalb derselben `readwrite`-IndexedDB-Transaktion geprüft, in der
  Video und Thumbnail gespeichert werden. Zwei gleichzeitig gestartete
  Uploads können die Grenzen nicht mehr gegenseitig umgehen.
- **Clip- und Vorschaubild-Bearbeitung:** Beide Vorgänge prüfen das Original
  innerhalb ihrer Schreibtransaktion. Wird das Video zwischenzeitlich gelöscht,
  kann die Bearbeitung keinen alten Blob wiederherstellen und auch kein
  verwaistes Thumbnail erzeugen.
- **Löschen vollständiger HTML-Projekte:** Die Datenbank sucht sämtliche
  zum Projekt gehörenden Dateien über den `byScene`-Index, statt sich nur auf
  potenziell beschädigte Metadaten zu verlassen. So lassen sich auch verwaiste
  Projektdateien entfernen.
- **Hörverlauf:** Pause/Fortsetzen mit einer neuen internen `playbackId` zählt
  nicht als zusätzlicher Song. Für einen neuen Durchlauf verwendet die Statistik
  den bereits vorhandenen Song-Session-Zähler.
- **Playlist-Rollback:** Wenn die Datenbanklöschung eines Wallpapers scheitert,
  wird neben seiner Playlist-Position auch der bisherige Startpunkt der Liste
  wiederhergestellt, sofern er nicht bereits an anderer Stelle geändert wurde.

Die neuen Regressionstests prüfen konkurrierende Schreibvorgänge, Rollback,
Löschungen trotz beschädigter Daten und Repeat-vs.-Resume-Verhalten.

## Vorherige Stabilisierung v1.24.0 (ohne neue Funktionen)

Der vollständige Quellcode wurde erneut per TypeScript und mit den vorhandenen
Modul-, Settings-, Lyrics-, Audio- und Wallpaper-Regressionstests geprüft.
Konkret behoben wurden:

- Der Szene-Import prüft Anzahl und Gesamtgröße **in derselben** schreibenden
  IndexedDB-Transaktion, in der die Dateien gespeichert werden. Zwei parallele
  Importe können so nicht beide den alten Füllstand als gültig ansehen.
- Beim Stoppen einer Tonfreigabe werden Event-Listener **aller** freigegebenen
  Audio-/Videospuren entfernt. Alte Freigaben greifen dadurch nicht mehr in
  den nächsten Aufnahmevorgang ein.
- Der doppelte Canvas-Neuprüfen-Button ist entfernt.
- Eine absichtlich ausgewählte Song-Notiz wird beim nächsten Player-Trackwechsel
  nicht mehr ungewollt durch den aktuellen Song ersetzt.
- Quellenwechsel, Playlist-Bearbeitung und Szenenlöschung verwenden vor dem
  Speichern den aktuellsten Stand, statt parallele Einstellungen zu überschreiben.
  Bei fehlgeschlagener Löschung wird die ursprüngliche Position restauriert.
- Eine fehlschlagende JSON-Backup-Wiederherstellung versucht den zuvor
  gespeicherten Zustand aller kleinen Einstellungsblöcke zurückzusetzen.
  Da lokaler Browser-Storage nicht transaktional ist, wird ein gescheiterter
  Rollback ausdrücklich gemeldet; Medien-Dateien sind davon unberührt.

**Offene Integrationsthemen:** Native Spotify-Canvas-Videos sind nicht immer
als separate URL zugänglich. Der interne Lyrics-Dienst und externe Quellen
liefern nicht zuverlässig alle Songs. Digitale Audioanalyse benötigt weiterhin
eine vom Desktop-Client tatsächlich bereitgestellte, freigegebene Tonspur.
Proprietäre Wallpaper-Engine-JavaScript-APIs können ohne passende Originalprojekte
nicht pauschal unterstützt oder als funktionsfähig abgenommen werden.
Automatisierte Tests können diese Spotify-/Wallpaper-Engine-Live-Abnahme nicht ersetzen.

## Deine HTML-Wallpapers

- **Nur Ordnerimport für HTML:** Einzelne `index.html`-Dateien können nicht
  mehr importiert werden, weil sonst CSS, JavaScript, Bilder und andere Assets
  fehlen. Wähle den **vollständigen Wallpaper-Ordner** oder einen Sammelordner
  mit mehreren eigenständigen Wallpaper-Unterordnern aus. Bereits früher
  gespeicherte Ein-Datei-Wallpapers bleiben weiterhin abspielbar.
- **Ordnererkennung:** Eigenständige Unterordner werden in natürlicher
  Reihenfolge (`01`, `02`, ...) zu einzelnen Szenen. `web/index.html` und
  benachbarte `assets/`, `fonts/`, `js/` gehören dagegen zum selben Projekt.
  Bei gemeinsam genutzten Dateien außerhalb mehrerer eigenständiger Projekte
  wird der Import kontrolliert abgelehnt, statt Dateien still auszulassen.
- **Wallpaper-Engine `project.json`:** Das Feld `file` wird als HTML-Startseite
  ausgewertet. Defekte, fremde oder fehlende Pfade werden vor der Speicherung
  abgelehnt; es wird keine zufällige HTML-Unterseite gestartet.
- **Ein Projekt:** Seine `index.html` (oder unterstützte alternative Startseite),
  CSS-/JS-Dateien, Unterordner, Bilder, Fonts, 3D- und andere Assets bleiben
  zusammen. Auch Projekte mit `web/index.html` und `assets/` daneben werden
  als *ein* Wallpaper erkannt.
- **Validierung:** Ein kompletter Sammelordner wird vor dem Schreiben auf
  fehlende Einstiege, doppelte oder unsichere Dateipfade und Größenlimits
  überprüft. Die Dateien selbst bleiben unverändert; ein fehlgeschlagener
  Datenbankimport darf keine teilweise neue Bibliothek erzeugen.
- **Wiedergabe:** Pro neuem Song genau das nächste Wallpaper. Nach dem letzten
  beginnt die Liste mit dem nächsten Song wieder bei Wallpaper 1.
- **Grenzen:** Höchstens 1.024 Dateien und 256 MiB je Projekt, bis zu 128 Szenen
  und maximal 2 GiB Bibliothek. Ob tatsächlich so viel gespeichert werden kann,
  hängt zusätzlich vom lokalen Chromium-/Windows-Speicher ab.
- **Speicherung:** Größere Projekte werden als einzelne Original-Blobs in
  IndexedDB abgelegt. Der ZIP-Export erhält die Dateien samt relativen Pfaden.
  Das JSON-Einstellungsbackup enthält **nicht** die großen Originaldateien.
- **Wiedergabe großer Webprojekte (v1.20 korrigiert):** HTML, CSS und JavaScript
  werden für die isolierte Ansicht vorbereitet. Große Bilder, Fonts und weitere
  Medien werden als Blobs übergeben und erhalten ihre temporären URLs erst
  **innerhalb des Sandbox-iframes**. Damit umgeht ZuKaTo eine Browser-Sperre,
  die parent-seitige Blob-URLs für isolierte iframes unzugänglich macht. Auch
  `srcset`-Bilder und lokale CSS-Imports mit einfachen Media Queries werden
  nun aufgelöst. In v1.20 wurde ein Fehler in der Hauptbühne behoben:
  Die Bühne benutzte zuvor das fertige HTML statt des Bootstrap-Dokuments,
  deshalb wurden die Assets im Player nicht initialisiert, obwohl die
  Bibliotheksvorschau funktionierte. Nach Szenenwechsel entlädt das iframe
  seine Ressourcen.
- **Dynamische lokale Projektdateien (v1.21):** JavaScript kann relative
  Konfigurations- und Mediendateien zur Laufzeit über `fetch()` oder
  `XMLHttpRequest` laden. Auch dynamisch zugewiesene `img.src`-, Video-/Audio-
  `src`-Attribute und `setAttribute("src", ...)` werden für vorhandene lokale
  Dateien aufgelöst. Optional gibt `zukatoWallpaperAssetUrl(relativePath)`
  eine sichere lokale Blob-URL zurück. Fehlende Dateien und JavaScript-Fehler
  werden im Visualizer angezeigt, ohne lokale Dateipfade zu übertragen. **Es
  werden keine externen Netzwerkverbindungen freigeschaltet.**
- **Lokale JavaScript-Module (v1.22):** Eigene Web-Wallpapers dürfen
  `<script type="module" src="js/main.js">` verwenden. Lokale statische
  `import`-/`export ... from`-Pfade und literale dynamische `import("./x.js")`
  werden als Import-Map innerhalb der Sandbox aufgelöst. Das funktioniert
  auch über Unterordner und mit zyklischen Modulbeziehungen. Klassische
  Skripte bleiben unverändert. Der Modulcode erhält keinen direkten Zugriff
  auf die Spotify-Oberfläche.
- **Originaldarstellung:** Unter Visualizer → Wallpapers ist „Eigene
  Wallpapers in Originalfarben anzeigen“ standardmäßig aktiv – auch für alte
  gespeicherte Konfigurationen. Der Effekt nimmt nur ZuKaTos eigene
  Abdunklung, Unschärfe, Vignette und Farbfilter weg. Die Wallpaper-eigenen
  Licht-/Wettereffekte bleiben erhalten. Der Schalter ist reversibel.
- **Grenzen:** Absolute Dateipfade, externe Internet-Assets, Wallpaper-Engine-
  spezifische APIs und Web-Worker funktionieren nicht generell in der
  Sandbox. Dynamisch BERECHNETE Modulpfade und externe/bare Paketimporte
  (z. B. `import "three"` ohne lokale Importzuordnung) sind noch nicht
  allgemein unterstützt. Falls „AUTO: LÄDT…“ im Wallpaper stehenbleibt,
  kann dessen Originalprojekt auch einen blockierten externen Dienst erwarten.

- **Sicherheit:** Eigener JavaScript-Code läuft nur in einem isolierten iframe.
  Keine Spotify-Kontotokens, kein stiller Netzwerkzugriff. Wallpaper-Engine-
  Sonder-APIs, Worker sowie berechnete oder externe JS-Modulimporte sind
  noch nicht allgemein unterstützt; solche Projekte müssen wir gezielt testen. Die neuen lokalen
  `fetch()`-/XHR-Zugriffe sind **keine** Internetfreigabe. Die Browserprüfung
  testete eine Beispielszene in Chromium, nicht deine echten Wallpaper-Ordner.

### Schnittstelle für eigene HTML-Animationen

Eine HTML-Szene kann `window.addEventListener('zukato:player', ...)` verwenden.
`event.detail` enthält `playing`, `positionMs`, `durationMs` und `run` (Song-
Durchlaufnummer). Nur die ausdrücklich verfügbaren Werte verwenden; es handelt
sich **nicht** um eine Spotify-Audioanalyse.

```js
window.addEventListener('zukato:player', (event) => {
  const { playing, positionMs, durationMs, run } = event.detail;
  document.body.classList.toggle('paused', !playing);
  // Hier bei Bedarf die eigene Animation aktualisieren.
});
```

## Canvas, Lyrics und Audio

- **Originalclip statt Wallpaper:** ZuKaTo versucht Spotifys bereits im Client
  sichtbaren Canvas anzuzeigen; falls keine zugängliche Quelle existiert, bleibt
  das Albumcover. Spotify bietet keine dokumentierte öffentliche Canvas-Web-API.
- **Lyrics:** Lokale Korrekturen, nach Möglichkeit synchronisierte Spotify-
  Lyrics und LRCLIB als Fallback. Nicht für jeden Song garantiert; der
  Spotify-interne Dienst ist versionsabhängig.
- **Audioeffekte:** Kein Mikrofon zwingend nötig. Im Visualizer zuerst
  **System-/Tab-Audio** wählen und, falls der Dialog dies anbietet, die
  Audiofreigabe aktivieren. Nur bei tatsächlich freigegebener Tonspur
  werden Frequenzen analysiert. Falls der Spotify-Desktop-Client keine
  System-Audiofreigabe unterstützt, kann ein aktiviertes Windows-Loopback-
  Gerät (z. B. Stereo Mix) oder ein Mikrofon als Audioeingang helfen. ZuKaTo
  besitzt keinen offiziellen direkten Spotify-PCM-Audiozugang und zeigt
  ohne Audiodaten keine erfundenen Frequenzen.

Über **Visualizer → Verbindung prüfen** lassen sich Medienfehler ohne private
Song- oder Accountdaten diagnostizieren.

## Projektaufbau

| Pfad | Aufgabe |
|---|---|
| `src/` | Quellcode mit ausführlichen Datei-/Abschnitts-/Funktionskommentaren |
| `tools/` | Build, Diagnose und Spicetify-Installation |
| `tests/` | Automatische Regressionstests; für die Weiterentwicklung behalten |
| `dist/` | Generierter Build, beim nächsten `npm run build` neu erstellt |
| `package.json` / `package-lock.json` | Nötige npm-Konfiguration |
| `tsconfig.json` / `.gitignore` | TypeScript- und Git-Konfiguration |

Die alten `TESTPLAN_V1.*.md`, `REVIEW_V1.12.md`, `PROJECT_STATUS.md`,
`VISUALIZER_ROADMAP.md`, `START_HIER_WINDOWS.md`, `HTML_WALLPAPER_API.md`
und `WALLPAPER_PROJECT_COMPATIBILITY.md` sind **nicht für den Betrieb nötig**.
Ihre wesentlichen aktuellen Hinweise stehen jetzt hier; die alten Dateien sind
nicht mehr Bestandteil der neuen Projekt-ZIP.

Hinweis: Der Library-Ordner „Wallpaper Engine“ war bei der letzten Prüfung leer
bzw. nicht mit zugänglichen Beispieldateien gefüllt. Die Import-Tests verwenden
deshalb realitätsnahe Testprojekte, nicht deine Originalprojekte.

Bei lokalen ES-Modulen unterstützen wir bewusst kein npm-Paketmanagement im
Wallpaper-Player. Externe Bibliotheken müssen als lokale Dateien im Projekt
vorliegen; die tatsächliche Kompatibilität größerer 3D-Frameworks ist noch
nicht garantiert.
