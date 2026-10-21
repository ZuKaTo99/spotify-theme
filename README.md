# ZuKaTo Spicetify

Kommentierte Spicetify-Erweiterung mit Workspace, Songverwaltung und einem
Visualizer für eigene **vollständige HTML-Wallpaper-Projekte**. Stand: **v1.60.0**.

Die automatischen Tests prüfen den Quellcode und seine Browser-Sandbox. **Nicht
alle Funktionen sind im echten Spotify-Desktop-Client abgenommen:** Insbesondere
Canvas-Quellen, Spotify-interne Lyrics, digitale Audioanalyse und spezielle
Wallpaper-Engine-JavaScript-APIs bleiben abhängig vom Client bzw. Originalprojekt.

## v1.60.0 – Ausgewählte Songs in Spotify-Playlists übertragen

- **Neue Playlist-Funktion:** Markierte Favoriten oder Hörverlaufs-Titel lassen sich
  direkt in eine **bestehende** Spotify-Playlist übertragen. Unter „Playlist-Werkzeuge“
  können alternativ alle lokalen Favoriten ausgewählt werden.
- **Ziel angeben:** `spotify:playlist:<22 Zeichen>` oder offizieller
  `https://open.spotify.com/playlist/...`-Link. Keine Fremdserver-Links.
- **Vor dem Speichern:** Bestätigungsdialog, klare Meldungen bei ungültigen Links,
  Doppelklick-Sperre und verständlicher Bericht über Teilfehler.
- **Große Sammlungen:** Spotify erhält maximal 100 Titel pro API-Anfrage in
  Originalreihenfolge. Doppelte/ungültige URIs werden übersprungen. Nach einem
  API-Fehler gibt es bewusst keine automatische Wiederholung (Duplikatrisiko).
- **Berechtigungen:** Der angemeldete Spotify-Client muss das Hinzufügen zu dieser
  Playlist erlauben. Fehlen Playlist-Schreibrechte, wird eine Fehlermeldung
  angezeigt. Der direkte Spotify-Client-Praxistest steht noch aus.
- **Unverändert:** Nebula Engines, Visualizer, Presets, lokale Bibliothek.

## v1.59.0 – Favoriten und Hörverlauf gemeinsam bearbeiten

- **Sichtbare neue Funktionen:** Titel einzeln per Checkbox markieren, die aktuelle Seite
  oder alle Suchtreffer wählen und die Auswahl über mehrere Seiten behalten.
- **Favoriten:** Markierte Titel nach Bestätigung gesammelt entfernen oder in der
  ursprünglichen Reihenfolge zur Spotify-Warteschlange hinzufügen.
- **Hörverlauf:** Mehrere Titel auf einmal als Favoriten speichern oder einreihen;
  mehrfach gehörte Titel werden bei diesen Aktionen nur einmal verarbeitet.
- **Sicherheit:** Höchstens ein geprüfter Bibliotheks-Schreibvorgang pro Sammelaktion.
  Bestehende Favoriten werden bei Erreichen der Grenze von 250 nicht verdrängt.
  Die Spotify-Queue nutzt weiterhin 25er-Blöcke ohne riskante automatische Retries.
- **Bedienung:** Tastaturbedienbare Checkboxen, lokale Übersetzungen, Statusmeldungen,
  Teilerfolg bei API-Fehlern und Schutz gegen Doppelklicks.
- **Unverändert:** Visualizer, Wallpaper Engines, Presets und alle gespeicherten Daten.

## v1.58.0 – Zuverlässiger Sleep-Timer auch bei Player-Ausfällen

- **Deadline bleibt erhalten:** Falls Spotify beim Ablauf die Pause-Aktion synchron ablehnt oder ein Promise zurückweist, wird der Timer nicht mehr vorzeitig gelöscht.
- **Kontrollierter Wiederholungsversuch:** Nach einem Player-Fehler erfolgt der nächste Pause-Versuch frühestens nach fünf Sekunden. Fokus-/Sichtbarkeitsereignisse dürfen diese Wartezeit nicht umgehen.
- **Schutz bei Timerwechseln:** Ein verspätetes Ergebnis eines alten Pause-Aufrufs kann keinen inzwischen neu gestarteten oder abgebrochenen Timer löschen. Stop entfernt alle geplanten Retries. Ein vorübergehender Storage-Lesefehler beim Modul-Neustart löscht eine noch im Arbeitsspeicher bekannte Deadline nicht.
- **Regressionstests:** Synchroner Player-Fehler, asynchrone Ablehnung, parallele Timeränderung und Modul-Shutdown werden in der echten Modul-Runtime nachgestellt. Visualizer und Wallpaper bleiben unverändert.

## v1.57.0 – Robuste Kontextaktionen und Lautstärke-Steuerung

- **Einheitliche Spotify-IDs:** Die Lesezeichen- und Kopier-Menüs akzeptieren nur gültige 22-stellige Titel-/Episoden-IDs. Offizielle `open.spotify.com`-Links werden in dieselbe URI umgewandelt. Alben und Playlists werden nicht versehentlich übernommen.
- **Zwischenablage:** Wenn die moderne Browser-Clipboard-API nicht verfügbar ist, wird ein kontrollierter DOM-Fallback versucht. Er entfernt sein temporäres Eingabefeld, stellt den Fokus wieder her und meldet Erfolg erst nach tatsächlich bestätigtem Kopiervorgang.
- **Lautstärke per Mausrad:** Keine ungültigen Werte (`NaN`) mehr; Browser-Zoom, Fremdscrollen und schon behandelte Events bleiben unangetastet. Ausfälle der Spotify-Player-API werden abgefangen.
- **Regressionstests:** Die echten Kontextmenü- und Wheel-Callbacks werden mit simulierten Spotify- und Browser-APIs ausgeführt. Visualizer und Wallpaper-Dateien wurden nicht verändert.

## v1.56.0 – Sichere Workspace- und Kontextaktionen

- Die Aktion „Merken“ im Hörverlauf ist idempotent: Ein bereits gespeicherter Favorit wird nicht mehr versehentlich entfernt.
- Dashboard, Favoriten, Hörverlauf und Spotify-Kontextmenü zeigen Storage-Fehler an, ohne einen Erfolg vorzutäuschen. Ein fehlgeschlagenes Löschen setzt auch die Seitennavigation nicht zurück.
- Aktionen in Titellisten fangen synchrone und asynchrone Ausnahmen ab. Fehlermeldungen sind lokalisiert.
- Extension-Meldungen funktionieren auch, wenn Spotifys Einstellungs-Storage nicht erreichbar ist.
- Bestehende Daten, Visualizer und Nebula Engines bleiben unverändert.

## v1.55.0 – Schutz lokaler Sammlungen bei Storage-Ausfällen

- Mutationen an Favoriten, Hörverlauf und Song-Notizen brechen bei einem fehlgeschlagenen Lesezugriff ab, statt die Daten durch eine leere Sammlung zu ersetzen.
- Backup-Export und Rollback-Vorbereitung verwenden einen strikten Speicherzugriff; fehlgeschlagene Exporte werden angezeigt.
- Favoriten-Aktionen lesen ihre Daten nur noch einmal pro Änderung und behandeln Speicherfehler sichtbar.

## v1.54.0 – Konfliktfreie Änderungen der Moduleinstellungen

- **Schnelle Moduländerungen:** Beim Aktivieren, Deaktivieren, Umbenennen oder Sortieren eines Moduls
  wird vor dem Speichern der aktuell persistierte Stand eingelesen. Zwei Aktionen
  vor dem nächsten React-Render überschreiben sich dadurch nicht mehr.
- **Tastenkürzel:** Aufnahme, Entfernen und Wiederherstellen prüfen die zuletzt
  gespeicherten Belegungen – nicht nur den Stand beim Öffnen der Einstellungsseite.
  Dadurch bleiben parallele Änderungen erhalten und neue Konflikte werden erkannt.
- **Regressionen:** Drei Laufzeitprüfungen führen echte TSX-Eventhandler aus,
  darunter zwei Änderungen ohne dazwischenliegenden Render-Zyklus.
- **Unverändert:** Wallpaper, Visualizer, Presets, Nebula Engines und vorhandene Daten.

## Große Titelsammlungen (v1.49.0)

- Favoriten und der komplette lokale Hörverlauf sind nach Titel, Künstler und Album durchsuchbar.
- Jeweils 40 Einträge pro Seite; bis zu 250 Favoriten und 500 Verlaufseinträge bleiben erreichbar.
- Suche und Blättern verändern keine Songdaten. Nach dem Löschen passt sich die Seitenzahl an.
- Beschädigte Backup-Einträge verdrängen beim Import keine gültigen Datensätze mehr.

## Kontextmenü-Warteschlange (v1.47.0)

- **Einheitliches Verhalten:** Die Rechtsklick-Aktion „Zur Warteschlange hinzufügen“
  verwendet nun dieselbe getestete 25er-Batchlogik wie die Playlist-Seite.
  Auch große Mehrfachauswahlen werden der Reihe nach statt als unbegrenzte
  Einzelanfrage gesendet.
- **Doppelklickschutz:** Die synchron gesetzte Single-Flight-Sperre verhindert
  parallele Aktionen, auch wenn Spotify dasselbe Kontextmenü zweimal auslöst.
  Sie bleibt bei einem Modul-Neustart bis zum Ende einer laufenden Aktion aktiv.
- **Fehler und Teilerfolge:** Ungültige URIs werden nicht gesendet. Bei Fehlern
  stoppt der Versand sofort; bestätigte Titel und übersprungene Einträge werden
  getrennt gemeldet. Es gibt keine automatischen Wiederholungsversuche, da
  diese ungewollte Duplikate erzeugen könnten.
- **Tests:** Sieben neue isolierte Laufzeittests prüfen Batchgrößen,
  Reihenfolge, gemischte Auswahlen, Doppelklicks sowie Erfolgs-/Fehlerpfade.
- **Unverändert:** Wallpaper, Visualizer, Presets und die Nebula Engines.
  Im Projektarchiv liegen weiterhin keine zusätzlichen TXT-Berichte.

## Schnellaktionen und Suche (v1.46.0)

- **Keine doppelten Aktionen:** Ein sofortiges Single-Flight-Lock schützt die
  Schnellaktionen und alle Treffer-Aktionen bei einem Doppelklick, noch bevor
  React die deaktivierten Buttons gerendert hat.
- **Eindeutiger Fortschrittszustand:** Während einer Aktion im Schnellfenster
  sind auch dessen Suchaktionen gesperrt; nach Erfolg oder API-Fehler werden
  alle Aktionen wieder freigegeben.
- **Modulwechsel:** Wenn die Titelsuche geschlossen wird, werden laufende
  Suchanfragen für die alte Ansicht entwertet. Verspätete API-Antworten können
  daher keine veralteten Treffer zurückschreiben.
- **Regressionen:** Acht neue Tests prüfen Doppelklicks, Fehler, Freigabe und
  die Integration der Sperre. Wallpaper, Visualizer und Presets bleiben unberührt.
- **Paket:** Keine gesonderten `.txt`-Berichte oder -Anleitungen im ZIP.

## Warteschlange und Playlist-Werkzeuge (v1.45.0)

- **Schutz vor Mehrfachklicks:** Während einer Queue-Aktion sind die Eingabe,
  die Suche und alle Queue-Schaltflächen gesperrt. Ein unmittelbar gesetzter
  Ref verhindert doppelte Queue-Requests vor dem nächsten React-Render.
- **Große Favoritenlisten:** Titel und Episoden werden in geordneter Reihenfolge
  in Blöcken von maximal 25 Einträgen über `Spicetify.addToQueue` eingereiht.
  Auf Wunsch mehrfach ausgewählte Titel bleiben mehrfach erhalten.
- **Spotify-API-Fehler:** Nach einem fehlgeschlagenen Block wird nicht automatisch
  erneut gesendet, damit keine doppelten Queue-Einträge entstehen. Bei vorherigen
  erfolgreichen Blöcken wird die bestätigte Anzahl angezeigt. Ein unbestätigter
  fehlgeschlagener Block kann von Spotify trotzdem angenommen worden sein.
- **Ungültige Einträge:** Ungültige Spotify-Links/URIs werden übersprungen und
  ausdrücklich gemeldet, statt stillschweigend ignoriert zu werden.
- **Tests:** Isolierte Tests für Blockgrenzen, Reihenfolge, leere Auswahl,
  Teilfehler, Duplikate und den Queue-Bedienzustand.
- **Release-Hygiene:** Keine gesonderten TXT-Prüfberichte oder TXT-Anleitungen im
  ZIP; die notwendigen Installationsinformationen stehen in dieser README.

## Song-Notizen und Schnellaktionen (v1.44.0)

- **Schutz für ungespeicherte Notizen:** Änderungen werden während der Bearbeitung
  zusätzlich im *sessionStorage* dieses Spotify-Tabs gesichert. Nach Song- oder
  Modulwechsel lässt sich derselbe Entwurf weiterbearbeiten. **Erst der Button
  „Speichern“ schreibt dauerhaft in die ZuKaTo-Library.**
- **Eindeutiges Verwerfen:** Der neue Button „Entwurf verwerfen“ entfernt nur den
  Entwurf des ausgewählten Songs, nicht die bereits gespeicherte Notiz.
- **Speicherfehler:** Bei fehlgeschlagenem Library-Schreibzugriff bleibt der
  Entwurf erhalten und die UI zeigt eine Fehlermeldung statt falschem Erfolg.
- **Importierte Daten:** Eine inzwischen extern aktualisierte Notiz wird nicht
  stillschweigend von einem älteren Entwurf verdeckt. Beim Verlassen des
  Spotify-Tabs (Sitzungsende) laufen Entwürfe aus – nicht als Backup verstehen.
- **Schnellaktionen:** Das Fenster „Song hinzufügen“ zeigt bei Songwechsel auch
  ohne erneutes Öffnen den aktuell spielenden Titel; der Listener wird beim
  Schließen entfernt.
- **Regressionen:** Zehn neue Tests für Entwurfswechsel, Speicherausfall,
  Datenvalidierung und Event-Lifecycle. Der Visualizer und beide Nebula Engines
  bleiben unverändert.

## Mini-Player und Tastenkürzel (v1.43.0)

Dieses Update baut ausschließlich auf dem getesteten v1.42.0-Spotify-Projekt
auf. **Nebula Engines, Visualizer, Audiofreigaben und gespeicherte Presets bleiben
unverändert.**

- **Mini-Player im Sichtbereich:** Dragging wird nun an allen vier Kanten
  begrenzt. Nach Änderung der Fenstergröße wird die aktuelle Position erneut
  geprüft; bei kleinen Viewports bleibt das Panel erreichbar. Die Breite passt
  sich dabei der vorhandenen Fläche an.
- **Mini-Player-Lifecycle:** Ein extern aus dem DOM entferntes Panel lässt sich
  beim erneuten Öffnen neu aufbauen; Resize-Listener werden beim Modul-Stopp
  wieder entfernt. Ziehen mit Rechtsklick ist nicht mehr möglich.
- **Tastenkürzel:** Globale Player-Shortcuts lösen nicht in normalen Eingaben,
  ARIA-Textfeldern oder verschachtelten Shadow-DOM-Editoren aus. Bereits von
  Spotify oder der Shortcut-Aufnahme behandelte Keydowns bleiben unangetastet.
  Verlorene Modifier-Keyup-Ereignisse können nicht dauerhaft alte Modifier
  als gedrückt markieren.
- **Regressionstests:** Acht neue isolierte Tests und ein optionaler echter
  Chromium-Test für Mini-Player-Dragging, Resize, erneutes Öffnen und Cleanup.

**Testgrenze:** Die neue UI-Logik ist im Browser geprüft, nicht in einem
live installierten Windows-Spotify-Client.

## Modul-Wiederherstellung und Kontextaktionen (v1.42.0)

Dieses Update setzt auf dem funktionierenden Spotify-Stand v1.41.0 auf.
Die bestehenden Wallpaper-/Nebula-Engines, der Visualizer, gespeicherte
Presets und die funktionierende Audiobrücke wurden nicht geändert.

- **Individuelle Modul-Retries:** Wenn sich ein Zusatzmodul wegen einer noch
  nicht verfügbaren Spotify-API nicht registrieren kann, bereinigt der
  Modulmanager den angefangenen Start und versucht ihn nach 0,5 / 1 / 2 / 4 / 8 / 16
  und maximal 30 Sekunden erneut. Andere Module laufen unabhängig weiter.
- **Sauberer Shutdown:** Wird ein Modul deaktiviert oder Spotify geschlossen,
  entfernt der Manager auch seine *ausstehenden* Wiederholungs-Timer.
  Ein späterer Retry darf kein abgeschaltetes Modul wieder aktivieren.
- **Kontextmenü-Auswahl:** Bei einer gemischten Auswahl wird nur eine gültige
  Spotify-Track- bzw. Episoden-URI gemerkt oder kopiert. Das Menü bietet die
  Aktion nicht mehr für ungültige URI-Formate an. Die Queue verwendet
  dieselbe strikte Prüfung.
- **Tests:** Zehn neue isolierte Tests prüfen echte Modul-Laufzeitfunktionen,
  Backoff, Cleanup, Mehrfachauswahlen und einen kaputten Modul-Stopp.

**Noch offen:** Die Windows-Spicetify-Laufzeit und die native Build-Toolchain
müssen weiterhin auf deinem Rechner getestet werden. Automatisierte Tests
können nicht garantieren, dass jede Spotify-Clientversion identisch reagiert.

## Startzuverlässigkeit und Dashboard-Performance (v1.41.0)

Dieses Update basiert auf dem funktionierenden v1.40.0 und ändert nur das
Spotify-Projekt, nicht die beiden Nebula Engines oder deine Wallpaper-Presets.

- **Spotify-Start:** Die Erweiterung überprüft die tatsächliche Verfügbarkeit
  der benötigten Player-/Storage-Methoden. Wenn eine Spotify-API beim Start
  vorübergehend ausfällt, wird der begonnene Start bereinigt und mit einem
  gedeckelten Retry-Abstand erneut versucht. Beim Schließen werden alle
  ausstehenden Retry-Timer entfernt; es bleiben keine Zombie-Starts zurück.
- **Song-Session-Lifecycle:** Registrieren von Player-Listenern und Einrichten
  des 1-Hz-Sicherheitsnetzes sind jetzt ein gemeinsamer Startvorgang. Fehler
  hinterlassen keinen halbfertigen Song-Session-Tracker.
- **Dashboard:** Der sichtbare laufende Fortschrittsbalken bleibt sekündlich.
  Bei Pause prüft er höchstens alle drei Sekunden, in ausgeblendeten Fenstern
  alle vier Sekunden. Songwechsel, Play/Pause und Rückkehr in Spotify werden
  weiterhin unmittelbar verarbeitet. Identische Fortschrittswerte lösen
  keine zusätzliche React-Aktualisierung aus.
- **Regressionstests:** Acht neue isolierte Tests decken verzögerte Spotify-
  APIs, wiederholte Startfehler, Shutdown, Listener-Cleanup und Dashboard-
  Aktualisierungsregeln ab.

**Grenzen:** Ein Test im echten Spotify-Client unter Windows ist weiterhin
sinnvoll, da die Startreihenfolge der Client-APIs zwischen Versionen variieren
kann. Audiofreigabe, Visualizer, Szenen-IDs und gespeicherte Einstellungen
wurden nicht verändert.

## Langzeitstabilität von Sleep-Timer und Hörverlauf (v1.40.0)

Dieses Update setzt auf dem getesteten v1.39.0-Projekt auf und verändert **nur
ZuKaTo Spicetify**. Visualizer, Audioberechtigung, Nebula Engines, Wallpaper-
Presets und die bestehende Effektspeicherung bleiben technisch unverändert.

- **Sleep-Timer im Leerlauf:** Ohne aktive Deadline werden überhaupt keine
  wiederkehrenden Timer mehr angelegt. Während eines Countdowns erfolgt die
  Prüfung höchstens einmal pro Minute und spätestens beim Ablauf; beim
  Rückwechsel zu Spotify wird eine nach Standby verpasste Deadline sofort
  geprüft. Dadurch sinkt die typische Hintergrundarbeit von 3.600 auf
  höchstens 60 Deadline-Prüfungen pro Stunde bei laufendem Timer.
- **Gespeicherter Timer:** Sowohl numerische als auch als String gespeicherte
  Deadlines werden wiederhergestellt. Ungültige Werte oder nicht zugänglicher
  Storage legen das Sleep-Timer-Menü nicht mehr lahm.
- **Hörverlauf:** Der zuletzt tatsächlich protokollierte Songdurchlauf wird
  ebenfalls lokal gespeichert. Ein Modul-Neustart oder ein Aus-/Einschalten
  der Statistik während desselben Songs führt nicht mehr automatisch zu einem
  doppelten Hörverlaufseintrag. Ein neuer Song-Session-Index wird erfasst.
- **Cleanup:** Sämtliche neu geplanten Timeouts sowie Sichtbarkeits-/Fokus-
  Listener werden beim Deaktivieren des Moduls entfernt.
- **Tests:** `tests/long-session-modules-v140.test.mjs` prüft die echten
  Modul-Funktionen mit simuliertem Spotify inklusive Standby, Neustart,
  Timeouts, Speicherfehlern und ausbleibender Doppelzählung.

**Grenzen:** Der Live-Test im echten Spotify-Desktop-Client und eine belastbare
CPU-/RAM-Messung auf Windows bleiben separat notwendig. Die Tests prüfen die
Laufzeitlogik, nicht den Zustand deines persönlichen Spotify-Profils.

## Lange Sitzungen und Hintergrundbetrieb (v1.39.0)

Dieses Update betrifft ausschliesslich ZuKaTo Spicetify. Die bereits
funktionierenden Nebula Engines, gespeicherten Szenen und Audioberechtigungen
bleiben unveraendert.

- **Player-Updates:** Bei sichtbarer laufender Wiedergabe bleibt die gewohnte
  250-ms-Aktualisierung erhalten. Im sichtbaren Pausezustand wird sie auf 1 s,
  im Hintergrund auf 2 s reduziert. Spotify-Song- und Pause-Events sowie die
  Rueckkehr in den Tab aktualisieren den Zustand trotzdem sofort.
- **Song-Session:** Die fortlaufende Session-Persistenz bleibt bestehen, aber
  unveraenderte URI-/Songlauf-Werte loesen nicht mehr jede Sekunde ein
  zusaetzliches React-Update fuer die gesamte Visualizer-Seite aus.
- **Lyrics-Fallback:** Die Spotify-DOM-Vorschau wird nur gelesen, wenn Lyrics
  aktiviert und weder synchronisierte noch unformatierte Lyrics verfuegbar sind.
  Im ausgeblendeten Tab entfällt der DOM-Scan; bei Rueckkehr wird aktualisiert.
- **Spotify Canvas:** Hintergrund-Tab fuehrt keine wiederholte Canvas-DOM-Suche
  aus. Bei Sichtbarkeit wird die Suche umgehend wieder aufgenommen.
- **Tests:** Reine Regeln fuer Poll-Intervalle, Songlauf-Gleichheit und
  Fallback-Lyrics sowie Integrations-Vertraege mit Event-/Timer-Cleanup
  sind in `tests/runtime-polling-v139.test.mjs` dokumentiert.

**Grenze:** CPU-/RAM-Verbrauch und Lebensdauer muessen auf dem Windows-System
mit laufendem Spotify gemessen werden. Automatische Tests ersetzen das nicht.
Der hier verwendete lokale Compiler ist TypeScript 5.8.3; die Projektdatei
fordert TypeScript ^7.0.2. Nach `npm ci` ist die erneute Pruefung mit der
installierten Version daher wichtig.

## Performance und Speicherverbrauch (v1.38.0)

Dieses Update veraendert **nur ZuKaTo Spicetify**. Die beiden Nebula Engines
und bestehende Wallpaper-Presets aus v1.36 bleiben unveraendert.

- **Audio-Canvas:** Wenn Spotify pausiert, das Visualizer-Overlay ausgeschaltet
  ist oder die Spotify-Ansicht im Hintergrund liegt, werden unnoetige
  `requestAnimationFrame`-Aufrufe beendet. Beim Weiterlaufen bzw. Sichtbarwerden
  startet die Darstellung mit derselben Audiofreigabe erneut.
- **Buffer-Recycling:** `getByteFrequencyData()` und die Wellenformzeichnung
  nutzen pro aktiver Freigabe wiederverwendbare `Uint8Array`-Puffer anstatt
  bei jedem Frame bzw. Audio-Tick neue Byte-Arrays anzulegen.
- **Wallpaper-Audio:** Die Verbindung uebertraegt bei pausiertem Player oder
  fehlender Audiofreigabe ein Stillepaket und startet **keinen** leerlaufenden
  20-Hz-Timer. Bei Musik + aktiver Freigabe bleiben 20 Aktualisierungen pro
  Sekunde bestehen. Der iframe-Start erhaelt weiter das Initial-/Replay-Paket.
- **Automatische Tests:** Testfaelle fuer die Performance-Regeln, das
  erneute Starten nach Tab-Wechseln und vorhandene Visualizer-/Wallpaper-
  Regressionen wurden ausgefuehrt. Audioaufnahme aus Spotify und
  Windows-Installation bleiben separat im Desktop-Client zu testen.

## Update-Sicherheit und Rollback (v1.37.0)

Mit v1.37.0 wurde **nur der Spotify-Workspace** verändert; beide funktionierenden
Nebula-Engine-Projekte aus v1.36 bleiben unverändert.

- **Behoben:** Der Installer löschte früher den bisherigen Custom-App-Ordner
  vor dem Kopieren. Bei Kopier- oder Spicetify-Fehlern konnte die letzte
  funktionierende Version verloren gehen. Nun werden Extension und Custom-App
  zunächst vollständig in temporäre Nachbarordner kopiert, anschließend
  einzeln ausgetauscht und bei fehlgeschlagener Konfiguration oder `apply`
  wiederhergestellt. Andere Spicetify-Erweiterungen werden nicht angefasst.
- **Behoben:** Ein fehlgeschlagener Bundle-/Sass-Build löschte früher den
  bisherigen `dist/`-Ordner. Der neue Build entsteht vollständig separat.
  Das letzte Build bleibt bis zum erfolgreich abgeschlossenen Austausch erhalten.
- **Hinweis:** Falls Spicetify selbst während `apply` Änderungen am Spotify-
  Client bereits durchgeführt hat, ersetzt das Rollback die ZuKaTo-Dateien,
  jedoch nicht automatisch interne Spotify-Dateien oder geänderte CLI-Konfig.
  In diesem seltenen Fall Fehlerursache korrigieren und `spicetify apply`
  erneut ausführen. Das eigentliche Anwenden kann nur unter Windows getestet
  werden.
- **Tests:** 195 Spotify-Tests bestanden (davon neue Installations- und
  Rollback-Fälle), TypeScript-Prüfung und portabler Build erfolgreich.
  Zusätzlich wurde ein absichtlich fehlerhafter SCSS-Build in einer isolierten
  Projektkopie ausgeführt: `dist/` blieb dabei unverändert.
- **Bestehendes Verhalten:** Visualizer, Speichereinstellungen, Szenen-IDs,
  Play-/Pause-/Skip-Steuerung und Nebula-Audiobridges wurden nicht verändert.

## Installieren / Aktualisieren (Windows)

Entpacke das vollständige Spotify-ZIP in deinen Workspace; die vorhandene
Installation und deine gespeicherten Wallpaper-Szenen nicht löschen.
Auch für v1.50.0 müssen die beiden Nebula-Wallpaper-Quellprojekte **nicht** neu
importiert werden. Die zuvor funktionierenden Szenen bleiben bestehen.

```bash
npm ci
npm run check
npm test
npm run install:spicetify
```

Die Befehle **einzeln** ausführen. `npm run doctor` überprüft die Entwicklungs-
und Installationsumgebung. `dist/` wird automatisch erzeugt; `node_modules/`
gehört nicht in das Release-ZIP. Es gibt keinen zusätzlichen Windows-CMD-Installer.

## Wallpaper-Ordner importieren

1. Visualizer öffnen und den Bereich **Wallpapers** wählen.
2. Den **vollständigen Projektordner** importieren, niemals nur `index.html`.
3. Bei Sammelordnern die angelegte Szenenliste und Reihenfolge prüfen.
4. Für ein Projekt im Manager die Vorschau öffnen und danach im Player testen.

ZuKaTo kopiert die Dateien in seine lokale IndexedDB, verändert aber **keine**
Originaldateien auf der Festplatte. HTML, CSS, JS, Bilder, Fonts, Modelle und
verschachtelte Asset-Ordner gehören zusammen. Der Einstieg kann `index.html`
oder eine in `project.json` angegebene HTML-Datei sein. Mehrere getrennte
Wallpaper im Sammelordner können einzeln importiert werden. Der Ordnerimport
ist die einzige reguläre HTML-Importfunktion; ältere schon gespeicherte
Einzel-HTML-Szenen bleiben lesbar.

**Grenzen:** bis zu 1.024 Dateien und 256 MiB je HTML-Projekt, insgesamt
begrenzt durch IndexedDB und Browser-Quota. Manche externen Ressourcen,
proprietären Wallpaper-Engine-APIs, Web-Worker, berechneten Modulimporte und
nicht auflösbaren npm-Pakete funktionieren nicht in der sicheren Sandbox.
Bei mehrteiligen Webprojekten werden zahlreiche lokale `fetch()`-, XHR-,
Medien- und ES-Modul-Pfade unterstützt, aber nicht jedes JavaScript-Framework.

## Sandbox-Speicher und Browser-Gegentest (v1.36.0)

- **Behoben:** Beim Initialisieren großer HTML-Wallpaper-Projekte löscht
  `document.open()` in Chromium früh registrierte Nachrichten-Listener.
  Dadurch blieben später übertragene Einstellungsänderungen wirkungslos.
  Nach dem Dokumentaufbau werden die StorageSync- und Fehler-Listener jetzt
  zuverlässig neu registriert; die eigentlichen gespeicherten Presets und
  Szenen-IDs werden weder überschrieben noch migriert.
- **Behoben:** Der simulierte `storage`-Event nutzt ein gültiges
  `storageArea: null`, statt eine JavaScript-Proxy-Fassade zu übergeben, die
  Chromium als native `Storage`-Instanz ablehnt.
- **Geprüft:** In einem echten isolierten Chromium-iframe wurden lokale und
  Session-Einstellungen, Änderungsereignisse, Rückmeldungen an den Host sowie
  der Audio-/Play-Pause-Nachrichtenkanal beider Nebula-Projekte getestet.
- **Optionaler erneuter Browser-Test:**
  `python tools/test-wallpaper-browser.py` (benötigt das Python-Paket
  `playwright` und einen lokal installierten Chromium-Browser).
  Dieser Test ersetzt keinen echten Spotify-Desktop-/Windows-Audiotest.

## Audio-Lifecycle und HTML-Szenen (v1.36.0)

- HTML-Szenen empfangen jetzt beim realen iframe-`load` neben dem
  aktuellen Playerzustand auch einen frischen Audio-Snapshot. Das verhindert
  verlorene Startpakete bei gewöhnlichen (nicht-projektbasierten) HTML-Szenen.
- Die Audio-Brücke zwischen Spicetify und HTML-Wallpapers wurde von 10 auf
  maximal 20 Pakete pro Sekunde angehoben. Es werden unverändert nur
  64 normierte Werte aus einer ausdrücklich freigegebenen Quelle übertragen.
- Beide Nebula Engines setzen beim Pausieren die zuletzt gezeichneten Peaks
  sofort zurück und können nicht mit alten Ausschlägen weiterlaufen.
- Nebula zeigt ohne Tonspur einen präziseren Status: Eine Verbindung zu
  Spotify bedeutet nicht automatisch, dass Audio freigegeben wurde.
- Bei einer Installation sind die beiden Nebula-Quellprojekte ab dieser
  Version ebenfalls zu aktualisieren und die HTML-Wallpaper neu zu importieren.

## Transport- und Audio-Status-Reparatur (v1.34.0)

- Die großen Previous-/Play-/Pause-/Next-Tasten und der optionale Mini-Player
  benutzen nun einheitliche SVGs statt systemabhängiger Emoji-Zeichen. Die
  Ausführung verwendet weiterhin `Spicetify.Player` und die ursprünglichen
  Aktionen. Tastaturnavigation, ARIA-Beschriftung und reduzierte Animation
  sind berücksichtigt.
- Der Audiozustand steht **direkt unter der Visualizer-Bühne**, nicht nur im
  Audio-Einstellungsbereich. Er unterscheidet fehlende Freigabe, noch laufende
  Freigabe, erkanntes Audiosignal, Stille und Spotify-Pause.
- Während eines noch offenen Berechtigungsdialogs lassen sich die Starttasten
  nicht mehrfach betätigen. Typische Chromium-/Electron-Audiofehler erscheinen
  in einer verständlichen Fehlermeldung.
- Audio bleibt **opt-in**. Spotify liefert Spicetify keine garantiert nutzbaren
  Audio-Samples. Für echte Musikreaktion muss im Visualizer eine aktive Tonspur
  ausdrücklich freigegeben werden: bevorzugt System-/Tab-Audio mit Ton, falls
  der Spotify-Client dies unterstützt; ansonsten das Mikrofon (beispielsweise
  via virtuelles Loopback-Gerät). Eine Bildschirmfreigabe ohne Audiospur
  startet absichtlich keinen vorgetäuschten Audio-Visualizer.
- Die beiden Nebula Engines akzeptieren weiterhin 64 normierte Audio-Bänder
  über die bestehende isolierte `postMessage`-Schnittstelle. Ihre gespeicherten
  Presets sowie die Speicher-Brücke bleiben unverändert. Der Standalone-Modus
  von Wallpaper Engine verwendet weiterhin seinen eigenen Audiolistener.

**Praktischer Funktionstest:** Spotify starten, Visualizer öffnen, einen
Song abspielen und auf »System-/Tab-Audio« klicken. Im Freigabedialog muss
»Audio teilen« aktiviert sein. Der Status muss bei vorhandenem Signal auf
»Audiosignal erkannt – Visualizer aktiv« wechseln. Falls diese Option im
Spotify-Desktop-Client fehlt, die Mikrofonquelle ausprobieren. Im
Nebula-Wallpaper unter Einstellungen außerdem prüfen, dass
»Audio-Visualisierung« nicht auf »Aus« steht. Für absichtlich unabhängige
Animationen kann die **deutlich als Demo gekennzeichnete** Wallpaper-Demo
aktiviert werden; sie reagiert nicht auf echte Musik.

## Speicher- und Video-Lifecycle-Reparatur (v1.33.0)

Der bestehende Visualizer wurde ohne neue Produktfunktionen stabilisiert:

- **HTML-Projekt laden/aktualisieren:** `loadSceneProject()` liest die
  Projektbeschreibung und ALLE Asset-Blobs jetzt aus derselben
  IndexedDB-Transaktion. Während eines parallelen Projektupdates dürfen keine
  alten Dateipfade mit neuen Dateien vermischt werden. Die Originaldateien,
  gespeicherten Presets und vorhandenen Playlists bleiben unverändert.
- **Direkte Clips und importierte Videos:** Der Szenenplayer wartet vor einem
  Wiedergabeversuch auf tatsächlich geladene Videodaten. Wenn Spotify in der
  Zwischenzeit pausiert, darf das spätere `canplay` nichts starten.
- **Ältere Video-Wallpaper mit Überblendung:** Auch die aktiven und ausblendenden
  Videolayer verwenden den gleichen abgesicherten Start-/Pause-Ablauf. Ein
  `play()`-Fehler nach einem Songwechsel wird nur für ein noch vorhandenes
  Video gemeldet. Der eigentliche Songzähler und die Reihenfolge bleiben gleich.

**Geprüft:** 178/178 automatische Tests, TypeScript 5.8, vollständiger
App-/Extension-/Theme-Build und ein Chromium-Lauf mit einer echten geladenen
WebM-Videodatei (`canplay` → Play → Pause). Der Datenbank-Race-Test verwendet
gezielt einen kontrollierten IndexedDB-Snapshot-Adapter. **Nicht abgenommen:**
TypeScript 7 auf deinem Windows-Rechner und die tatsächliche Spotify-Desktop-
Wiedergabe sowie interne Canvas-/Lyrics-Dienste.

## Canvas- und Lyrics-Fehlerbereinigung (v1.32.0)

Diese Version ergänzt **keine neuen Funktionen**, sondern beseitigt
Fehler bei vorhandenen Spotify-Fallbacks:

- **Canvas-Wiedergabe:** Ein Spotify-Video wartet auf tatsächlich verfügbare
  Mediendaten (`canplay`), bevor ein Play-Versuch erfolgt. Verzögerte
  Fehlermeldungen alter Videos dürfen keine neue Szene blockieren;
  Spotify-Pause hat Vorrang. Das Cover bleibt verfügbar, wenn der Client
  keinen abspielbaren Canvas liefert.
- **Canvas-Quellen:** Ein unzulässiger `currentSrc` unterdrückt eine gültige
  HTTPS-/Blob-Quelle aus einem `<source>`-Element nicht mehr.
- **Spotify-Lyrics-Vorschau:** Bei zwei Songs mit gleichem Titel werden die
  sichtbaren Vorschauzeilen zusätzlich am Künstler geprüft. Das React-UI
  bindet diese Vorschau ausdrücklich an URI, Titel und Künstler, damit
  veraltete Zeilen nicht für einen Render-Takt erscheinen.
- **Lokale LRC-Datenbank:** Scheitert das Lesen einer gespeicherten LRC,
  bleibt die Suche über Spotify und LRCLIB verfügbar. Die Warnung wird
  protokolliert, der Fehler wird nicht still verschluckt.
- **Automatische Lyrics:** Remix-, Live- und Acoustic-Fassungen werden bei
  identischem Namen nicht mehr blind gleichgesetzt. Syntaktisch ungültige
  oder leere Zeitmarken können bei vorhandenen Plain-Lyrics nicht mehr
  einen angeblich synchronisierten Treffer erzeugen.

**Prüfung:** 175 automatische Tests, TypeScript-/Bundle-Build mit dem hier
verfügbaren TypeScript 5.8. Zusätzlich bestand ein Chromium-Test mit
wirklichem Spotify-ähnlichem Sidebar-DOM und ungeladenem HTML5-Video.
Kein garantierter Zugriff auf Spotify Canvas und **keine** Abnahme mit dem
Windows-Spotify-Client oder dessen TypeScript-7-Umgebung. Die reparierten
beiden Nebula-Originalprojekte aus v1.30 bleiben unverändert verwendbar.

## Audio und Wallpaper-Lebenszyklus (v1.31.0)

**Audioquelle und ZuKaTo-Zeicheneffekt sind unabhängig:** Unter **Visualizer →
Audio** kannst du System-/Tab-Audio oder Mikrofon freigeben, auch wenn die
ZuKaTo-Spektrumanzeige auf **„Aus“** steht. Ein externes Nebula-Wallpaper kann
weiterhin auf die 64 echten, normierten Frequenzbänder reagieren; es wird kein
zusätzliches Balken-Overlay erzwungen. Die Audiofreigabe muss der Nutzer
weiterhin selbst bestätigen – kein direkter Spotify-PCM- oder DRM-Zugriff.

Wenn das HTML-Wallpaper langsamer startet als der Player, bestätigt die
Sandbox nach dem tatsächlichen Dokumentstart die Initialisierung; erst dann
sendet ZuKaTo Songstatus und Audiosignal erneut. Bei Pause oder abgebrochener
Freigabe erhält das Wallpaper ein Paket mit 64 Nullwerten, damit keine alten
Frequenzspitzen als laufende Musik stehenbleiben. Ohne aktive Audiofreigabe
wird keine Demoenergie vorgetäuscht.

Bei ausgeblendeter ZuKaTo-Audiodarstellung wird **kein** unsichtbarer
requestAnimationFrame-Zeichenloop mehr gestartet. Die Signaldiagnose arbeitet
stattdessen mit einem separaten 700-ms-Timer, der zusammen mit Tracks und
AudioContext aufgeräumt wird. Auch Fehler nach teilweise geöffnetem
MediaStream führen nicht zu hängengebliebenen Listenern.

**Geprüft:** 166 automatische Tests und ein Chromium-Test des isolierten
Projekt-Startvorgangs samt verzögerter Song-/FFT-Übergabe. Die Original-Engines
waren bereits in v1.30.0 als separate Pakete mit echten Browser-Bildern und
Wiederherstellung der Presets geprüft. Der erneute Kompletttest beider Engines
unter v1.31.0 sowie die Windows-/Spotify-Live-Abnahme stehen noch aus.

## Original-Nebula-Engines und Projektupdates (v1.30.0)

Die beiden ursprünglich bereitgestellten Webprojekte **Birkan Nebula Engine**
und **ZuKaTo Nebula Engine** sind separat als v1.2 korrigiert. Der Hauptfehler
war eine inkompatible Origin-Prüfung: `sandbox="allow-scripts"` hat absichtlich
keinen regulären Origin; die früheren Engine-Nachrichten wurden verworfen.

Der ZuKaTo-Visualizer übermittelt nun ausschließlich Songtitel, Künstler,
Playback-Zustand und – bei ausdrücklicher Audiofreigabe – maximal zehnmal pro
Sekunde 64 normierte FFT-Werte in das isolierte HTML-iframe. Weder Spotify-
Tokens noch rohe Audiodaten werden an die Szene weitergereicht. System-/Tab-
Audio ist nur bei geeigneten Browser-/Electron-Versionen verfügbar; sonst
bleibt das Mikrofon oder die separat erkennbare Nebula-Demo.

**Bereits importierte Projekte:** ZuKaTo speichert eine Kopie sämtlicher
HTML-Dateien in IndexedDB. Ein Austausch des Originalordners auf dem PC
aktualisiert diese gespeicherte Kopie NICHT automatisch. Daher kann man
unter **Visualizer → Wallpapers** ein bestehendes Projekt auswählen und
**„Projektordner aktualisieren (Presets behalten)“** ausführen. Die neuen
Dateien ersetzen die alten atomar; die Szene-ID, ihre Playlist-Einträge und
lokalen Reglerwerte bleiben erhalten. Bitte den vollständigen entpackten
Nebula-Ordner auswählen, niemals eine einzelne `index.html`. Die laufende
Szene verwendet die neue Fassung ab dem nächsten Songwechsel.

## Einstellungs-Speicherung (v1.29.0)

Jeder Song startet das HTML-Wallpaper in einem **neuen isolierten iframe**.
Das gewöhnliche Browser-`localStorage` und `sessionStorage` sind dort nicht
zugänglich. ZuKaTo stellt für vollständige HTML-Webprojekte zwei getrennte,
projektbezogene Fassaden bereit, damit das Wallpaper `getItem`, `setItem`,
`removeItem`, `clear`, `key`, `length` und übliche Property-Zugriffe verwenden
kann. Gespeichert wird im **ZuKaTo-Host**, nie in Spotifys echtem
Wallpaper-/Iframe-Speicher. Werte überstehen einen Songwechsel.

**Neu:** Auch `sessionStorage`-Werte überstehen den iframe-Neustart. Der Host
behält für jede Szenen-ID zwei getrennte Bereiche. Bereits in v1.28.0
persistierte `localStorage`-Werte bleiben kompatibel. Vorschau und Bühne
synchronisieren beide Bereiche. Beim Löschen des Wallpapers werden beide
Speicherbereiche gelöscht. Die Daten sind auf jeweils maximal 128 Schlüssel
und 48 KiB je Bereich begrenzt; gespeicherte Werte werden nicht im UI gezeigt.

Der Wallpaper-Manager zeigt bei einem ausgewählten HTML-Projekt die **Anzahl
über ZuKaTo gespeicherter Einstellungen** für beide Bereiche. Damit kann man
sehen, ob ein Wallpaper die angebotene Speicher-Schnittstelle überhaupt nutzt:

- **Werte vorhanden:** Die Browser-Speicherung funktioniert. Springt das
  Preset trotzdem zurück, setzt die **Original-Wallpaper-Logik** eventuell
  bei jedem Start wieder Standardwerte oder ignoriert gespeicherte Einstellungen.
- **0 lokal / 0 Sitzung:** Das Projekt hat bislang keine Werte über diese
  Speicherwege persistiert. Es könnte IndexedDB, eigene Variablen, Cookies
  oder eine proprietäre Wallpaper-Engine-API verwenden, oder gar nicht speichern.
  Dann muss der **Originalquellcode des Wallpapers** gezielt geprüft werden.

Das alleinige Vorhandensein dieser Speicher-Fassade repariert **keinen**
JavaScript-Code, der bei jedem Start blind Defaults über gespeicherte Werte
schreibt. Die beiden bereitgestellten Original-Nebula-Engines wurden deshalb
in v1.30.0 auf den isolierten Host und seine Einstellungsschnittstelle
abgestimmt; andere Wallpaper benötigen gegebenenfalls eigene Korrekturen.

## Sicherheit / eigene HTML-Animationen

HTML-Webprojekte laufen in `sandbox="allow-scripts"` **ohne**
`allow-same-origin`. Eigene Dateien werden über lokale, temporäre Blob-URLs
innerhalb des isolierten iframes geladen. Die CSS-/JS-Ausführung wird durch
CSP begrenzt; Internetverbindungen und direkter Spotify-Kontozugriff werden
nicht freigeschaltet.

Optional kann das Wallpaper Spielerinformationen ohne Kontodaten erhalten:

```js
window.addEventListener("zukato:player", (event) => {
  const { playing, positionMs, durationMs, run } = event.detail;
  document.body.classList.toggle("paused", !playing);
});
```

Das ist **kein** Zugang zu Spotify-Roh-Audio oder PCM.

## Canvas, Lyrics, Audiovisualizer

- **Spotify Canvas:** ZuKaTo versucht, einen im Client vorhandenen Canvas-Clip
  wiederzuverwenden. Fehlt ein zugänglicher Clip, kann das Cover angezeigt
  werden. Es gibt keine garantierte öffentliche Spotify-Canvas-API.
- **Lyrics:** Lokale LRCs, je nach Client verfügbare Spotify-Lyrics und LRCLIB
  als Fallback. Der synchronisierte Text ist nicht für jeden Song verfügbar.
- **Audio:** Ein Mikrofon ist **nicht zwingend** notwendig. Eine freigegebene
  System-/Tab-Audiospur oder ein Loopback-Gerät kann eine digitale Audioquelle
  liefern. Ohne Audiofreigabe keine echte Frequenzanalyse. Spotify stellt über
  Spicetify keinen dokumentierten direkten PCM-Stream bereit.

Die technischen Medien-Diagnosen sind unter **Visualizer → Verbindung prüfen**
erreichbar. Privatinhalte werden nicht mitgesendet.

## Struktur und Qualitätsprüfung

| Ordner / Datei | Zweck |
|---|---|
| `src/` | Ausführlich kommentierter Quellcode und Integrationen |
| `tools/` | Build, Umgebungsdiagnose und Spicetify-Installation |
| `tests/` | Automatische Regressionstests für Wiedergabe, Dateien und Zustände |
| `package.json`, `package-lock.json` | Node-/npm-Abhängigkeiten |
| `tsconfig.json`, `.gitignore` | Compiler und Versionsverwaltung |
| `dist/` (generiert) | Kompilierte App, Theme und Erweiterung |

Die Tests prüfen u. a. Storage-Operationen, Importlimits, Songwechsel,
Frequenzpakete und Audiolifecycle. Die originalen Birkan-/ZuKaTo-Nebula-
Projekte wurden mit v1.30.0 im Browser geprüft. v1.31.0 erweitert die Tests
für den Übergabezeitpunkt und audiofreie/ausgeblendete Zustände.

Der Build wurde hier mit einem verfügbaren TypeScript-5.8-Compiler und einem
Offline-Fallback ausgeführt; eine separate TypeScript-7-Windows- und
Spotify-Desktop-Abnahme muss auf dem Zielrechner erfolgen.

## v1.49.0 – Notizen und Datensicherheit

- Gespeicherte Notizen sind inklusive ihres Texts durchsuchbar und seitenweise erreichbar.
- Entwürfe bleiben bei fehlschlagenden `sessionStorage`-Schreibzugriffen im Arbeitsspeicher erhalten und werden nicht von älteren Speicherständen überschrieben.
- Neue Entwürfe erkennen geänderte Notiztexte auch bei unverändertem Update-Zeitstempel.
- Mehrfache Notizen und Favoriten-URIs aus älteren Backups werden beim Lesen zusammengeführt; bei Notizen gewinnt der neuere Zeitstempel.


## v1.50.0 – Sicherer Backup-Import

- JSON-Backups werden **vor jeder Änderung** auf vollständige Einstellungs- und
  Bibliotheksblöcke geprüft. Beschädigte Sammlungen, Presets und Song-Szenen
  werden nicht stillschweigend durch leere Listen ersetzt.
- Die Sicherheitsabfrage zeigt die Anzahl von Verlaufseinträgen, Favoriten,
  Notizen, Presets und Song-Szenen und weist auf fehlende Mediendateien hin.
- Schnelle doppelte Importversuche werden verhindert. Größere legitime Backups
  sind bis 10 MB zulässig; bereits vorhandene Sicherungen bleiben kompatibel.
- **Vor dem Import zuerst den bisherigen Stand exportieren.** JSON-Sicherungen
  enthalten weiterhin keine HTML-Wallpapers, Videos oder LRC-Mediendateien.
- Testlauf: `npm run check && npm test`. Die Tests ersetzen keine Spotify-
  Desktop-Prüfung.


## v1.51.0 – Backup-Schutz gegen stilles Abschneiden

- Bei einer Wiederherstellung mit mehr Daten als zulässig (500 Hörverlaufseinträge,
  250 Favoriten, 250 Notizen, acht Presets, 100 Song-Szenen oder zu großen
  Wallpaper-Playlists) wird der Import **vor dem ersten Schreibzugriff abgelehnt**.
  Eine unbemerkt gekürzte Sicherung ist damit nicht mehr möglich.
- Überlange Spotify-URIs, Metadaten und Notiztexte sowie doppelte Preset-IDs
  und Song-Szenen werden vor dem Restore erkannt.
- Die Importabfrage zeigt **bisherige → neue** Datenmengen. Fehlen ältere
  optionale Blöcke, wird ausdrücklich **„bleibt erhalten“** angezeigt.
- Ein altes Backup ohne Farbpalette verändert die bisherige Palette nicht.
- Der Visualizer, Audiofreigaben und die Nebula-Engines wurden nicht geändert.
- Prüfung: `npm run check` und `npm test`; zusätzlich Browser-/Praxistests
  durchführen, bevor ältere Sicherungen in produktiven Profilen importiert werden.

## v1.52.0 – Bedienung der Einstellungen und Schnellsuche

- Die Einstellungen merken sich innerhalb der laufenden Spotify-Sitzung den
  zuletzt besuchten Unterbereich. Beim Zurückkehren aus einem anderen Modul
  landet man nicht mehr zwangsweise in der Übersicht.
- Die sechs Einstellungsbereiche sind zusätzlich mit Pfeiltasten (auch horizontal),
  Pos1/Home und Ende/End navigierbar. Der Tastaturfokus wandert zur gewählten
  Schaltfläche; diese Bedienung funktioniert auch ohne Maus.
- `Strg+Umschalt+F` öffnet die Schnellsuche nur, wenn keine Texteingabe, ein
  fremder Dialog, ein wiederholter Tastenanschlag oder eine bereits verarbeitete
  Tastaturaktion dazwischenfunkt. Escape schließt die Schnellsuche weiterhin.
- Acht Regressionstests prüfen Zustandsspeicherung, gesperrten Storage,
  Navigation, Modifikatoren und die Einbindung in die Oberfläche.

## v1.53.0 – Modulsortierung und Tastenkürzel-Aufnahme

- Eine Sortierposition in den Moduleinstellungen wird erst beim Verlassen
  des Feldes gespeichert. Leere Zwischenwerte lösen keinen ungewollten Reset
  mehr aus. Erlaubt sind nur ganze Zahlen von 0 bis 10000.
- `Enter` bestätigt den neuen Wert, `Escape` verwirft die Eingabe.
  Ungültige Werte lassen die vorherige gespeicherte Position unverändert.
- Wenn eine neue Tastenkombination bereits belegt ist, bleibt die Aufnahme offen.
  Es kann sofort eine andere Kombination eingegeben werden, ohne erneut auf
  „Bearbeiten“ klicken zu müssen.
- Die Aufnahme besitzt außerdem einen sichtbaren „Aufnahme abbrechen“-Button;
  `Escape` bleibt als Abbruchweg erhalten. Beim Abbruch wird nichts überschrieben.
- Zehn neue Regressionstests prüfen Grenzwerte, ungültige Eingaben und die
  tatsächlichen Shortcut-Eventhandler für Konflikt, erneuten Versuch und Abbruch.
- Visualizer, Wallpaper und gespeicherte Presets bleiben unverändert.
  Das Release-ZIP enthält keine zusätzlichen TXT-Dateien.
