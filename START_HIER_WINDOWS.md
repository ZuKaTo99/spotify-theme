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
