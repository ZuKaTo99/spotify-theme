# ZuKaTo v1.12.0 – derzeit nur Entwicklungsstand

**Auf Wunsch noch nicht installieren!** Die Installationsanweisungen unten sind
für eine spätere ausdrückliche Freigabe gedacht. Dieses Archiv enthält keinen
Git-Patch und überschreibt weder eine lokale `.git`-Historie noch persönliche
Wallpaper-Dateien auf der Festplatte.

---

# ZuKaTo v1.11.0 – Entwicklungsstand, derzeit NICHT übernehmen

Der Nutzer behält zunächst die bestehende installierte Version. v1.11.0 enthält alle Änderungen von v1.8 bis v1.10 sowie die automatische Lyrics-Suche. **Kein Git-Commit/Push und keine Installation vor der ausdrücklichen Freigabe.** Die Befehle unten dienen ausschließlich der späteren Referenz.

Beim späteren Test im Spotify-Client: Titel mit synchronisierten Lyrics, Titel nur mit unzeitgesteuertem Text, einen Instrumentaltitel sowie einen nicht gefundenen Titel anspielen. Prüfen, dass Songwechsel keine alten Zeilen anzeigen, dass eigene LRC-Korrekturen Vorrang haben und dass Schriftgröße/Position/Farbe weiterhin einstellbar sind. Bei fehlenden Texten Netzwerk/Provider prüfen; nicht davon ausgehen, dass Spotify selbst Lyrics bereitstellt.

---

# ZuKaTo v1.10.0 – Entwicklungsstand, derzeit NICHT übernehmen

Der v1.10.0-Stand ist aus v1.9.0 entstanden; v1.8.0 muss dafür nicht separat installiert werden. Der Benutzer hat ausdrücklich festgelegt, vorerst keine Version zu übernehmen. Daher sind die folgenden Befehle **nur als spätere technische Referenz** dokumentiert.

Wenn die Freigabe später erfolgt: ZIP-Inhalt direkt im bestehenden Projektordner überschreiben (kein zusätzlicher Oberordner; `.git` und `node_modules` werden nicht mitgeliefert) und bei Bedarf einzeln `npm install`, `npm test`, `npm run install:spicetify` ausführen. Commit und Push erfolgen ausschließlich auf ausdrücklichen Wunsch mit einzelnen Git-Befehlen.

Der aktuelle Build/Unit-Test-Stand ist kein Ersatz für die Spotify-Abnahme auf dem Windows-Rechner.

---

# ZuKaTo v1.8.0 – Windows direkt überschreiben

1. ZIP **direkt in deinen bestehenden `zukato-spicetify`-Ordner** entpacken. Die ZIP hat keinen zusätzlichen übergeordneten Projektordner. `.git` und vorhandene `node_modules` bleiben dabei erhalten.
2. `INSTALLIEREN_WINDOWS.cmd` per Doppelklick starten, oder Git Bash öffnen und die folgenden Befehle **einzeln** ausführen:

```bash
npm install
npm test
npm run install:spicetify
git status -sb
```

Bei Fehlern die exakte Ausgabe ansehen. **Erst nach erfolgreichen Tests/Installation** committen und auf GitLab/GitHub pushen. Keine Verkettungen mit `&&` erforderlich.

---

# ZuKaTo Spicetify v1.7.2 – direkt über deine Installation kopieren

**Ausgangslage:** Dein Projekt baut bereits erfolgreich, aber `spicetify apply` bricht ab mit:
`Spotify version and backup version are mismatched`.

Das ist **kein TypeScript-Fehler** und auch kein fehlendes Spicetify im PATH. Spotify wurde seit dem letzten Spicetify-Backup aktualisiert. Spicetify empfiehlt dafür `spicetify backup apply`.

## 1. ZIP direkt in deinen bisherigen Ordner entpacken

Die ZIP enthält **alle ZuKaTo-Projektdateien direkt im Archivhauptverzeichnis**, also `package.json`, `src/`, `tools/`, `tests/` und `dist/`.

1. Öffne `C:\Users\sakar.birkan\source\repos\zukato-spicetify`.
2. Entpacke den **Inhalt** der ZIP **direkt in diesen Ordner** und bestätige das Überschreiben gleichnamiger Dateien.
3. Die ZIP enthält **kein `.git` und kein `node_modules`**. Deine vorhandene GitLab-Verbindung und installierten Abhängigkeiten werden dadurch nicht angefasst.
4. Du brauchst **keinen** `git apply`-Befehl und **keinen** zusätzlichen Testordner.

Zur Kontrolle muss danach `package.json` die Version **1.7.2** enthalten.

## 2. Installieren (ein Doppelklick oder PowerShell)

**Am einfachsten:** Im Projektordner auf `INSTALLIEREN_WINDOWS.cmd` doppelklicken. Die Datei führt `npm install`, `npm test` und `npm run install:spicetify` aus und stoppt sofort bei einem Fehler.

**Alternativ in PowerShell:**

```powershell
cd "C:\Users\sakar.birkan\source\repos\zukato-spicetify"
npm install
npm test
npm run install:spicetify
```

Der Installer führt die Befehle `spicetify config ...` und anschließend `spicetify apply` aus. **Nur wenn die Spicetify-Ausgabe eindeutig auf ein veraltetes Backup hinweist**, startet er **automatisch genau einmal** `spicetify backup apply`.

Dieser Befehl erstellt das Spicetify-Backup zur aktuell installierten Spotify-Version neu und wendet die vorhandene Konfiguration an. Dadurch muss er nach einem Spotify-Update nicht separat von dir gestartet werden.

## Was, wenn es trotzdem fehlschlägt?

Wenn die automatische Backup-Reparatur selbst fehlschlägt, wird **die echte CLI-Fehlermeldung** angezeigt. Es wird **kein** `restore`, `reset --hard` oder Endlos-Retry gestartet. Gegebenenfalls unterstützt Spicetify deine aktuelle Spotify-Version noch nicht. Ein möglicher nächster manueller Schritt nach Prüfung der Meldung ist `spicetify update`.

Ein bewusstes Abschalten der automatischen Reparatur ist optional möglich:

```powershell
$env:ZUKATO_DISABLE_AUTO_BACKUP = "1"
npm run install:spicetify
Remove-Item Env:ZUKATO_DISABLE_AUTO_BACKUP
```

## Weitere Hinweise

- `Kein -ComputerName übergeben` erscheint schon beim Start von PowerShell, bevor ZuKaTo ausgeführt wird. Diese Meldung stammt nicht aus dem ZuKaTo-Installer.
- `npm audit` meldete zuvor eine separate Sicherheitswarnung. Diese ist nicht die Ursache der Backup-Meldung; bitte nicht ungeprüft `npm audit fix --force` ausführen.
- `npm run doctor` zeigt die Build-Voraussetzungen an. Es ändert keine Spicetify-Dateien.
- Die importierten HTML-Wallpapers, Lyrics und Szenendaten werden durch das Überschreiben **dieser Quellprojektdateien** nicht gelöscht. Die Projekt-ZIP enthält keine Nutzerdatenbanken.

## Umfang und Tests

Die Änderungen in v1.7.2 betreffen primär `tools/install.mjs` und fünf neue Tests der Spicetify-Installation; alle bisherigen Visualizer-Funktionen bleiben im Projekt. In der Entwicklungsumgebung bestanden **56 automatisierte Tests**, davon **fünf Installer-Tests** mit einer simulierten Spicetify-CLI. Ein echter Windows-/Spotify-Test auf deinem Rechner ist weiterhin erforderlich.

Offizielle Spicetify-Hinweise: https://spicetify.app/docs/getting-started
