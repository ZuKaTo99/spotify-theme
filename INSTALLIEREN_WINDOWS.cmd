@echo off
setlocal
REM =============================================================================
REM Datei: INSTALLIEREN_WINDOWS.cmd
REM Zweck: Ein-Klick-Installation in demselben Ordner, in dem diese Datei liegt.
REM
REM Keine Git-Befehle, keine ZIP-Entpackung und keine Loeschung von Benutzerdaten.
REM Der Node-Installer behandelt selbststaendig ein veraltetes Spicetify-Backup.
REM =============================================================================

REM Unabhaengig davon arbeiten, woher diese Datei gestartet wurde.
cd /d "%~dp0"
if errorlevel 1 goto error

REM Sicherstellen, dass die Batch-Datei im richtigen Projektordner liegt.
if not exist "package.json" (
  echo FEHLER: package.json fehlt. Bitte ZIP-Inhalt direkt ins Projekt entpacken.
  goto error
)

REM 1. Projektabhaengigkeiten anhand von package.json installieren.
echo [1/3] npm install
call npm install
if errorlevel 1 goto error

REM 2. TypeScript, Build und automatische Tests pruefen.
echo [2/3] npm test
call npm test
if errorlevel 1 goto error

REM 3. Extension und Custom App bauen und via Spicetify aktivieren.
REM Bei veraltetem Backup versucht tools/install.mjs genau einmal backup apply.
echo [3/3] npm run install:spicetify
call npm run install:spicetify
if errorlevel 1 goto error

echo.
echo ERFOLG: ZuKaTo wurde gebaut und Spicetify wurde aktualisiert.
echo Spotify ggf. neu starten.
pause
exit /b 0

:error
echo.
echo FEHLER: Installation abgebrochen. Die Fehlermeldung steht oben.
echo Falls noetig: Ausgabe aus diesem Fenster kopieren.
pause
exit /b 1
