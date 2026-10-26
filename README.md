# ZuKaTo Spicetify

Kommentierte Spicetify-Erweiterung mit Workspace, Songverwaltung und einem
Visualizer für eigene **vollständige HTML-Wallpaper-Projekte**. Entwicklungsstand: **v1.76.0-rc.8**.

Die automatischen Tests prüfen den Quellcode und seine Browser-Sandbox. **Nicht
alle Funktionen sind im echten Spotify-Desktop-Client abgenommen:** Insbesondere
Canvas-Quellen, Spotify-interne Lyrics, digitale Audioanalyse und spezielle
Wallpaper-Engine-JavaScript-APIs bleiben abhängig vom Client bzw. Originalprojekt.

## v1.76.0-rc.8 – Visualizer rechts und Wallpaper auf dem Desktop

- Die kleine Ansicht ist 400 px breit und fest am rechten Bildschirmrand. Sie
  kann innerhalb von Spotify nicht verschoben oder skaliert werden.
- „Desktop“ öffnet das laufende Wallpaper mit Zurück, Pause/Wiedergabe und Weiter
  als verschiebbares Document-PiP-Fenster. „Spotify öffnen“ bringt das Hauptfenster
  zurück und setzt dieselbe Bühne an ihren Platz. Das Fenster muss per Klick vor
  dem Minimieren geöffnet werden; die Webview muss Document PiP unterstützen.
- Das Übertragen eingebetteter HTML-Wallpaper zwischen Dokumenten kann deren
  iframe beim Öffnen oder Schließen einmalig neu laden. Die konkrete Spotify-
  Webview und das Minimieren müssen am Desktop geprüft werden.

## v1.76.0-rc.7 – Kleine Visualizer-Ansicht und aufgeräumte Bedienung

- Auf Dashboard und anderen Workspace-Seiten läuft dieselbe Visualizer-Bühne
  unten rechts weiter. „Groß“ führt zurück, ohne Wallpaper und Tonquelle neu zu
  laden. Die kleine Ansicht erscheint auch direkt beim Öffnen des Workspace.
- Der erste Popup-Prototyp öffnete nach Klick ein separates Player-Fenster mit
  Cover und Wiedergabesteuerung, wenn die Spotify-Webview Document PiP erlaubt.
  Es kann beim Minimieren von Spotify sichtbar bleiben. Der Klick muss vor dem
  Minimieren erfolgen. Die Client-Unterstützung muss noch praktisch geprüft
  werden.
- Die große Bühne zeigt ihre Wiedergabetasten direkt im Bild. Doppelte Tasten,
  lange Statusmeldungen und Einstellungsfelder sind aus der Startansicht
  entfernt; „Anpassen“ blendet die bisherigen Regler und Diagnosen ein.
- Die geöffnete Wallpaper-Vorschau bleibt bei einem Wechsel der Visualizer-Reiter
  erhalten. Ein echter Songwechsel darf die große Szene weiterhin neu starten.

## v1.76.0-rc.6 – Visualizer-Bedienung

- Zurück, Wiedergabe/Pause und Weiter liegen im Kino- und Vollbildmodus direkt
  auf der Bühne. Im Vollbild gibt es zusätzlich eine sichtbare Schaltfläche zum
  Verlassen. Die Kino-Bühne berücksichtigt die Spotify-Playerleiste.
- Beim Wechsel zwischen Workspace-Modulen bleibt ein bereits geöffneter
  Visualizer gemountet. Seine Szene und eine freigegebene Audioquelle müssen
  deshalb nicht neu gestartet werden. Die eigene Spektrumszeichnung pausiert
  währenddessen.
- Der optionale ZuKaTo Mini-Player bietet bei unterstützter Webview ein
  separates, schwebendes Fenster. Es wird vor dem Minimieren per Klick geöffnet
  und bleibt dann beim Minimieren des Spotify-Hauptfensters sichtbar. Falls die Webview dies nicht
  unterstützt, bleibt Spotifys eigener MiniPlayer unten rechts verfügbar.
  Das separate ZuKaTo-Fenster ist im Desktop-Client noch nicht abgenommen.

## v1.76.0-rc.5 – Kompakter Workspace

Der gemeinsame Kopf zeigt Titel und Schnellsuche in einer Zeile. Die
Modulnavigation startet kompakt; Suche und „Module anzeigen“ bleiben jederzeit
erreichbar. Dashboard, Playlist-Werkzeuge, Einstellungen und Visualizer beginnen
ohne wiederholte Einleitungen direkt mit ihren Aktionen. Hinweise zu
Schnellzugriffen und Einstellungsbereichen bleiben als Tooltips verfügbar.
Das Dashboard zeigt bei schmalem Platz lesbare Schnellzugriffe in einer Spalte;
doppelte Songaktionen und doppelte Einstellungslinks wurden entfernt. Der
rc.5-Build wurde lokal angewendet und in den vier Bereichen visuell geprüft.

## v1.76.0-rc.4 – Benannte Musiksammlungen

Unter **Playlist-Werkzeuge → Sammlung zusammenstellen** lassen sich Favoriten und
Hörverlauf durchsuchen und in mehreren benannten Sammlungen organisieren. Jede
Sammlung speichert bis zu 500 Songs samt Reihenfolge und Anzeigenamen lokal.
Ausgewählte Songs können kopiert, lokal entfernt, eingereiht oder nach
Bestätigung in eine Spotify-Playlist übertragen werden. Der Export in eine
neue Playlist erfordert einen zusätzlichen Bestätigungsschritt.
Bei einer unklaren Spotify-Antwort blockiert ein vor dem ersten API-Aufruf
gespeicherter Exportstatus weitere Versuche. Nach Prüfung der Playlist in
Spotify kann genau dieser Auftrag über zwei bewusste Klicks wieder freigegeben
werden.
Die vorhandene JSON-Datensicherung übernimmt benannte Sammlungen jetzt
einschließlich Reihenfolge und Songinformationen. Ältere Backups ohne diesen
Abschnitt lassen bereits vorhandene Sammlungen unverändert.
Die Sammlungswerkbank initialisiert ihren lokalen Speicher erst beim ersten
Öffnen des Tabs. Ändert ein zweites Spotify-Fenster die Sammlungen, wird der
neue Stand angezeigt. Eine inzwischen veraltete Aktion wird vor dem Speichern
abgebrochen und kann nach dem Neuladen bewusst erneut ausgeführt werden.
Auch Export-Sperren anderer Fenster bleiben erhalten, wenn während einer
Spotify-Anfrage der Status des eigenen Exports aktualisiert wird.

Der verfügbare GitLab-Stand vor dieser Änderung war v1.73.0. Deshalb existiert
hier kein v1.75.0-Speicherschlüssel für die frühere einzelne Arbeitsliste;
eine Übernahme solcher bereits gespeicherten Daten ist noch nicht nachgewiesen.
Der rc.4-Build wurde lokal mit Spicetify angewendet. Mit rc.2 startete der
Spotify-Client und zeigte die Sammlungswerkbank mit Quellen und aktiver
Sammlung an. Die Sammlungsaktionen, der Exportwächter und der Playlist-Export müssen
im echten Client noch geprüft werden, bevor v1.76.0 als stabil gilt.

## v1.72.0 – Dashboard-Informationskarten und Bibliotheksvorschau

- Sechs Informationskarten frei mit Pfeiltasten anordnen und einzeln ein-/ausblenden.
- Favoritenvorschau mit direktem Abspielen und Link zum Favoritenmodul.
- Vier jüngste Song-Notizen lokal anzeigen und zum Notizmodul wechseln.
- Alte Dashboard-Einstellungen rückwärtskompatibel erweitern; Kartenfolge bleibt gespeichert.
- Responsive Zwei-Spalten-Ansicht und Ein-Spalten-Darstellung in schmalen Fenstern.
- Visualizer, beide Nebula Engines und Musikbibliothek unverändert.

## v1.64.0 – Playlist-Inhalte direkt im Workspace verwalten

- **Playlist-Inhaltsverwaltung:** Eine bestehende Spotify-Playlist per Link oder
  Auswahl aus den eigenen Playlists laden. Titel und Künstler anzeigen, lokal
  suchen, markieren und seitenweise (50 pro API-Request, 30 pro UI-Seite)
  durchsuchen. Maximal 500 geladene Einträge, keine ständigen Hintergrundabrufe.
- **Zusammenhängende Aktionen:** Markierte Titel zur Spotify-Warteschlange
  hinzufügen oder über das bekannte Playlist-Zielwerkzeug in eine andere
  Spotify-Playlist kopieren. Die reine Auswahl verändert Spotify nicht.
- **Entfernen mit Sicherheitsdialog:** Ausschließlich explizit ausgewählte URIs
  über `DELETE /playlists/{id}/items` entfernen. **Wichtig:** Spotify kann
  dabei sämtliche Vorkommen der URI entfernen, auch auf noch nicht geladenen
  Seiten. Der Dialog warnt davor; anschließend Ansicht neu laden.
- **API-Sicherheit:** Nur feste Spotify-Domains und gültige IDs. Keine
  automatischen Wiederholungsversuche nach unklaren Schreibfehlern; Teilerfolge
  werden angezeigt und die Ansicht danach als veraltet markiert.
- **Berechtigungen:** Das seit Februar 2026 aktualisierte GET-Endpoint kann nur
  Inhalte eigener oder kollaborativ bearbeitbarer Playlists freigeben. Ein
  `403` wird als Lesefehler angezeigt. Löschungen erfordern Schreibrechte.
- **Unverändert:** Visualizer, importierte Wallpaper, Nebula Engines, Presets.

## v1.63.0 – Eigene Spotify-Playlists direkt als Ziel auswählen

- Playlist-Browser ist jetzt in **allen** Export-Ansichten vorhanden: Favoriten,
  Hörverlauf, Playlist-Werkzeug und Mehrfachimport.
- Per Klick werden die eigenen und abonnierten Spotify-Playlists aus
  `GET /v1/me/playlists` abgerufen. Suche nach Namen oder Besitzer, Auswahl über
  Dropdown; der bisherige manuelle Link bleibt vollständig nutzbar.
- Bei über 50 Playlists lassen sich weitere Seiten nachladen (bis zu 500). Die
  Folgeanfragen verwenden sichere feste Offset-URLs, keine fremden `next`-Links.
- **Nur Lesen** beim Laden und Auswählen: Erst der separate, bestätigte
  Übertragungsbutton versucht Änderungen. Abonnierte Playlists ohne Schreibrecht
  können trotzdem sichtbar sein; Spotify entscheidet über die Berechtigung.
- Keine Playlist-Metadaten werden lokal gespeichert. Bereinigte API-Antworten,
  Schutz gegen Doppelklicks, Fehleranzeige, keine automatischen Wiederholungen.
- Deutsche und englische Texte, kommentierter Code, Regressionstests und
  bestehende Audio-/Wallpaper-Quellen unverändert.

## v1.62.0 – Import-Arbeitsliste für Spotify-Links

- **Bearbeitbare Auswahl:** Bis zu 500 validierte Titel lassen sich einzeln an- und
  abwählen; alle markieren oder die Auswahl aufheben. Nur ausgewählte Einträge
  werden in die Warteschlange bzw. Spotify-Playlist übertragen.
- **Reihenfolge und Suche:** Songs mit Pfeiltasten-Buttons verschieben, nach URI
  oder Spotify-ID filtern und über Seiten mit je 30 Einträgen navigieren.
  Die Suche verändert die eigentliche Auswahl nicht.
- **Eingabe aufräumen:** Auf Wunsch bleibt nur die aktuelle Auswahl in der
  Texteingabe. Diese bewusst verändernde Aktion benötigt eine Bestätigung.
- **Sicherheit:** Quelle und Spotify-API bleiben beim bloßen Bearbeiten
  unverändert. Alle Versandwege verwenden dieselbe geprüfte Auswahl und
  schützen weiterhin vor Doppelklicks sowie großen Mehrfachanfragen.
- **Unverändert:** HTML-Wallpapers, Nebula Engines und Visualizer-Effekte.

## v1.61.0 – Mehrfachimporte und zuletzt genutzte Playlists

- Spotify-Titel und Episoden per mehrzeiligem Link-/URI-Feld importieren, mit
  Analyse von ungültigen und doppelten Einträgen. Höchstens 500 gültige Songs;
  mehr als 500 führt zu einer Fehlermeldung statt stillschweigender Kürzung.
- Importierte Titel ausdrücklich in die Warteschlange oder eine bestehende
  Spotify-Playlist übernehmen, niemals automatisch.
- Zuletzt erfolgreich verwendete Playlist-Ziele bleiben lokal verfügbar, bis
  sie in der Oberfläche gelöscht werden.

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


## v1.62.0 – Playlist-Sammelimport und häufige Ziele

- Im Modul „Playlist-Werkzeuge“ lassen sich bis zu 500 Spotify-Titel oder
  Episoden per Mehrfach-Einfügen übernehmen (Link oder URI, getrennt durch
  Zeilenwechsel, Leerraum, Kommas und Semikola).
- Vor einer Aktion zeigt die Vorschau gültige, ungültige und doppelte Einträge.
  Die Reihenfolge der gültigen ersten Treffer bleibt erhalten; bei zu langen
  Eingaben oder mehr als 500 unterschiedlichen Titeln wird **nichts** verschickt.
- Die Vorschau kann mit einem Klick in die Warteschlange oder nach einer
  separaten Bestätigung in eine bestehende Spotify-Playlist übertragen werden.
- Bis zu fünf **erfolgreich verwendete** Ziel-Playlists werden lokal gespeichert
  und können direkt wiedergewählt oder komplett entfernt werden. Niemals Token
  oder Playlist-Inhalte speichern. Ausfälle des lokalen Speichers blockieren
  Spotify-Transfers nicht.
- Alle bestehenden Favoriten, Hörverlauf, Visualizer-Quellen, Effekte und
  Nebula-Engines bleiben unverändert.
- Prüfen: `npm test`, `npm run install:spicetify`, danach in Spotify einen
  kleinen Import gegen eine Playlist testen, die man bearbeiten darf.


## v1.65.0 – Playlists erstellen und einzelne Vorkommen verschieben

- In den bestehenden Playlist-Zielfeldern gibt es einen **optionalen Dialog
  zum Erstellen einer neuen Spotify-Playlist** (Name, Beschreibung, privat/
  öffentlich). Der Standard ist **privat**. Ein Bestätigungsklick erstellt
  nur die leere Playlist und übernimmt deren URI als Ziel; Songs werden
  ausdrücklich **erst nach der separaten Transferbestätigung** übertragen.
- Im Playlist-Inhaltsmanager lässt sich die **absolute Position eines einzelnen
  Playlist-Eintrags** ändern, auch wenn der Song mehrfach in der Playlist
  enthalten ist. Den Eintrag über „Position ändern“ markieren, Zielplatz
  zwischen 1 und der Playlist-Gesamtzahl eingeben und bestätigen.
- Spotifys aktueller PUT-`/items`-Endpunkt verschiebt exakt eine Position und
  nutzt eine unmittelbar vor dem Schreiben angeforderte `snapshot_id`.
  So werden URI-Duplikate nicht gemeinsam verändert. Bei einem unsicheren
  API-Ausgang wird **nicht automatisch erneut geschrieben**.
- Nach einer Verschiebung muss die Playlist neu geladen werden. Das verhindert,
  dass eine veraltete Ansicht weiter für Aktionen verwendet wird.
- Typprüfung und Tests: `npm run check && npm test`. Ein echter Spotify-Client
  mit Playlist-Schreibrechten bleibt für einen Praxistest erforderlich.
- Alle neu eingefügten Quellcodebereiche sind kommentiert; Visualizer,
  Effekt-Persistenz und beide Nebula Engines bleiben unverändert.


## v1.66.0 – Große Playlists und eigene Metadaten

- Playlist-Inhaltsmanager lädt bis zu 10.000 Positionen über Spotify-50er-Seiten.
  Eine gewünschte Spotify-Seite kann direkt angesprungen werden, ohne alle
  vorherigen Seiten abfragen zu müssen. Nachgeladen wird nur auf Klick.
- Die sichtbare Suche/Auswahl bleibt ausdrücklich auf **geladene Titel**
  begrenzt; entfernte, nicht geladene Duplikate sind weiterhin vor der
  Löschbestätigung zu beachten.
- Besitzer können Playlist-Namen und Beschreibungen über einen eigenen
  Dialog laden, bearbeiten und nach ausdrücklicher Bestätigung ändern.
  Vorher werden Spotify-Konto und Playlist-Eigentümer verglichen.
- Spotify kann bei einem erfolgreichen Metadaten-PUT eine leere Antwort liefern.
  Bei uneindeutiger Antwort wird NICHT automatisch erneut geschrieben;
  die Metadaten müssen erst neu geladen werden.
- API-URLs werden nur aus validierten Spotify-IDs konstruiert.
  Playlist-Songs, Sichtbarkeit, Visualizer und Nebula-Engines bleiben unverändert.


## v1.67.0 – Aufgeräumter Playlist-Workspace mit echter Tab-Navigation

- Die bisher sehr lange Seite „Playlist-Werkzeuge“ ist in vier übersichtliche
  Bereiche unterteilt: **Schnell einreihen**, **Links importieren**,
  **Playlists verwalten** und **Favoriten übertragen**.
- Die Unterbereiche bleiben **gleichzeitig gemountet**, während nur der
  aktive Bereich angezeigt wird. Beim Wechsel gehen deshalb bereits
  eingegebene Spotify-Links, markierte Songs und geladene Playlist-Seiten
  nicht verloren. API-Schreibaktionen werden dabei nicht automatisch ausgelöst.
- Der zuletzt geöffnete Unterbereich wird für die aktuelle Sitzung gemerkt.
  Gesperrter oder defekter Sitzungsspeicher bleibt ausdrücklich toleriert.
- Vollständige Tastatursteuerung: `Pfeil links/rechts`, `Home` und `End`;
  der Tastaturfokus folgt der aktuellen Registerkarte. `Tab` und Eingaben
  innerhalb der Werkzeuge bleiben unverändert benutzbar.
- Vier flexible Registerkarten (auf schmalen Fenstern zwei Spalten),
  zugängliche Beschriftungen und ein Favoritenzähler an der Übertragung.
- Neun zusätzliche UI- und Logiktests. Der vollständige Projektstand,
  Visualizer, Audioanalyse und beide Nebula Engines bleiben erhalten.


## v1.68.0 – Navigationszentrale, Suchfeld und dauerhafte Schnellzugriffe

- Die übergreifende Workspace-Navigation hat nun eine **direkte Modulsuche**,
  auch bei benutzerdefinierten Modultiteln. Umlaute und Schreibweise werden
  beim Suchen normalisiert. Die Suchfunktion startet keine Spotify-Aktion.
- Bis zu fünf Module können über das Stern-Symbol **dauerhaft angeheftet**
  werden. Sie erscheinen oben als Schnellzugriff. Der lokale Speicher enthält
  nur bekannte Modul-IDs, keine Spotify-Tokens, Playlists oder Songdaten.
- Vorübergehend deaktivierte Module werden nie über gespeicherte Pins geöffnet.
  Werden sie erneut aktiviert, kann ihre alte Anheftung wieder erscheinen.
- Die volle Modulnavigation ist ein- und ausklappbar. Tippen im Suchfeld
  klappt sie wieder auf; `Escape` löscht die aktuelle Modulsuche.
  `Enter` öffnet einen eindeutigen Treffer, `Pfeil runter` fokussiert den ersten.
- Für kleine Workspace-Flächen gibt es **horizontal scrollbar erreichbare**
  Modulgruppen statt überfüllter mehrzeiliger Navigation. CSS-Container-Queries
  berücksichtigen auch eine breite Spotify-Seitenleiste. Sichtbare Fokusrahmen
  und beschriftete Pin-Tasten erleichtern Tastatur- und Screenreader-Bedienung.
- Fehlender, beschädigter oder gesperrter Browser-Speicher verhindert niemals
  Navigation oder Pin-Klicks in der laufenden Ansicht. Schnelle Pin-Klicks werden
  vollständig übernommen; bei fünf Pins werden weitere Pins deutlich gesperrt.
- Alle Änderungen sind lokal auf die Workspace-Navigation begrenzt.
  Bestehende Playlist-Tools, Audioanalyse, Presets und beide Nebula Engines
  bleiben unverändert.
- Neue Tests: `tests/workspace-navigation-v168.test.mjs`. Gesamttest:
  `npm test` und anschließend bei dir `npm run install:spicetify`.


## v1.69.0 – Einheitliche Bibliothekslisten und klarere Einstellungen

- **Favoriten, Hörverlauf und Song-Notizen** erhalten eine gemeinsame Such-
  und Sortierleiste mit aufgeräumter Bedienung. Die Suche lässt sich direkt
  zurücksetzen; gefundene Titel und Notizen werden weiterhin paginiert.
- Sortierung: gespeicherte Reihenfolge (Standard), Titel A–Z und Künstler A–Z.
  Hörverlauf und Notizen bieten zusätzlich „Neueste“ und „Älteste zuerst“
  anhand ihrer jeweiligen Zeitstempel. Doppelte Wiedergaben im Hörverlauf
  bleiben als eigenständige Zeilen erhalten.
- Eine **kompakte Listenansicht** reduziert die Zeilenhöhe in allen drei
  Bibliotheksbereichen. Die Auswahl und sämtliche Titelaktionen bleiben
  vollständig nutzbar – auch in schmaleren Spotify-Fenstern.
- Sortierung und Dichte werden gerätelokal je Bereich gespeichert und bei
  erneutem Öffnen wiederhergestellt. Defekter oder gesperrter Browser-Speicher
  blockiert die Oberfläche nicht. Kein Schreiben in die Favoriten-, Verlaufs-
  oder Notizbibliothek; kein Umbau des bestehenden Backups.
- In den allgemeinen Einstellungen zeigen Workspace-Titel und Anzeigename
  jetzt einen Zeichenzähler. `Esc` verwirft ungespeicherte Feldänderungen auch
  bei unmittelbar folgendem `blur`; unveränderte Texte werden nicht erneut
  gespeichert. Deutsch und Englisch sind ergänzt.
- Die Anpassungen sind kommentiert, mit gemeinsamen Funktionen statt
  dreifach kopierter Sortierlogik. Testdatei:
  `tests/collection-display-v169.test.mjs`.
- Visualizer, Wallpaper-Host, beide Nebula Engines und Spotify-Schreibaktionen
  wurden für dieses Release **nicht** geändert.


## v1.70.0 – Lokale Musikstatistik und Dashboard-Aktivität

- **Statistik:** Auswahl zwischen 7 Tagen, 30 Tagen und dem gesamten lokal
  gespeicherten Hörverlauf. Anzahl der Songwechsel, einzigartige Titel,
  heutige Ereignisse und aktive Kalendertage werden passend zum Zeitraum angezeigt.
- **7-Tage-Aktivitätsverlauf:** Sieben Kalender-Tagesbalken, auch an Tagen ohne
  Ereignisse. Dashboard und Statistik verwenden dieselbe reine Datenberechnung.
- **Ranglisten:** Top 10 der Künstler und Songs im gewählten Zeitraum.
  Songs werden nach Spotify-URI statt nach gleich klingendem Titel gruppiert.
  Gleiche Künstler-/Song-Häufigkeiten behalten eine stabile Reihenfolge.
- **Dashboard:** Die neue Aktivitätskurve verlinkt auf die Statistik, wenn
  das Modul aktiviert ist. Keine zusätzliche Spotify-API-Abfrage.
- **Ehrliche Datenbasis:** Es werden nur beobachtete lokale Songwechsel aus
  maximal 500 gespeicherten Verlaufsereignissen ausgewertet. Keine erfundenen
  Hörminuten, vollständigen Spotify-Statistiken oder Jahresrückblicke.
  Die Auswertung verändert die gespeicherten Daten nicht.
- Deutsch/Englisch, kompakte Bildschirmbreiten, Tastaturbedienung und
  Regressionstests ergänzt. Visualizer und Nebula Engines unverändert.


## v1.72.0 – Persönliches Dashboard und Schnellzugriffe

- **Dashboard-Schnellzugriffe anpassen:** Bis zu sechs Module direkt auf der
  Startseite platzieren, entfernen und mit Auf-/Ab-Tasten umsortieren. Eigene
  Modulnamen aus den allgemeinen Einstellungen werden übernommen. Deaktivierte
  Seiten bleiben auch bei früher gespeicherten Verknüpfungen unzugänglich.
- **Dashboard-Bereiche auswählen:** Aktivitätskurve, zuletzt gehörte Titel und
  Workspace-Überblick können einzeln ein- und ausgeblendet werden. Der aktive
  Spotify-Player und die Kennzahlen bleiben immer erreichbar.
- **Persönlicher Statistikzeitraum:** Titelwechsel und eindeutige Songs auf
  dem Dashboard für 7 Tage, 30 Tage oder den gesamten *lokalen* Verlauf.
  Die darunter stehende Sieben-Tage-Kurve bleibt ausdrücklich auf sieben
  Kalendertage beschränkt, statt falsche Langzeitbalken anzuzeigen.
- **Dauerhafte Speicherung:** Einstellungen werden ausschließlich unter
  `zukato-toolkit.dashboard.preferences.v1` im lokalen Browser-Speicher
  abgelegt; ältere Einstellungen, die Bibliothek und Spotify-Daten bleiben
  unverändert. Gesperrter oder defekter Speicher verhindert die Bedienung
  während der laufenden Sitzung nicht. „Dashboard zurücksetzen“ stellt die
  Standardwerte wieder her.
- **Barrierearm und responsiv:** Bedienelemente haben Beschriftungen,
  sichtbare Tastatur-Fokusmarkierungen und ein schmalfenstertaugliches Layout.
  Deutsch/Englisch vollständig ergänzt.
- **Regression:** `tests/dashboard-personalization-v171.test.mjs` prüft die
  Speicherung, strikte Datenvalidierung und tatsächliche TSX-Callbacks.
  Visualizer, Audioanalyse und beide Nebula Engines wurden nicht verändert.


## v1.73.0 – Musik wiederentdecken (lokale Bibliothekswerkzeuge)

- **Neue Statistik-Ansicht:** „Musik wiederentdecken“ zeigt Songs und Episoden,
  die im lokalen Hörverlauf mehrfach vorkommen. Die Ansicht ist über die
  Statistik und den Dashboard-Schnellzugriff erreichbar, sofern aktiviert.
- **Zwei nachvollziehbare Sortierungen:** Am häufigsten gehört und am längsten
  nicht gehört. Zusammenfassung anhand gültiger Spotify-URIs; gleiche Namen
  verschiedener Songs werden nicht verwechselt.
- **Flexible Filter:** Mindestens 1, 2, 3 oder 5 lokale Songwechsel, Suche
  nach Titel/Künstler und optional nur noch nicht gemerkte Favoriten.
- **Direkte Aktionen:** Auswahl einzelner Titel, einer Seite oder aller Treffer,
  mit anschließendem gezieltem Speichern als lokale Favoriten, Einreihen in
  die Warteschlange oder Übernehmen in bestehende Spotify-Playlists.
  Markieren allein löst keinerlei Speicher- oder Spotify-Schreibaktion aus.
- **Begrenzte, ehrliche Datenbasis:** Nur die maximal 500 lokal gespeicherten
  Songwechsel; keine serverseitigen Spotify-Empfehlungen oder Hörminuten.
  Ungültige und zukünftige Zeitstempel werden ausgeschlossen. Kein Eingriff
  in Visualizer, Nebula Engines oder gespeicherte Presets.
- Deutsch/Englisch, schmale Fenster, kommentierter Quellcode und
  `tests/library-discovery-v173.test.mjs` als neue Regression.
