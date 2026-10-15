# ZuKaTo v1.12.0 – Bedienungsabnahme (Entwicklungsstand)

## Grundidee

Der Visualizer soll in erster Linie Musik + HTML-Wallpapers + automatische Lyrics
anzeigen und nicht ständig die gesamte Einstellungsoberfläche. Die neue Version
verschiebt deshalb Einstellungen aus der Hauptansicht in vier Registerkarten.
Dieser Stand ist weiterhin **nicht zur Übernahme freigegeben**: Der Nutzer möchte
vorerst ohne Installation/Commit weiterentwickeln.

## Manuell im echten Spotify-Client zu prüfen (noch NICHT durchgeführt)

1. **Wallpapers:** Den bereits importierten HTML-Ordner öffnen. Neues Lied,
   Skip und Repeat schalten jeweils GENAU ein Wallpaper weiter; innerhalb eines
   Songs wird nicht weitergeschaltet. Neue Ordner beginnen beim nächsten Song
   wieder bei Nummer 1; die angezeigte Nummer muss passen.
2. **Originalclips:** Der Schalter oberhalb der Bühne schaltet ohne Datenverlust
   zwischen eigenen Wallpapers und hinterlegten zulässigen Originalclips um.
   Ohne hinterlegten Originalclip erscheint eine Erklärung (kein erfundener Clip).
3. **Lyrics:** Automatische LRCLIB-Abfrage, Synced-/Plain-Fallback, eigene LRCs,
   Schriftgröße, Textfarbe/Highlight und feine Positionseinstellungen prüfen.
   Nicht erwarten, dass jeder Song beim Drittanbieter verfügbar ist.
4. **Audio:** Effektmodus, optionale Mikrofonfreigabe und Freigabe beim Stoppen
   prüfen. Die Spotify-Roh-Audiodaten sind nicht Teil dieser Schnittstelle.
5. **Kino:** Kinomodus blendet Einstellungsfelder aus, lässt Videobühne und
   Lyrics aktiv und kann mit „Bearbeiten“ wieder verlassen werden.
6. **Responsive:** Kleine Spotify-Fenster und Vollbild kontrollieren.

## Korrekturen / technische Prüfungen

- Neu `src/shared/visualizer-workspace.ts`: reine, testbare Navigation und
  gespeicherter aktiver Tab (nur SessionStorage, sicherer Fallback).
- Haupt-HTML-Ordnerverwaltung ist im Wallpaper-Tab sofort sichtbar;
  ältere Einzelvideo-Werkzeuge sind ausklappbar.
- `src/shared/scene-playlists.ts`: `scenePosition()` als einheitliche Berechnung
  für Wiedergabe und angezeigte Reihenfolge, mit Regressionstests.
- Deutsch/Englisch, Tab-Steuerung und responsives Layout ergänzt.
- `npm test`: 84 von 84 Tests bestanden, inklusive TypeScript und Bundles.
  Der Build nutzte in der Prüfungsumgebung den TypeScript-Fallback, weil die
  kopierten esbuild-Binärdateien für Windows statt Linux gebaut sind.
- Kein Windows-/Spotify-Live-Test in dieser Umgebung möglich.

## Bekannte Grenzen

- Original-Musikvideo-Clips werden **nicht automatisch** über Spotify/Canvas
  geladen. Der Schalter nutzt ausschließlich zuvor rechtmäßig hinterlegte
  direkte HTTPS-Videoquellen.
- Automatisch gefundene LRCLIB-Texte sind Community-Daten und keine garantierten
  vollständigen, offiziell lizenzierten Spotify-Originaltexte.
- Eigene Web-Wallpapers müssen HTML/CSS/JS-Szenen sein. Proprietäre native
  Wallpaper-Engine-Projekte und Internet-Zugriffe aus eingebettetem JavaScript
  sind absichtlich nicht aktiviert.
