## v1.12 – UI-Fokus (15. Oktober 2026)

Vier schlanke Visualizer-Panels, Kinomodus, ein Quellenumschalter oberhalb der
Bühne, sichtbarer HTML-Ordnerimport und nachrangige Einzelvideo-Verwaltung.
Playlists und Lied-spezifische Zuordnungen bleiben in ihrer bisherigen
Speicherstruktur erhalten. Der angezeigte Wallpaper-Index wird nun identisch
zur tatsächlichen Startposition berechnet.

**Weiter offen:** automatische rechtmäßige Originalclip-Quelle, lizenzierte
Publisher-Lyrics, robustes Live-Feedback aus dem Spotify-Client und weitere
Kompatibilitätstests echter Wallpaper-Engine-HTML-Projekte.

---

## Aktualisierung v1.11.0 – automatische Lyrics

- **Neu implementiert:** Synchronisierte oder unsynchronisierte Texte automatisch von LRCLIB anhand von Titel, Künstler, Album und Dauer abrufen und in der Visualizer-Ebene anzeigen; Local-LRC hat Vorrang.
- **Wichtig:** LRCLIB ist eine unabhängige Community-Lyrics-Quelle; kein Versprechen, dass alle Originaltexte verfügbar sind oder dass alle Rechte geklärt sind. Quellenattribution, RAM-only-Aufbewahrung, Rate-Limit und kein Bulk-Download sind eingebaut.
- **Noch offen:** Spotify-Live-Prüfung der externen CORS-Verbindung, mögliche alternative ausdrücklich erlaubte/lizenzierte Lyrics-Anbieter, Wort-für-Wort-Karaoke, automatische legale Originalvideo-Ausschnitte und echte Systemaudio-FFT.
- **UI:** Manueller `.lrc`-Editor ist nur noch eine optionale erweiterte Funktion; Design-Regler bleiben zentral.

---

# ZuKaTo – Wallpaper-Visualizer: Architektur & nächste Ausbaustufen

**Stand: 14. Oktober 2026 · Version 1.6.0**

## Produktvision

Ein immersiver visueller Player mit einem eigenen (Wallpaper-Engine-ähnlichen)
bewegten Hintergrund, darüber einer individuell konfigurierbaren, **wirklich**
audioreaktiven Visualisierung und synchronisiertem **Original-Songtext**.
Das Ergebnis soll anstelle eines konventionellen Equalizers eine vollständig
gestaltbare Musikszene sein.

## Jetzt vorhanden (v1.5)

| Ebene | Vorhanden | Speichermedium |
| --- | --- | --- |
| Wallpaper | Ausschließlich eigene importierte Standard-/Song-Videos, Cover/Contain, Blur, Dim, Geschwindigkeit, Vollbild, Crossfades (0–3000 ms), **nicht-destruktive Loop-Ausschnitte**, Songposition-Sync mit Video-Offset (±10 s), Sättigung/Hue/Vignette | IndexedDB |
| Bibliothek | Sortieren, Dateigrößen, JPG-Miniaturbilder, Video-Vorschau nach Auswahl, Kopieren/Zuordnen, Einzel-Export/Löschen | IndexedDB |
| Audio | WebAudio-Analyser: Balken, Ring, Wellenform, reaktive Partikel; selbst wählbare Farbe, Deckkraft, Glow; optionaler Mikrofonstream | Speicher nach Freigabe + Styles in Settings |
| Lyrics | Eigenen `.lrc`-Text importieren/inline bearbeiten, Zeitmarken an aktueller Songposition setzen, lokal exportieren, songbezogen speichern, Timing, Position, Ausrichtung, Farben, Schatten, 1/3/5 Zeilen | IndexedDB + Settings |
| Regler | Video-, Audio- und Lyric-Konfiguration, drei Szenenvorlagen + acht eigene Presets + bis zu 100 Song-spezifische Styles, Deutsch/Englisch | Spicetify LocalStorage |

**Eigene Videos statt Beispiel-Wallpaper:** Nutzer exportieren Videos/Song-Ausschnitte aus Wallpaper Engine oder anderen Editoren als kompatible Videodateien und importieren sie selbst. Das Projekt enthält keine vorgefertigten Wallpaper-Mediendateien. Die neue Clip-Funktion bearbeitet Zeitgrenzen ausschließlich bei der Wiedergabe, nicht den Videoblob.

**Keine Behauptung einer bereits vorhandenen Spotify-Audio- oder Lyrics-Schnittstelle:**
Der v1.5-Analyzer wird über das Mikrofon gespeist. Lyrics stammen nur aus
einer vom Nutzer selbst eingelesenen `.lrc`-Datei.

## Neu v1.6 – verbindlich geklärte Wallpaper-Ordner-Semantik

- Nutzer wählt in **Einstellungen** einen Ordner mit mehreren eigenen HTML-Webwallpapers (`unterordner/index.html` je Projekt). Einmaliger Import, keine automatische Laufwerksüberwachung.
- **Genau eine Szene pro Song:** ein Titelwechsel erhöht den Ordnerindex um eins (inklusive Skip/Repeat); nach dem letzten Wallpaper startet erst der NÄCHSTE Song mit Wallpaper Nummer eins. Während eines Titels bleibt die Szene unverändert und animiert für sich selbst in Endlosschleife.
- Pro Song können eigene Szenen zugewiesen werden. Bei fehlender Song-Zuordnung gilt die alphabetisch-natürliche Hauptordnerliste.
- Globale Einstellung: **Wallpapers AN** zeigt eigene Szenen; **Wallpapers AUS** zeigt ausschließlich hinterlegte Originalclip-URLs; ohne Quelle folgt eine ehrliche Fehlermeldung.
- Originalclips: validierte manuell eingetragene direkte HTTPS-Medien-URLs und freiwilliger JSON-Massenimport. Automatisches Online-Laden von Spotify-Canvas oder urheberrechtlich geschützter Videos ist **nicht** umgesetzt.
- Import: Projektdateien werden lokal in IndexedDB gespeichert, als isolierte iframe-Szene ausgegeben; CSS, JS und lokale Assets werden eingebettet. Wallpaper-Engine-spezifische native Pakete und proprietäre Runtime-APIs werden nicht vorgetäuscht.
- Lyrics: eigene zeitcodierte `.lrc` über dem Wallpaper bereits möglich; automatische lizenzierte Original-Lyrics-Anbindung noch offen.

## v1.7 – Streaming-Lifecycle und Wallpaper-Schnittstelle

- **Implementiert:** Songlaufindex unabhängig von der Visualizer-Seite dauerhaft durch den Extension-Kern verfolgen und in lokalem Speicher halten; bei deaktivierter Extension nur aktive-Tab-Beobachtung als Fallback. Doppelte `songchange`-Events werden reduziert, Seek/Pause schalten nicht weiter.
- **Implementiert:** Playlist-Startanker für neu importierte/umgeordnete Ordner, Sandbox-Vorschau für HTML und Videos, fehlende Dateien erkennbar machen, Unterordner-Assets zuverlässig paketieren.
- **Implementiert:** `zukato:player` als begrenztes, dokumentiertes HTML-Ereignis für eigenentwickelte Animationen; keine Spotify-Interna oder Audio-FFT im Web-Wallpaper. Siehe `HTML_WALLPAPER_API.md`.
- **Weiter offen:** Echter Windows-Spotify-Test von Repeat, Resume, Autoplay, HTML-Sandbox und Decoderverhalten; außerdem lizenziertes Lyrics-Quellsystem, automatische zulässige Originalclips, komplexe Shader/Canvas-API, vollständiger Szenen-Backup-/Restore-Prozess.

## Geplante Reihenfolge

### P1 – Video-Erfahrung (in v1.4 weiter umgesetzt)

- **Umgesetzt:** Crossfade bei Quellwechsel, weiterhin laufender Default bei Songwechsel, Fallback bei Codecfehler, Browser-Vorschau auf Abruf, sortierbare Bibliothek, einzelne Dateien exportieren und zuweisen; keine Uploads.
- **Offen:** MP4/WebM-Codecs, Autoplay, Fullscreen und Speicherverhalten unter Windows im echten Spotify prüfen; optionaler Bulk-Export/Import mit Manifest. JPG-Miniaturbilder für neue Imports und manuelle Migration alter Videos sind umgesetzt. **v1.4:** Start- und Endzeit pro Zuordnung inklusive eigener Preview und Loop, unabhängiger Clip bei Kopien, intakter Originalexport und Migration bestehender Assets ohne DB-Versionserhöhung.

**v1.5:** Optionaler Videopositions-Abgleich mit Playerfortschritt, auch beim Seek. Ein Zeitoffset für Clip-Phasen; kein Frame-/Sample-Lock und keine automatische Beat-Erkennung. Individuelle Song-Styles, CSS-Farbkorrekturen und ein lokaler LRC-Editor ergänzen den Workflow.

### P2 – Synchronisierte Original-Lyrics (rechtmäßig bezogene Quelle)

- Geeigneten offiziellen/lizenzierten Anbieter sowie Nutzungsrechte und Authentifizierung auswählen.
- Provider-Adapter definieren, der zeitcodierte Zeilen liefert; Cache nach Anbieterbedingungen.
- Robust mit instrumentalen Liedern, fehlenden Lyrics und unterschiedlichen Zeilen-/Wortsynchronisationsformaten umgehen.
- Manuelles LRC weiterhin immer als Override erlauben.
- **Nicht** durch inoffizielle Spotify-Endpoints, Umgehung von DRM oder unautorisierte Weitergabe von Texten implementieren.

### P3 – Erweiterte Audio-Visualisierung

- Für Spotify-Digitalaudio steht über die derzeit geprüfte Spicetify-API keine freigegebene Roh-Audioquelle bereit.
- Optionaler, **klar benannter und separat installierter** lokaler Audio-Loopback-Helper für kompatible Plattformen, sofern legal und technisch zulässig.
- Adapter-Schnittstelle für echte Frequenzbins, FFT- und RMS-Werte; automatische Quelle/Fehleranzeige.
- Stil-Editor weiter ausbauen (Partikel, Spectrum-Geometrie, Farben, mehrere Ebenen, Tempo/Reaktionskurven). Erste Lyrics-Stile und Szenen-Presets sind umgesetzt; reaktive Audio-Partikel, Spektrumfarbe, Alpha und Glow sind jetzt ebenfalls integriert.

### P4 – Eigene Wallpaper Engine-Videos importieren

- Direkter Import **gewöhnlicher Videodateien** ist bereits möglich.
- Wallpaper-Engine-`*.pkg`/Szenenpakete sind kein normales Video und werden derzeit **nicht** interpretiert.
- Nutzer erstellen und bearbeiten ihre Videohintergründe selbst; ZuKaTo bietet nur lokalen Import, Songzuordnung, Vorschau und Loop-Zeiten.
- Für weitere Dateiformate zuerst Exportformat und tatsächliche Codec-Unterstützung des Spotify-Chromium-Clients prüfen.
- **Keine vorgefertigten Video-Wallpaper beilegen.**

## Architektur und Schnittstellen

- `src/custom-app/modules/visualizer/Visualizer.tsx`: Player-Events, Lyrics, gemeinsame Regler.
- `src/custom-app/modules/visualizer/WallpaperBackdrop.tsx`: Doppel-Layer-Crossfades und Blob-URL-Cleanup.
- `src/custom-app/modules/visualizer/WallpaperLibrary.tsx`: lokale Dateiliste, Miniaturbilder, Vorschau, Zuordnung und Export.
- `src/custom-app/modules/visualizer/video-thumbnail.ts`: lokale JPEG-Frame-Extraktion mit Timeout und Cleanup.
- `src/custom-app/modules/visualizer/VisualizerPresets.tsx`: Vorlagenwahl und persönliche Presetverwaltung.
- `src/custom-app/modules/visualizer/media-store.ts`: IndexedDB, Größen-/URI-Schranken und nicht-destruktive Videoclip-Metadaten.
- `src/custom-app/modules/visualizer/lyrics.ts`: LRC-Timing, Zeilensuche und Zeitmarken-Formatierung.
- `src/custom-app/modules/visualizer/LyricsEditor.tsx`: lokale Lyrics-Eingabe und Export, kein Provider.
- `src/custom-app/modules/visualizer/video-sync.ts`: reine Clip-/Songposition-Mathematik, auch ohne Spotify testbar.
- `src/custom-app/modules/visualizer/useMicrophoneSpectrum.ts`: WebAudio-Analyser, dynamische Partikel, Farbe/Glow/Alpha, Canvas und MediaStream-Cleanup.
- `src/shared/visualizer-config.ts`: validierte Konfiguration, eventbasierte Aktualisierung, Song-spezifische Styles und Preset-Speicher.
- `src/shared/i18n.ts`: sichtbare Labels in Deutsch/Englisch.
- `tests/visualizer.test.mjs`: Unit-Tests aus dem echten Sourcecode.

**Abnahmeregel:** Lokale Tests und ein erfolgreicher Build bedeuten noch nicht,
dass jede Electron-/Spotify-Version Video, Mikrofonberechtigung und Fullscreen
identisch unterstützt. Die realen Clienttests sind Pflicht.
