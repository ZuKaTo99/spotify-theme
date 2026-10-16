# ZuKaTo Spicetify

ZuKaTo ist eine kommentierte Spicetify-Erweiterung mit Workspace, Songverwaltung,
Dashboard, Einstellungen und einem Visualizer für eigene HTML-Web-Wallpapers.

**Entwicklungsstand:** v1.21.0. Der Build und die automatisierten Tests sind
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

## Deine HTML-Wallpapers

- **Ordnerauswahl:** Ein Hauptordner mit mehreren HTML-Projekten importiert
  jedes Projekt als eine eigene Szene, in natürlicher Reihenfolge (`01`, `02`, ...).
- **Ein Projekt:** Seine `index.html` (oder unterstützte alternative Startseite),
  CSS-/JS-Dateien, Unterordner, Bilder, Fonts, 3D- und andere Assets bleiben
  zusammen. Auch Projekte mit `web/index.html` und `assets/` daneben werden
  als *ein* Wallpaper erkannt.
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
- **Originaldarstellung:** Unter Visualizer → Wallpapers ist „Eigene
  Wallpapers in Originalfarben anzeigen“ standardmäßig aktiv – auch für alte
  gespeicherte Konfigurationen. Der Effekt nimmt nur ZuKaTos eigene
  Abdunklung, Unschärfe, Vignette und Farbfilter weg. Die Wallpaper-eigenen
  Licht-/Wettereffekte bleiben erhalten. Der Schalter ist reversibel.
- **Grenzen:** Absolute Dateipfade, externe Internet-Assets, Wallpaper-Engine-
  spezifische APIs, ES-Modulimporte und Web-Worker funktionieren nicht
  generell in der Sandbox. Falls „AUTO: LÄDT…“ im Wallpaper stehenbleibt,
  kann dessen Originalprojekt auch einen blockierten externen Dienst erwarten.

- **Sicherheit:** Eigener JavaScript-Code läuft nur in einem isolierten iframe.
  Keine Spotify-Kontotokens, kein stiller Netzwerkzugriff. Wallpaper-Engine-
  Sonder-APIs, Worker und dynamische JS-Modulimporte sind noch nicht allgemein
  unterstützt; solche Projekte müssen wir gezielt testen. Die neuen lokalen
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
